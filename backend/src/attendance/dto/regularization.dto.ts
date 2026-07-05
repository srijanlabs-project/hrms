import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitRegularizationDto {
  @IsString()
  attendanceRecordId: string;

  @IsOptional()
  @IsISO8601()
  requestedCheckIn?: string;

  @IsOptional()
  @IsISO8601()
  requestedCheckOut?: string;

  @IsString()
  @MinLength(5)
  reason: string;
}
