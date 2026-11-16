import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { SaveOwnerDetailsDto } from './dto/save-owner-details.dto';

describe('OnboardingController', () => {
  let controller: OnboardingController;
  let service: OnboardingService;

  const mockSaveResult = {
    success: true,
    message: 'Owner details and Step 1 draft saved successfully',
    step: 1,
    status: 'IN_PROGRESS',
    owner: {
      id: 'owner-uuid-1',
      fullName: 'Sunil Shantha Perera',
      email: 'sunil@construction.lk',
      phone: '+94771234567',
      nic: '198512345678',
      role: 'OWNER',
      isMasterOwner: true,
    },
    ownerDetail: {
      id: 'detail-uuid-1',
      companyName: 'Perera Builders',
      designation: 'Owner',
    },
    draft: {
      id: 'draft-uuid-1',
      step: 1,
      status: 'IN_PROGRESS',
      data: {},
    },
    tokens: {
      accessToken: 'jwt-access-token',
      refreshToken: 'jwt-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    },
  };

  const mockDraftResult = {
    success: true,
    message: 'Onboarding draft retrieved successfully',
    step: 1,
    status: 'IN_PROGRESS',
    owner: mockSaveResult.owner,
    ownerDetail: mockSaveResult.ownerDetail,
    draft: mockSaveResult.draft,
  };

  const mockService = {
    saveOwnerDetails: jest.fn().mockResolvedValue(mockSaveResult),
    getDraft: jest.fn().mockResolvedValue(mockDraftResult),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [{ provide: OnboardingService, useValue: mockService }],
    }).compile();

    controller = module.get<OnboardingController>(OnboardingController);
    service = module.get<OnboardingService>(OnboardingService);
  });

  describe('POST /onboarding/owner/details', () => {
    it('should save owner details and return 201 with draft and server-set master owner flag', async () => {
      const dto: SaveOwnerDetailsDto = {
        fullName: 'Sunil Shantha Perera',
        email: 'sunil@construction.lk',
        phone: '0771234567',
        nic: '198512345678',
        password: 'ValidPassword123!',
      };

      const req = { user: { userId: 'owner-uuid-1', role: 'OWNER' } };
      const ip = '127.0.0.1';
      const userAgent = 'Mozilla/5.0';

      const result = await controller.saveOwnerDetails(dto, req, ip, userAgent);

      expect(result).toEqual(mockSaveResult);
      expect(mockService.saveOwnerDetails).toHaveBeenCalledWith(
        dto,
        { userId: 'owner-uuid-1', role: 'OWNER' },
        ip,
        userAgent,
      );
    });
  });

  describe('GET /onboarding/draft', () => {
    it('should retrieve onboarding draft for authenticated owner', async () => {
      const req = { user: { userId: 'owner-uuid-1', role: 'OWNER' } };

      const result = await controller.getDraft(req);

      expect(result).toEqual(mockDraftResult);
      expect(mockService.getDraft).toHaveBeenCalledWith('owner-uuid-1');
    });
  });
});
