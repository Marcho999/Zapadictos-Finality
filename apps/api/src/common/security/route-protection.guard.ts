import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const IS_PUBLIC = 'isPublic';
/** Marca una ruta como pública para el guard global de A01 (docs/06-seguridad.md). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

// Mismo valor que GUARDS_METADATA en @nestjs/common/constants.js: se repite
// aquí en vez de importarlo para no depender de una ruta no pública del paquete.
const GUARDS_METADATA = '__guards__';

/**
 * Red de seguridad de A01 (docs/06-seguridad.md): no reemplaza a
 * AdminAuthGuard ni a CustomerAuthGuard, que siguen validando la sesión de
 * verdad. Solo falla si un controlador no tiene ni @Public() ni
 * @UseGuards(...), para que olvidar proteger una ruta nueva no la deje
 * abierta en silencio.
 */
@Injectable()
export class RouteProtectionGuard implements CanActivate {
  private readonly logger = new Logger('RouteProtection');

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const hasGuards = targets.some((t) => ((Reflect.getMetadata(GUARDS_METADATA, t) as unknown[]) ?? []).length > 0);
    if (hasGuards) return true;

    // No se expone el detalle al cliente (docs/06-seguridad.md A05): queda en el log.
    this.logger.error(
      `Ruta sin proteger: agrega @Public() o @UseGuards(...) en ${context.getClass().name}.${context.getHandler().name}`,
    );
    throw new InternalServerErrorException();
  }
}
