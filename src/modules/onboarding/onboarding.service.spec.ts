import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
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
    isMasterOwner: true,
    companyName: 'Perera Builders (Pvt) Ltd',
    address: '123 Galle Road, Colombo 03',
    designation: 'Managing Director & Owner',
    emergencyContact: '0719876543',
  };

  beforeEach(async () => {
    prisma = {
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
    it('should successfully save Step 1 owner details and draft for a new owner with Master Owner flag', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

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
        isMasterOwner: true,
        nicName: baseDto.fullName,
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
        status: 'IN_PROGRESS',
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
      expect(result.status).toBe('IN_PROGRESS');
      expect(result.owner.isMasterOwner).toBe(true);
      expect(result.owner.role).toBe(Role.OWNER);
      expect(result.ownerDetail.isMasterOwner).toBe(true);
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

      // Verify OwnerDetail was upserted with Master Owner flag
      expect(prisma.ownerDetail.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: createdUser.id },
          create: expect.objectContaining({
            isMasterOwner: true,
            nicName: baseDto.fullName,
          }),
        }),
      );

      // Verify OnboardingDraft was created
      expect(prisma.onboardingDraft.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: createdUser.id,
            step: 1,
            status: 'IN_PROGRESS',
          }),
        }),
      );
    });

    it('should allow setting isMasterOwner to false if explicitly provided', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const createdUser = {
        id: 'owner-partner-uuid',
        fullName: 'Nimal Silva',
        email: 'nimal@construction.lk',
        phone: '+94772223344',
        nic: '199012345678',
        role: Role.OWNER,
        isMasterOwner: false,
      };
      prisma.user.create.mockResolvedValue(createdUser);
      prisma.ownerDetail.upsert.mockResolvedValue({
        id: 'detail-2',
        userId: createdUser.id,
        isMasterOwner: false,
      });
      prisma.onboardingDraft.findFirst.mockResolvedValue(null);
      prisma.onboardingDraft.create.mockResolvedValue({
        id: 'draft-2',
        step: 1,
        status: 'IN_PROGRESS',
        data: {},
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.saveOwnerDetails({
        ...baseDto,
        email: 'nimal@construction.lk',
        phone: '0772223344',
        isMasterOwner: false,
      });

      expect(result.owner.isMasterOwner).toBe(false);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isMasterOwner: false }),
        }),
      );
    });

    it('should throw ConflictException if user already exists without an active in-progress draft', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-user-uuid',
        email: baseDto.email.toLowerCase(),
        phone: '+94771234567',
        nic: baseDto.nic,
      });
      prisma.onboardingDraft.findFirst.mockResolvedValue(null);

      await expect(service.saveOwnerDetails(baseDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should update existing draft when called by an authenticated user', async () => {
      const existingUser = {
        id: 'auth-user-id',
        email: 'existing@construction.lk',
        phone: '+94771112233',
        nic: '198011122233',
      };
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.user.findFirst.mockResolvedValue(null); // No conflict
      prisma.user.update.mockResolvedValue({
        ...existingUser,
        fullName: baseDto.fullName,
        email: baseDto.email.toLowerCase(),
        phone: '+94771234567',
        nic: baseDto.nic,
        role: Role.OWNER,
        isMasterOwner: true,
      });
      prisma.ownerDetail.upsert.mockResolvedValue({ id: 'detail-1', isMasterOwner: true });
      prisma.onboardingDraft.findFirst.mockResolvedValue({
        id: 'draft-existing-1',
        userId: existingUser.id,
        step: 1,
        status: 'IN_PROGRESS',
      });
      prisma.onboardingDraft.update.mockResolvedValue({
        id: 'draft-existing-1',
        step: 1,
        status: 'IN_PROGRESS',
        data: {},
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.saveOwnerDetails(baseDto, existingUser.id);

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.onboardingDraft.update).toHaveBeenCalled();
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
          isMasterOwner: true,
          companyName: 'Perera Builders',
        },
      };
      prisma.user.findUnique.mockResolvedValue(user);

      const draft = {
        id: 'draft-uuid-1',
        userId,
        step: 1,
        status: 'IN_PROGRESS',
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
      expect(result.status).toBe('IN_PROGRESS');
      expect(result.owner?.fullName).toBe('Sunil Shantha Perera');
      expect(result.owner?.isMasterOwner).toBe(true);
      expect(result.draft.data).toEqual(draft.data);
    });

    it('should resume progress when query identifier (email) is provided', async () => {
      const email = 'sunil@construction.lk';
      const user = {
        id: 'owner-1',
        fullName: 'Sunil Shantha Perera',
        email,
        phone: '+94771234567',
        nic: '198512345678',
        role: Role.OWNER,
        isMasterOwner: true,
        ownerDetail: null,
      };
      prisma.user.findFirst.mockResolvedValue(user);

      const draft = {
        id: 'draft-1',
        userId: 'owner-1',
        step: 1,
        status: 'IN_PROGRESS',
        data: { step: 1, email },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.onboardingDraft.findFirst.mockResolvedValue(draft);

      const result = await service.getDraft(undefined, email);

      expect(result.success).toBe(true);
      expect(result.step).toBe(1);
      expect(result.draft.id).toBe('draft-1');
    });

    it('should throw NotFoundException when no draft exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-no-draft' });
      prisma.onboardingDraft.findFirst.mockResolvedValue(null);

      await expect(service.getDraft('user-no-draft')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when neither auth user nor identifier is provided', async () => {
      await expect(service.getDraft(undefined, undefined)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Full Scenario: Resume After Logout', () => {
    it('should allow owner to save draft, simulate logout, and resume draft upon re-authentication', async () => {
      // 1. Save Step 1
      prisma.user.findFirst.mockResolvedValue(null);
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
        isMasterOwner: true,
      });

      const storedDraft = {
        id: 'persisted-draft-uuid',
        userId: ownerUser.id,
        email: ownerUser.email,
        step: 1,
        status: 'IN_PROGRESS',
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

      // 2. Simulate Logout (session invalidated on client / refresh token revoked on backend)
      // 3. User Logs Back In -> Receives new JWT token with sub: ownerUser.id
      // 4. User requests GET /onboarding/draft using authenticated token
      prisma.user.findUnique.mockResolvedValue({
        ...ownerUser,
        ownerDetail: { id: 'detail-id-1', isMasterOwner: true },
      });
      prisma.onboardingDraft.findFirst.mockResolvedValue(storedDraft);

      const resumeResponse = await service.getDraft(ownerUser.id);

      expect(resumeResponse.success).toBe(true);
      expect(resumeResponse.step).toBe(1);
      expect(resumeResponse.status).toBe('IN_PROGRESS');
      expect(resumeResponse.owner?.id).toBe(ownerUser.id);
      expect(resumeResponse.owner?.isMasterOwner).toBe(true);
      expect(resumeResponse.draft.data.companyName).toBe(baseDto.companyName);
    });
  });
});
