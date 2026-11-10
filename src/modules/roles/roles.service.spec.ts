import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CMS_ROLES } from './constants/roles.constant';

describe('RolesService (E-08: Roles API)', () => {
  let service: RolesService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      roleModel: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-123', role: 'STAFF' }),
        update: jest.fn().mockResolvedValue({ id: 'user-123', role: 'OWNER' }),
      },
      userRole: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  describe('GET /roles', () => {
    it('should return exactly 8 CMS roles with scopes', async () => {
      const roles = await service.getRoles();
      expect(roles).toHaveLength(8);

      const codes = roles.map((r) => r.code);
      expect(codes).toEqual([
        'OWNER',
        'PROJECT_MANAGER',
        'SITE_SUPERVISOR',
        'ARCHITECT',
        'LABOURER',
        'ACCOUNTANT',
        'STORE_KEEPER',
        'STAFF',
      ]);
    });

    it('should verify Owner has Company Wide scope and requiresApproval: false', async () => {
      const roles = await service.getRoles();
      const owner = roles.find((r) => r.code === 'OWNER');
      expect(owner).toBeDefined();
      expect(owner?.scope).toBe('Company Wide');
      expect(owner?.requiresApproval).toBe(false);
      expect(owner?.tags).toContain('BILLING');
    });

    it('should verify non-owner roles require approval', async () => {
      const roles = await service.getRoles();
      const nonOwners = roles.filter((r) => r.code !== 'OWNER');
      nonOwners.forEach((role) => {
        expect(role.requiresApproval).toBe(true);
      });
    });

    it('should verify Staff role includes sub-roles', async () => {
      const roles = await service.getRoles();
      const staff = roles.find((r) => r.code === 'STAFF');
      expect(staff).toBeDefined();
      expect(staff?.subRoles).toBeDefined();
      expect(staff?.subRoles).toContain('Support Operations');
      expect(staff?.subRoles).toContain('Workforce Administration');
    });
  });

  describe('PATCH /users/me/role', () => {
    describe('Each role selection scenario', () => {
      it('1. OWNER: should be APPROVED and proceedToRegistration: true', async () => {
        const result = await service.setUserRole('user-123', { role: 'OWNER' });
        expect(result.success).toBe(true);
        expect(result.role).toBe('OWNER');
        expect(result.status).toBe('APPROVED');
        expect(result.requiresApproval).toBe(false);
        expect(result.proceedToRegistration).toBe(true);
        expect(result.scope).toBe('Company Wide');
      });

      it('2. PROJECT_MANAGER: should be PENDING and proceedToRegistration: false', async () => {
        const result = await service.setUserRole('user-123', { role: 'PROJECT_MANAGER' });
        expect(result.success).toBe(true);
        expect(result.role).toBe('PROJECT_MANAGER');
        expect(result.status).toBe('PENDING');
        expect(result.requiresApproval).toBe(true);
        expect(result.proceedToRegistration).toBe(false);
        expect(result.scope).toBe('Project Specific');
      });

      it('3. SITE_SUPERVISOR: should be PENDING', async () => {
        const result = await service.setUserRole('user-123', { role: 'SITE_SUPERVISOR' });
        expect(result.role).toBe('SITE_SUPERVISOR');
        expect(result.status).toBe('PENDING');
        expect(result.scope).toBe('Job Site');
      });

      it('4. ARCHITECT: should be PENDING', async () => {
        const result = await service.setUserRole('user-123', { role: 'ARCHITECT' });
        expect(result.role).toBe('ARCHITECT');
        expect(result.status).toBe('PENDING');
        expect(result.scope).toBe('Design Dept');
      });

      it('5. LABOURER: should be PENDING', async () => {
        const result = await service.setUserRole('user-123', { role: 'LABOURER' });
        expect(result.role).toBe('LABOURER');
        expect(result.status).toBe('PENDING');
        expect(result.scope).toBe('Field Works');
      });

      it('6. ACCOUNTANT: should be PENDING', async () => {
        const result = await service.setUserRole('user-123', { role: 'ACCOUNTANT' });
        expect(result.role).toBe('ACCOUNTANT');
        expect(result.status).toBe('PENDING');
        expect(result.scope).toBe('HQ Office');
      });

      it('7. STORE_KEEPER: should be PENDING', async () => {
        const result = await service.setUserRole('user-123', { role: 'STORE_KEEPER' });
        expect(result.role).toBe('STORE_KEEPER');
        expect(result.status).toBe('PENDING');
        expect(result.scope).toBe('Warehouse');
      });

      it('8. STAFF (with sub-role): should be PENDING and preserve subRole', async () => {
        const result = await service.setUserRole('user-123', {
          role: 'STAFF',
          subRole: 'Support Operations',
        });
        expect(result.role).toBe('STAFF');
        expect(result.subRole).toBe('Support Operations');
        expect(result.status).toBe('PENDING');
        expect(result.scope).toBe('HQ Office');
      });
    });

    describe('Invalid role testing', () => {
      it('should throw BadRequestException when role is unknown', async () => {
        await expect(service.setUserRole('user-123', { role: 'SUPER_ADMIN' })).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException when role is empty', async () => {
        await expect(service.setUserRole('user-123', { role: '' })).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });
});
