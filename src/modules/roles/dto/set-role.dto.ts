import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SetRoleDto {
  @IsString({ message: 'role must be a string' })
  @IsNotEmpty({ message: 'role is required' })
  role: string;

  @IsString({ message: 'subRole must be a string' })
  @IsOptional()
  subRole?: string;
}
