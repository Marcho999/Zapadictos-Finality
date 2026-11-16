import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import {
  productListQuerySchema,
  productSlugSchema,
  type ProductListQuery,
} from '@zapadictos/shared';
import { Public } from '../../common/security/route-protection.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CatalogService } from './catalog.service.js';
import { ProductsService } from './products.service.js';

/** Endpoints públicos del catálogo (docs/04-api.md). */
@Public()
@Controller()
export class CatalogController {
  constructor(
    private readonly products: ProductsService,
    private readonly catalog: CatalogService,
  ) {}

  @Get('products')
  @Header('Cache-Control', 'public, max-age=30')
  listProducts(
    @Query(new ZodValidationPipe(productListQuerySchema))
    query: ProductListQuery,
  ) {
    return this.products.list(query);
  }

  @Get('products/:slug')
  @Header('Cache-Control', 'public, max-age=30')
  productDetail(
    @Param('slug', new ZodValidationPipe(productSlugSchema)) slug: string,
  ) {
    return this.products.detail(slug);
  }

  @Get('brands')
  @Header('Cache-Control', 'public, max-age=300')
  brands() {
    return this.catalog.brands();
  }

  @Get('categories')
  @Header('Cache-Control', 'public, max-age=300')
  categories() {
    return this.catalog.categories();
  }

  @Get('banner')
  @Header('Cache-Control', 'public, max-age=60')
  banner() {
    return this.catalog.banner();
  }
}
