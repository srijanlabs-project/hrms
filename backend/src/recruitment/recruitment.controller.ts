import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import {
  CreateCandidateDto, CreateOfferDto, CreateRequisitionDto, ScheduleInterviewDto, SendOfferDto, StageChangeDto, SubmitScorecardDto,
} from './dto/recruitment.dto';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequestUser } from '../common/auth/request-user';
import { Roles } from '../common/auth/roles.decorator';
import { SystemRole } from '../common/auth/roles.enum';
import { DecisionDto } from '../approvals/dto/decision.dto';

@Controller('api/v1')
export class RecruitmentController {
  constructor(private readonly recruitment: RecruitmentService) {}

  @Roles(SystemRole.HR_ADMIN)
  @Post('job-requisitions')
  createRequisition(@CurrentUser() user: RequestUser, @Body() dto: CreateRequisitionDto) {
    return this.recruitment.createRequisition(user.tenantId!, user, dto);
  }

  @Get('job-requisitions')
  listRequisitions(@CurrentUser() user: RequestUser) {
    return this.recruitment.listRequisitions(user.tenantId!);
  }

  @Patch('job-requisitions/:id/decision')
  decideRequisition(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.recruitment.decideRequisition(user.tenantId!, id, user, dto.decision, dto.comment);
  }

  @Post('candidates')
  createCandidate(@CurrentUser() user: RequestUser, @Body() dto: CreateCandidateDto) {
    return this.recruitment.createCandidate(user.tenantId!, dto);
  }

  @Get('candidates')
  listCandidates(@CurrentUser() user: RequestUser, @Query('requisitionId') requisitionId?: string) {
    return this.recruitment.listCandidates(user.tenantId!, requisitionId);
  }

  @Patch('candidates/:id/stage')
  changeStage(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: StageChangeDto) {
    return this.recruitment.changeStage(user.tenantId!, id, dto);
  }

  @Post('candidates/:id/interviews')
  scheduleInterview(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ScheduleInterviewDto) {
    return this.recruitment.scheduleInterview(user.tenantId!, id, dto);
  }

  @Post('interview-feedback/:id/submit')
  submitScorecard(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: SubmitScorecardDto) {
    return this.recruitment.submitScorecard(user.tenantId!, id, dto);
  }

  @Post('offers')
  createOffer(@CurrentUser() user: RequestUser, @Body() dto: CreateOfferDto) {
    return this.recruitment.createOffer(user.tenantId!, user, dto);
  }

  @Post('offers/:id/send')
  sendOffer(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: SendOfferDto) {
    return this.recruitment.sendOffer(user.tenantId!, id, dto);
  }

  @Post('offers/:id/accept')
  acceptOffer(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.recruitment.acceptOffer(user.tenantId!, id);
  }

  @Post('offers/:id/decline')
  declineOffer(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.recruitment.declineOffer(user.tenantId!, id);
  }
}
