import {
  Controller,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { SetRoleDto } from './dto/set-role.dto';
import { SetRoleResponseDto } from './dto/set-role-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
export class UsersRoleController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * PATCH /users/me/role (or /api/v1/users/me/role)
   * Authenticated endpoint to save role selection
   * Owner -> approved immediately
   * Non-Owner -> marked as pending approval
   */
  @Patch('me/role')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setMyRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetRoleDto,
  ): Promise<SetRoleResponseDto> {
    if (!user || !user.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.rolesService.setUserRole(user.userId, dto);
  }
}
