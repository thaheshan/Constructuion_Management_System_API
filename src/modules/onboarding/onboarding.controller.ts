import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Ip,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { SaveOwnerDetailsDto } from './dto/save-owner-details.dto';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * POST /api/v1/onboarding/owner/details
   * Saves Step 1 Owner Details and stores an onboarding draft.
   * Open only when no Master Owner exists, or requires an authenticated Owner.
   */
  @Post('owner/details')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OptionalJwtAuthGuard)
  async saveOwnerDetails(
    @Body() dto: SaveOwnerDetailsDto,
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const authenticatedUser = req.user ? { userId: req.user.userId, role: req.user.role } : undefined;
    return this.onboardingService.saveOwnerDetails(
      dto,
      authenticatedUser,
      ip,
      userAgent,
    );
  }

  /**
   * GET /api/v1/onboarding/draft
   * Resumes onboarding progress by returning stored draft for the authenticated user.
   * Requires valid JWT authentication to prevent account enumeration and data leakage.
   */
  @Get('draft')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async getDraft(@Req() req: any) {
    return this.onboardingService.getDraft(req.user.userId);
  }
}
