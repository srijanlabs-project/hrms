import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitSelfReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  selfRating: number;

  @IsOptional()
  @IsString()
  selfComments?: string;
}

export class SubmitManagerReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  managerRating: number;

  @IsOptional()
  @IsString()
  managerComments?: string;
}

export class CalibrateReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  calibratedRating: number;
}
