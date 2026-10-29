import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Ip,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { SaveOwnerDetailsDto } from './dto/save-owner-details.dto';
import { GetDraftQueryDto } from './dto/get-draft-query.dto';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * POST /api/v1/onboarding/owner/details
   * Saves Step 1 Owner Details and stores an onboarding draft.
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
    const authenticatedUserId = req.user?.userId;
    return this.onboardingService.saveOwnerDetails(
      dto,
      authenticatedUserId,
      ip,
      userAgent,
    );
  }

  /**
   * GET /api/v1/onboarding/draft
   * Resumes onboarding progress by returning stored draft.
   */
  @Get('draft')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  async getDraft(@Query() query: GetDraftQueryDto, @Req() req: any) {
    const authenticatedUserId = req.user?.userId;
    return this.onboardingService.getDraft(authenticatedUserId, query.identifier);
  }
}
