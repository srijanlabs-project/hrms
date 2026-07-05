import { ArrayMinSize, IsArray, IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Exactly one of employeeIds or departmentId must be provided (validated in the service —
 * class-validator can't easily express "exactly one of" across two optional fields). */
export class CreateTrainingAssignmentDto {
  @IsString()
  courseId: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  employeeIds?: string[];

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}

export class CompleteTrainingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  feedbackRating?: number;

  @IsOptional()
  @IsString()
  feedbackComments?: string;
}
