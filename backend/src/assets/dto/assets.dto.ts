import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AllocationCondition, AssetType } from '@prisma/client';

export class CreateAssetDto {
  @IsString()
  @MaxLength(50)
  assetTag: string;

  @IsEnum(AssetType)
  type: AssetType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  makeModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseValue?: number;
}

export class AllocateAssetDto {
  @IsString()
  employeeId: string;

  @IsOptional()
  @IsDateString()
  allocatedOn?: string;

  @IsOptional()
  @IsDateString()
  expectedReturnOn?: string;
}

export class ReturnAssetDto {
  @IsEnum(AllocationCondition)
  conditionOnReturn: AllocationCondition;

  @IsOptional()
  @IsDateString()
  returnedOn?: string;
}
