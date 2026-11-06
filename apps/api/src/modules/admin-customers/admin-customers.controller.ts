import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { adminCustomerListQuerySchema, type z } from '@zapadictos/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard.js';
import { AdminCustomersService } from './admin-customers.service.js';

@Controller('admin/customers')
@UseGuards(AdminAuthGuard)
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(adminCustomerListQuerySchema)) query: z.output<typeof adminCustomerListQuerySchema>) {
    return this.customers.list(query);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.customers.detail(id);
  }
}
