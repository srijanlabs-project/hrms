import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocType } from '@prisma/client';

// fileUrl is accepted as a pre-uploaded URL for now — real multipart upload +
// object storage (R2/S3, per the stack recommendation) is a follow-up; wiring
// it needs real storage credentials this environment doesn't have.
export class AddDocumentDto {
  @IsEnum(DocType)
  docType: DocType;

  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}
