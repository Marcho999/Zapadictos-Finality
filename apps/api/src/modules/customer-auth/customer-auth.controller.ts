import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { customerLoginSchema, customerRegisterSchema, type z } from '@zapadictos/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { requestMeta } from '../admin-auth/admin-auth.controller.js';
import { CUSTOMER_REFRESH_COOKIE, clearCustomerCookies, setCustomerCookies } from './customer-cookies.js';
import { CustomerAuthService } from './customer-auth.service.js';

function refreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[CUSTOMER_REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

/** Sesión de la tienda (docs/04-api.md). */
@Controller('auth')
export class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService) {}

  /** 5 por minuto por IP en registro y login (docs/06-seguridad.md A07). */
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body(new ZodValidationPipe(customerRegisterSchema)) body: z.output<typeof customerRegisterSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(body, requestMeta(req));
    setCustomerCookies(res, result);
    return result.customer;
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(customerLoginSchema)) body: z.output<typeof customerLoginSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body.email, body.password, requestMeta(req));
    setCustomerCookies(res, result);
    return result.customer;
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.auth.refresh(refreshCookie(req), requestMeta(req));
      setCustomerCookies(res, result);
      return result.customer;
    } catch (error) {
      clearCustomerCookies(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(refreshCookie(req));
    clearCustomerCookies(res);
  }
}
