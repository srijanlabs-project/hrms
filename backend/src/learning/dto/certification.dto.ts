import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCertificationDto {
  @IsString()
  employeeId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  issuingBody?: string;

  @IsISO8601()
  issuedDate: string;

  @IsOptional()
  @IsISO8601()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}
