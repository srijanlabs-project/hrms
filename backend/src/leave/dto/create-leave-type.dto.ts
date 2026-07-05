import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApplicableGender, LeaveAccrualFrequency } from '@prisma/client';

export class CreateLeaveTypeDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsEnum(LeaveAccrualFrequency)
  accrualFrequency?: LeaveAccrualFrequency;

  @IsOptional()
  @IsNumber()
  accrualRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  accrualDayOfMonth?: number;

  @IsOptional()
  @IsNumber()
  maxBalance?: number;

  @IsOptional()
  @IsNumber()
  maxCarryForward?: number;

  @IsOptional()
  @IsBoolean()
  encashable?: boolean;

  @IsOptional()
  @IsNumber()
  encashmentMaxDays?: number;

  @IsOptional()
  @IsInt()
  requiresDocumentAboveDays?: number;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;

  @IsOptional()
  @IsBoolean()
  allowHalfDay?: boolean;

  @IsOptional()
  @IsInt()
  minDaysNotice?: number;

  @IsOptional()
  @IsInt()
  maxConsecutiveDays?: number;

  @IsOptional()
  @IsEnum(ApplicableGender)
  applicableGender?: ApplicableGender;

  @IsOptional()
  @IsArray()
  applicableEmploymentTypes?: string[];
}
