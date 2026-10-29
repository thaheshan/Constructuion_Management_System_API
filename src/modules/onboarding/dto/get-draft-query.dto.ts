import { IsOptional, IsString } from 'class-validator';

export class GetDraftQueryDto {
  @IsOptional()
  @IsString()
  identifier?: string;
}
