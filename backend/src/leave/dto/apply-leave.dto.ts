import { IsBoolean, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class ApplyLeaveDto {
  @IsString()
  leaveTypeId: string;

  @IsISO8601()
  startDate: string;

  @IsISO8601()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  isStartHalfDay?: boolean;

  @IsOptional()
  @IsBoolean()
  isEndHalfDay?: boolean;

  @IsString()
  @MinLength(5)
  reason: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsString()
  onBehalfOfEmployeeId?: string;
}
