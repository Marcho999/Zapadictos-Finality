import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { orderCreateSchema, orderListQuerySchema, type z } from '@zapadictos/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentCustomer, CustomerAuthGuard, type AuthenticatedCustomer } from '../customer-auth/customer-auth.guard.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(CustomerAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(orderCreateSchema)) body: z.output<typeof orderCreateSchema>,
  ) {
    return this.orders.create(customer.id, body.addressId);
  }

  @Get()
  list(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Query(new ZodValidationPipe(orderListQuerySchema)) query: z.output<typeof orderListQuerySchema>,
  ) {
    return this.orders.list(customer.id, query.page);
  }

  @Get(':id')
  detail(@CurrentCustomer() customer: AuthenticatedCustomer, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.detail(customer.id, id);
  }
}
