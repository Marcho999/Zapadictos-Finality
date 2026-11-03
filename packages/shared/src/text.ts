/** "Velo Stride 2" → "velo-stride-2" (sin tildes ni símbolos). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

/** SKU de una variante: VEL-STR2-NEG-41 (docs/03-modelo-datos.md). */
export function buildSku(reference: string, colorCode: string, size: number): string {
  return `${reference}-${colorCode}-${size}`;
}

/** Número de pedido visible: 123 → "ZP-000123". */
export function formatOrderNumber(number: number): string {
  return `ZP-${String(number).padStart(6, '0')}`;
}

export const GENDER_LABELS = {
  MEN: 'Hombre',
  WOMEN: 'Mujer',
  UNISEX: 'Unisex',
} as const;
