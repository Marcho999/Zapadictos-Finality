import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [CatalogController],
  providers: [ProductsService, CatalogService],
})
export class CatalogModule {}
