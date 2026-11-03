import { formatOrderNumber, type OrderDto, type OrderSummaryDto } from '@zapadictos/shared';
import type { Prisma } from '../../generated/prisma/client.js';

export const orderInclude = {
  items: {
    orderBy: { productName: 'asc' },
    include: {
      variant: {
        select: {
          productColor: {
            select: {
              product: { select: { slug: true } },
              images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
            },
          },
        },
      },
    },
  },
  payments: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toOrderDto(o: OrderWithItems): OrderDto {
  return {
    id: o.id,
    number: formatOrderNumber(o.number),
    status: o.status,
    subtotal: o.subtotal,
    shippingCost: o.shippingCost,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    expiresAt: o.expiresAt.toISOString(),
    paidAt: iso(o.paidAt),
    shippedAt: iso(o.shippedAt),
    deliveredAt: iso(o.deliveredAt),
    cancelledAt: iso(o.cancelledAt),
    cancelReason: o.cancelReason,
    shipping: {
      recipientName: o.shipRecipientName,
      phone: o.shipPhone,
      department: o.shipDepartment,
      city: o.shipCity,
      line1: o.shipLine1,
      notes: o.shipNotes,
    },
    items: o.items.map((i) => ({
      productName: i.productName,
      colorName: i.colorName,
      size: i.size,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      listPrice: i.listPrice,
      productSlug: i.variant.productColor.product.slug,
      imageUrl: i.variant.productColor.images[0]?.url ?? null,
    })),
    payments: o.payments.map((p) => ({
      reference: p.reference,
      status: p.status,
      method: p.method,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export const orderSummaryInclude = {
  items: { select: { quantity: true } },
  payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
} satisfies Prisma.OrderInclude;

export function toOrderSummary(o: Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>): OrderSummaryDto {
  return {
    id: o.id,
    number: formatOrderNumber(o.number),
    status: o.status,
    total: o.total,
    itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    createdAt: o.createdAt.toISOString(),
    expiresAt: o.expiresAt.toISOString(),
    cancelReason: o.cancelReason,
    lastPaymentStatus: o.payments[0]?.status ?? null,
  };
}
