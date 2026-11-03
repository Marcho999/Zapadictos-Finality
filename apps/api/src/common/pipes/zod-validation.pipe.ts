import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valida y transforma la entrada con un esquema Zod (D-21).
 * Los esquemas usan `.strict()`, así que un campo no declarado se rechaza:
 * es el equivalente de `whitelist` + `forbidNonWhitelisted`.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Los datos enviados no son válidos',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || null,
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
