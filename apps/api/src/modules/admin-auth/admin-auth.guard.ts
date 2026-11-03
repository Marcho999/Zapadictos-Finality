import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { loadEnv } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ADMIN_ACCESS_COOKIE } from './admin-cookies.js';
import {
  ADMIN_JWT_AUDIENCE,
  JWT_ISSUER,
  type AdminJwtPayload,
} from './admin-auth.service.js';

export interface AuthenticatedAdmin {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  sessionId: string;
}

type AdminRequest = Request & { admin?: AuthenticatedAdmin };

const ALLOW_PENDING_PASSWORD = 'allowPendingPassword';

/** Rutas que se pueden usar antes de cambiar la contraseña temporal. */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD, true);

export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedAdmin => {
    const admin = ctx.switchToHttp().getRequest<AdminRequest>().admin;
    if (!admin) throw new UnauthorizedException();
    return admin;
  },
);

/**
 * Protege todo /admin (docs/06-seguridad.md A01). Solo acepta tokens firmados
 * con el secreto del panel y con la audiencia del panel. Además revisa en la
 * base que la sesión siga abierta y el administrador siga activo, para que
 * desactivar a alguien o cerrar sesión tenga efecto inmediato.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const token: unknown = request.cookies?.[ADMIN_ACCESS_COOKIE];
    if (typeof token !== 'string' || token.length === 0) throw new UnauthorizedException();

    let payload: AdminJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<AdminJwtPayload>(token, {
        secret: loadEnv().ADMIN_JWT_SECRET,
        audience: ADMIN_JWT_AUDIENCE,
        issuer: JWT_ISSUER,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException();
    }

    const session = await this.prisma.adminSession.findUnique({
      where: { id: payload.sid },
      include: { admin: true },
    });
    if (
      !session ||
      session.adminId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.admin.active
    ) {
      throw new UnauthorizedException();
    }

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (session.admin.mustChangePassword && !allowPending) {
      throw new ForbiddenException({ message: 'Debes cambiar tu contraseña temporal' });
    }

    request.admin = {
      id: session.admin.id,
      name: session.admin.name,
      email: session.admin.email,
      mustChangePassword: session.admin.mustChangePassword,
      sessionId: session.id,
    };
    return true;
  }
}
