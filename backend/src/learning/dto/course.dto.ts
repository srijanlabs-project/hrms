import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  contentUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableDepartmentIds?: string[];
}
