import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminOrdersService } from './admin-orders.service.js';

@Module({
  imports: [OrdersModule],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService],
})
export class AdminOrdersModule {}
