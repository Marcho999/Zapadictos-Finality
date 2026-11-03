import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { adminOrderListQuerySchema, adminOrderStatusSchema, type z } from '@zapadictos/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminAuthGuard, CurrentAdmin, type AuthenticatedAdmin } from '../admin-auth/admin-auth.guard.js';
import { AdminOrdersService } from './admin-orders.service.js';

@Controller('admin/orders')
@UseGuards(AdminAuthGuard)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(adminOrderListQuerySchema)) query: z.output<typeof adminOrderListQuerySchema>) {
    return this.orders.list(query);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.detail(id);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(adminOrderStatusSchema)) body: z.output<typeof adminOrderStatusSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.orders.changeStatus(id, body.status, body.reason, { adminId: admin.id, ip: req.ip });
  }

  /** Marca como resuelto un pedido que necesitaba revisión (p. ej. tras un reembolso manual). */
  @Post(':id/resolve-review')
  resolve(@Param('id', new ParseUUIDPipe()) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() req: Request) {
    return this.orders.resolveReview(id, { adminId: admin.id, ip: req.ip });
  }
}
