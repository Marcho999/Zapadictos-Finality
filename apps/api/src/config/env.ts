import { existsSync } from 'node:fs';
import { z } from 'zod';

const secret = z
  .string()
  .min(32, 'Debe tener al menos 32 caracteres aleatorios');

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    WEB_ORIGIN: z.url(),
    SHIPPING_COST: z.coerce.number().int().min(0).default(15000),
    // Saltos de proxy en los que se confía para leer la IP real:
    // local = 1 (Nuxt); producción = 2 (Nuxt en Vercel + balanceador de Render).
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),

    // Secretos JWT separados por acceso (D-01): un token de cliente nunca
    // sirve en el panel, porque está firmado con otra clave.
    ADMIN_JWT_SECRET: secret,
    CUSTOMER_JWT_SECRET: secret,

    // Imágenes: con CLOUDINARY_URL se usa Cloudinary; sin ella, en desarrollo
    // y pruebas, se guardan en disco (UPLOADS_DIR).
    CLOUDINARY_URL: z
      .string()
      .regex(/^cloudinary:\/\/[^:]+:[^@]+@[\w-]+$/, 'Formato cloudinary://key:secret@cloud')
      .optional(),
    UPLOADS_DIR: z.string().default('uploads'),

    // Wompi (sandbox). Sin estas llaves la tienda funciona, pero no se puede pagar.
    WOMPI_PUBLIC_KEY: z.string().regex(/^pub_(test|prod)_\w+$/, 'Debe empezar por pub_test_ o pub_prod_').optional(),
    WOMPI_INTEGRITY_SECRET: z.string().min(10).optional(),
    WOMPI_EVENTS_SECRET: z.string().min(10).optional(),
    WOMPI_API_URL: z.url().default('https://sandbox.wompi.co/v1'),
  })
  .refine((env) => env.ADMIN_JWT_SECRET !== env.CUSTOMER_JWT_SECRET, {
    message: 'Los secretos del panel y de la tienda deben ser distintos (D-01)',
    path: ['CUSTOMER_JWT_SECRET'],
  })
  .refine(
    (env) => env.NODE_ENV !== 'production' || (env.WOMPI_PUBLIC_KEY && env.WOMPI_INTEGRITY_SECRET && env.WOMPI_EVENTS_SECRET),
    { message: 'En producción se necesitan las llaves de Wompi', path: ['WOMPI_PUBLIC_KEY'] },
  )
  .refine((env) => env.NODE_ENV !== 'production' || env.CLOUDINARY_URL, {
    message: 'En producción las imágenes deben ir a Cloudinary',
    path: ['CLOUDINARY_URL'],
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Lee y valida las variables de entorno una sola vez.
 * Si falta alguna, la API no arranca (mejor fallar al inicio que en producción).
 */
export function loadEnv(): Env {
  if (cached) return cached;
  // En local se lee apps/api/.env; en Render las variables vienen del panel.
  if (process.env.NODE_ENV !== 'production' && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((i) => `${i.path.join('.')} (${i.message})`)
      .join(', ');
    throw new Error(`Variables de entorno inválidas o faltantes: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}
