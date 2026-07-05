import { IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { EmploymentType, Gender } from '@prisma/client';

// Deliberately hand-written rather than PartialType(CreateEmployeeDto) to avoid
// pulling in @nestjs/mapped-types as an extra dependency for one DTO.
export class UpdateEmployeeDto {
  @IsOptional() @IsString() employeeCode?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'panNumber must be a valid PAN (e.g. ABCDE1234F)' }) panNumber?: string;
  @IsOptional() @Matches(/^[0-9]{12}$/, { message: 'aadhaarNumber must be exactly 12 digits' }) aadhaarNumber?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() personalEmail?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() designationId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsDateString() dateOfJoining?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsString() workLocationId?: string;
}
