import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CustomerMeDto } from '@zapadictos/shared';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { loadEnv } from '../../config/env.js';
import { ARGON2_OPTIONS } from '../../common/security/argon2-options.js';
import { randomToken, sha256 } from '../../common/security/tokens.js';
import { ActorType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JWT_ISSUER, type RequestMeta } from '../admin-auth/admin-auth.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CUSTOMER_ACCESS_TTL_MS, CUSTOMER_SESSION_TTL_MS } from './customer-cookies.js';

export const CUSTOMER_JWT_AUDIENCE = 'zapadictos-customer';

export interface CustomerJwtPayload {
  sub: string;
  sid: string;
}

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';

type CustomerRow = { id: string; name: string; email: string; phone: string | null; dataPolicyAcceptedAt: Date };

export function toCustomerMe(c: CustomerRow): CustomerMeDto {
  return { id: c.id, name: c.name, email: c.email, phone: c.phone, dataPolicyAcceptedAt: c.dataPolicyAcceptedAt.toISOString() };
}

@Injectable()
export class CustomerAuthService {
  /** Mismo truco que en el panel: si el correo no existe, se tarda lo mismo. */
  private dummyHash = argon2.hash(randomToken(), ARGON2_OPTIONS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(
    input: { name: string; email: string; password: string; phone?: string },
    meta: RequestMeta,
  ) {
    try {
      const customer = await this.prisma.customer.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          passwordHash: await argon2.hash(input.password, ARGON2_OPTIONS),
          // Ley 1581 de 2012: queda la fecha en que aceptó la política (D-16).
          dataPolicyAcceptedAt: new Date(),
        },
      });
      await this.audit.log({ action: 'CUSTOMER_REGISTERED', actorType: ActorType.CUSTOMER, customerId: customer.id, ip: meta.ip });
      const tokens = await this.createSession(customer.id, randomUUID(), meta);
      return { ...tokens, customer: toCustomerMe(customer) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ message: 'Ya existe una cuenta con ese correo. Ingresa con tu contraseña.' });
      }
      throw error;
    }
  }

  async login(email: string, password: string, meta: RequestMeta) {
    const customer = await this.prisma.customer.findUnique({ where: { email } });
    const valid = await argon2.verify(customer?.passwordHash ?? (await this.dummyHash), password);
    if (!customer || !valid || !customer.active) {
      await this.audit.log({
        action: 'CUSTOMER_LOGIN_FAILED',
        actorType: ActorType.ANONYMOUS,
        entity: 'Customer',
        entityId: customer?.id,
        details: { reason: !customer ? 'unknown_email' : !valid ? 'bad_password' : 'inactive' },
        ip: meta.ip,
      });
      throw new UnauthorizedException({ message: INVALID_CREDENTIALS });
    }
    const tokens = await this.createSession(customer.id, randomUUID(), meta);
    return { ...tokens, customer: toCustomerMe(customer) };
  }

  /** Rotación con detección de reutilización, igual que en el panel (A07). */
  async refresh(refreshToken: string | undefined, meta: RequestMeta) {
    if (!refreshToken) throw new UnauthorizedException();
    const session = await this.prisma.customerSession.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { customer: true },
    });
    if (!session) throw new UnauthorizedException();

    if (session.revokedAt) {
      await this.prisma.customerSession.updateMany({
        where: { family: session.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        action: 'CUSTOMER_REFRESH_REUSED',
        actorType: ActorType.ANONYMOUS,
        entity: 'Customer',
        entityId: session.customerId,
        details: { family: session.family },
        ip: meta.ip,
      });
      throw new UnauthorizedException();
    }
    if (session.expiresAt <= new Date() || !session.customer.active) throw new UnauthorizedException();

    const revoked = await this.prisma.customerSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw new UnauthorizedException();

    const tokens = await this.createSession(session.customerId, session.family, meta);
    return { ...tokens, customer: toCustomerMe(session.customer) };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.prisma.customerSession.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(customerId: string, family: string, meta: RequestMeta) {
    const refreshToken = randomToken();
    const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_MS);
    const session = await this.prisma.customerSession.create({
      data: {
        customerId,
        family,
        expiresAt,
        tokenHash: sha256(refreshToken),
        ip: meta.ip?.slice(0, 45),
        userAgent: meta.userAgent?.slice(0, 300),
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: customerId, sid: session.id } satisfies CustomerJwtPayload, {
      secret: loadEnv().CUSTOMER_JWT_SECRET,
      audience: CUSTOMER_JWT_AUDIENCE,
      issuer: JWT_ISSUER,
      expiresIn: CUSTOMER_ACCESS_TTL_MS / 1000,
      algorithm: 'HS256',
    });
    return { accessToken, refreshToken, sessionExpiresAt: expiresAt };
  }
}
