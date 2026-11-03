import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  MAX_IMAGES_PER_COLOR,
  buildSku,
  formatCOP,
  slugify,
  type AdminColorCreateInput,
  type AdminColorUpdateInput,
  type AdminImageUpdateInput,
  type AdminOfferCreateInput,
  type AdminOfferDto,
  type AdminOfferUpdateInput,
  type AdminProductCreateInput,
  type AdminProductDetailDto,
  type AdminProductListQuery,
  type AdminProductRowDto,
  type AdminProductUpdateInput,
  type AdminVariantUpdateInput,
  type AdminVariantsCreateInput,
  type OfferState,
  type Paginated,
} from '@zapadictos/shared';
import { ActorType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService, diff } from '../audit/audit.service.js';
import { ImageStorage } from '../storage/image-storage.js';
import { detectImageType } from '../storage/image-type.js';
import { currentOffer } from '../catalog/pricing.js';

export interface Actor {
  adminId: string;
  ip?: string;
}

const ADMIN_PAGE_SIZE = 20;

export function offerState(
  offer: { active: boolean; startsAt: Date; endsAt: Date },
  now: Date,
): OfferState {
  if (offer.endsAt <= now) return 'ended';
  if (!offer.active) return 'inactive';
  return offer.startsAt > now ? 'scheduled' : 'current';
}

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: ImageStorage,
  ) {}

  private log(actor: Actor, action: string, entity: string, entityId: string, details?: Record<string, unknown>, tx?: Prisma.TransactionClient) {
    return this.audit.log(
      { action, actorType: ActorType.ADMIN, adminId: actor.adminId, entity, entityId, details, ip: actor.ip },
      tx,
    );
  }

  // ─────────────────────────────── Productos ───────────────────────────────

  async list(query: AdminProductListQuery): Promise<Paginated<AdminProductRowDto>> {
    const now = new Date();
    const where: Prisma.ProductWhereInput = {
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { reference: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
      ...(query.brand && { brand: { slug: query.brand } }),
      ...(query.status && { active: query.status === 'active' }),
    };
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
        include: {
          brand: { select: { name: true } },
          category: { select: { name: true } },
          offers: { where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } } },
          colors: {
            orderBy: { sortOrder: 'asc' },
            include: {
              variants: { where: { active: true }, select: { size: true, stock: true } },
              images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: products.map((p) => {
        const variants = p.colors.filter((c) => c.active).flatMap((c) => c.variants);
        return {
          id: p.id,
          name: p.name,
          reference: p.reference,
          brand: p.brand.name,
          category: p.category.name,
          price: p.price,
          salePrice: currentOffer(p.offers, now, p.price)?.salePrice ?? null,
          totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
          sizesCount: new Set(variants.map((v) => v.size)).size,
          active: p.active,
          coverUrl: p.colors.find((c) => c.images.length)?.images[0]?.url ?? null,
        };
      }),
      meta: {
        page: query.page,
        pageSize: ADMIN_PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
      },
    };
  }

  async detail(id: string): Promise<AdminProductDetailDto> {
    const now = new Date();
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        colors: {
          orderBy: { sortOrder: 'asc' },
          include: {
            variants: { orderBy: { size: 'asc' } },
            images: { orderBy: { sortOrder: 'asc' } },
          },
        },
        offers: { orderBy: { startsAt: 'desc' }, include: { createdBy: { select: { name: true } } } },
      },
    });
    if (!p) throw new NotFoundException();
    return {
      id: p.id,
      name: p.name,
      reference: p.reference,
      slug: p.slug,
      description: p.description,
      gender: p.gender,
      price: p.price,
      active: p.active,
      brandId: p.brandId,
      categoryId: p.categoryId,
      createdAt: p.createdAt.toISOString(),
      colors: p.colors.map((c) => ({
        id: c.id,
        name: c.name,
        hex: c.hex,
        code: c.code,
        sortOrder: c.sortOrder,
        active: c.active,
        variants: c.variants.map((v) => ({ id: v.id, size: v.size, sku: v.sku, stock: v.stock, active: v.active })),
        images: c.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, sortOrder: i.sortOrder })),
      })),
      offers: p.offers.map((o) => this.toOfferDto(o, now)),
    };
  }

  private toOfferDto(
    o: { id: string; salePrice: number; startsAt: Date; endsAt: Date; active: boolean; createdBy: { name: string } },
    now: Date,
  ): AdminOfferDto {
    return {
      id: o.id,
      salePrice: o.salePrice,
      startsAt: o.startsAt.toISOString(),
      endsAt: o.endsAt.toISOString(),
      active: o.active,
      state: offerState(o, now),
      createdBy: o.createdBy.name,
    };
  }

  private async assertBrandAndCategory(brandId?: string, categoryId?: string) {
    if (brandId && !(await this.prisma.brand.findUnique({ where: { id: brandId } }))) {
      throw new BadRequestException({ message: 'La marca no existe' });
    }
    if (categoryId && !(await this.prisma.category.findUnique({ where: { id: categoryId } }))) {
      throw new BadRequestException({ message: 'La categoría no existe' });
    }
  }

  async create(input: AdminProductCreateInput & { active: boolean }, actor: Actor) {
    await this.assertBrandAndCategory(input.brandId, input.categoryId);
    const product = await this.prisma.product.create({
      data: {
        name: input.name,
        reference: input.reference,
        slug: input.slug ?? slugify(input.name),
        description: input.description,
        gender: input.gender,
        price: Number(input.price),
        active: input.active,
        brandId: input.brandId,
        categoryId: input.categoryId,
      },
    });
    await this.log(actor, 'PRODUCT_CREATED', 'Product', product.id, { name: product.name, reference: product.reference });
    return this.detail(product.id);
  }

  async update(id: string, input: AdminProductUpdateInput, actor: Actor) {
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    await this.assertBrandAndCategory(input.brandId, input.categoryId);

    const price = input.price === undefined ? undefined : Number(input.price);
    if (price !== undefined && price !== before.price) {
      // Una oferta vigente o futura debe seguir siendo más barata que el precio normal.
      const blocking = await this.prisma.offer.findFirst({
        where: { productId: id, active: true, endsAt: { gt: new Date() }, salePrice: { gte: price } },
      });
      if (blocking) {
        throw new ConflictException({
          message: `Hay una oferta de ${formatCOP(blocking.salePrice)}: el precio normal debe ser mayor`,
        });
      }
    }

    const data = { ...input, price } as Prisma.ProductUncheckedUpdateInput;
    await this.prisma.$transaction(async (tx) => {
      const after = await tx.product.update({ where: { id }, data });
      if (after.reference !== before.reference) await this.regenerateSkus(tx, id);
      const changes = diff(before as unknown as Record<string, unknown>, Object.fromEntries(
        Object.keys(input).map((k) => [k, (after as unknown as Record<string, unknown>)[k]]),
      ));
      await this.log(actor, 'PRODUCT_UPDATED', 'Product', id, changes, tx);
    });
    return this.detail(id);
  }

  async deactivate(id: string, actor: Actor) {
    await this.prisma.product.update({ where: { id }, data: { active: false } });
    await this.log(actor, 'PRODUCT_DEACTIVATED', 'Product', id);
  }

  /** Los SKU dependen de la referencia y del código de color (buildSku). */
  private async regenerateSkus(tx: Prisma.TransactionClient, productId: string) {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: productId },
      include: { colors: { include: { variants: true } } },
    });
    // Primero a valores temporales para no chocar con la restricción única.
    for (const color of product.colors) {
      for (const v of color.variants) {
        await tx.variant.update({ where: { id: v.id }, data: { sku: `TMP-${v.id}`.slice(0, 30) } });
      }
    }
    for (const color of product.colors) {
      for (const v of color.variants) {
        await tx.variant.update({ where: { id: v.id }, data: { sku: buildSku(product.reference, color.code, v.size) } });
      }
    }
  }

  // ─────────────────────────────── Colores ───────────────────────────────

  async addColor(productId: string, input: AdminColorCreateInput, actor: Actor) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { colors: { select: { sortOrder: true } } },
    });
    if (!product) throw new NotFoundException();
    const sortOrder = Math.max(-1, ...product.colors.map((c) => c.sortOrder)) + 1;
    const color = await this.prisma.productColor.create({
      data: { productId, name: input.name, hex: input.hex, code: input.code, sortOrder },
    });
    await this.log(actor, 'COLOR_CREATED', 'ProductColor', color.id, { productId, name: color.name, code: color.code });
    return this.detail(productId);
  }

  async updateColor(colorId: string, input: AdminColorUpdateInput, actor: Actor) {
    const before = await this.prisma.productColor.findUnique({ where: { id: colorId } });
    if (!before) throw new NotFoundException();
    await this.prisma.$transaction(async (tx) => {
      const after = await tx.productColor.update({ where: { id: colorId }, data: input });
      if (after.code !== before.code) await this.regenerateSkus(tx, before.productId);
      await this.log(actor, 'COLOR_UPDATED', 'ProductColor', colorId,
        diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>), tx);
    });
    return this.detail(before.productId);
  }

  /**
   * Borra el color si nunca se vendió; si alguna de sus tallas está en un
   * pedido, solo se desactiva para no romper el historial.
   */
  async deleteColor(colorId: string, actor: Actor) {
    const color = await this.prisma.productColor.findUnique({
      where: { id: colorId },
      include: { images: true, variants: { select: { id: true, _count: { select: { orderItems: true } } } } },
    });
    if (!color) throw new NotFoundException();

    const sold = color.variants.some((v) => v._count.orderItems > 0);
    if (sold) {
      await this.prisma.productColor.update({ where: { id: colorId }, data: { active: false } });
      await this.log(actor, 'COLOR_DEACTIVATED', 'ProductColor', colorId, { reason: 'has_orders' });
      return { deleted: false, product: await this.detail(color.productId) };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.variant.deleteMany({ where: { productColorId: colorId } });
      await tx.productColor.delete({ where: { id: colorId } });
      await this.log(actor, 'COLOR_DELETED', 'ProductColor', colorId, { name: color.name, code: color.code }, tx);
    });
    await Promise.all(color.images.map((i) => this.storage.delete(i.publicId)));
    return { deleted: true, product: await this.detail(color.productId) };
  }

  // ─────────────────────────────── Tallas ───────────────────────────────

  async addVariants(colorId: string, input: AdminVariantsCreateInput, actor: Actor) {
    const color = await this.prisma.productColor.findUnique({
      where: { id: colorId },
      include: { product: { select: { reference: true } }, variants: { select: { size: true } } },
    });
    if (!color) throw new NotFoundException();
    const from = Number(input.from);
    const to = Number(input.to);
    const stock = Number(input.stock ?? 0);
    const existing = new Set(color.variants.map((v) => v.size));
    const sizes = Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((s) => !existing.has(s));
    if (sizes.length === 0) throw new ConflictException({ message: 'Esas tallas ya existen en este color' });

    await this.prisma.variant.createMany({
      data: sizes.map((size) => ({
        productColorId: colorId,
        size,
        stock,
        sku: buildSku(color.product.reference, color.code, size),
      })),
    });
    await this.log(actor, 'VARIANTS_CREATED', 'ProductColor', colorId, { sizes, stock });
    return this.detail(color.productId);
  }

  async updateVariant(variantId: string, input: AdminVariantUpdateInput, actor: Actor) {
    const before = await this.prisma.variant.findUnique({
      where: { id: variantId },
      include: { productColor: { select: { productId: true } } },
    });
    if (!before) throw new NotFoundException();
    const data = { ...input, stock: input.stock === undefined ? undefined : Number(input.stock) };
    const after = await this.prisma.variant.update({ where: { id: variantId }, data });
    // Cada ajuste de stock queda con el valor anterior y el nuevo.
    await this.log(actor, input.stock !== undefined ? 'STOCK_ADJUSTED' : 'VARIANT_UPDATED', 'Variant', variantId, {
      sku: after.sku,
      ...diff({ stock: before.stock, active: before.active }, { stock: after.stock, active: after.active }),
    });
    return this.detail(before.productColor.productId);
  }

  // ─────────────────────────────── Fotos ───────────────────────────────

  async uploadImage(colorId: string, file: { buffer: Buffer; size: number } | undefined, alt: string | undefined, actor: Actor) {
    if (!file) throw new BadRequestException({ message: 'Selecciona una imagen' });
    const color = await this.prisma.productColor.findUnique({
      where: { id: colorId },
      include: { product: { select: { id: true, name: true, reference: true } }, images: { select: { sortOrder: true } } },
    });
    if (!color) throw new NotFoundException();
    if (color.images.length >= MAX_IMAGES_PER_COLOR) {
      throw new ConflictException({ message: `Cada color admite hasta ${MAX_IMAGES_PER_COLOR} fotos` });
    }
    const type = detectImageType(file.buffer);
    if (!type) throw new UnsupportedMediaTypeException({ message: 'Solo se permiten imágenes JPEG, PNG o WebP' });

    const stored = await this.storage.upload(file.buffer, type, color.product.reference.toLowerCase());
    const sortOrder = Math.max(-1, ...color.images.map((i) => i.sortOrder)) + 1;
    try {
      const image = await this.prisma.productImage.create({
        data: {
          productColorId: colorId,
          url: stored.url,
          publicId: stored.publicId,
          alt: (alt || `${color.product.name} ${color.name}`).slice(0, 150),
          sortOrder,
        },
      });
      await this.log(actor, 'IMAGE_UPLOADED', 'ProductImage', image.id, { colorId, bytes: file.size, type: type.mime });
    } catch (error) {
      await this.storage.delete(stored.publicId);
      throw error;
    }
    return this.detail(color.product.id);
  }

  async updateImage(imageId: string, input: AdminImageUpdateInput, actor: Actor) {
    const image = await this.prisma.productImage.update({
      where: { id: imageId },
      data: input,
      include: { productColor: { select: { productId: true } } },
    });
    await this.log(actor, 'IMAGE_UPDATED', 'ProductImage', imageId, input);
    return this.detail(image.productColor.productId);
  }

  async deleteImage(imageId: string, actor: Actor) {
    const image = await this.prisma.productImage.delete({
      where: { id: imageId },
      include: { productColor: { select: { productId: true } } },
    });
    await this.storage.delete(image.publicId);
    await this.log(actor, 'IMAGE_DELETED', 'ProductImage', imageId);
    return this.detail(image.productColor.productId);
  }

  // ─────────────────────────────── Ofertas ───────────────────────────────

  /** Reglas de docs/05-reglas-negocio.md: más barata que el precio y sin cruces. */
  private async assertOfferValid(
    productId: string,
    offer: { salePrice: number; startsAt: Date; endsAt: Date; active: boolean },
    excludeId?: string,
  ) {
    if (offer.endsAt <= offer.startsAt) {
      throw new BadRequestException({ message: 'La fecha de fin debe ser posterior a la de inicio' });
    }
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException();
    if (offer.salePrice >= product.price) {
      throw new BadRequestException({
        message: `El precio de oferta debe ser menor que el precio normal (${formatCOP(product.price)})`,
      });
    }
    if (!offer.active) return;
    const overlap = await this.prisma.offer.findFirst({
      where: {
        productId,
        active: true,
        ...(excludeId && { NOT: { id: excludeId } }),
        startsAt: { lt: offer.endsAt },
        endsAt: { gt: offer.startsAt },
      },
    });
    if (overlap) {
      const fmt = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
      throw new ConflictException({
        message: `Se cruza con otra oferta activa (${fmt(overlap.startsAt)} – ${fmt(overlap.endsAt)}). Un producto solo puede tener una oferta activa a la vez.`,
      });
    }
  }

  async createOffer(productId: string, input: AdminOfferCreateInput, actor: Actor) {
    const data = {
      salePrice: Number(input.salePrice),
      startsAt: new Date(input.startsAt as Date),
      endsAt: new Date(input.endsAt as Date),
      active: input.active ?? true,
    };
    await this.assertOfferValid(productId, data);
    const offer = await this.prisma.offer.create({ data: { ...data, productId, createdById: actor.adminId } });
    await this.log(actor, 'OFFER_CREATED', 'Offer', offer.id, { productId, ...data });
    return this.detail(productId);
  }

  async updateOffer(offerId: string, input: AdminOfferUpdateInput, actor: Actor) {
    const before = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!before) throw new NotFoundException();
    const next = {
      salePrice: input.salePrice === undefined ? before.salePrice : Number(input.salePrice),
      startsAt: input.startsAt === undefined ? before.startsAt : new Date(input.startsAt as Date),
      endsAt: input.endsAt === undefined ? before.endsAt : new Date(input.endsAt as Date),
      active: input.active ?? before.active,
    };
    await this.assertOfferValid(before.productId, next, offerId);
    await this.prisma.offer.update({ where: { id: offerId }, data: next });
    await this.log(actor, 'OFFER_UPDATED', 'Offer', offerId,
      diff(before as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>));
    return this.detail(before.productId);
  }

  async deleteOffer(offerId: string, actor: Actor) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundException();
    if (offer.startsAt <= new Date()) {
      throw new ConflictException({
        message: 'Solo se pueden borrar ofertas que aún no empiezan. Para quitarla de la tienda, desactívala.',
      });
    }
    await this.prisma.offer.delete({ where: { id: offerId } });
    await this.log(actor, 'OFFER_DELETED', 'Offer', offerId, { salePrice: offer.salePrice });
    return this.detail(offer.productId);
  }
}
