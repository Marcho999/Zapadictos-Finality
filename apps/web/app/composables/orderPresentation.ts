import type { OrderStatus, PaymentStatus } from '@zapadictos/shared';

/** Tono de `UiTag` para cada estado, usado en Pedido, Mis pedidos y el admin. */
export const ORDER_STATUS_TONE: Record<OrderStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  DECLINED: 'danger',
  VOIDED: 'danger',
  ERROR: 'danger',
};
