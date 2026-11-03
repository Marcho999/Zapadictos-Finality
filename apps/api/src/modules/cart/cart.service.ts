import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MAX_QTY_PER_ITEM, type CartDto, type CartLineDto, type CartVariantDto } from '@zapadictos/shared';
import { loadEnv } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { currentOffer, publicStock } from '../catalog/pricing.js';

/** Todo lo necesario para decidir si una variante se puede comprar y a qué precio. */
export const variantForSaleInclude = {
  productColor: {
    include: {
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      product: {
        include: {
          brand: true,
          category: true,
          offers: { where: { active: true } },
        },
      },
    },
  },
} satisfies Prisma.VariantInclude;

export type VariantForSale = Prisma.VariantGetPayload<{ include: typeof variantForSaleInclude }>;

/** Una variante se puede comprar si ella, su color, su producto, su marca y su categoría están activos. */
export function isPurchasable(v: VariantForSale): boolean {
  const color = v.productColor;
  const product = color.product;
  return v.active && color.active && product.active && product.brand.active && product.category.active;
}

/** Precio vigente (con la oferta, si hay): lo calcula siempre la API (A04). */
export function unitPriceOf(v: VariantForSale, now = new Date()): { unitPrice: number; listPrice: number } {
  const product = v.productColor.product;
  const offer = currentOffer(product.offers, now, product.price);
  return { unitPrice: offer?.salePrice ?? product.price, listPrice: product.price };
}

function toCartVariant(v: VariantForSale, now: Date): CartVariantDto {
  const product = v.productColor.product;
  const { unitPrice } = unitPriceOf(v, now);
  return {
    id: v.id,
    sku: v.sku,
    size: v.size,
    stock: publicStock(v.stock),
    available: isPurchasable(v),
    colorName: v.productColor.name,
    colorCode: v.productColor.code,
    productName: product.name,
    productSlug: product.slug,
    brandName: product.brand.name,
    price: product.price,
    salePrice: unitPrice < product.price ? unitPrice : null,
    imageUrl: v.productColor.images[0]?.url ?? null,
  };
}

/** Problema de una línea del carrito, en palabras para el cliente. */
function lineProblem(v: VariantForSale, quantity: number): string | null {
  if (!isPurchasable(v)) return 'Este producto ya no está disponible';
  if (v.stock === 0) return 'Se agotó esta talla';
  if (v.stock < quantity) return `Solo ${v.stock === 1 ? 'queda 1 par' : `quedan ${v.stock} pares`} en esta talla`;
  return null;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /** Datos públicos de variantes (carrito local del visitante). */
  async variants(ids: string[]): Promise<CartVariantDto[]> {
    const now = new Date();
    const variants = await this.prisma.variant.findMany({ where: { id: { in: ids } }, include: variantForSaleInclude });
    return variants.map((v) => toCartVariant(v, now));
  }

  async cart(customerId: string): Promise<CartDto> {
    const now = new Date();
    const items = await this.prisma.cartItem.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
      include: { variant: { include: variantForSaleInclude } },
    });
    const lines: CartLineDto[] = items.map((item) => {
      const { unitPrice } = unitPriceOf(item.variant, now);
      return {
        id: item.id,
        quantity: item.quantity,
        variant: toCartVariant(item.variant, now),
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        problem: lineProblem(item.variant, item.quantity),
      };
    });
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const shippingCost = lines.length ? loadEnv().SHIPPING_COST : 0;
    return {
      lines,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotal,
      shippingCost,
      total: subtotal + shippingCost,
      canCheckout: lines.length > 0 && lines.every((l) => l.problem === null),
    };
  }

  private async purchasableVariant(variantId: string) {
    const variant = await this.prisma.variant.findUnique({ where: { id: variantId }, include: variantForSaleInclude });
    if (!variant || !isPurchasable(variant)) throw new NotFoundException({ message: 'Ese producto no está disponible' });
    return variant;
  }

  async add(customerId: string, variantId: string, quantity: number): Promise<CartDto> {
    const variant = await this.purchasableVariant(variantId);
    const existing = await this.prisma.cartItem.findUnique({ where: { customerId_variantId: { customerId, variantId } } });
    const next = (existing?.quantity ?? 0) + quantity;
    if (next > MAX_QTY_PER_ITEM) {
      throw new BadRequestException({ message: `Puedes llevar hasta ${MAX_QTY_PER_ITEM} pares de la misma talla` });
    }
    if (next > variant.stock) {
      throw new ConflictException({
        message: variant.stock === 0 ? 'Se agotó esta talla' : `Solo quedan ${variant.stock} pares en esta talla`,
      });
    }
    await this.prisma.cartItem.upsert({
      where: { customerId_variantId: { customerId, variantId } },
      create: { customerId, variantId, quantity: next },
      update: { quantity: next },
    });
    return this.cart(customerId);
  }

  async update(customerId: string, itemId: string, quantity: number): Promise<CartDto> {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, customerId }, include: { variant: true } });
    if (!item) throw new NotFoundException();
    // Bajar la cantidad siempre se permite; subirla, solo hasta el stock.
    if (quantity > item.quantity && quantity > item.variant.stock) {
      throw new ConflictException({ message: `Solo quedan ${item.variant.stock} pares en esta talla` });
    }
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.cart(customerId);
  }

  async remove(customerId: string, itemId: string): Promise<CartDto> {
    const deleted = await this.prisma.cartItem.deleteMany({ where: { id: itemId, customerId } });
    if (deleted.count === 0) throw new NotFoundException();
    return this.cart(customerId);
  }

  /**
   * Une el carrito local al iniciar sesión (docs/05-reglas-negocio.md, Carrito):
   * suma cantidades, con tope de 5 por ítem y del stock disponible. Las
   * variantes que ya no se venden se descartan sin error.
   */
  async merge(customerId: string, items: { variantId: string; quantity: number }[]): Promise<CartDto> {
    const wanted = new Map<string, number>();
    for (const i of items) wanted.set(i.variantId, (wanted.get(i.variantId) ?? 0) + i.quantity);

    const variants = await this.prisma.variant.findMany({ where: { id: { in: [...wanted.keys()] } }, include: variantForSaleInclude });
    const existing = await this.prisma.cartItem.findMany({ where: { customerId, variantId: { in: [...wanted.keys()] } } });
    const current = new Map(existing.map((e) => [e.variantId, e.quantity]));

    await this.prisma.$transaction(
      variants
        .filter((v) => isPurchasable(v) && v.stock > 0)
        .map((v) => {
          const quantity = Math.min(MAX_QTY_PER_ITEM, v.stock, (current.get(v.id) ?? 0) + (wanted.get(v.id) ?? 0));
          return this.prisma.cartItem.upsert({
            where: { customerId_variantId: { customerId, variantId: v.id } },
            create: { customerId, variantId: v.id, quantity },
            update: { quantity },
          });
        }),
    );
    return this.cart(customerId);
  }
}
