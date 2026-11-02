import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SaveOwnerDetailsDto } from './dto/save-owner-details.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class OnboardingService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly ACCESS_TOKEN_EXPIRY_SECONDS = 900;
  private readonly REFRESH_TOKEN_DAYS = 7;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Normalizes Sri Lankan phone number to canonical +94XXXXXXXXX format.
   */
  canonicalizePhone(phone: string): string {
    const cleaned = phone.trim().replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '+94' + cleaned.substring(1);
    }
    if (cleaned.startsWith('94') && cleaned.length === 11) {
      return '+' + cleaned;
    }
    if (cleaned.startsWith('+94') && cleaned.length === 12) {
      return cleaned;
    }
    return cleaned;
  }

  /**
   * Hashes token using SHA-256 for secure storage.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Saves Step 1 Owner Details and creates/updates the onboarding draft.
   */
  async saveOwnerDetails(
    dto: SaveOwnerDetailsDto,
    authenticatedUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const canonicalPhone = this.canonicalizePhone(dto.phone);
    const nicUpper = dto.nic.trim().toUpperCase();
    const fullNameTrimmed = dto.fullName.trim();
    const isMasterOwner = dto.isMasterOwner !== undefined ? dto.isMasterOwner : true;

    let user;

    if (authenticatedUserId) {
      // Authenticated user updating their owner details / draft
      user = await this.prisma.user.findUnique({
        where: { id: authenticatedUserId },
      });

      if (!user) {
        throw new NotFoundException('Authenticated user not found');
      }

      // Check conflict if email, phone, or nic changed to another user's
      const conflictUser = await this.prisma.user.findFirst({
        where: {
          id: { not: user.id },
          OR: [
            { email: normalizedEmail },
            { phone: canonicalPhone },
            { nic: nicUpper },
          ],
        },
      });

      if (conflictUser) {
        throw new ConflictException(
          'Email, phone, or NIC is already in use by another account',
        );
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          fullName: fullNameTrimmed,
          email: normalizedEmail,
          phone: canonicalPhone,
          nic: nicUpper,
          passwordHash,
          role: Role.OWNER,
          isMasterOwner,
        },
      });
    } else {
      // Unauthenticated initial onboarding
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedEmail },
            { phone: canonicalPhone },
            { nic: nicUpper },
          ],
        },
      });

      if (existingUser) {
        // Check if user has an existing in-progress draft (allow resume/update if password matches)
        const existingDraft = await this.prisma.onboardingDraft.findFirst({
          where: {
            OR: [{ userId: existingUser.id }, { email: normalizedEmail }],
            status: 'IN_PROGRESS',
          },
        });

        if (existingDraft) {
          const isPasswordValid = await bcrypt.compare(
            dto.password,
            existingUser.passwordHash,
          );
          if (!isPasswordValid) {
            throw new ConflictException(
              'An onboarding draft exists for this account. Please log in with your password to resume or choose unique credentials.',
            );
          }
          user = existingUser;
        } else {
          throw new ConflictException(
            'An account with this email, phone, or NIC already exists. Please log in to proceed.',
          );
        }
      } else {
        // Create new Owner user
        const passwordHash = await bcrypt.hash(dto.password, 10);

        user = await this.prisma.user.create({
          data: {
            fullName: fullNameTrimmed,
            email: normalizedEmail,
            phone: canonicalPhone,
            nic: nicUpper,
            passwordHash,
            role: Role.OWNER,
            isMasterOwner,
          },
        });
      }
    }

    // Upsert OwnerDetail model
    const ownerDetail = await this.prisma.ownerDetail.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        isMasterOwner,
        nicName: fullNameTrimmed,
        companyName: dto.companyName?.trim() || null,
        designation: dto.designation?.trim() || 'Owner',
        emergencyContact: dto.emergencyContact
          ? this.canonicalizePhone(dto.emergencyContact)
          : null,
        address: dto.address?.trim() || null,
      },
      update: {
        isMasterOwner,
        nicName: fullNameTrimmed,
        companyName: dto.companyName?.trim() || null,
        designation: dto.designation?.trim() || 'Owner',
        emergencyContact: dto.emergencyContact
          ? this.canonicalizePhone(dto.emergencyContact)
          : null,
        address: dto.address?.trim() || null,
      },
    });

    // Prepare Step 1 Draft Data (never persist raw/hashed passwords in draft JSON)
    const draftData = {
      step: 1,
      fullName: fullNameTrimmed,
      email: normalizedEmail,
      phone: canonicalPhone,
      nic: nicUpper,
      isMasterOwner,
      companyName: dto.companyName?.trim() || null,
      address: dto.address?.trim() || null,
      designation: dto.designation?.trim() || 'Owner',
      emergencyContact: dto.emergencyContact
        ? this.canonicalizePhone(dto.emergencyContact)
        : null,
      lastSavedAt: new Date().toISOString(),
    };

    // Upsert OnboardingDraft
    let draft = await this.prisma.onboardingDraft.findFirst({
      where: {
        OR: [{ userId: user.id }, { email: normalizedEmail }],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (draft) {
      draft = await this.prisma.onboardingDraft.update({
        where: { id: draft.id },
        data: {
          userId: user.id,
          email: normalizedEmail,
          step: 1,
          data: draftData,
          status: 'IN_PROGRESS',
        },
      });
    } else {
      draft = await this.prisma.onboardingDraft.create({
        data: {
          userId: user.id,
          email: normalizedEmail,
          step: 1,
          data: draftData,
          status: 'IN_PROGRESS',
        },
      });
    }

    // Issue tokens for session continuity and resume after logout
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: this.ACCESS_TOKEN_EXPIRY },
    );

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      success: true,
      message: 'Owner details and Step 1 draft saved successfully',
      step: 1,
      status: 'IN_PROGRESS',
      owner: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        nic: user.nic,
        role: user.role,
        isMasterOwner: user.isMasterOwner,
      },
      ownerDetail: {
        id: ownerDetail.id,
        isMasterOwner: ownerDetail.isMasterOwner,
        nicName: ownerDetail.nicName,
        companyName: ownerDetail.companyName,
        designation: ownerDetail.designation,
        emergencyContact: ownerDetail.emergencyContact,
        address: ownerDetail.address,
      },
      draft: {
        id: draft.id,
        step: draft.step,
        status: draft.status,
        data: draft.data,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      },
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        tokenType: 'Bearer',
        expiresIn: this.ACCESS_TOKEN_EXPIRY_SECONDS,
      },
    };
  }

  /**
   * Resumes onboarding progress by retrieving stored draft.
   */
  async getDraft(authenticatedUserId?: string, identifier?: string) {
    let user;
    let draft;

    if (authenticatedUserId) {
      user = await this.prisma.user.findUnique({
        where: { id: authenticatedUserId },
        include: { ownerDetail: true },
      });

      if (!user) {
        throw new UnauthorizedException('User account not found');
      }

      draft = await this.prisma.onboardingDraft.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
      });
    } else if (identifier) {
      const cleaned = identifier.trim().toLowerCase();
      const canonical = this.canonicalizePhone(identifier);

      user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: cleaned }, { phone: canonical }, { nic: identifier.trim().toUpperCase() }],
        },
        include: { ownerDetail: true },
      });

      draft = await this.prisma.onboardingDraft.findFirst({
        where: {
          OR: [
            ...(user ? [{ userId: user.id }] : []),
            { email: cleaned },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
    } else {
      throw new BadRequestException(
        'Authentication token or identifier query is required to resume draft',
      );
    }

    if (!draft) {
      throw new NotFoundException('No active onboarding draft found');
    }

    return {
      success: true,
      message: 'Onboarding draft retrieved successfully',
      step: draft.step,
      status: draft.status,
      owner: user
        ? {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            nic: user.nic,
            role: user.role,
            isMasterOwner: user.isMasterOwner,
          }
        : null,
      ownerDetail: user?.ownerDetail || null,
      draft: {
        id: draft.id,
        step: draft.step,
        status: draft.status,
        data: draft.data,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      },
    };
  }
}
