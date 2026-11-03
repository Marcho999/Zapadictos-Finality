import { MAX_QTY_PER_ITEM, ORDER_STATUSES, type OrderStatus } from './constants.js';
import { z } from './zod-es.js';

/** Carrito, pedidos y pagos (docs/05-reglas-negocio.md). */

const uuid = z.uuid('Identificador inválido');
const quantity = z.coerce
  .number()
  .int()
  .min(1, 'La cantidad mínima es 1')
  .max(MAX_QTY_PER_ITEM, `Máximo ${MAX_QTY_PER_ITEM} pares por talla`);

/** GET /variants?ids=a,b,c — datos del carrito local (máximo 20). */
export const variantIdsQuerySchema = z
  .object({
    ids: z
      .string()
      .transform((v) => [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))])
      .pipe(z.array(uuid).min(1).max(20)),
  })
  .strict();

export const cartAddSchema = z.object({ variantId: uuid, quantity: quantity.default(1) }).strict();
export const cartUpdateSchema = z.object({ quantity }).strict();
export const cartMergeSchema = z
  .object({ items: z.array(z.object({ variantId: uuid, quantity }).strict()).max(20) })
  .strict();

export const orderCreateSchema = z.object({ addressId: uuid }).strict();

export const orderListQuerySchema = z
  .object({ page: z.coerce.number().int().min(1).max(1000).default(1) })
  .strict();

export const paymentVerifySchema = z
  .object({ transactionId: z.string().trim().regex(/^[\w-]{3,64}$/, 'Transacción inválida') })
  .strict();

export const adminOrderListQuerySchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    q: z.string().trim().min(1).max(80).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    needsReview: z.enum(['true']).transform(() => true).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

/** Transiciones que puede hacer el administrador (docs/05-reglas-negocio.md). */
export const ADMIN_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const adminOrderStatusSchema = z
  .object({
    status: z.enum(['SHIPPED', 'DELIVERED', 'CANCELLED']),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PAID: 'Pagado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export const PAYMENT_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  DECLINED: 'Rechazado',
  VOIDED: 'Anulado',
  ERROR: 'Error',
};

// ───────────────────────────── Respuestas ─────────────────────────────

/** Una variante tal como se muestra en el carrito. */
export interface CartVariantDto {
  id: string;
  sku: string;
  size: number;
  /** Stock público (tope 10). */
  stock: number;
  /** false si la variante, su color, su producto o su marca están inactivos. */
  available: boolean;
  colorName: string;
  colorCode: string;
  productName: string;
  productSlug: string;
  brandName: string;
  price: number;
  salePrice: number | null;
  imageUrl: string | null;
}

export interface CartLineDto {
  /** id del ítem del carrito (en el carrito local, el id de la variante). */
  id: string;
  quantity: number;
  variant: CartVariantDto;
  unitPrice: number;
  lineTotal: number;
  /** Mensaje si la línea no se puede comprar tal cual (agotada, menos stock…). */
  problem: string | null;
}

export interface CartDto {
  lines: CartLineDto[];
  count: number;
  subtotal: number;
  shippingCost: number;
  total: number;
  canCheckout: boolean;
}

export interface OrderItemDto {
  productName: string;
  colorName: string;
  size: number;
  sku: string;
  quantity: number;
  unitPrice: number;
  listPrice: number;
  productSlug: string | null;
  imageUrl: string | null;
}

export interface PaymentDto {
  reference: string;
  status: PaymentStatus;
  method: string | null;
  createdAt: string;
}

export interface OrderDto {
  id: string;
  number: string;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  total: number;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  shipping: {
    recipientName: string;
    phone: string;
    department: string;
    city: string;
    line1: string;
    notes: string | null;
  };
  items: OrderItemDto[];
  payments: PaymentDto[];
}

export interface OrderSummaryDto {
  id: string;
  number: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  expiresAt: string;
  cancelReason: string | null;
  lastPaymentStatus: PaymentStatus | null;
}

export interface AdminOrderRowDto extends OrderSummaryDto {
  customerName: string;
  customerEmail: string;
  needsReview: boolean;
}

export interface AdminOrderDetailDto extends OrderDto {
  needsReview: boolean;
  customer: { id: string; name: string; email: string };
  history: { action: string; at: string; actor: string; details: unknown }[];
}

/** Datos para abrir el widget de Wompi (docs/05-reglas-negocio.md, Pagos). */
export interface CheckoutSessionDto {
  publicKey: string;
  currency: 'COP';
  amountInCents: number;
  reference: string;
  signature: string;
  expirationTime: string;
  redirectUrl: string;
  customer: { email: string; fullName: string; phoneNumber: string | null };
}
