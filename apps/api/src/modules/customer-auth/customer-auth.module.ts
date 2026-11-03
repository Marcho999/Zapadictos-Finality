import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthGuard } from './customer-auth.guard.js';
import { CustomerAuthService } from './customer-auth.service.js';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, CustomerAuthGuard],
  exports: [CustomerAuthGuard, JwtModule],
})
export class CustomerAuthModule {}
