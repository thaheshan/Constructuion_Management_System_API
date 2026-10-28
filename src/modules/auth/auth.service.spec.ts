import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, HTTP_STATUS_LOCKED } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, HttpException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  const mockPassword = 'SecurePassword123!';
  let passwordHash: string;

  const baseUser = {
    id: 'user-uuid-1',
    email: 'test@construction.lk',
    phone: '+94771234567',
    fullName: 'Test Engineer',
    role: 'PROJECT_MANAGER',
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(mockPassword, 10);
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-signed-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('normalizePhone helper', () => {
    it('should generate Sri Lankan phone format variations from 07XXXXXXXX', () => {
      const candidates = service.normalizePhone('0771234567');
      expect(candidates).toContain('0771234567');
      expect(candidates).toContain('+94771234567');
      expect(candidates).toContain('94771234567');
    });

    it('should generate variations from +947XXXXXXXX', () => {
      const candidates = service.normalizePhone('+94771234567');
      expect(candidates).toContain('0771234567');
      expect(candidates).toContain('+94771234567');
      expect(candidates).toContain('94771234567');
    });
  });

  describe('login - Correct Login', () => {
    it('should authenticate successfully with email and return tokens + user info', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        identifier: 'test@construction.lk',
        password: mockPassword,
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@construction.lk' },
      });
      expect(jwtService.sign).toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-signed-jwt-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('test@construction.lk');
      expect(result.expiresIn).toBe(900);
    });

    it('should authenticate successfully with mobile phone (+94 format)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...baseUser,
        passwordHash,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        identifier: '+94771234567',
        password: mockPassword,
      });

      expect(prisma.user.findFirst).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-signed-jwt-token');
      expect(result.user.phone).toBe('+94771234567');
    });

    it('should authenticate successfully with mobile phone (07x format)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...baseUser,
        passwordHash,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        identifier: '0771234567',
        password: mockPassword,
      });

      expect(prisma.user.findFirst).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-signed-jwt-token');
    });

    it('should reset failedLoginAttempts if user had previous failed attempts', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash,
        failedLoginAttempts: 3,
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      await service.login({
        identifier: 'test@construction.lk',
        password: mockPassword,
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });
  });

  describe('login - Remember Me', () => {
    it('should set refresh token expiry to 7 days by default (rememberMe = false)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
      prisma.refreshToken.create.mockResolvedValue({});

      const beforeCall = Date.now();
      await service.login({
        identifier: 'test@construction.lk',
        password: mockPassword,
        rememberMe: false,
      });

      const createCall = prisma.refreshToken.create.mock.calls[0][0];
      const expiry = new Date(createCall.data.expiresAt).getTime();
      const diffDays = Math.round((expiry - beforeCall) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it('should set refresh token expiry to 30 days when rememberMe is true', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
      prisma.refreshToken.create.mockResolvedValue({});

      const beforeCall = Date.now();
      await service.login({
        identifier: 'test@construction.lk',
        password: mockPassword,
        rememberMe: true,
      });

      const createCall = prisma.refreshToken.create.mock.calls[0][0];
      const expiry = new Date(createCall.data.expiresAt).getTime();
      const diffDays = Math.round((expiry - beforeCall) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });
  });

  describe('login - Wrong Password & Lockout Flow', () => {
    it('should throw 401 and increment failedLoginAttempts on wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash,
        failedLoginAttempts: 0,
      });
      prisma.user.update.mockResolvedValue({});

      await expect(
        service.login({
          identifier: 'test@construction.lk',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: {
          failedLoginAttempts: 1,
          lockedUntil: null,
        },
      });
    });

    it('should lock account and throw HTTP 423 on 5th consecutive failure', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash,
        failedLoginAttempts: 4,
      });
      prisma.user.update.mockResolvedValue({});

      try {
        await service.login({
          identifier: 'test@construction.lk',
          password: 'WrongPassword!',
        });
        fail('Should have thrown an HttpException with 423');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HTTP_STATUS_LOCKED);
        expect(err.getResponse().error).toBe('Locked');
      }

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseUser.id },
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('should reject login immediately with 423 if account is currently locked', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // locked for 10 more minutes
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash,
        failedLoginAttempts: 5,
        lockedUntil: futureDate,
      });

      try {
        await service.login({
          identifier: 'test@construction.lk',
          password: mockPassword, // even with correct password
        });
        fail('Should have rejected with 423 Locked');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HTTP_STATUS_LOCKED);
        expect(err.getResponse().message).toContain('Account is temporarily locked');
      }
    });

    it('should allow login and clear lockout when lockout period has passed', async () => {
      const pastDate = new Date(Date.now() - 5 * 60 * 1000); // lockout expired 5 mins ago
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash,
        failedLoginAttempts: 5,
        lockedUntil: pastDate,
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        identifier: 'test@construction.lk',
        password: mockPassword,
      });

      expect(result.accessToken).toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    it('should throw 401 when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          identifier: 'unknown@construction.lk',
          password: mockPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw 400 when identifier is missing or empty', async () => {
      await expect(
        service.login({
          identifier: '',
          password: mockPassword,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshTokens - Token Refresh & Rotation', () => {
    it('should refresh tokens, rotate the refresh token, and return new tokens', async () => {
      const futureExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-rec-1',
        tokenHash: 'hashed-old-token',
        userId: baseUser.id,
        isRevoked: false,
        expiresAt: futureExpiry,
        user: baseUser,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens({
        refreshToken: 'valid-raw-refresh-token',
      });

      expect(result.accessToken).toBe('mock-signed-jwt-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900);

      // Verify token rotation: old token is revoked
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-rec-1' },
        data: { isRevoked: true },
      });

      // Verify new token is stored
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should throw 401 if refresh token is not found', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshTokens({ refreshToken: 'non-existent-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw 401 if refresh token is already revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-rec-2',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 100000),
        user: baseUser,
      });

      await expect(
        service.refreshTokens({ refreshToken: 'revoked-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw 401 if refresh token is expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-rec-3',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 100000), // in the past
        user: baseUser,
      });

      await expect(
        service.refreshTokens({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw 423 if user is locked out when attempting to refresh', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-rec-4',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 100000),
        user: {
          ...baseUser,
          lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      try {
        await service.refreshTokens({ refreshToken: 'valid-token-locked-user' });
        fail('Should have thrown 423 Locked');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HTTP_STATUS_LOCKED);
      }
    });
  });

  describe('logout - Session Revocation', () => {
    it('should revoke the refresh token and return success message', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-rec-to-logout',
        isRevoked: false,
      });
      prisma.refreshToken.update.mockResolvedValue({});

      const result = await service.logout({
        refreshToken: 'active-token-to-revoke',
      });

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-rec-to-logout' },
        data: { isRevoked: true },
      });
      expect(result.message).toBe('Logged out successfully');
    });
  });
});
