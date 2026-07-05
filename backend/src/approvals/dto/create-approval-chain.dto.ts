import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalApplicability } from '@prisma/client';

class ApprovalStepDto {
  @IsEnum(['manager', 'role', 'specific_user'])
  approverType: 'manager' | 'role' | 'specific_user';

  @IsOptional()
  roleId?: string;

  @IsOptional()
  userId?: string;

  @IsOptional()
  escalationHours?: number;
}

export class CreateApprovalChainDto {
  @IsNotEmpty()
  name: string;

  @IsEnum(ApprovalApplicability)
  appliesTo: ApprovalApplicability;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepDto)
  steps: ApprovalStepDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
