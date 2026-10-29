import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { AuthService, COOKIE_NAME } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
export const Public = () => SetMetadata('atlas:public', true);
const equal = (a: string, b: string) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (mutation) {
      const expected = process.env.APP_ORIGIN || 'http://localhost:8080';
      const origin = req.headers.origin;
      if (origin && origin !== expected)
        throw new ForbiddenException('This request origin is not allowed.');
      if (req.headers['sec-fetch-site'] === 'cross-site')
        throw new ForbiddenException('Cross-site requests are not allowed.');
    }
    if (
      this.reflector.getAllAndOverride<boolean>('atlas:public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const cookie = String(req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${COOKIE_NAME}=`));
    const token = cookie?.slice(COOKIE_NAME.length + 1) || '';
    const session = await this.auth.session(token);
    req.user = session.user;
    req.sessionHash = session.sessionHash;
    req.csrfToken = session.csrfToken;
    if (mutation) {
      const given = req.headers['x-csrf-token'];
      if (typeof given !== 'string' || !equal(given, session.csrfToken))
        throw new ForbiddenException(
          'Your security token is missing or expired. Refresh and try again.',
        );
    }
    return true;
  }
}
