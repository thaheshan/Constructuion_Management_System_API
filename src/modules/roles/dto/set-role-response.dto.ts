export class SetRoleResponseDto {
  success: boolean;
  message: string;
  role: string;
  subRole?: string;
  scope: string;
  status: 'APPROVED' | 'PENDING';
  requiresApproval: boolean;
  proceedToRegistration: boolean;
  updatedAt: string;
}
