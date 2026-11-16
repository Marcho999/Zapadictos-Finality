import { Module } from '@nestjs/common';
import { AdminBannerController } from './admin-banner.controller.js';
import { AdminBannerService } from './admin-banner.service.js';

@Module({
  controllers: [AdminBannerController],
  providers: [AdminBannerService],
})
export class AdminBannerModule {}
