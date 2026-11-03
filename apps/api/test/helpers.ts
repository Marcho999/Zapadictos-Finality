import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { ARGON2_OPTIONS } from '../src/common/security/argon2-options.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { setupApp } from '../src/setup-app.js';

export const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
export const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? '').toLowerCase();
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? '';

export async function createApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  setupApp(app);
  await app.init();
  return app;
}

export function createPrisma() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
}

let ipCounter = 10;
/**
 * IP distinta por prueba (vía X-Forwarded-For, que la API acepta de un salto
 * de proxy), para que el límite de intentos de una prueba no afecte a otra.
 */
export function freshIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

/** Cookies "nombre=valor" de una respuesta, listas para mandar en Cookie. */
export function cookiesFrom(res: request.Response): Record<string, string> {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const out: Record<string, string> = {};
  for (const line of raw ?? []) {
    const [pair] = line.split(';');
    const index = pair.indexOf('=');
    out[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return out;
}

export function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export async function loginAdmin(app: INestApplication<App>, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/admin/auth/login')
    .set('Origin', ORIGIN)
    .set('X-Forwarded-For', freshIp())
    .send({ email, password });
  if (res.status !== 200) throw new Error(`Login falló: ${res.status} ${JSON.stringify(res.body)}`);
  return cookiesFrom(res);
}

export async function createTestAdmin(
  prisma: PrismaClient,
  data: { email: string; password: string; mustChangePassword?: boolean; active?: boolean },
) {
  return prisma.admin.create({
    data: {
      name: 'Admin de prueba',
      email: data.email,
      passwordHash: await argon2.hash(data.password, ARGON2_OPTIONS),
      mustChangePassword: data.mustChangePassword ?? false,
      active: data.active ?? true,
    },
  });
}

/** PNG real de 1×1 píxel. */
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
