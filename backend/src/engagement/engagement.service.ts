import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors/app-error';
import { RequestUser } from '../common/auth/request-user';
import { SystemRole } from '../common/auth/roles.enum';
import { CreateAnnouncementDto, CreateRecognitionDto, CreateSurveyDto, SubmitSurveyResponseDto } from './dto/engagement.dto';

const POSTGRES_UNIQUE_VIOLATION = 'P2002';

/**
 * PRIVACY INVARIANT (Engagement spec §3): when survey.isAnonymous === true,
 * SurveyResponse.employeeId must be null on every write path in this file —
 * never persisted, not merely filtered out of read responses. SurveyHasResponded
 * exists ONLY for duplicate-check/response-rate purposes and must NEVER be
 * joined back to SurveyResponse in either direction, anonymous or not. If you
 * touch submitResponse() or getResults() below, re-read this comment and verify
 * the invariant still holds before committing.
 */
@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Announcements
  // ---------------------------------------------------------------------

  async createAnnouncement(tenantId: string, actingUser: RequestUser, dto: CreateAnnouncementDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.announcement.create({
        data: {
          tenantId,
          title: dto.title,
          body: dto.body,
          audience: dto.audience ?? 'all',
          audienceRefId: dto.audienceRefId,
          publishedAt: new Date(),
          createdByUserId: actingUser.userId,
        },
      }),
    );
  }

  async listAnnouncements(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.announcement.findMany({ where: { tenantId }, orderBy: { publishedAt: 'desc' } }),
    );
  }

  // ---------------------------------------------------------------------
  // Recognitions
  // ---------------------------------------------------------------------

  async createRecognition(tenantId: string, actingUser: RequestUser, dto: CreateRecognitionDto) {
    if (!actingUser.employeeId) {
      throw AppErrors.badRequest('REQUESTER_NOT_LINKED_TO_EMPLOYEE', 'Giving recognition requires a linked employee record');
    }
    if (actingUser.employeeId === dto.givenToEmployeeId) {
      throw AppErrors.badRequest('SELF_RECOGNITION', 'You cannot give recognition to yourself');
    }
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.recognition.create({
        data: {
          tenantId,
          givenByEmployeeId: actingUser.employeeId!,
          givenToEmployeeId: dto.givenToEmployeeId,
          category: dto.category,
          message: dto.message,
          visibility: dto.visibility ?? 'public',
        },
      }),
    );
  }

  async listRecognitions(tenantId: string, actingUser: RequestUser) {
    const canSeeManagerOnly = actingUser.roleName === SystemRole.MANAGER || actingUser.roleName === SystemRole.HR_ADMIN;
    return this.prisma.withTenant(tenantId, async (tx) => {
      const recognitions = await tx.recognition.findMany({
        // Filtered in the service layer (not just the controller) so any future
        // caller of this method inherits the same visibility rule automatically.
        where: { tenantId, visibility: canSeeManagerOnly ? undefined : 'public' },
        orderBy: { createdAt: 'desc' },
      });
      const employeeIds = [...new Set([...recognitions.map((r) => r.givenByEmployeeId), ...recognitions.map((r) => r.givenToEmployeeId)])];
      const employees = await tx.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, firstName: true, lastName: true } });
      const byId = new Map(employees.map((e) => [e.id, e]));
      return recognitions.map((r) => ({
        ...r,
        givenBy: byId.get(r.givenByEmployeeId) ?? null,
        givenTo: byId.get(r.givenToEmployeeId) ?? null,
      }));
    });
  }

  // ---------------------------------------------------------------------
  // Surveys
  // ---------------------------------------------------------------------

  async createSurvey(tenantId: string, dto: CreateSurveyDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.survey.create({
        data: {
          tenantId,
          title: dto.title,
          questions: dto.questions as unknown as Prisma.InputJsonValue,
          isAnonymous: dto.isAnonymous ?? true,
          opensAt: new Date(dto.opensAt),
          closesAt: new Date(dto.closesAt),
        },
      }),
    );
  }

  async listSurveys(tenantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const surveys = await tx.survey.findMany({ where: { tenantId }, orderBy: { opensAt: 'desc' } });
      // SurveyHasResponded (not SurveyResponse) is the correct count source even
      // for non-anonymous surveys — see the anonymity design note above: never
      // join SurveyResponse back to who-responded for a count either.
      const counts = await tx.surveyHasResponded.groupBy({ by: ['surveyId'], where: { surveyId: { in: surveys.map((s) => s.id) } }, _count: true });
      const countBySurvey = new Map(counts.map((c) => [c.surveyId, c._count]));
      return surveys.map((s) => ({ ...s, responseCount: countBySurvey.get(s.id) ?? 0 }));
    });
  }

  async submitResponse(tenantId: string, surveyId: string, actingUser: RequestUser, dto: SubmitSurveyResponseDto) {
    if (!actingUser.employeeId) {
      throw AppErrors.badRequest('REQUESTER_NOT_LINKED_TO_EMPLOYEE', 'Submitting a survey response requires a linked employee record');
    }
    const employeeId = actingUser.employeeId;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const survey = await tx.survey.findUnique({ where: { id: surveyId } });
      if (!survey) throw AppErrors.notFound('SURVEY_NOT_FOUND', 'Survey not found');

      const now = new Date();
      if (now < survey.opensAt || now > survey.closesAt) {
        throw AppErrors.badRequest('SURVEY_CLOSED', 'This survey is not currently open for responses');
      }

      // Duplicate-check happens via SurveyHasResponded ONLY — never by looking at
      // SurveyResponse rows (which, for an anonymous survey, carry no employeeId
      // to check against anyway).
      try {
        await tx.surveyHasResponded.create({ data: { surveyId, employeeId } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === POSTGRES_UNIQUE_VIOLATION) {
          throw AppErrors.conflict('DUPLICATE_RESPONSE', 'You have already responded to this survey');
        }
        throw err;
      }

      // PRIVACY: employeeId is only ever included when the survey is NOT
      // anonymous. For an anonymous survey this is `undefined` on the Prisma
      // create call, i.e. the column is left at its schema default (null) —
      // it is never written and then hidden later.
      return tx.surveyResponse.create({
        data: {
          surveyId,
          employeeId: survey.isAnonymous ? undefined : employeeId,
          answers: dto.answers as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, surveyId: true, submittedAt: true },
      });
    });
  }

  async getResults(tenantId: string, surveyId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const survey = await tx.survey.findUnique({ where: { id: surveyId } });
      if (!survey) throw AppErrors.notFound('SURVEY_NOT_FOUND', 'Survey not found');

      // Only ever select `answers` — never `employeeId` — regardless of whether
      // the survey is anonymous, so there is no per-employee mapping possible
      // even accidentally. SurveyHasResponded is used here only to report a
      // response COUNT, never joined to these rows.
      const responses = await tx.surveyResponse.findMany({
        where: { surveyId },
        select: { answers: true },
      });
      const responseCount = await tx.surveyHasResponded.count({ where: { surveyId } });

      const questions = survey.questions as unknown as { id: string; text: string; type: 'nps' | 'rating' | 'text' }[];
      const results = questions.map((q) => {
        const values = responses
          .map((r) => (r.answers as unknown as { questionId: string; answer: string | number }[]).find((a) => a.questionId === q.id)?.answer)
          .filter((v) => v !== undefined);

        if (q.type === 'text') {
          const shuffled = [...values].sort(() => Math.random() - 0.5);
          return { questionId: q.id, text: q.text, type: q.type, freeTextResponses: shuffled };
        }

        const numeric = values.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
        const average = numeric.length > 0 ? numeric.reduce((s, v) => s + v, 0) / numeric.length : null;
        return { questionId: q.id, text: q.text, type: q.type, average, responseCount: numeric.length };
      });

      return { surveyId, title: survey.title, isAnonymous: survey.isAnonymous, totalResponses: responseCount, results };
    });
  }

  // ---------------------------------------------------------------------
  // Birthday / anniversary announcements — daily cron across all tenants
  // ---------------------------------------------------------------------

  @Cron('0 4 * * *')
  async birthdayAnniversaryAnnouncementsJob() {
    await this.prisma.withoutTenantScope(async (tx) => {
      const today = new Date();
      const month = today.getUTCMonth() + 1;
      const day = today.getUTCDate();

      const employees = await tx.employee.findMany({
        where: { employmentStatus: { in: ['active', 'on_notice'] } },
        select: { id: true, tenantId: true, firstName: true, lastName: true, dateOfBirth: true, dateOfJoining: true, birthdayOptOut: true },
      });

      const byTenant = new Map<string, typeof employees>();
      for (const e of employees) {
        if (!byTenant.has(e.tenantId)) byTenant.set(e.tenantId, []);
        byTenant.get(e.tenantId)!.push(e);
      }

      for (const [tenantId, tenantEmployees] of byTenant) {
        const hrAdmin = await tx.user.findFirst({ where: { tenantId, role: { name: 'HR Admin' } } });
        if (!hrAdmin) {
          this.logger.warn(`No HR Admin user found for tenant ${tenantId} — skipping birthday/anniversary announcements for this tenant`);
          continue;
        }

        for (const e of tenantEmployees) {
          const name = `${e.firstName} ${e.lastName ?? ''}`.trim();

          if (!e.birthdayOptOut && e.dateOfBirth && e.dateOfBirth.getUTCMonth() + 1 === month && e.dateOfBirth.getUTCDate() === day) {
            await tx.announcement.create({
              data: {
                tenantId,
                title: `Happy Birthday, ${name}!`,
                body: `Please join us in wishing ${name} a very happy birthday today.`,
                audience: 'all',
                publishedAt: new Date(),
                createdByUserId: hrAdmin.id,
              },
            });
          }

          if (e.dateOfJoining.getUTCMonth() + 1 === month && e.dateOfJoining.getUTCDate() === day) {
            const years = today.getUTCFullYear() - e.dateOfJoining.getUTCFullYear();
            if (years > 0) {
              await tx.announcement.create({
                data: {
                  tenantId,
                  title: `Work Anniversary: ${name}`,
                  body: `${name} is celebrating ${years} year${years === 1 ? '' : 's'} with us today. Congratulations!`,
                  audience: 'all',
                  publishedAt: new Date(),
                  createdByUserId: hrAdmin.id,
                },
              });
            }
          }
        }
      }
    });
  }
}
