import type { Paginated, ProductCardDto } from '@zapadictos/shared';
import type { LocationQuery } from 'vue-router';

/** Parámetros de la URL que se envían a GET /products (docs/04-api.md). */
const PRODUCT_QUERY_KEYS = [
  'q',
  'brand',
  'category',
  'gender',
  'size',
  'minPrice',
  'maxPrice',
  'onSale',
  'sort',
  'page',
] as const;

export function pickProductQuery(query: LocationQuery) {
  const picked: Record<string, string> = {};
  for (const key of PRODUCT_QUERY_KEYS) {
    const value = query[key];
    if (typeof value === 'string' && value !== '') picked[key] = value;
  }
  return picked;
}

/**
 * Lista de productos ligada a la URL: cambiar un filtro o la página cambia la
 * URL, y la URL vuelve a pedir los productos. Se renderiza en el servidor.
 */
export function useProducts(query: MaybeRefOrGetter<Record<string, string>>) {
  return useFetch<Paginated<ProductCardDto>>('/api/v1/products', {
    query: computed(() => toValue(query)),
    key: computed(() => `products:${JSON.stringify(toValue(query))}`),
  });
}
