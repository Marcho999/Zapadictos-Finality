import { LOW_STOCK_PER_SIZE, NEW_PRODUCT_DAYS } from '@zapadictos/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface OfferLike {
  salePrice: number;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
}

/** Una oferta está vigente si está activa y `now` cae dentro de sus fechas. */
export function isOfferCurrent(offer: OfferLike, now: Date): boolean {
  return offer.active && offer.startsAt <= now && offer.endsAt > now;
}

/**
 * Oferta vigente de un producto (docs/05-reglas-negocio.md).
 * Si por error hubiera más de una, gana la de menor precio; la API impide
 * que se crucen al crearlas.
 */
export function currentOffer<T extends OfferLike>(
  offers: T[],
  now: Date,
  price: number,
): T | null {
  const valid = offers.filter(
    (offer) => isOfferCurrent(offer, now) && offer.salePrice < price,
  );
  if (valid.length === 0) return null;
  return valid.reduce((best, offer) =>
    offer.salePrice < best.salePrice ? offer : best,
  );
}

export function isNewProduct(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() <= NEW_PRODUCT_DAYS * DAY_MS;
}

/**
 * Resume las tallas de un producto sumando el stock de todos sus colores.
 * Solo cuentan las tallas con stock.
 */
export function summarizeSizes(variants: { size: number; stock: number }[]) {
  const bySize = new Map<number, number>();
  for (const { size, stock } of variants) {
    bySize.set(size, (bySize.get(size) ?? 0) + stock);
  }
  const inStock = [...bySize.entries()]
    .filter(([, stock]) => stock > 0)
    .map(([size]) => size)
    .sort((a, b) => a - b);
  const lowStockSizes = [...bySize.entries()]
    .filter(([, stock]) => stock > 0 && stock <= LOW_STOCK_PER_SIZE)
    .map(([size]) => size)
    .sort((a, b) => a - b);
  return {
    minSize: inStock[0] ?? null,
    maxSize: inStock.at(-1) ?? null,
    lowStockSizes,
  };
}

/**
 * Stock que se muestra al público. Se limita para no revelar el inventario
 * exacto; alcanza para pintar "Agotado" y "Últimos pares" (D-22).
 */
export const PUBLIC_STOCK_CAP = 10;
export function publicStock(stock: number): number {
  return Math.min(Math.max(stock, 0), PUBLIC_STOCK_CAP);
}
