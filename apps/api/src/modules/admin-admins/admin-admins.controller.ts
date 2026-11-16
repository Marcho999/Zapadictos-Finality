import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { adminCreateSchema, adminUpdateSchema, type AdminCreateInput, type AdminUpdateInput } from '@zapadictos/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminAuthGuard, CurrentAdmin, type AuthenticatedAdmin } from '../admin-auth/admin-auth.guard.js';
import { AdminAdminsService } from './admin-admins.service.js';

@Controller('admin/admins')
@UseGuards(AdminAuthGuard)
export class AdminAdminsController {
  constructor(private readonly admins: AdminAdminsService) {}

  @Get()
  list() {
    return this.admins.list();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(adminCreateSchema)) body: AdminCreateInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.admins.create(body, { adminId: admin.id, ip: req.ip });
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(adminUpdateSchema)) body: AdminUpdateInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.admins.update(id, body, { adminId: admin.id, ip: req.ip });
  }
}
