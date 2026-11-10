import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any, info: any): TUser {
    if (err) {
      throw err;
    }

    if (!user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          statusCode: 401,
          errorCode: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired.',
        });
      }

      throw new UnauthorizedException({
        statusCode: 401,
        errorCode: 'TOKEN_INVALID_OR_MISSING',
        message: 'Authentication required. Missing or invalid token.',
      });
    }

    return user;
  }
}