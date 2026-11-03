import { Module } from '@nestjs/common';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminTaxonomyService } from './admin-taxonomy.service.js';

@Module({
  controllers: [AdminCatalogController],
  providers: [AdminProductsService, AdminTaxonomyService],
})
export class AdminCatalogModule {}
