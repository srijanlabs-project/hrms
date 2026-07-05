import { IsEnum, IsOptional, IsString } from 'class-validator';

export class DecisionDto {
  @IsEnum(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  comment?: string;
}
