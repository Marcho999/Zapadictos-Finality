import { z } from './zod-es.js';

/** Cuentas de cliente (HU-06, HU-07, HU-08). docs/05-reglas-negocio.md, "Validaciones de datos". */

export const DEPARTMENTS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
  'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const MAX_ADDRESSES = 5;
export const CUSTOMER_PASSWORD_MIN = 8;

const email = z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido').max(254));
const name = z.string().trim().min(2, 'Escribe tu nombre').max(80, 'Máximo 80 caracteres');
/** Celular colombiano: 10 dígitos que empiezan por 3. Se aceptan espacios al escribirlo. */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^3\d{9}$/, 'Escribe un celular de 10 dígitos que empiece por 3'));

export const customerPasswordSchema = z
  .string()
  .min(CUSTOMER_PASSWORD_MIN, `Debe tener al menos ${CUSTOMER_PASSWORD_MIN} caracteres`)
  // argon2 acepta más, pero un límite evita abusos con contraseñas enormes.
  .max(72, 'Máximo 72 caracteres')
  .regex(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/, 'Debe tener al menos una letra')
  .regex(/\d/, 'Debe tener al menos un número');

export const customerRegisterSchema = z
  .object({
    name,
    email,
    password: customerPasswordSchema,
    phone: z.union([z.literal(''), phoneSchema]).optional().transform((v) => v || undefined),
    acceptDataPolicy: z.literal(true, { error: 'Debes aceptar la política de tratamiento de datos' }),
  })
  .strict();
export type CustomerRegisterInput = z.input<typeof customerRegisterSchema>;

export const customerLoginSchema = z
  .object({
    email,
    password: z.string().min(1, 'Escribe tu contraseña').max(200),
  })
  .strict();
export type CustomerLoginInput = z.input<typeof customerLoginSchema>;

/** El correo no se puede cambiar en el MVP (docs/04-api.md). */
export const profileUpdateSchema = z
  .object({
    name,
    phone: z.union([z.literal(''), phoneSchema]).transform((v) => v || null),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar');
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

const addressFields = {
  label: z.string().trim().min(2, 'Ponle un nombre, por ejemplo "Casa"').max(40),
  recipientName: name,
  phone: phoneSchema,
  department: z.enum(DEPARTMENTS, { error: 'Elige un departamento' }),
  city: z.string().trim().min(2, 'Escribe la ciudad o municipio').max(60),
  line1: z.string().trim().min(5, 'Escribe la dirección completa').max(120),
  notes: z.string().trim().max(120).optional().transform((v) => v || null),
  isDefault: z.boolean(),
};

export const addressCreateSchema = z
  .object({ ...addressFields, isDefault: addressFields.isDefault.default(false) })
  .strict();
export type AddressCreateInput = z.input<typeof addressCreateSchema>;

export const addressUpdateSchema = z
  .object(addressFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar');
export type AddressUpdateInput = z.input<typeof addressUpdateSchema>;

export interface CustomerMeDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  dataPolicyAcceptedAt: string;
}

export interface AddressDto {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  department: string;
  city: string;
  line1: string;
  notes: string | null;
  isDefault: boolean;
}
