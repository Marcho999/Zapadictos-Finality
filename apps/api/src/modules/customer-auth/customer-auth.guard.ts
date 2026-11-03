import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { loadEnv } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JWT_ISSUER } from '../admin-auth/admin-auth.service.js';
import { CUSTOMER_ACCESS_COOKIE } from './customer-cookies.js';
import { CUSTOMER_JWT_AUDIENCE, type CustomerJwtPayload } from './customer-auth.service.js';

export interface AuthenticatedCustomer {
  id: string;
  sessionId: string;
}

type CustomerRequest = Request & { customer?: AuthenticatedCustomer };

export const CurrentCustomer = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedCustomer => {
    const customer = ctx.switchToHttp().getRequest<CustomerRequest>().customer;
    if (!customer) throw new UnauthorizedException();
    return customer;
  },
);

/**
 * Protege las rutas del cliente (docs/06-seguridad.md A01). Solo acepta tokens
 * firmados con CUSTOMER_JWT_SECRET y con la audiencia de clientes: un token
 * del panel no sirve aquí, ni al revés.
 */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CustomerRequest>();
    const token: unknown = request.cookies?.[CUSTOMER_ACCESS_COOKIE];
    if (typeof token !== 'string' || token.length === 0) throw new UnauthorizedException();

    let payload: CustomerJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<CustomerJwtPayload>(token, {
        secret: loadEnv().CUSTOMER_JWT_SECRET,
        audience: CUSTOMER_JWT_AUDIENCE,
        issuer: JWT_ISSUER,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException();
    }

    const session = await this.prisma.customerSession.findUnique({
      where: { id: payload.sid },
      select: { customerId: true, revokedAt: true, expiresAt: true, customer: { select: { active: true } } },
    });
    if (
      !session ||
      session.customerId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.customer.active
    ) {
      throw new UnauthorizedException();
    }

    request.customer = { id: payload.sub, sessionId: payload.sid };
    return true;
  }
}
