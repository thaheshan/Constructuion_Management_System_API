import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret || jwtSecret.trim().length < 32) {
      throw new Error(
        'JWT_SECRET environment variable is required and must be at least 32 characters long',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Malformed token payload.');
    }

    // Expose id, userId, and sub so controllers from both branches work seamlessly
    return {
      id: payload.sub,
      userId: payload.sub,
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}