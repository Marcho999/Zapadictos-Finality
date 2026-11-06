import { Module } from '@nestjs/common';
import { AdminSummaryController } from './admin-summary.controller.js';
import { AdminSummaryService } from './admin-summary.service.js';

@Module({
  controllers: [AdminSummaryController],
  providers: [AdminSummaryService],
})
export class AdminSummaryModule {}
