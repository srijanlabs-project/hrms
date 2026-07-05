import { IsEnum, IsISO8601, IsNumber, IsOptional } from 'class-validator';
import { CheckInSource } from '@prisma/client';

export class PunchDto {
  @IsEnum(['check_in', 'check_out'])
  type: 'check_in' | 'check_out';

  @IsEnum(CheckInSource)
  source: CheckInSource;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsISO8601()
  clientTimestamp: string;
}
