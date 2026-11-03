import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './orders.service.js';

/** Cada minuto cancela los pedidos vencidos y devuelve su stock (D-08). */
@Injectable()
export class OrdersExpirationTask {
  private readonly logger = new Logger('OrdersExpiration');
  private running = false;

  constructor(private readonly orders: OrdersService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'orders-expiration' })
  async run() {
    if (this.running) return; // nunca dos corridas a la vez
    this.running = true;
    try {
      await this.orders.cancelExpired();
    } catch (error) {
      this.logger.error(`Falló la cancelación de pedidos vencidos: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
