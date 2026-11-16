import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SaveOwnerDetailsDto } from './dto/save-owner-details.dto';
import { Role, OnboardingStatus } from '@prisma/client';
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
   * Hashes token using SHA-256 for secure database storage.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Saves Step 1 Owner Details and creates/updates the onboarding draft.
   *
   * Security & Governance Rules:
   * 1. Unauthenticated creation is ONLY permitted when no Master Owner exists in the system.
   *    The initial owner is automatically designated as Master Owner (server-side).
   * 2. Once a Master Owner exists, creating additional Owners requires an authenticated Owner.
   * 3. An existing user's role is NEVER escalated from this endpoint.
   * 4. An existing account's credentials (passwordHash, email, phone, NIC) are NEVER overwritten.
   * 5. isMasterOwner from request payload is strictly ignored and determined server-side.
   * 6. All mutations are wrapped in a database transaction with generic conflict handling.
   */
  async saveOwnerDetails(
    dto: SaveOwnerDetailsDto,
    authenticatedUser?: { userId: string; role?: string },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const canonicalPhone = this.canonicalizePhone(dto.phone);
    const nicUpper = dto.nic.trim().toUpperCase();
    const fullNameTrimmed = dto.fullName.trim();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingMasterOwner = await tx.user.findFirst({
          where: { isMasterOwner: true },
        });

        let targetUser: any;
        let isMasterOwner = false;

        if (authenticatedUser?.userId) {
          // --- AUTHENTICATED CALLER FLOW ---
          const caller = await tx.user.findUnique({
            where: { id: authenticatedUser.userId },
          });

          if (!caller) {
            throw new UnauthorizedException('User session is invalid');
          }

          // Privilege escalation check: caller MUST have Role.OWNER
          if (caller.role !== Role.OWNER) {
            throw new ForbiddenException(
              'Access denied. Only an account with the Owner role can perform owner onboarding actions.',
            );
          }

          if (caller.email === normalizedEmail || caller.id === authenticatedUser.userId) {
            // Owner is updating their own onboarding draft details
            // RULE: Never overwrite credentials (passwordHash, email, phone, nic) or change role!
            targetUser = caller;
            isMasterOwner = caller.isMasterOwner;
          } else {
            // Authenticated Owner is onboarding an additional Owner
            // RULE: Additional owners are NOT master owners (server-side enforced)
            isMasterOwner = false;

            // Check if account already exists
            const existingAccount = await tx.user.findFirst({
              where: {
                OR: [
                  { email: normalizedEmail },
                  { phone: canonicalPhone },
                  { nic: nicUpper },
                ],
              },
            });

            if (existingAccount) {
              throw new ConflictException(
                'Registration request could not be processed with the provided details.',
              );
            }

            const passwordHash = await bcrypt.hash(dto.password, 10);
            targetUser = await tx.user.create({
              data: {
                fullName: fullNameTrimmed,
                email: normalizedEmail,
                phone: canonicalPhone,
                nic: nicUpper,
                passwordHash,
                role: Role.OWNER,
                isMasterOwner: false,
              },
            });
          }
        } else {
          // --- UNAUTHENTICATED CALLER FLOW ---
          // RULE: Allow initial Owner creation only while NO master owner exists
          if (existingMasterOwner) {
            throw new ForbiddenException(
              'Initial master owner already exists. Additional owners can only be onboarded by an authenticated Owner.',
            );
          }

          // Check if an account already exists with any of the identifiers
          const existingUser = await tx.user.findFirst({
            where: {
              OR: [
                { email: normalizedEmail },
                { phone: canonicalPhone },
                { nic: nicUpper },
              ],
            },
          });

          if (existingUser) {
            // Generic error message to prevent account enumeration
            throw new ConflictException(
              'Registration request could not be processed with the provided details.',
            );
          }

          // Initial system setup: this first owner becomes the Master Owner
          isMasterOwner = true;
          const passwordHash = await bcrypt.hash(dto.password, 10);

          targetUser = await tx.user.create({
            data: {
              fullName: fullNameTrimmed,
              email: normalizedEmail,
              phone: canonicalPhone,
              nic: nicUpper,
              passwordHash,
              role: Role.OWNER,
              isMasterOwner: true,
            },
          });
        }

        // Upsert OwnerDetail model (without duplicate isMasterOwner or nicName)
        const ownerDetail = await tx.ownerDetail.upsert({
          where: { userId: targetUser.id },
          create: {
            userId: targetUser.id,
            companyName: dto.companyName?.trim() || null,
            designation: dto.designation?.trim() || 'Owner',
            emergencyContact: dto.emergencyContact
              ? this.canonicalizePhone(dto.emergencyContact)
              : null,
            address: dto.address?.trim() || null,
          },
          update: {
            companyName: dto.companyName?.trim() || null,
            designation: dto.designation?.trim() || 'Owner',
            emergencyContact: dto.emergencyContact
              ? this.canonicalizePhone(dto.emergencyContact)
              : null,
            address: dto.address?.trim() || null,
          },
        });

        // Prepare Step 1 Draft Data (passwords strictly omitted for security)
        const draftData = {
          step: 1,
          fullName: targetUser.fullName,
          email: targetUser.email,
          phone: targetUser.phone,
          nic: targetUser.nic,
          isMasterOwner: targetUser.isMasterOwner,
          companyName: dto.companyName?.trim() || null,
          address: dto.address?.trim() || null,
          designation: dto.designation?.trim() || 'Owner',
          emergencyContact: dto.emergencyContact
            ? this.canonicalizePhone(dto.emergencyContact)
            : null,
          lastSavedAt: new Date().toISOString(),
        };

        // Upsert OnboardingDraft
        let draft = await tx.onboardingDraft.findFirst({
          where: { userId: targetUser.id },
          orderBy: { updatedAt: 'desc' },
        });

        if (draft) {
          draft = await tx.onboardingDraft.update({
            where: { id: draft.id },
            data: {
              step: 1,
              data: draftData,
              status: OnboardingStatus.IN_PROGRESS,
            },
          });
        } else {
          draft = await tx.onboardingDraft.create({
            data: {
              userId: targetUser.id,
              email: targetUser.email,
              step: 1,
              data: draftData,
              status: OnboardingStatus.IN_PROGRESS,
            },
          });
        }

        // Generate auth tokens for session continuity
        const accessToken = this.jwtService.sign(
          { sub: targetUser.id, email: targetUser.email, role: targetUser.role },
          { expiresIn: this.ACCESS_TOKEN_EXPIRY },
        );

        const rawRefreshToken = crypto.randomBytes(40).toString('hex');
        const tokenHash = this.hashToken(rawRefreshToken);
        const expiresAt = new Date(
          Date.now() + this.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
        );

        await tx.refreshToken.create({
          data: {
            tokenHash,
            userId: targetUser.id,
            expiresAt,
            ipAddress,
            userAgent,
          },
        });

        // Record audit log for Owner creation
        try {
          await tx.auditLog.create({
            data: {
              userId: targetUser.id,
              action: 'OWNER_CREATED',
              resource: 'onboarding',
              ipAddress,
              userAgent,
              details: {
                isMasterOwner: targetUser.isMasterOwner,
                email: targetUser.email,
                step: 1,
              },
            },
          });
        } catch (_) {}

        return {
          success: true,
          message: 'Owner details and Step 1 draft saved successfully',
          step: 1,
          status: draft.status,
          owner: {
            id: targetUser.id,
            fullName: targetUser.fullName,
            email: targetUser.email,
            phone: targetUser.phone,
            nic: targetUser.nic,
            role: targetUser.role,
            isMasterOwner: targetUser.isMasterOwner,
          },
          ownerDetail: {
            id: ownerDetail.id,
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
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Registration request could not be processed with the provided details.',
        );
      }
      throw error;
    }
  }

  /**
   * Resumes onboarding progress by retrieving stored draft for the authenticated user.
   * Public unauthenticated access is strictly blocked to prevent data leaks and enumeration.
   */
  async getDraft(authenticatedUserId: string) {
    if (!authenticatedUserId) {
      throw new UnauthorizedException('Authentication token is required to retrieve draft');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authenticatedUserId },
      include: { ownerDetail: true },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    const draft = await this.prisma.onboardingDraft.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    if (!draft) {
      throw new NotFoundException('No active onboarding draft found');
    }

    return {
      success: true,
      message: 'Onboarding draft retrieved successfully',
      step: draft.step,
      status: draft.status,
      owner: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        nic: user.nic,
        role: user.role,
        isMasterOwner: user.isMasterOwner,
      },
      ownerDetail: user.ownerDetail || null,
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
