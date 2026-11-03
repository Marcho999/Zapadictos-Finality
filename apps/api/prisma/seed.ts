/**
 * Datos de prueba (docs/08-plan.md, paso 6).
 * Marcas, modelos y precios son de ejemplo, igual que en los mockups.
 *
 * - El catálogo solo se carga si la base está vacía; para recargarlo: pnpm db:reset
 * - El administrador inicial sale de SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { Gender, PrismaClient } from '../src/generated/prisma/client.js';
import { ARGON2_OPTIONS } from '../src/common/security/argon2-options.js';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * DAY);
const daysFromNow = (d: number) => new Date(now + d * DAY);

type ColorSeed = {
  name: string;
  hex: string;
  code: string;
  /** talla → stock */
  stock: Record<number, number>;
};

type ProductSeed = {
  reference: string;
  name: string;
  brand: string;
  category: string;
  gender: Gender;
  price: number;
  createdDaysAgo: number;
  active?: boolean;
  description: string;
  colors: ColorSeed[];
};

const brands = ['Velo', 'Kora', 'Nomad', 'Arca', 'Pulse', 'Tundra'];
const categories = ['Running', 'Urbano', 'Basket', 'Skate'];

/** Stock de 0 a 6 por talla, reproducible a partir de una semilla. */
function stockRange(from: number, to: number, seed: number) {
  const stock: Record<number, number> = {};
  let x = seed;
  for (let size = from; size <= to; size++) {
    x = (x * 9301 + 49297) % 233280;
    stock[size] = Math.floor((x / 233280) * 7);
  }
  return stock;
}

const products: ProductSeed[] = [
  {
    reference: 'VEL-STR2',
    name: 'Velo Stride 2',
    brand: 'Velo',
    category: 'Running',
    gender: Gender.UNISEX,
    price: 389900,
    createdDaysAgo: 19,
    description:
      'Zapatilla de running para entrenamiento diario. Capellada en malla transpirable, mediasuela de espuma con buen retorno y suela de caucho con tracción para asfalto. Horma regular: si estás entre dos tallas, elige la mayor.',
    colors: [
      // Igual que el mockup "Colores, tallas y fotos": 12 pares en negro.
      { name: 'Negro', hex: '#111111', code: 'NEG', stock: { 37: 0, 38: 1, 39: 2, 40: 2, 41: 2, 42: 3, 43: 1, 44: 0, 45: 1 } },
      { name: 'Blanco', hex: '#F4F2EE', code: 'BLA', stock: { 37: 1, 38: 1, 39: 2, 40: 1, 41: 2, 42: 1, 43: 1, 44: 1, 45: 1 } },
      { name: 'Naranja', hex: '#FF5A1F', code: 'NAR', stock: { 38: 1, 39: 1, 40: 1, 41: 1, 42: 1, 43: 1, 44: 0, 45: 0 } },
    ],
  },
  {
    reference: 'KOR-CT90',
    name: 'Kora Court 90',
    brand: 'Kora',
    category: 'Basket',
    gender: Gender.MEN,
    price: 459900,
    createdDaysAgo: 12,
    description:
      'Bota de basket inspirada en las canchas de los noventa. Cuero sintético, cuello acolchado y suela de goma de alto agarre.',
    colors: [
      { name: 'Blanco', hex: '#F4F2EE', code: 'BLA', stock: { 39: 0, 40: 1, 41: 0, 42: 1, 43: 1, 44: 0, 45: 0 } },
    ],
  },
  {
    reference: 'NOM-TRX',
    name: 'Nomad Trail X',
    brand: 'Nomad',
    category: 'Running',
    gender: Gender.MEN,
    price: 419900,
    createdDaysAgo: 8,
    description:
      'Para trail y caminos destapados: suela con tacos de 4 mm, puntera reforzada y capellada repelente al agua.',
    colors: [
      { name: 'Gris', hex: '#8A8C8E', code: 'GRI', stock: stockRange(38, 44, 3) },
      { name: 'Verde', hex: '#3F5B3A', code: 'VER', stock: stockRange(38, 44, 7) },
    ],
  },
  {
    reference: 'ARC-STL',
    name: 'Arca Street Low',
    brand: 'Arca',
    category: 'Urbano',
    gender: Gender.UNISEX,
    price: 299900,
    createdDaysAgo: 40,
    description:
      'Tenis bajo de uso diario. Lona resistente, plantilla acolchada y suela vulcanizada que combina con todo.',
    colors: [
      { name: 'Blanco', hex: '#F4F2EE', code: 'BLA', stock: stockRange(36, 43, 11) },
      { name: 'Negro', hex: '#111111', code: 'NEG', stock: stockRange(36, 43, 13) },
    ],
  },
  {
    reference: 'PUL-FLW',
    name: 'Pulse Flow',
    brand: 'Pulse',
    category: 'Running',
    gender: Gender.WOMEN,
    price: 349900,
    createdDaysAgo: 55,
    description:
      'Running liviano para distancias cortas y medias. Tejido elástico que se adapta al pie y amortiguación suave.',
    // Agotado en todas las tallas, como en el mockup de Productos.
    colors: [
      { name: 'Rosa', hex: '#E8A0B4', code: 'ROS', stock: { 35: 0, 36: 0, 37: 0, 38: 0, 39: 0, 40: 0 } },
    ],
  },
  {
    reference: 'TUN-SKP',
    name: 'Tundra Skate Pro',
    brand: 'Tundra',
    category: 'Skate',
    gender: Gender.UNISEX,
    price: 279900,
    createdDaysAgo: 70,
    active: false,
    description:
      'Zapatilla de skate con gamuza en las zonas de roce, lengüeta acolchada y suela de goma plana para sentir la tabla.',
    colors: [
      { name: 'Negro', hex: '#111111', code: 'NEG', stock: stockRange(38, 43, 17) },
    ],
  },
  {
    reference: 'VEL-CLS',
    name: 'Velo Classic',
    brand: 'Velo',
    category: 'Urbano',
    gender: Gender.UNISEX,
    price: 259900,
    createdDaysAgo: 90,
    description:
      'El clásico de Velo: cuero sintético liso, suela de goma cosida y un diseño que no pasa de moda.',
    colors: [
      { name: 'Blanco', hex: '#F4F2EE', code: 'BLA', stock: stockRange(36, 45, 19) },
    ],
  },
  {
    reference: 'NOM-CMD',
    name: 'Nomad City Mid',
    brand: 'Nomad',
    category: 'Urbano',
    gender: Gender.WOMEN,
    price: 329900,
    createdDaysAgo: 33,
    description:
      'Bota media para la ciudad. Capellada en gamuza, cuello acolchado y suela de caucho antideslizante para días de lluvia.',
    colors: [
      { name: 'Beige', hex: '#D8C3A5', code: 'BEI', stock: stockRange(35, 41, 23) },
      { name: 'Negro', hex: '#111111', code: 'NEG', stock: stockRange(35, 41, 29) },
    ],
  },
  {
    reference: 'VEL-TMP',
    name: 'Velo Tempo',
    brand: 'Velo',
    category: 'Running',
    gender: Gender.WOMEN,
    price: 349900,
    createdDaysAgo: 4,
    description:
      'Para entrenamientos de ritmo: mediasuela firme, drop de 8 mm y una capellada que sujeta el pie en las curvas.',
    colors: [
      { name: 'Azul', hex: '#2D4F8E', code: 'AZU', stock: { 35: 2, 36: 3, 37: 1, 38: 4, 39: 2, 40: 1, 41: 3 } },
      { name: 'Negro', hex: '#111111', code: 'NEG', stock: stockRange(35, 41, 31) },
    ],
  },
  {
    reference: 'NOM-RDG',
    name: 'Nomad Ridge',
    brand: 'Nomad',
    category: 'Running',
    gender: Gender.MEN,
    price: 439900,
    createdDaysAgo: 26,
    description:
      'Trail de larga distancia con placa de protección, amortiguación máxima y cordones de ajuste rápido.',
    // 5 pares en total: aparece como "Stock bajo" en el admin.
    colors: [
      { name: 'Negro', hex: '#111111', code: 'NEG', stock: { 40: 1, 41: 0, 42: 2, 43: 1, 44: 1, 45: 0 } },
    ],
  },
  {
    reference: 'KOR-LTE',
    name: 'Kora Lite',
    brand: 'Kora',
    category: 'Basket',
    gender: Gender.WOMEN,
    price: 389900,
    createdDaysAgo: 15,
    description:
      'Basket de corte bajo y peso ligero, con malla en los laterales para mantener el pie fresco durante el partido.',
    colors: [
      { name: 'Blanco', hex: '#F4F2EE', code: 'BLA', stock: stockRange(35, 41, 37) },
      { name: 'Lila', hex: '#B9A6D9', code: 'LIL', stock: stockRange(35, 41, 41) },
    ],
  },
  {
    reference: 'ARC-CNV',
    name: 'Arca Canvas',
    brand: 'Arca',
    category: 'Urbano',
    gender: Gender.UNISEX,
    price: 189900,
    createdDaysAgo: 120,
    description:
      'Lona y caucho, nada más. El tenis sencillo para todos los días, con plantilla removible.',
    colors: [
      { name: 'Crudo', hex: '#EDE6D6', code: 'CRU', stock: stockRange(35, 45, 43) },
      { name: 'Negro', hex: '#111111', code: 'NEG', stock: stockRange(35, 45, 47) },
    ],
  },
];

function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function seedAdmin(prisma: PrismaClient) {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Define SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en apps/api/.env');
  }
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres');
  }
  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`· Administrador ${email} ya existe (no se cambia su contraseña)`);
    return existing;
  }
  const admin = await prisma.admin.create({
    data: {
      name: 'Administrador',
      email,
      passwordHash: await argon2.hash(password, ARGON2_OPTIONS),
    },
  });
  console.log(`✓ Administrador inicial: ${email}`);
  return admin;
}

async function seedCatalog(prisma: PrismaClient, adminId: string) {
  if ((await prisma.product.count()) > 0) {
    console.log('· El catálogo ya tiene productos; para recargarlo usa pnpm db:reset');
    return;
  }

  const brandIds = new Map<string, string>();
  for (const name of brands) {
    const brand = await prisma.brand.create({ data: { name, slug: slugify(name) } });
    brandIds.set(name, brand.id);
  }

  const categoryIds = new Map<string, string>();
  for (const [index, name] of categories.entries()) {
    const category = await prisma.category.create({
      data: { name, slug: slugify(name), sortOrder: index },
    });
    categoryIds.set(name, category.id);
  }

  for (const p of products) {
    await prisma.product.create({
      data: {
        reference: p.reference,
        name: p.name,
        slug: slugify(p.name),
        description: p.description,
        gender: p.gender,
        price: p.price,
        active: p.active ?? true,
        createdAt: daysAgo(p.createdDaysAgo),
        brandId: brandIds.get(p.brand)!,
        categoryId: categoryIds.get(p.category)!,
        colors: {
          create: p.colors.map((color, index) => ({
            name: color.name,
            hex: color.hex,
            code: color.code,
            sortOrder: index,
            variants: {
              create: Object.entries(color.stock).map(([size, stock]) => ({
                size: Number(size),
                stock,
                sku: `${p.reference}-${color.code}-${size}`,
              })),
            },
          })),
        },
      },
    });
  }

  const productId = async (reference: string) =>
    (await prisma.product.findUniqueOrThrow({ where: { reference } })).id;

  await prisma.offer.createMany({
    data: [
      // Vigente: Velo Stride 2 a $329.900 (−15%).
      { productId: await productId('VEL-STR2'), salePrice: 329900, startsAt: daysAgo(2), endsAt: daysFromNow(27), createdById: adminId },
      // Vigente: Arca Street Low a $269.900 (−10%).
      { productId: await productId('ARC-STL'), salePrice: 269900, startsAt: daysAgo(1), endsAt: daysFromNow(12), createdById: adminId },
      // Programada: empieza en 17 días.
      { productId: await productId('TUN-SKP'), salePrice: 239900, startsAt: daysFromNow(17), endsAt: daysFromNow(30), createdById: adminId },
      // Terminada: queda en el historial.
      { productId: await productId('VEL-STR2'), salePrice: 339900, startsAt: daysAgo(44), endsAt: daysAgo(34), createdById: adminId },
    ],
  });

  const variants = await prisma.variant.count();
  console.log(
    `✓ Catálogo: ${brands.length} marcas, ${categories.length} categorías, ${products.length} productos, ${variants} variantes y 4 ofertas`,
  );
}

async function seedBanner(prisma: PrismaClient) {
  if ((await prisma.banner.count()) > 0) return;
  await prisma.banner.create({
    data: {
      tag: 'NUEVA TEMPORADA',
      title: 'Tu talla, en stock y lista para salir.',
      subtitle:
        'Filtra por marca, talla y precio, paga seguro y recibe tus zapatillas en cualquier ciudad de Colombia.',
      ctaLabel: 'Ver catálogo',
      ctaHref: '/tienda',
    },
  });
  console.log('✓ Portada');
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta DATABASE_URL');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const admin = await seedAdmin(prisma);
    await seedCatalog(prisma, admin.id);
    await seedBanner(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
