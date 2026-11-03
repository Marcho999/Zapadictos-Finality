import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { addressCreateSchema, addressUpdateSchema, profileUpdateSchema, type z } from '@zapadictos/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentCustomer, CustomerAuthGuard, type AuthenticatedCustomer } from '../customer-auth/customer-auth.guard.js';
import { CustomersService } from './customers.service.js';

@Controller('users/me')
@UseGuards(CustomerAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  me(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.customers.me(customer.id);
  }

  @Patch()
  updateMe(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(profileUpdateSchema)) body: z.output<typeof profileUpdateSchema>,
  ) {
    return this.customers.updateMe(customer.id, body);
  }

  @Get('addresses')
  addresses(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.customers.addresses(customer.id);
  }

  @Post('addresses')
  createAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(addressCreateSchema)) body: z.output<typeof addressCreateSchema>,
  ) {
    return this.customers.createAddress(customer.id, body);
  }

  @Patch('addresses/:id')
  updateAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(addressUpdateSchema)) body: z.output<typeof addressUpdateSchema>,
  ) {
    return this.customers.updateAddress(customer.id, id, body);
  }

  @Delete('addresses/:id')
  deleteAddress(@CurrentCustomer() customer: AuthenticatedCustomer, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.customers.deleteAddress(customer.id, id);
  }
}
