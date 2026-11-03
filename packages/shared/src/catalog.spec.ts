import { describe, expect, it } from 'vitest';
import { productListQuerySchema } from './catalog.js';
import { discountPercent, formatCOP, toCents } from './money.js';

describe('productListQuerySchema', () => {
  it('aplica los valores por defecto', () => {
    expect(productListQuerySchema.parse({})).toEqual({
      sort: 'newest',
      page: 1,
    });
  });

  it('convierte la lista de marcas y los números', () => {
    const query = productListQuerySchema.parse({
      brand: 'Velo, nomad',
      size: '41',
      maxPrice: '400000',
      onSale: 'true',
    });
    expect(query.brand).toEqual(['velo', 'nomad']);
    expect(query.size).toBe(41);
    expect(query.maxPrice).toBe(400000);
    expect(query.onSale).toBe(true);
  });

  it('rechaza parámetros desconocidos', () => {
    expect(productListQuerySchema.safeParse({ price: '1' }).success).toBe(
      false,
    );
  });

  it('rechaza tallas fuera de rango y precios invertidos', () => {
    expect(productListQuerySchema.safeParse({ size: '60' }).success).toBe(
      false,
    );
    expect(
      productListQuerySchema.safeParse({ minPrice: '5', maxPrice: '1' })
        .success,
    ).toBe(false);
  });

  it('responde los errores en español', () => {
    const result = productListQuerySchema.safeParse({ size: '60' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/grande|mayor/i);
  });

  it('rechaza slugs con caracteres extraños', () => {
    expect(
      productListQuerySchema.safeParse({ brand: "velo'; drop" }).success,
    ).toBe(false);
  });
});

describe('dinero', () => {
  it('formatea pesos como en los mockups', () => {
    expect(formatCOP(389900)).toBe('$389.900');
    expect(formatCOP(15000)).toBe('$15.000');
  });

  it('convierte a centavos solo enteros', () => {
    expect(toCents(704800)).toBe(70480000);
    expect(() => toCents(10.5)).toThrow();
  });

  it('calcula el porcentaje de descuento', () => {
    expect(discountPercent(389900, 329900)).toBe(15);
    expect(discountPercent(389900, 389900)).toBe(0);
  });
});
