import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AdminMeDto } from '@zapadictos/shared';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { loadEnv } from '../../config/env.js';
import { ARGON2_OPTIONS } from '../../common/security/argon2-options.js';
import { randomToken, sha256 } from '../../common/security/tokens.js';
import { ActorType } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ADMIN_ACCESS_TTL_MS, ADMIN_SESSION_TTL_MS } from './admin-cookies.js';

export const ADMIN_JWT_AUDIENCE = 'zapadictos-admin';
export const JWT_ISSUER = 'zapadictos-api';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export interface AdminJwtPayload {
  sub: string;
  sid: string;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';
const LOCKED = `Demasiados intentos fallidos. Espera ${LOCK_MINUTES} minutos e inténtalo de nuevo`;

@Injectable()
export class AdminAuthService {
  /**
   * Hash de una contraseña que nadie conoce: si el correo no existe se
   * verifica contra este, para que la respuesta tarde lo mismo y no revele
   * qué correos son de administradores.
   */
  private dummyHash = argon2.hash(randomToken(), ARGON2_OPTIONS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, meta: RequestMeta) {
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    const now = new Date();

    if (admin?.lockedUntil && admin.lockedUntil > now) {
      await this.audit.log({
        action: 'ADMIN_LOGIN_LOCKED',
        actorType: ActorType.ANONYMOUS,
        entity: 'Admin',
        entityId: admin.id,
        ip: meta.ip,
      });
      throw new HttpException({ message: LOCKED }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const valid = await argon2.verify(admin?.passwordHash ?? (await this.dummyHash), password);

    if (!admin || !valid || !admin.active) {
      if (admin && !valid) {
        const failed = admin.failedLoginCount + 1;
        const lock = failed >= MAX_FAILED_LOGINS;
        await this.prisma.admin.update({
          where: { id: admin.id },
          data: {
            failedLoginCount: lock ? 0 : failed,
            lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : undefined,
          },
        });
      }
      await this.audit.log({
        action: 'ADMIN_LOGIN_FAILED',
        actorType: ActorType.ANONYMOUS,
        entity: 'Admin',
        entityId: admin?.id,
        details: { email, reason: !admin ? 'unknown_email' : !valid ? 'bad_password' : 'inactive' },
        ip: meta.ip,
      });
      throw new UnauthorizedException({ message: INVALID_CREDENTIALS });
    }

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
    });
    const tokens = await this.createSession(admin.id, randomUUID(), new Date(now.getTime() + ADMIN_SESSION_TTL_MS), meta);
    await this.audit.log({
      action: 'ADMIN_LOGIN',
      actorType: ActorType.ADMIN,
      adminId: admin.id,
      ip: meta.ip,
    });
    return { ...tokens, admin: this.toMe(admin) };
  }

  /**
   * Rotación del refresh token (docs/06-seguridad.md A07): cada uso entrega un
   * token nuevo y revoca el anterior. Si llega un token ya revocado, alguien lo
   * copió: se revoca toda la cadena (family) y hay que volver a ingresar.
   */
  async refresh(refreshToken: string | undefined, meta: RequestMeta) {
    if (!refreshToken) throw new UnauthorizedException();
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { admin: true },
    });
    if (!session) throw new UnauthorizedException();

    if (session.revokedAt) {
      await this.prisma.adminSession.updateMany({
        where: { family: session.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        action: 'ADMIN_REFRESH_REUSED',
        actorType: ActorType.ANONYMOUS,
        entity: 'Admin',
        entityId: session.adminId,
        details: { family: session.family },
        ip: meta.ip,
      });
      throw new UnauthorizedException();
    }

    if (session.expiresAt <= new Date() || !session.admin.active) {
      throw new UnauthorizedException();
    }

    // Revocar solo si sigue activa evita que dos peticiones simultáneas
    // con el mismo token generen dos sesiones válidas.
    const revoked = await this.prisma.adminSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw new UnauthorizedException();

    // La sesión nueva hereda el vencimiento: las 8 horas son absolutas.
    const tokens = await this.createSession(session.adminId, session.family, session.expiresAt, meta);
    return { ...tokens, admin: this.toMe(session.admin) };
  }

  async logout(refreshToken: string | undefined, sessionId: string | undefined) {
    const hash = refreshToken ? sha256(refreshToken) : undefined;
    if (!hash && !sessionId) return;
    await this.prisma.adminSession.updateMany({
      where: { revokedAt: null, OR: [...(hash ? [{ tokenHash: hash }] : []), ...(sessionId ? [{ id: sessionId }] : [])] },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(adminId: string, sessionId: string, current: string, next: string, meta: RequestMeta) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
    if (!(await argon2.verify(admin.passwordHash, current))) {
      throw new UnauthorizedException({ message: 'La contraseña actual no es correcta' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.admin.update({
        where: { id: adminId },
        data: { passwordHash: await argon2.hash(next, ARGON2_OPTIONS), mustChangePassword: false },
      });
      // Se cierran las demás sesiones abiertas; la actual sigue.
      await tx.adminSession.updateMany({
        where: { adminId, revokedAt: null, NOT: { id: sessionId } },
        data: { revokedAt: new Date() },
      });
      await this.audit.log(
        { action: 'ADMIN_PASSWORD_CHANGED', actorType: ActorType.ADMIN, adminId, entity: 'Admin', entityId: adminId, ip: meta.ip },
        tx,
      );
    });
    return this.toMe({ ...admin, mustChangePassword: false });
  }

  private async createSession(adminId: string, family: string, expiresAt: Date, meta: RequestMeta) {
    const refreshToken = randomToken();
    const session = await this.prisma.adminSession.create({
      data: {
        adminId,
        family,
        expiresAt,
        tokenHash: sha256(refreshToken),
        ip: meta.ip?.slice(0, 45),
        userAgent: meta.userAgent?.slice(0, 300),
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: adminId, sid: session.id } satisfies AdminJwtPayload, {
      secret: loadEnv().ADMIN_JWT_SECRET,
      audience: ADMIN_JWT_AUDIENCE,
      issuer: JWT_ISSUER,
      expiresIn: ADMIN_ACCESS_TTL_MS / 1000,
      algorithm: 'HS256',
    });
    return { accessToken, refreshToken, sessionExpiresAt: expiresAt };
  }

  toMe(admin: { id: string; name: string; email: string; mustChangePassword: boolean }): AdminMeDto {
    return { id: admin.id, name: admin.name, email: admin.email, mustChangePassword: admin.mustChangePassword };
  }
}
