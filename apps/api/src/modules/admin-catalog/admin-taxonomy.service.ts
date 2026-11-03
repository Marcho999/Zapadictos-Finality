import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  slugify,
  type AdminBrandCreateInput,
  type AdminBrandDto,
  type AdminBrandUpdateInput,
  type AdminCategoryDto,
  type AdminCategoryUpdateInput,
} from '@zapadictos/shared';
import { ActorType } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService, diff } from '../audit/audit.service.js';
import type { Actor } from './admin-products.service.js';

/** Marcas y categorías (HU-18). */
@Injectable()
export class AdminTaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private log(actor: Actor, action: string, entity: string, entityId: string, details?: Record<string, unknown>) {
    return this.audit.log({ action, actorType: ActorType.ADMIN, adminId: actor.adminId, entity, entityId, details, ip: actor.ip });
  }

  async brands(): Promise<AdminBrandDto[]> {
    const brands = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, active: b.active, productCount: b._count.products }));
  }

  async createBrand(input: AdminBrandCreateInput, actor: Actor) {
    const brand = await this.prisma.brand.create({ data: { name: input.name, slug: input.slug ?? slugify(input.name) } });
    await this.log(actor, 'BRAND_CREATED', 'Brand', brand.id, { name: brand.name });
    return brand;
  }

  async updateBrand(id: string, input: AdminBrandUpdateInput, actor: Actor) {
    const before = await this.prisma.brand.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    if (input.active === false && before.active) await this.assertNoActiveProducts({ brandId: id }, 'marca');
    const after = await this.prisma.brand.update({ where: { id }, data: input });
    await this.log(actor, 'BRAND_UPDATED', 'Brand', id, diff(before, after));
    return after;
  }

  async categories(): Promise<AdminCategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      active: c.active,
      sortOrder: c.sortOrder,
      productCount: c._count.products,
    }));
  }

  async createCategory(input: AdminBrandCreateInput, actor: Actor) {
    const last = await this.prisma.category.aggregate({ _max: { sortOrder: true } });
    const category = await this.prisma.category.create({
      data: { name: input.name, slug: input.slug ?? slugify(input.name), sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    await this.log(actor, 'CATEGORY_CREATED', 'Category', category.id, { name: category.name });
    return category;
  }

  async updateCategory(id: string, input: AdminCategoryUpdateInput, actor: Actor) {
    const before = await this.prisma.category.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    if (input.active === false && before.active) await this.assertNoActiveProducts({ categoryId: id }, 'categoría');
    const after = await this.prisma.category.update({ where: { id }, data: input });
    await this.log(actor, 'CATEGORY_UPDATED', 'Category', id, diff(before, after));
    return after;
  }

  /** Regla: solo se desactiva si no tiene productos activos (docs/05-reglas-negocio.md). */
  private async assertNoActiveProducts(where: { brandId?: string; categoryId?: string }, label: string) {
    const count = await this.prisma.product.count({ where: { ...where, active: true } });
    if (count > 0) {
      throw new ConflictException({
        message: `No se puede desactivar: la ${label} tiene ${count} ${count === 1 ? 'producto activo' : 'productos activos'}`,
      });
    }
  }
}
