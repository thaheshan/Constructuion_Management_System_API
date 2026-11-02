import {
  Injectable,
  UnauthorizedException,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export const HTTP_STATUS_LOCKED = 423;

@Injectable()
export class AuthService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;
  private readonly LOCKOUT_DURATION_MS = this.LOCKOUT_DURATION_MINUTES * 60 * 1000;

  // Lifetimes
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly ACCESS_TOKEN_EXPIRY_SECONDS = 900;
  private readonly REFRESH_TOKEN_STANDARD_DAYS = 7;
  private readonly REFRESH_TOKEN_REMEMBER_ME_DAYS = 30;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Hashes a raw token using SHA-256 for secure database storage.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Normalizes Sri Lankan phone numbers to account for common input variations
   * (e.g. 0771234567, +94771234567, 94771234567).
   */
  normalizePhone(input: string): string[] {
    const cleaned = input.trim().replace(/\s+/g, '');
    const candidates = new Set<string>([cleaned]);

    if (cleaned.startsWith('0') && cleaned.length === 10) {
      candidates.add('+94' + cleaned.substring(1));
      candidates.add('94' + cleaned.substring(1));
    } else if (cleaned.startsWith('+94') && cleaned.length === 12) {
      candidates.add('0' + cleaned.substring(3));
      candidates.add(cleaned.substring(1));
    } else if (cleaned.startsWith('94') && cleaned.length === 11) {
      candidates.add('0' + cleaned.substring(2));
      candidates.add('+' + cleaned);
    }

    return Array.from(candidates);
  }

  /**
   * Authenticates user via email or mobile phone, enforces lockout on repeated failures,
   * and issues access and refresh tokens.
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const rawIdentifier = (dto.identifier || dto.email || dto.phone || '').trim();

    if (!rawIdentifier) {
      throw new BadRequestException('Email or mobile identifier is required');
    }

    // Determine query filter based on identifier format
    let user;
    if (rawIdentifier.includes('@')) {
      user = await this.prisma.user.findUnique({
        where: { email: rawIdentifier.toLowerCase() },
      });
    } else {
      const phoneCandidates = this.normalizePhone(rawIdentifier);
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: rawIdentifier.toLowerCase() },
            { phone: { in: phoneCandidates } },
          ],
        },
      });
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = new Date();

    // Check account lockout status
    if (user.lockedUntil) {
      if (user.lockedUntil > now) {
        const remainingMinutes = Math.ceil(
          (user.lockedUntil.getTime() - now.getTime()) / 60000,
        );
        throw new HttpException(
          {
            statusCode: HTTP_STATUS_LOCKED,
            error: 'Locked',
            message: `Account is temporarily locked due to repeated failed login attempts. Please try again after ${remainingMinutes} minute(s).`,
            lockedUntil: user.lockedUntil,
          },
          HTTP_STATUS_LOCKED,
        );
      } else {
        // Lockout expired, reset counters
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
      }
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      const newAttempts = user.failedLoginAttempts + 1;
      let newLockedUntil: Date | null = null;

      if (newAttempts >= this.MAX_FAILED_ATTEMPTS) {
        newLockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION_MS);
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockedUntil: newLockedUntil,
        },
      });

      if (newLockedUntil) {
        throw new HttpException(
          {
            statusCode: HTTP_STATUS_LOCKED,
            error: 'Locked',
            message: `Account has been locked due to ${this.MAX_FAILED_ATTEMPTS} consecutive failed login attempts. Please try again after ${this.LOCKOUT_DURATION_MINUTES} minutes.`,
            lockedUntil: newLockedUntil,
          },
          HTTP_STATUS_LOCKED,
        );
      }

      const attemptsRemaining = this.MAX_FAILED_ATTEMPTS - newAttempts;
      throw new UnauthorizedException(
        `Invalid credentials. ${attemptsRemaining} attempt(s) remaining before account lockout.`,
      );
    }

    // Reset failed attempts on successful authentication
    if (user.failedLoginAttempts > 0 || user.lockedUntil !== null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    // Generate Access Token (15 minutes)
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: this.ACCESS_TOKEN_EXPIRY },
    );

    // Refresh Token lifetime based on "Remember me"
    const refreshDays = dto.rememberMe
      ? this.REFRESH_TOKEN_REMEMBER_ME_DAYS
      : this.REFRESH_TOKEN_STANDARD_DAYS;
    const refreshExpiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    // Generate high-entropy raw refresh token and store SHA-256 hash
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: refreshExpiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    };
  }

  /**
   * Rotates and issues a new access token and refresh token pair using an active refresh token.
   */
  async refreshTokens(dto: RefreshTokenDto, ipAddress?: string, userAgent?: string) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenRecord.isRevoked) {
      // Possible token theft / reuse scenario: revoke active sessions or deny
      throw new UnauthorizedException('Refresh token has already been revoked');
    }

    const now = new Date();
    if (tokenRecord.expiresAt < now) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Check if user is locked
    if (tokenRecord.user.lockedUntil && tokenRecord.user.lockedUntil > now) {
      throw new HttpException(
        {
          statusCode: HTTP_STATUS_LOCKED,
          error: 'Locked',
          message: 'User account is currently locked',
        },
        HTTP_STATUS_LOCKED,
      );
    }

    // Token Rotation: Invalidate the current refresh token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    // Generate new Access Token
    const accessToken = this.jwtService.sign(
      {
        sub: tokenRecord.user.id,
        email: tokenRecord.user.email,
        role: tokenRecord.user.role,
      },
      { expiresIn: this.ACCESS_TOKEN_EXPIRY },
    );

    // Generate new rotated Refresh Token (preserve remaining duration or 7-day standard)
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = this.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_STANDARD_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        userId: tokenRecord.user.id,
        expiresAt: newExpiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  /**
   * Revokes the provided refresh token to end user session.
   */
  async logout(dto: LogoutDto) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (tokenRecord && !tokenRecord.isRevoked) {
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });
    }

    return {
      message: 'Logged out successfully',
    };
  }
}
