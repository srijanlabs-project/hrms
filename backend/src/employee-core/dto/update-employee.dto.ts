import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { EmploymentType, Gender } from '@prisma/client';

// Deliberately hand-written rather than PartialType(CreateEmployeeDto) to avoid
// pulling in @nestjs/mapped-types as an extra dependency for one DTO.
export class UpdateEmployeeDto {
  @IsOptional() @IsString() employeeCode?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
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
