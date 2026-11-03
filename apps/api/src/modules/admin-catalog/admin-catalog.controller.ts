import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MAX_IMAGE_BYTES,
  adminBrandCreateSchema,
  adminBrandUpdateSchema,
  adminCategoryCreateSchema,
  adminCategoryUpdateSchema,
  adminColorCreateSchema,
  adminColorUpdateSchema,
  adminImageUpdateSchema,
  adminImageUploadSchema,
  adminOfferCreateSchema,
  adminOfferUpdateSchema,
  adminProductCreateSchema,
  adminProductListQuerySchema,
  adminProductUpdateSchema,
  adminVariantUpdateSchema,
  adminVariantsCreateSchema,
} from '@zapadictos/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminAuthGuard, CurrentAdmin, type AuthenticatedAdmin } from '../admin-auth/admin-auth.guard.js';
import { AdminProductsService, type Actor } from './admin-products.service.js';
import { AdminTaxonomyService } from './admin-taxonomy.service.js';

const Id = () => new ParseUUIDPipe();
const actorOf = (admin: AuthenticatedAdmin, req: Request): Actor => ({ adminId: admin.id, ip: req.ip });
type Body<S extends { parse: (v: unknown) => unknown }> = ReturnType<S['parse']>;

/** Catálogo del panel (docs/04-api.md). Todo exige la sesión de administrador. */
@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminCatalogController {
  constructor(
    private readonly products: AdminProductsService,
    private readonly taxonomy: AdminTaxonomyService,
  ) {}

  // Productos
  @Get('products')
  list(@Query(new ZodValidationPipe(adminProductListQuerySchema)) query: Body<typeof adminProductListQuerySchema>) {
    return this.products.list(query);
  }

  @Get('products/:id')
  detail(@Param('id', Id()) id: string) {
    return this.products.detail(id);
  }

  @Post('products')
  create(
    @Body(new ZodValidationPipe(adminProductCreateSchema)) body: Body<typeof adminProductCreateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.products.create(body, actorOf(admin, req));
  }

  @Patch('products/:id')
  update(
    @Param('id', Id()) id: string,
    @Body(new ZodValidationPipe(adminProductUpdateSchema)) body: Body<typeof adminProductUpdateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.products.update(id, body, actorOf(admin, req));
  }

  @Delete('products/:id')
  @HttpCode(204)
  deactivate(@Param('id', Id()) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() req: Request) {
    return this.products.deactivate(id, actorOf(admin, req));
  }

  // Colores
  @Post('products/:id/colors')
  addColor(
    @Param('id', Id()) id: string,
    @Body(new ZodValidationPipe(adminColorCreateSchema)) body: Body<typeof adminColorCreateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.products.addColor(id, body, actorOf(admin, req));
  }

  @Patch('colors/:id')
  updateColor(
    @Param('id', Id()) id: string,
    @Body(new ZodValidationPipe(adminColorUpdateSchema)) body: Body<typeof adminColorUpdateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.products.updateColor(id, body, actorOf(admin, req));
  }

  @Delete('colors/:id')
  deleteColor(@Param('id', Id()) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() req: Request) {
    return this.products.deleteColor(id, actorOf(admin, req));
  }

  // Tallas
  @Post('colors/:id/variants')
  addVariants(
    @Param('id', Id()) id: string,
    @Body(new ZodValidationPipe(adminVariantsCreateSchema)) body: Body<typeof adminVariantsCreateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.products.addVariants(id, body, actorOf(admin, req));
  }

  @Patch('variants/:id')
  updateVariant(
    @Param('id', Id()) id: string,
    @Body(new ZodValidationPipe(adminVariantUpdateSchema)) body: Body<typeof adminVariantUpdateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.products.updateVariant(id, body, actorOf(admin, req));
  }

  // Fotos
  @Post('colors/:id/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 2 } }))
  uploadImage(
    @Param('id', Id()) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(adminImageUploadSchema)) body: Body<typeof adminImageUploadSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.products.uploadImage(id, file, body.alt, actorOf(admin, req));
  }

  @Patch('images/:id')
  updateImage(
    @Param('id', Id()) id: string,
    @Body(new ZodValidationPipe(adminImageUpdateSchema)) body: Body<typeof adminImageUpdateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.products.updateImage(id, body, actorOf(admin, req));
  }

  @Delete('images/:id')
  deleteImage(@Param('id', Id()) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() req: Request) {
    return this.products.deleteImage(id, actorOf(admin, req));
  }

  // Ofertas
  @Post('products/:id/offers')
  createOffer(
    @Param('id', Id()) id: string,
    @Body(new ZodValidationPipe(adminOfferCreateSchema)) body: Body<typeof adminOfferCreateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.products.createOffer(id, body, actorOf(admin, req));
  }

  @Patch('offers/:id')
  updateOffer(
    @Param('id', Id()) id: string,
    @Body(new ZodValidationPipe(adminOfferUpdateSchema)) body: Body<typeof adminOfferUpdateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.products.updateOffer(id, body, actorOf(admin, req));
  }

  @Delete('offers/:id')
  deleteOffer(@Param('id', Id()) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() req: Request) {
    return this.products.deleteOffer(id, actorOf(admin, req));
  }

  // Marcas y categorías
  @Get('brands')
  brands() {
    return this.taxonomy.brands();
  }

  @Post('brands')
  createBrand(
    @Body(new ZodValidationPipe(adminBrandCreateSchema)) body: Body<typeof adminBrandCreateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.taxonomy.createBrand(body, actorOf(admin, req));
  }

  @Patch('brands/:id')
  updateBrand(
    @Param('id', Id()) id: string,
    @Body(new ZodValidationPipe(adminBrandUpdateSchema)) body: Body<typeof adminBrandUpdateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.taxonomy.updateBrand(id, body, actorOf(admin, req));
  }

  @Get('categories')
  categories() {
    return this.taxonomy.categories();
  }

  @Post('categories')
  createCategory(
    @Body(new ZodValidationPipe(adminCategoryCreateSchema)) body: Body<typeof adminCategoryCreateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.taxonomy.createCategory(body, actorOf(admin, req));
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', Id()) id: string,
    @Body(new ZodValidationPipe(adminCategoryUpdateSchema)) body: Body<typeof adminCategoryUpdateSchema>,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() req: Request,
  ) {
    return this.taxonomy.updateCategory(id, body, actorOf(admin, req));
  }
}
