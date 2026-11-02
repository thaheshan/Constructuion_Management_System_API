export class RoleResponseDto {
  id: string;
  code: string;
  name: string;
  description: string;
  scope: string;
  tags: string[];
  requiresApproval: boolean;
  subRoles?: string[];
}

export class RolesListResponseDto {
  total: number;
  roles: RoleResponseDto[];
}
