import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { GoalStatus, GoalType } from '@prisma/client';

export class CreateGoalDto {
  @IsString()
  employeeId: string;

  @IsString()
  cycleId: string;

  @IsOptional()
  @IsString()
  parentGoalId?: string;

  @IsString()
  @MinLength(2)
  title: string;

  @IsEnum(GoalType)
  type: GoalType;

  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weightPercent?: number;
}

export class UpdateGoalProgressDto {
  @IsOptional()
  @IsNumber()
  currentValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
