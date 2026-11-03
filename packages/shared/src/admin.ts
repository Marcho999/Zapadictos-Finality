import { GENDERS, SIZE_MAX, SIZE_MIN } from './constants.js';
import { z } from './zod-es.js';

/** Esquemas del panel de administración (docs/04-api.md, docs/05-reglas-negocio.md). */

const email = z.string().trim().toLowerCase().pipe(z.email('Correo inválido').max(254));
const uuid = z.uuid('Identificador inválido');
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones')
  .max(80);
const price = z.coerce
  .number()
  .int('El precio debe ser un número entero')
  .min(1, 'El precio debe ser mayor que 0')
  .max(5_000_000, 'El precio no puede superar $5.000.000');

export const ADMIN_PASSWORD_MIN = 12;

// ─────────────────────────── Sesión del administrador ───────────────────────────

export const adminLoginSchema = z
  .object({
    email,
    // No se valida el largo aquí: un mensaje distinto revelaría las reglas.
    password: z.string().min(1, 'Escribe tu contraseña').max(200),
  })
  .strict();
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contraseña actual').max(200),
    newPassword: z
      .string()
      .min(ADMIN_PASSWORD_MIN, `Debe tener al menos ${ADMIN_PASSWORD_MIN} caracteres`)
      .max(200),
  })
  .strict()
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'La nueva contraseña debe ser distinta de la actual',
    path: ['newPassword'],
  });
export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;

export interface AdminMeDto {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
}

// ───────────────────────────── Productos ─────────────────────────────

export const adminProductListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(60).optional(),
    brand: slug.optional(),
    status: z.enum(['active', 'inactive']).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;

const productFields = {
  name: z.string().trim().min(2, 'Escribe el nombre').max(80),
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Solo mayúsculas, números y guiones (ej. VEL-STR2)')
    .max(20),
  slug,
  brandId: uuid,
  categoryId: uuid,
  gender: z.enum(GENDERS),
  price,
  description: z.string().trim().min(10, 'Escribe una descripción de al menos 10 caracteres').max(2000),
  active: z.boolean(),
};

export const adminProductCreateSchema = z
  .object({ ...productFields, slug: slug.optional(), active: z.boolean().default(false) })
  .strict();
export type AdminProductCreateInput = z.input<typeof adminProductCreateSchema>;

export const adminProductUpdateSchema = z
  .object(productFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar');
export type AdminProductUpdateInput = z.input<typeof adminProductUpdateSchema>;

// ───────────────────────── Colores, tallas y fotos ─────────────────────────

const colorFields = {
  name: z.string().trim().min(2, 'Escribe el nombre del color').max(30),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Usa el formato #RRGGBB')
    .transform((v) => v.toUpperCase()),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,5}$/, 'De 2 a 5 letras o números (ej. NEG)'),
};

export const adminColorCreateSchema = z.object(colorFields).strict();
export type AdminColorCreateInput = z.input<typeof adminColorCreateSchema>;

export const adminColorUpdateSchema = z
  .object({ ...colorFields, sortOrder: z.number().int().min(0).max(100), active: z.boolean() })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar');
export type AdminColorUpdateInput = z.input<typeof adminColorUpdateSchema>;

const size = z.coerce.number().int().min(SIZE_MIN).max(SIZE_MAX);
const stock = z.coerce.number().int('El stock debe ser un número entero').min(0, 'El stock no puede ser negativo').max(10_000);

export const adminVariantsCreateSchema = z
  .object({
    from: size,
    to: size,
    stock: stock.default(0),
  })
  .strict()
  .refine((v) => v.from <= v.to, { message: '"Desde" debe ser menor o igual que "Hasta"', path: ['to'] });
export type AdminVariantsCreateInput = z.input<typeof adminVariantsCreateSchema>;

export const adminVariantUpdateSchema = z
  .object({ stock, active: z.boolean() })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar');
export type AdminVariantUpdateInput = z.input<typeof adminVariantUpdateSchema>;

export const adminImageUploadSchema = z
  .object({ alt: z.string().trim().max(150).optional() })
  .strict();

export const adminImageUpdateSchema = z
  .object({ alt: z.string().trim().min(1).max(150), sortOrder: z.number().int().min(0).max(100) })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar');
export type AdminImageUpdateInput = z.input<typeof adminImageUpdateSchema>;

export const MAX_IMAGES_PER_COLOR = 8;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// ───────────────────────────── Ofertas ─────────────────────────────

const date = z.coerce.date({ error: 'Fecha inválida' });

export const adminOfferCreateSchema = z
  .object({ salePrice: price, startsAt: date, endsAt: date, active: z.boolean().default(true) })
  .strict()
  .refine((v) => v.endsAt > v.startsAt, {
    message: 'La fecha de fin debe ser posterior a la de inicio',
    path: ['endsAt'],
  });
export type AdminOfferCreateInput = z.input<typeof adminOfferCreateSchema>;

export const adminOfferUpdateSchema = z
  .object({ salePrice: price, startsAt: date, endsAt: date, active: z.boolean() })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar')
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, {
    message: 'La fecha de fin debe ser posterior a la de inicio',
    path: ['endsAt'],
  });
export type AdminOfferUpdateInput = z.input<typeof adminOfferUpdateSchema>;

// ───────────────────────── Marcas y categorías ─────────────────────────

export const adminBrandCreateSchema = z
  .object({ name: z.string().trim().min(2, 'Escribe el nombre').max(60), slug: slug.optional() })
  .strict();
export type AdminBrandCreateInput = z.input<typeof adminBrandCreateSchema>;

export const adminBrandUpdateSchema = z
  .object({ name: z.string().trim().min(2).max(60), slug, active: z.boolean() })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar');
export type AdminBrandUpdateInput = z.input<typeof adminBrandUpdateSchema>;

export const adminCategoryCreateSchema = adminBrandCreateSchema;
export type AdminCategoryCreateInput = AdminBrandCreateInput;

export const adminCategoryUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    slug,
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(100),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar');
export type AdminCategoryUpdateInput = z.input<typeof adminCategoryUpdateSchema>;

// ───────────────────────────── Respuestas ─────────────────────────────

export interface AdminProductRowDto {
  id: string;
  name: string;
  reference: string;
  brand: string;
  category: string;
  price: number;
  salePrice: number | null;
  totalStock: number;
  sizesCount: number;
  active: boolean;
  coverUrl: string | null;
}

export interface AdminVariantDto {
  id: string;
  size: number;
  sku: string;
  stock: number;
  active: boolean;
}

export interface AdminImageDto {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
}

export interface AdminColorDto {
  id: string;
  name: string;
  hex: string;
  code: string;
  sortOrder: number;
  active: boolean;
  variants: AdminVariantDto[];
  images: AdminImageDto[];
}

export type OfferState = 'current' | 'scheduled' | 'ended' | 'inactive';

export interface AdminOfferDto {
  id: string;
  salePrice: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  state: OfferState;
  createdBy: string;
}

export interface AdminProductDetailDto {
  id: string;
  name: string;
  reference: string;
  slug: string;
  description: string;
  gender: (typeof GENDERS)[number];
  price: number;
  active: boolean;
  brandId: string;
  categoryId: string;
  createdAt: string;
  colors: AdminColorDto[];
  offers: AdminOfferDto[];
}

export interface AdminBrandDto {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  productCount: number;
}

export interface AdminCategoryDto extends AdminBrandDto {
  sortOrder: number;
}
