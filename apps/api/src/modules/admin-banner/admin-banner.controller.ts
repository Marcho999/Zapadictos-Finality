import { Body, Controller, Get, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_IMAGE_BYTES, adminBannerUpdateSchema, type AdminBannerUpdateInput } from '@zapadictos/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminAuthGuard, CurrentAdmin, type AuthenticatedAdmin } from '../admin-auth/admin-auth.guard.js';
import { AdminBannerService } from './admin-banner.service.js';

@Controller('admin/banner')
@UseGuards(AdminAuthGuard)
export class AdminBannerController {
  constructor(private readonly banner: AdminBannerService) {}

  @Get()
  get() {
    return this.banner.get();
  }

  @Put()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 5 } }))
  update(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(adminBannerUpdateSchema)) body: AdminBannerUpdateInput,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.banner.update(body, file, { adminId: admin.id, ip: req.ip });
  }
}
