import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AuthService, COOKIE_NAME, cookieSecure } from './auth.service.js';
import { Public } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';
class LoginDto {
  @ApiProperty({ example: 'customer@atlas.example' }) @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ format: 'password' }) @IsString() @MinLength(1) @MaxLength(256) password!: string;
}
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start a fixed-role session with a real account password' })
  async login(
    @Body() data: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(
      data.email,
      data.password,
      req.ip || req.socket.remoteAddress || 'unknown',
    );
    res.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: cookieSecure(),
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });
    return { user: result.user, csrfToken: result.csrfToken };
  }
  @Get('session') session(@Req() req: AuthenticatedRequest) {
    return { user: req.user, csrfToken: req.csrfToken };
  }
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.sessionHash);
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'strict',
      secure: cookieSecure(),
      path: '/',
    });
  }
}
