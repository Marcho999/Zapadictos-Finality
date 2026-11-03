import { describe, expect, it } from 'vitest';
import {
  currentOffer,
  isNewProduct,
  publicStock,
  summarizeSizes,
} from './pricing.js';

const now = new Date('2026-11-03T12:00:00Z');
const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number) => new Date(now.getTime() + offsetDays * day);

describe('currentOffer', () => {
  const offer = (salePrice: number, from: number, to: number, active = true) => ({
    salePrice,
    startsAt: at(from),
    endsAt: at(to),
    active,
  });

  it('devuelve la oferta activa dentro de sus fechas', () => {
    expect(currentOffer([offer(329900, -2, 27)], now, 389900)?.salePrice).toBe(
      329900,
    );
  });

  it('ignora ofertas apagadas, futuras, vencidas o más caras que el precio', () => {
    const offers = [
      offer(300000, -2, 27, false),
      offer(300000, 1, 10),
      offer(300000, -10, -1),
      offer(400000, -2, 27),
    ];
    expect(currentOffer(offers, now, 389900)).toBeNull();
  });

  it('la oferta termina exactamente en endsAt', () => {
    const o = offer(329900, -2, 0);
    expect(currentOffer([o], now, 389900)).toBeNull();
  });

  it('si hay dos vigentes, gana la más barata', () => {
    const offers = [offer(350000, -2, 5), offer(320000, -1, 5)];
    expect(currentOffer(offers, now, 389900)?.salePrice).toBe(320000);
  });
});

describe('isNewProduct', () => {
  it('es nuevo hasta los 30 días', () => {
    expect(isNewProduct(at(-30), now)).toBe(true);
    expect(isNewProduct(at(-31), now)).toBe(false);
  });
});

describe('summarizeSizes', () => {
  it('suma el stock de todos los colores por talla', () => {
    const summary = summarizeSizes([
      { size: 40, stock: 0 },
      { size: 41, stock: 2 },
      { size: 41, stock: 1 },
      { size: 42, stock: 0 },
      { size: 43, stock: 8 },
      { size: 40, stock: 0 },
    ]);
    expect(summary).toEqual({ minSize: 41, maxSize: 43, lowStockSizes: [41] });
  });

  it('sin stock no hay rango', () => {
    expect(summarizeSizes([{ size: 40, stock: 0 }])).toEqual({
      minSize: null,
      maxSize: null,
      lowStockSizes: [],
    });
  });
});

describe('publicStock', () => {
  it('limita el stock visible a 10', () => {
    expect(publicStock(2)).toBe(2);
    expect(publicStock(57)).toBe(10);
  });
});
