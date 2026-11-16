import { Module } from '@nestjs/common';
import { AdminAdminsController } from './admin-admins.controller.js';
import { AdminAdminsService } from './admin-admins.service.js';

@Module({
  controllers: [AdminAdminsController],
  providers: [AdminAdminsService],
})
export class AdminAdminsModule {}
