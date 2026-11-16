import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SaveOwnerDetailsDto {
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString({ message: 'Full name must be a string' })
  @MinLength(3, { message: 'Full name must be at least 3 characters long' })
  @MaxLength(100, { message: 'Full name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z\s\.\-']+$/, {
    message: 'Full name must be a valid NIC-style name containing only letters, spaces, dots, hyphens, or apostrophes',
  })
  fullName: string;

  @IsNotEmpty({ message: 'Email address is required' })
  @IsEmail({}, { message: 'Invalid email address format' })
  email: string;

  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  @Matches(/^(?:(?:\+94|94)|0)?[1-9][0-9]{8}$/, {
    message: 'Invalid Sri Lankan phone number format. Must be a valid 9 or 10-digit number (e.g. 0771234567, +94771234567)',
  })
  phone: string;

  @IsNotEmpty({ message: 'NIC is required' })
  @IsString({ message: 'NIC must be a string' })
  @Matches(/^([0-9]{9}[vVxX]|[0-9]{12})$/, {
    message: 'Invalid Sri Lankan NIC format. Must be either old format (9 digits followed by V/X) or new format (12 digits)',
  })
  nic: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password cannot exceed 128 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/, {
    message: 'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character',
  })
  password: string;

  @IsOptional()
  @IsString({ message: 'Company name must be a string' })
  @MaxLength(150, { message: 'Company name cannot exceed 150 characters' })
  companyName?: string;

  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  @MaxLength(255, { message: 'Address cannot exceed 255 characters' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'Designation must be a string' })
  @MaxLength(100, { message: 'Designation cannot exceed 100 characters' })
  designation?: string;

  @IsOptional()
  @IsString({ message: 'Emergency contact must be a string' })
  @Matches(/^(?:(?:\+94|94)|0)?[1-9][0-9]{8}$/, {
    message: 'Emergency contact must be a valid Sri Lankan phone number format',
  })
  emergencyContact?: string;
}
