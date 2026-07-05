import { IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { EmploymentType, Gender } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  employeeCode: string;

  @IsString()
  firstName: string;

  // Mandatory Indian KYC — required for statutory filings (TDS needs PAN, PF/UAN
  // needs Aadhaar-linked KYC). Required here even though nullable in the DB,
  // since pre_boarding employees from the Recruitment hire handoff don't go
  // through this endpoint.
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'panNumber must be a valid PAN (e.g. ABCDE1234F)' })
  panNumber: string;

  @IsString()
  @Matches(/^[0-9]{12}$/, { message: 'aadhaarNumber must be exactly 12 digits' })
  aadhaarNumber: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  designationId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsDateString()
  dateOfJoining: string;

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsOptional()
  @IsString()
  workLocationId?: string;
}
