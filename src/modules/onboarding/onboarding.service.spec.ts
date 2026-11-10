import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, OnboardingStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: any;
  let jwtService: any;

  const validPassword = 'SecurePassword123!';

  const baseDto = {
    fullName: 'K. A. Sunil Shantha Perera',
    email: 'sunil.perera@construction.lk',
    phone: '0771234567',
    nic: '198512345678',
    password: validPassword,
    companyName: 'Perera Builders (Pvt) Ltd',
    address: '123 Galle Road, Colombo 03',
    designation: 'Managing Director & Owner',
    emergencyContact: '0719876543',
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ownerDetail: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      onboardingDraft: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mocked-onboarding-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  describe('canonicalizePhone helper', () => {
    it('should format 10-digit 07XXXXXXXX to +947XXXXXXXX', () => {
      expect(service.canonicalizePhone('0771234567')).toBe('+94771234567');
      expect(service.canonicalizePhone('0712345678')).toBe('+94712345678');
    });

    it('should format 11-digit 94XXXXXXXXX to +94XXXXXXXXX', () => {
      expect(service.canonicalizePhone('94771234567')).toBe('+94771234567');
    });

    it('should preserve +94XXXXXXXXX format', () => {
      expect(service.canonicalizePhone('+94771234567')).toBe('+94771234567');
    });
  });

  describe('saveOwnerDetails (Scenario: An Owner saves Step 1)', () => {
    it('should successfully bootstrap initial Master Owner when no master owner exists', async () => {
      // No existing master owner in DB
      prisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const createdUser = {
        id: 'new-owner-uuid-1',
        fullName: baseDto.fullName,
        email: baseDto.email.toLowerCase(),
        phone: '+94771234567',
        nic: baseDto.nic,
        role: Role.OWNER,
        isMasterOwner: true,
        passwordHash: 'hashed-password-123',
      };
      prisma.user.create.mockResolvedValue(createdUser);

      const createdOwnerDetail = {
        id: 'owner-detail-uuid-1',
        userId: createdUser.id,
        companyName: baseDto.companyName,
        designation: baseDto.designation,
        emergencyContact: '+94719876543',
        address: baseDto.address,
      };
      prisma.ownerDetail.upsert.mockResolvedValue(createdOwnerDetail);

      const createdDraft = {
        id: 'draft-uuid-1',
        userId: createdUser.id,
        email: createdUser.email,
        step: 1,
        status: OnboardingStatus.IN_PROGRESS,
        data: {
          step: 1,
          fullName: baseDto.fullName,
          email: createdUser.email,
          phone: '+94771234567',
          nic: baseDto.nic,
          isMasterOwner: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.onboardingDraft.findFirst.mockResolvedValue(null);
      prisma.onboardingDraft.create.mockResolvedValue(createdDraft);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-uuid-1' });

      const result = await service.saveOwnerDetails(baseDto, undefined, '127.0.0.1', 'JestTestRunner');

      expect(result.success).toBe(true);
      expect(result.step).toBe(1);
      expect(result.status).toBe(OnboardingStatus.IN_PROGRESS);
      expect(result.owner.isMasterOwner).toBe(true);
      expect(result.owner.role).toBe(Role.OWNER);
      expect(result.tokens.accessToken).toBe('mocked-onboarding-jwt-token');

      // Verify User was created with isMasterOwner: true
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'sunil.perera@construction.lk',
            phone: '+94771234567',
            nic: '198512345678',
            role: Role.OWNER,
            isMasterOwner: true,
          }),
        }),
      );

      // Verify audit log recorded
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'OWNER_CREATED',
            resource: 'onboarding',
          }),
        }),
      );
    });

    it('should reject unauthenticated owner creation when a Master Owner already exists', async () => {
      // Existing master owner found
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 'existing-master-owner-id',
        email: 'master@construction.lk',
        isMasterOwner: true,
      });

      await expect(
        service.saveOwnerDetails(baseDto, undefined),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject owner onboarding action by a non-Owner authenticated caller (privilege escalation prevention)', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'master-owner' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'supervisor-user-id',
        role: Role.SITE_SUPERVISOR, // Non-owner
      });

      await expect(
        service.saveOwnerDetails(baseDto, { userId: 'supervisor-user-id', role: 'SITE_SUPERVISOR' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not overwrite credentials or role when an authenticated Owner updates their draft', async () => {
      const existingOwner = {
        id: 'auth-owner-id',
        email: baseDto.email.toLowerCase(),
        phone: '+94771112233',
        nic: '198011122233',
        passwordHash: 'original-secret-hash',
        role: Role.OWNER,
        isMasterOwner: true,
      };

      prisma.user.findFirst.mockResolvedValueOnce(existingOwner);
      prisma.user.findUnique.mockResolvedValue(existingOwner);
      prisma.ownerDetail.upsert.mockResolvedValue({ id: 'detail-1' });
      prisma.onboardingDraft.findFirst.mockResolvedValue({
        id: 'draft-1',
        userId: existingOwner.id,
        step: 1,
        status: OnboardingStatus.IN_PROGRESS,
      });
      prisma.onboardingDraft.update.mockResolvedValue({
        id: 'draft-1',
        step: 1,
        status: OnboardingStatus.IN_PROGRESS,
        data: {},
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.saveOwnerDetails(
        {
          ...baseDto,
          password: 'AttemptedNewPassword123!', // Should NOT overwrite credentials
        },
        { userId: existingOwner.id, role: Role.OWNER },
      );

      expect(result.success).toBe(true);
      // User update should NOT have been called with new credentials
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.owner.role).toBe(Role.OWNER);
      expect(result.owner.isMasterOwner).toBe(true);
    });

    it('should throw generic ConflictException if an unauthenticated registration conflicts with existing account', async () => {
      // No master owner yet, but an existing user shares phone/email/nic
      prisma.user.findFirst
        .mockResolvedValueOnce(null) // no master owner
        .mockResolvedValueOnce({ id: 'some-user', email: baseDto.email.toLowerCase() }); // account conflict

      await expect(service.saveOwnerDetails(baseDto, undefined)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getDraft (Scenario: Resume progress / Resume after logout)', () => {
    it('should resume progress when an authenticated owner calls getDraft', async () => {
      const userId = 'logged-in-owner-uuid';
      const user = {
        id: userId,
        fullName: 'Sunil Shantha Perera',
        email: 'sunil@construction.lk',
        phone: '+94771234567',
        nic: '198512345678',
        role: Role.OWNER,
        isMasterOwner: true,
        ownerDetail: {
          id: 'detail-uuid',
          companyName: 'Perera Builders',
        },
      };
      prisma.user.findUnique.mockResolvedValue(user);

      const draft = {
        id: 'draft-uuid-1',
        userId,
        step: 1,
        status: OnboardingStatus.IN_PROGRESS,
        data: {
          step: 1,
          fullName: 'Sunil Shantha Perera',
          email: 'sunil@construction.lk',
          phone: '+94771234567',
          nic: '198512345678',
          isMasterOwner: true,
          companyName: 'Perera Builders',
        },
        createdAt: new Date('2026-10-29T10:00:00Z'),
        updatedAt: new Date('2026-10-29T10:05:00Z'),
      };
      prisma.onboardingDraft.findFirst.mockResolvedValue(draft);

      const result = await service.getDraft(userId);

      expect(result.success).toBe(true);
      expect(result.step).toBe(1);
      expect(result.status).toBe(OnboardingStatus.IN_PROGRESS);
      expect(result.owner?.fullName).toBe('Sunil Shantha Perera');
      expect(result.owner?.isMasterOwner).toBe(true);
      expect(result.draft.data).toEqual(draft.data);
    });

    it('should throw UnauthorizedException when authenticatedUserId is missing', async () => {
      await expect(service.getDraft('')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when no draft exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-no-draft' });
      prisma.onboardingDraft.findFirst.mockResolvedValue(null);

      await expect(service.getDraft('user-no-draft')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Full Scenario: Resume After Logout', () => {
    it('should allow owner to save draft, simulate logout, and resume draft upon re-authentication', async () => {
      // 1. Initial Step 1 Save (no master owner)
      prisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const ownerUser = {
        id: 'persisted-owner-uuid',
        fullName: baseDto.fullName,
        email: baseDto.email.toLowerCase(),
        phone: '+94771234567',
        nic: baseDto.nic,
        role: Role.OWNER,
        isMasterOwner: true,
        passwordHash: await bcrypt.hash(validPassword, 10),
      };
      prisma.user.create.mockResolvedValue(ownerUser);
      prisma.ownerDetail.upsert.mockResolvedValue({
        id: 'detail-id-1',
        userId: ownerUser.id,
      });

      const storedDraft = {
        id: 'persisted-draft-uuid',
        userId: ownerUser.id,
        email: ownerUser.email,
        step: 1,
        status: OnboardingStatus.IN_PROGRESS,
        data: {
          step: 1,
          fullName: baseDto.fullName,
          email: ownerUser.email,
          phone: '+94771234567',
          nic: baseDto.nic,
          isMasterOwner: true,
          companyName: baseDto.companyName,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.onboardingDraft.findFirst.mockResolvedValue(null);
      prisma.onboardingDraft.create.mockResolvedValue(storedDraft);
      prisma.refreshToken.create.mockResolvedValue({});

      const saveResponse = await service.saveOwnerDetails(baseDto);
      expect(saveResponse.success).toBe(true);
      expect(saveResponse.step).toBe(1);

      // 2. Simulate Logout (session ended)
      // 3. User Logs Back In -> Receives new JWT token with sub: ownerUser.id
      // 4. User requests GET /onboarding/draft using authenticated token
      prisma.user.findUnique.mockResolvedValue({
        ...ownerUser,
        ownerDetail: { id: 'detail-id-1', companyName: baseDto.companyName },
      });
      prisma.onboardingDraft.findFirst.mockResolvedValue(storedDraft);

      const resumeResponse = await service.getDraft(ownerUser.id);

      expect(resumeResponse.success).toBe(true);
      expect(resumeResponse.step).toBe(1);
      expect(resumeResponse.status).toBe(OnboardingStatus.IN_PROGRESS);
      expect(resumeResponse.owner?.id).toBe(ownerUser.id);
      expect(resumeResponse.owner?.isMasterOwner).toBe(true);
      expect((resumeResponse.draft.data as any)?.companyName).toBe(baseDto.companyName);
    });
  });
});
