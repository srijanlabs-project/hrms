import { IsArray, IsEnum, IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';
import { PayrollRunType, TaxRegime } from '@prisma/client';

export class CreateSalaryStructureDto {
  @IsString()
  name: string;

  @IsArray()
  components: unknown[];
}

export class AssignCompensationDto {
  @IsString()
  employeeId: string;

  @IsString()
  salaryStructureId: string;

  @IsNumber()
  annualCtc: number;

  @IsISO8601()
  effectiveFrom: string;

  @IsOptional()
  @IsEnum(TaxRegime)
  taxRegime?: TaxRegime;
}

export class CreateRunDto {
  @IsString()
  period: string;

  @IsOptional()
  @IsEnum(PayrollRunType)
  runType?: PayrollRunType;
}

export class EditPayslipDto {
  lineItems: object;

  @IsString()
  comment: string;
}
