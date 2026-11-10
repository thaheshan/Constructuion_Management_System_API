import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { UsersRoleController } from './users-role.controller';
import { RolesService } from './roles.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('Roles & UsersRole Controllers (E-08: Roles API)', () => {
  let rolesController: RolesController;
  let usersRoleController: UsersRoleController;
  let rolesService: RolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController, UsersRoleController],
      providers: [
        RolesService,
        {
          provide: PrismaService,
          useValue: {
            roleModel: {
              findMany: jest.fn().mockResolvedValue([]),
              upsert: jest.fn().mockResolvedValue({}),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ id: 'user-001' }),
              update: jest.fn().mockResolvedValue({ id: 'user-001' }),
            },
            userRole: {
              upsert: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    rolesController = module.get<RolesController>(RolesController);
    usersRoleController = module.get<UsersRoleController>(UsersRoleController);
    rolesService = module.get<RolesService>(RolesService);
  });

  describe('GET /roles', () => {
    it('should return all 8 roles', async () => {
      const roles = await rolesController.getRoles();
      expect(roles).toHaveLength(8);
      expect(roles[0].code).toBe('OWNER');
    });
  });

  describe('PATCH /users/me/role', () => {
    it('should successfully save OWNER role and return APPROVED status', async () => {
      const authUser = { userId: 'user-001', email: 'owner@construction.lk', role: 'STAFF' };
      const response = await usersRoleController.setMyRole(authUser, { role: 'OWNER' });

      expect(response.success).toBe(true);
      expect(response.role).toBe('OWNER');
      expect(response.status).toBe('APPROVED');
      expect(response.proceedToRegistration).toBe(true);
    });

    it('should successfully save PROJECT_MANAGER role and return PENDING status', async () => {
      const authUser = { userId: 'user-001', email: 'pm@construction.lk', role: 'STAFF' };
      const response = await usersRoleController.setMyRole(authUser, { role: 'PROJECT_MANAGER' });

      expect(response.success).toBe(true);
      expect(response.role).toBe('PROJECT_MANAGER');
      expect(response.status).toBe('PENDING');
      expect(response.proceedToRegistration).toBe(false);
      expect(response.requiresApproval).toBe(true);
    });

    it('should throw UnauthorizedException on unauthenticated call', async () => {
      await expect(
        usersRoleController.setMyRole(null as any, { role: 'OWNER' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException on invalid role selection', async () => {
      const authUser = { userId: 'user-001', email: 'test@construction.lk', role: 'STAFF' };
      await expect(
        usersRoleController.setMyRole(authUser, { role: 'INVALID_ROLE_XYZ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
