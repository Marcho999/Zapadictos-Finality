import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'La solicitud no es válida',
  401: 'Debes iniciar sesión',
  403: 'No tienes permiso para hacer esto',
  404: 'No encontramos lo que buscas',
  409: 'La operación no se puede completar en el estado actual',
  413: 'El archivo supera el tamaño máximo de 5 MB',
  415: 'Formato de archivo no permitido',
  429: 'Demasiados intentos. Espera un momento e inténtalo de nuevo',
  500: 'Ocurrió un error inesperado. Inténtalo de nuevo',
};

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  slug: 'Ya existe un registro con ese slug',
  reference: 'Ya existe un producto con esa referencia',
  name: 'Ya existe un registro con ese nombre',
  email: 'Ya existe una cuenta con ese correo',
  sku: 'Ya existe una variante con ese SKU',
  code: 'Ese código de color ya existe en este producto',
};

/**
 * Todas las respuestas de error tienen la forma { statusCode, error, message },
 * en español y sin detalles internos (docs/04-api.md, docs/06-seguridad.md A05).
 *
 * Los errores que lanzamos nosotros llevan un objeto `{ message }`; los que
 * genera Nest (o librerías como el throttler) llevan `statusCode` y su mensaje
 * en inglés, así que esos se reemplazan por el mensaje por defecto.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const custom =
        typeof body === 'object' && body !== null
          ? (body as { message?: unknown; errors?: unknown; statusCode?: unknown })
          : {};
      const ours = custom.statusCode === undefined && typeof custom.message === 'string';
      this.send(response, status, ours ? (custom.message as string) : undefined, custom.errors);
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = JSON.stringify(exception.meta ?? {});
        const field = Object.keys(UNIQUE_FIELD_LABELS).find((f) => target.includes(f));
        this.send(response, 409, field ? UNIQUE_FIELD_LABELS[field] : 'Ese valor ya está en uso');
        return;
      }
      if (exception.code === 'P2025') {
        this.send(response, 404);
        return;
      }
    }

    // Error no controlado: se registra completo en el servidor, pero el
    // cliente solo recibe un mensaje genérico, sin stack trace.
    this.logger.error(exception instanceof Error ? exception.stack : exception);
    this.send(response, 500);
  }

  private send(response: Response, status: number, message?: string, errors?: unknown) {
    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message: message ?? DEFAULT_MESSAGES[status] ?? DEFAULT_MESSAGES[500],
      ...(Array.isArray(errors) ? { errors } : {}),
    });
  }
}
