import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CATALOG_PAGE_SIZE,
  type Paginated,
  type ProductCardDto,
  type ProductDetailDto,
  type ProductListQuery,
} from '@zapadictos/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  currentOffer,
  isNewProduct,
  publicStock,
  summarizeSizes,
} from './pricing.js';

/** Escapa los comodines de LIKE para que el texto del usuario sea literal. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Productos visibles: activos y con marca y categoría activas. */
const visibleProductWhere = {
  active: true,
  brand: { active: true },
  category: { active: true },
} satisfies Prisma.ProductWhereInput;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ProductListQuery): Promise<Paginated<ProductCardDto>> {
    const now = new Date();
    const pageSize = CATALOG_PAGE_SIZE;
    const offset = (query.page - 1) * pageSize;

    // Todas las condiciones usan parámetros ($1, $2…); ningún valor del
    // usuario se concatena en el SQL. Solo ORDER BY sale de una lista fija.
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p."active" AND b."active" AND c."active"`,
    ];
    if (query.q) {
      const pattern = likePattern(query.q.toLowerCase());
      conditions.push(
        Prisma.sql`(unaccent(lower(p."name")) LIKE unaccent(${pattern}) OR unaccent(lower(b."name")) LIKE unaccent(${pattern}))`,
      );
    }
    if (query.brand) {
      conditions.push(Prisma.sql`b."slug" = ANY(${query.brand}::text[])`);
    }
    if (query.category) {
      conditions.push(Prisma.sql`c."slug" = ${query.category}`);
    }
    if (query.gender) {
      // Hombre y Mujer incluyen los productos unisex (D-12).
      conditions.push(
        Prisma.sql`p."gender" IN (${query.gender}::"Gender", 'UNISEX'::"Gender")`,
      );
    }
    if (query.size !== undefined) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "ProductColor" pc
        JOIN "Variant" v ON v."productColorId" = pc."id"
        WHERE pc."productId" = p."id" AND pc."active" AND v."active"
          AND v."size" = ${query.size} AND v."stock" > 0)`);
    }
    if (query.onSale) {
      conditions.push(Prisma.sql`o."salePrice" IS NOT NULL`);
    }

    const priceConditions: Prisma.Sql[] = [];
    if (query.minPrice !== undefined) {
      priceConditions.push(Prisma.sql`"effectivePrice" >= ${query.minPrice}`);
    }
    if (query.maxPrice !== undefined) {
      priceConditions.push(Prisma.sql`"effectivePrice" <= ${query.maxPrice}`);
    }

    const orderBy = {
      newest: Prisma.sql`"createdAt" DESC, "id"`,
      price_asc: Prisma.sql`"effectivePrice" ASC, "id"`,
      price_desc: Prisma.sql`"effectivePrice" DESC, "id"`,
    }[query.sort];

    const rows = await this.prisma.$queryRaw<
      { id: string; total: bigint }[]
    >(Prisma.sql`
      WITH base AS (
        SELECT p."id", p."createdAt",
               COALESCE(o."salePrice", p."price") AS "effectivePrice"
        FROM "Product" p
        JOIN "Brand" b ON b."id" = p."brandId"
        JOIN "Category" c ON c."id" = p."categoryId"
        LEFT JOIN LATERAL (
          SELECT MIN(of."salePrice") AS "salePrice"
          FROM "Offer" of
          WHERE of."productId" = p."id" AND of."active"
            AND of."startsAt" <= ${now} AND of."endsAt" > ${now}
            AND of."salePrice" < p."price"
        ) o ON TRUE
        WHERE ${Prisma.join(conditions, ' AND ')}
      )
      SELECT "id", COUNT(*) OVER () AS "total"
      FROM base
      ${priceConditions.length ? Prisma.sql`WHERE ${Prisma.join(priceConditions, ' AND ')}` : Prisma.empty}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const total =
      rows.length > 0
        ? Number(rows[0].total)
        : await this.countWhenPageIsEmpty(query, offset);
    const ids = rows.map((row) => row.id);
    const cards = await this.loadCards(ids, now);

    return {
      data: cards,
      meta: {
        page: query.page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /**
   * Si se pide una página más allá de la última, COUNT(*) OVER() no devuelve
   * filas; se repite la consulta en la página 1 solo para saber el total.
   */
  private async countWhenPageIsEmpty(
    query: ProductListQuery,
    offset: number,
  ): Promise<number> {
    if (offset === 0) return 0;
    const firstPage = await this.list({ ...query, page: 1 });
    return firstPage.meta.total;
  }

  private async loadCards(ids: string[], now: Date): Promise<ProductCardDto[]> {
    if (ids.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: {
        brand: { select: { slug: true, name: true } },
        category: { select: { slug: true, name: true } },
        offers: {
          where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
        },
        colors: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
            variants: {
              where: { active: true },
              select: { size: true, stock: true },
            },
          },
        },
      },
    });

    const byId = new Map(products.map((p) => [p.id, p]));
    return ids
      .map((id) => byId.get(id))
      .filter((p) => p !== undefined)
      .map((p) => {
        const offer = currentOffer(p.offers, now, p.price);
        const cover = p.colors.find((c) => c.images.length > 0)?.images[0];
        return {
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          category: p.category,
          gender: p.gender,
          price: p.price,
          salePrice: offer?.salePrice ?? null,
          isNew: isNewProduct(p.createdAt, now),
          ...summarizeSizes(p.colors.flatMap((c) => c.variants)),
          coverImage: cover ? { url: cover.url, alt: cover.alt } : null,
        };
      });
  }

  async detail(slug: string): Promise<ProductDetailDto> {
    const now = new Date();
    const p = await this.prisma.product.findFirst({
      where: { slug, ...visibleProductWhere },
      include: {
        brand: { select: { slug: true, name: true } },
        category: { select: { slug: true, name: true } },
        offers: {
          where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
        },
        colors: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            variants: { where: { active: true }, orderBy: { size: 'asc' } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException();

    const offer = currentOffer(p.offers, now, p.price);
    const sizes = summarizeSizes(p.colors.flatMap((c) => c.variants));
    return {
      slug: p.slug,
      reference: p.reference,
      name: p.name,
      description: p.description,
      brand: p.brand,
      category: p.category,
      gender: p.gender,
      price: p.price,
      salePrice: offer?.salePrice ?? null,
      offer: offer
        ? { salePrice: offer.salePrice, endsAt: offer.endsAt.toISOString() }
        : null,
      isNew: isNewProduct(p.createdAt, now),
      minSize: sizes.minSize,
      maxSize: sizes.maxSize,
      colors: p.colors.map((c) => ({
        code: c.code,
        name: c.name,
        hex: c.hex,
        images: c.images.map((i) => ({ url: i.url, alt: i.alt })),
        variants: c.variants.map((v) => ({
          id: v.id,
          size: v.size,
          sku: v.sku,
          stock: publicStock(v.stock),
        })),
      })),
    };
  }
}
