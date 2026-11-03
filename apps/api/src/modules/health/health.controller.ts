import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Para Render y para despertar la API antes de una demo. */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        message: 'La base de datos no responde',
      });
    }
    return { status: 'ok' };
  }
}
