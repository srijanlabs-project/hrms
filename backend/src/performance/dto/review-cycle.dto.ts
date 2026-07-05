import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';
import { CycleStatus } from '@prisma/client';

export class CreateReviewCycleDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsISO8601()
  periodStart: string;

  @IsISO8601()
  periodEnd: string;

  @IsISO8601()
  selfReviewStart: string;

  @IsISO8601()
  selfReviewEnd: string;

  @IsISO8601()
  managerReviewStart: string;

  @IsISO8601()
  managerReviewEnd: string;

  @IsOptional()
  @IsISO8601()
  calibrationStart?: string;

  @IsOptional()
  @IsISO8601()
  calibrationEnd?: string;

  @IsOptional()
  @IsBoolean()
  requireSelfFirst?: boolean;
}

export class UpdateCycleStatusDto {
  @IsEnum(CycleStatus)
  status: CycleStatus;
}
