import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AnnouncementAudience, RecognitionVisibility } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(10_000)
  body: string;

  @IsOptional()
  @IsEnum(AnnouncementAudience)
  audience?: AnnouncementAudience;

  @IsOptional()
  @IsUUID()
  audienceRefId?: string;
}

export class CreateRecognitionDto {
  @IsString()
  givenToEmployeeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsEnum(RecognitionVisibility)
  visibility?: RecognitionVisibility;
}

class SurveyQuestionDto {
  @IsString()
  id: string;

  @IsString()
  @MaxLength(500)
  text: string;

  @IsEnum(['nps', 'rating', 'text'])
  type: 'nps' | 'rating' | 'text';
}

export class CreateSurveyDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  questions: SurveyQuestionDto[];

  @IsOptional()
  isAnonymous?: boolean;

  @IsString()
  opensAt: string;

  @IsString()
  closesAt: string;
}

class SurveyAnswerDto {
  @IsString()
  questionId: string;

  answer: string | number;
}

export class SubmitSurveyResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyAnswerDto)
  answers: SurveyAnswerDto[];
}
