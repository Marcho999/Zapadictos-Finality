import { z } from './zod-es.js';
import { GENDERS, SIZE_MAX, SIZE_MIN } from './constants.js';

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido')
  .max(80);

/** Lista separada por comas: "velo,nomad" → ["velo", "nomad"]. */
const slugList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(slug).min(1).max(10));

const price = z.coerce.number().int().min(0).max(5_000_000);

export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/**
 * Filtros de GET /products (docs/04-api.md).
 * `.strict()` rechaza parámetros desconocidos, igual que forbidNonWhitelisted.
 */
export const productListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(60).optional(),
    brand: slugList.optional(),
    category: slug.optional(),
    gender: z.enum(GENDERS).optional(),
    size: z.coerce.number().int().min(SIZE_MIN).max(SIZE_MAX).optional(),
    minPrice: price.optional(),
    maxPrice: price.optional(),
    onSale: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    sort: z.enum(PRODUCT_SORTS).default('newest'),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict()
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      query.minPrice <= query.maxPrice,
    { message: 'minPrice no puede ser mayor que maxPrice', path: ['minPrice'] },
  );

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductListQueryInput = z.input<typeof productListQuerySchema>;

export const productSlugSchema = slug;

/** Respuestas de la API (lo que consume el frontend). */

export interface BrandDto {
  slug: string;
  name: string;
}

export interface CategoryDto {
  slug: string;
  name: string;
}

export interface ProductImageDto {
  url: string;
  alt: string;
}

export interface ProductCardDto {
  slug: string;
  name: string;
  brand: BrandDto;
  category: CategoryDto;
  gender: (typeof GENDERS)[number];
  price: number;
  salePrice: number | null;
  isNew: boolean;
  minSize: number | null;
  maxSize: number | null;
  /** Tallas con 1 a 3 pares (para "Últimos pares en X"). */
  lowStockSizes: number[];
  coverImage: ProductImageDto | null;
}

export interface VariantDto {
  id: string;
  size: number;
  sku: string;
  stock: number;
}

export interface ProductColorDto {
  code: string;
  name: string;
  hex: string;
  images: ProductImageDto[];
  variants: VariantDto[];
}

export interface OfferDto {
  salePrice: number;
  endsAt: string;
}

export interface ProductDetailDto
  extends Omit<ProductCardDto, 'coverImage' | 'lowStockSizes'> {
  reference: string;
  description: string;
  offer: OfferDto | null;
  colors: ProductColorDto[];
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}
