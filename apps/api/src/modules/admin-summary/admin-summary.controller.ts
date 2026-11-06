import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard.js';
import { AdminSummaryService } from './admin-summary.service.js';

@Controller('admin/summary')
@UseGuards(AdminAuthGuard)
export class AdminSummaryController {
  constructor(private readonly summary: AdminSummaryService) {}

  @Get()
  get() {
    return this.summary.get();
  }
}
