import { IsArray, IsEnum, IsISO8601, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BiometricEventDto {
  @IsString()
  deviceUserCode: string;

  @IsISO8601()
  timestamp: string;

  @IsEnum(['in', 'out'])
  type: 'in' | 'out';
}

export class BiometricWebhookDto {
  @IsString()
  deviceId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BiometricEventDto)
  events: BiometricEventDto[];
}
