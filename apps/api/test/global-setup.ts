import { execSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Prepara la base de pruebas: aplica las migraciones pendientes, vacía las
 * tablas y carga el seed. Por seguridad, solo actúa sobre una base cuyo
 * nombre termine en "_test".
 */
export default async function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('Falta DATABASE_URL_TEST');
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Las pruebas e2e solo corren sobre una base *_test (recibí "${dbName}")`,
    );
  }

  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' };
  execSync('pnpm exec prisma migrate deploy', { env, stdio: 'pipe' });

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length > 0) {
      // Los nombres salen del catálogo de PostgreSQL, no del usuario.
      const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(
        `TRUNCATE ${list} RESTART IDENTITY CASCADE`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  execSync('pnpm exec prisma db seed', { env, stdio: 'pipe' });
}
