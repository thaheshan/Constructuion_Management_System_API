import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { id: 'u1', email: 'test@construction.lk' },
      }),
      refreshTokens: jest.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      }),
      logout: jest.fn().mockResolvedValue({
        message: 'Logged out successfully',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should call authService.login and return authentication payload', async () => {
    const dto = { identifier: 'test@construction.lk', password: 'Password123!', rememberMe: true };
    const result = await controller.login(dto, '127.0.0.1', 'Mozilla/5.0');

    expect(authService.login).toHaveBeenCalledWith(dto, '127.0.0.1', 'Mozilla/5.0');
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');
  });

  it('should call authService.refreshTokens and return renewed tokens', async () => {
    const dto = { refreshToken: 'valid-token' };
    const result = await controller.refreshTokens(dto, '127.0.0.1', 'Mozilla/5.0');

    expect(authService.refreshTokens).toHaveBeenCalledWith(dto, '127.0.0.1', 'Mozilla/5.0');
    expect(result.accessToken).toBe('new-access-token');
  });

  it('should call authService.logout and return logout confirmation', async () => {
    const dto = { refreshToken: 'token-to-revoke' };
    const result = await controller.logout(dto);

    expect(authService.logout).toHaveBeenCalledWith(dto);
    expect(result.message).toBe('Logged out successfully');
  });
});
