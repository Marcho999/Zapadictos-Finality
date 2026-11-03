const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Formatea pesos enteros como "$389.900". */
export function formatCOP(amount: number): string {
  // Intl agrega un espacio duro entre "$" y el número; los mockups no lo usan.
  return copFormatter.format(amount).replace(/\s/g, '');
}

/** Pesos → centavos, solo para Wompi (D-11). */
export function toCents(amount: number): number {
  if (!Number.isInteger(amount)) {
    throw new Error('Los montos en COP deben ser enteros');
  }
  return amount * 100;
}

/** Porcentaje de descuento redondeado, por ejemplo 15 para "−15%". */
export function discountPercent(price: number, salePrice: number): number {
  if (price <= 0 || salePrice >= price) return 0;
  return Math.round(((price - salePrice) / price) * 100);
}
