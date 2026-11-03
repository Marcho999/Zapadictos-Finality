import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { loadEnv } from '../../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SKIP_ORIGIN_CHECK = 'skipOriginCheck';

/** Para llamadas de servidor a servidor (el webhook de Wompi). */
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK, true);

/**
 * Defensa adicional contra CSRF (docs/06-seguridad.md A05): toda petición que
 * modifica datos debe venir de la web de Zapadictos. Se suma a SameSite=Strict.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed = new URL(loadEnv().WEB_ORIGIN).origin;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ORIGIN_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    if (request.headers.origin !== this.allowed) {
      throw new ForbiddenException({ message: 'Origen de la petición no permitido' });
    }
    return true;
  }
}
