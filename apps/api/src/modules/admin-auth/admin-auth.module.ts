import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { AdminAuthService } from './admin-auth.service.js';

@Global()
@Module({
  // El secreto se pasa en cada firma/verificación: no hay un secreto global
  // que pueda usarse por error para otro tipo de cuenta.
  imports: [JwtModule.register({})],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminAuthGuard],
  exports: [AdminAuthGuard, JwtModule],
})
export class AdminAuthModule {}
