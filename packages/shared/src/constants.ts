/** Reglas de negocio compartidas (docs/05-reglas-negocio.md). */

export const GENDERS = ['MEN', 'WOMEN', 'UNISEX'] as const;
export type Gender = (typeof GENDERS)[number];

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SIZE_MIN = 34;
export const SIZE_MAX = 48;

/** Productos por página en el catálogo. */
export const CATALOG_PAGE_SIZE = 12;

/** "Nuevo": creado hace 30 días o menos. */
export const NEW_PRODUCT_DAYS = 30;

/** "Últimos pares": 3 unidades o menos en una talla. */
export const LOW_STOCK_PER_SIZE = 3;

/** "Stock bajo" en el admin: 5 unidades o menos en total. */
export const LOW_STOCK_TOTAL = 5;

/** Unidades máximas de una misma variante en el carrito. */
export const MAX_QTY_PER_ITEM = 5;

/**
 * Tarifa de envío (D-13), igual al valor por defecto de la variable de
 * entorno `SHIPPING_COST` de la API. Solo se usa para la vista previa del
 * carrito del visitante antes de iniciar sesión: el total real siempre lo
 * calcula la API (`GET /cart`, `POST /orders`).
 */
export const SHIPPING_COST = 15000;

/** Minutos que el stock queda reservado mientras se paga. */
export const ORDER_RESERVATION_MINUTES = 30;
