import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { OriginGuard } from './common/security/origin.guard.js';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module.js';
import { AdminCatalogModule } from './modules/admin-catalog/admin-catalog.module.js';
import { AdminOrdersModule } from './modules/admin-orders/admin-orders.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CustomerAuthModule } from './modules/customer-auth/customer-auth.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { loadEnv } from './config/env.js';

@Module({
  imports: [
    // Límite general por IP; las rutas sensibles (login) tienen uno propio.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    // Las tareas programadas no corren en las pruebas: ahí se llaman a mano.
    ...(loadEnv().NODE_ENV === 'test' ? [] : [ScheduleModule.forRoot()]),
    PrismaModule,
    AuditModule,
    StorageModule,
    CatalogModule,
    CustomerAuthModule,
    CustomersModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    AdminAuthModule,
    AdminCatalogModule,
    AdminOrdersModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class AppModule {}
