import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RoleResponseDto } from './dto/role-response.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * GET /roles (or /api/v1/roles)
   * Returns all 8 roles with scope and permissions
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getRoles(): Promise<RoleResponseDto[]> {
    return this.rolesService.getRoles();
  }
}
