import { IsNotEmpty, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/)
  mobileNumber: string;

  @IsNotEmpty()
  @Length(4, 8)
  otp: string;
}
