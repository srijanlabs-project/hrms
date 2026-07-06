import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDelegationDto {
  @IsString()
  delegateEmployeeId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
