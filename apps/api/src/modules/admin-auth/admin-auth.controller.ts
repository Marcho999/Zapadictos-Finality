import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  adminChangePasswordSchema,
  adminLoginSchema,
  type AdminChangePasswordInput,
  type AdminLoginInput,
} from '@zapadictos/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  ADMIN_REFRESH_COOKIE,
  clearAdminCookies,
  setAdminCookies,
} from './admin-cookies.js';
import {
  AdminAuthGuard,
  AllowPendingPassword,
  CurrentAdmin,
  type AuthenticatedAdmin,
} from './admin-auth.guard.js';
import { AdminAuthService, type RequestMeta } from './admin-auth.service.js';

export function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

function refreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[ADMIN_REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  /** 3 intentos por minuto por IP (docs/06-seguridad.md A07). */
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(adminLoginSchema)) body: AdminLoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body.email, body.password, requestMeta(req));
    setAdminCookies(res, result);
    return result.admin;
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.auth.refresh(refreshCookie(req), requestMeta(req));
      setAdminCookies(res, result);
      return result.admin;
    } catch (error) {
      clearAdminCookies(res);
      throw error;
    }
  }

  /** Funciona aunque el token de acceso ya venció: usa el refresh token. */
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(refreshCookie(req), undefined);
    clearAdminCookies(res);
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  @AllowPendingPassword()
  me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.auth.toMe(admin);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @AllowPendingPassword()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(adminChangePasswordSchema)) body: AdminChangePasswordInput,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(admin.id, admin.sessionId, body.currentPassword, body.newPassword, requestMeta(req));
  }
}
