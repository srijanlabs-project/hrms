import { IsNotEmpty, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'mobileNumber must be a valid phone number' })
  mobileNumber: string;
}
