import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { AdminCustomersController } from './admin-customers.controller.js';
import { AdminCustomersService } from './admin-customers.service.js';

@Module({
  imports: [CustomersModule],
  controllers: [AdminCustomersController],
  providers: [AdminCustomersService],
})
export class AdminCustomersModule {}
