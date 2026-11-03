import { Module } from '@nestjs/common';
import { OrdersExpirationTask } from './orders-expiration.task.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersExpirationTask],
  exports: [OrdersService],
})
export class OrdersModule {}
