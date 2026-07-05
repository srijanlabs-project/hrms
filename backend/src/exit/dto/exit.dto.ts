import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ClearanceStatus, ExitInitiatedBy, ExitSentiment } from '@prisma/client';

export class CreateExitRequestDto {
  @IsString()
  employeeId: string;

  @IsEnum(ExitInitiatedBy)
  initiatedBy: ExitInitiatedBy;

  @IsDateString()
  resignationDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reasonCategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reasonNotes?: string;
}

export class UpdateLastWorkingDayDto {
  @IsDateString()
  lastWorkingDay: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason: string;
}

class ExitInterviewResponseDto {
  @IsString()
  question: string;

  @IsString()
  @MaxLength(5000)
  answer: string;
}

class ChecklistItemDto {
  @IsString()
  label: string;

  @IsBoolean()
  done: boolean;
}

export class UpdateClearanceTaskDto {
  @IsOptional()
  @IsEnum(ClearanceStatus)
  status?: ClearanceStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklistItems?: ChecklistItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  blockedReason?: string;
}

export class SubmitExitInterviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExitInterviewResponseDto)
  responses: ExitInterviewResponseDto[];

  @IsOptional()
  @IsEnum(ExitSentiment)
  overallSentiment?: ExitSentiment;
}
