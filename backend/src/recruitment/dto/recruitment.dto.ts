import { IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CandidateSource, CandidateStage, EmploymentType, InterviewRecommendation } from '@prisma/client';

export class CreateRequisitionDto {
  @IsString()
  title: string;

  @IsString()
  departmentId: string;

  @IsInt()
  @Min(1)
  headcount: number;

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsOptional()
  @IsNumber()
  budgetCtcMax?: number;

  @IsOptional()
  @IsDateString()
  targetCloseDate?: string;
}

export class CreateCandidateDto {
  @IsString()
  requisitionId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsEnum(CandidateSource)
  source?: CandidateSource;

  @IsOptional()
  @IsString()
  referredByEmployeeId?: string;
}

export class StageChangeDto {
  @IsEnum(CandidateStage)
  toStage: CandidateStage;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ScheduleInterviewDto {
  @IsArray()
  @IsString({ each: true })
  interviewerIds: string[];

  @IsDateString()
  scheduledAt: string;
}

class ScorecardItemDto {
  @IsString()
  criterion: string;

  @IsInt()
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SubmitScorecardDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScorecardItemDto)
  scorecard: ScorecardItemDto[];

  @IsEnum(InterviewRecommendation)
  recommendation: InterviewRecommendation;
}

export class CreateOfferDto {
  @IsString()
  candidateId: string;

  @IsString()
  salaryStructureId: string;

  @IsNumber()
  annualCtc: number;

  @IsDateString()
  proposedDoj: string;
}

export class SendOfferDto {
  @IsOptional()
  @IsInt()
  expiryDays?: number;
}
