import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ORIGIN, PNG_1PX, cookieHeader, cookiesFrom, createApp, createPrisma, freshIp, loginAdmin } from './helpers.js';

describe('Portada del panel (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = createPrisma();
  const http = () => request(app.getHttpServer());
  let cookie: string;
  let original: { tag: string; title: string; subtitle: string; ctaLabel: string; ctaHref: string; imageUrl: string | null };

  const put = () => http().put('/api/v1/admin/banner').set('Origin', ORIGIN).set('Cookie', cookie);

  beforeAll(async () => {
    app = await createApp();
    cookie = cookieHeader(await loginAdmin(app));
    const seeded = await prisma.banner.findFirstOrThrow();
    original = { tag: seeded.tag, title: seeded.title, subtitle: seeded.subtitle, ctaLabel: seeded.ctaLabel, ctaHref: seeded.ctaHref, imageUrl: seeded.imageUrl };
  });

  afterAll(async () => {
    // Deja la portada como estaba para las demás pruebas (el home la consulta).
    const banner = await prisma.banner.findFirstOrThrow();
    await prisma.banner.update({ where: { id: banner.id }, data: original });
    await prisma.$disconnect();
    await app.close();
  });

  it('una sesión de cliente no puede ver ni actualizar la portada', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', freshIp())
      .send({ name: 'Cliente Prueba', email: `portada.${Date.now()}@correo.test`, password: 'zapatos2026', acceptDataPolicy: true })
      .expect(201);
    const customerCookie = cookieHeader(cookiesFrom(res));
    await http().get('/api/v1/admin/banner').set('Cookie', customerCookie).expect(401);
    await http().put('/api/v1/admin/banner').set('Origin', ORIGIN).set('Cookie', customerCookie).expect(401);
  });

  it('actualiza los textos sin tocar la foto', async () => {
    const before = (await http().get('/api/v1/admin/banner').set('Origin', ORIGIN).set('Cookie', cookie).expect(200)).body;

    const res = await put()
      .field('tag', 'OFERTA ESPECIAL')
      .field('title', 'Título de prueba')
      .field('subtitle', 'Subtítulo de prueba')
      .field('ctaLabel', 'Ver ofertas')
      .field('ctaHref', '/tienda?onSale=true')
      .expect(200);

    expect(res.body.tag).toBe('OFERTA ESPECIAL');
    expect(res.body.ctaHref).toBe('/tienda?onSale=true');
    expect(res.body.imageUrl).toBe(before.imageUrl);
    expect(res.body.updatedByName).toBeTruthy();
  });

  it('sube una foto nueva y reemplaza la anterior', async () => {
    const before = (await http().get('/api/v1/admin/banner').set('Origin', ORIGIN).set('Cookie', cookie).expect(200)).body;

    const res = await put()
      .field('tag', 'NUEVA TEMPORADA')
      .field('title', 'Con foto nueva')
      .field('subtitle', 'Subtítulo')
      .field('ctaLabel', 'Ver catálogo')
      .field('ctaHref', '/tienda')
      .attach('file', PNG_1PX, 'portada.png')
      .expect(200);

    expect(res.body.imageUrl).not.toBe(before.imageUrl);
    expect(res.body.imageUrl).toMatch(/\/api\/v1\/uploads\//);
  });

  it('un ctaHref fuera de la lista fija responde 400', async () => {
    await put()
      .field('tag', 'X')
      .field('title', 'X')
      .field('subtitle', 'X')
      .field('ctaLabel', 'X')
      .field('ctaHref', 'https://malicioso.example')
      .expect(400);
  });

  it('GET /banner (público) refleja los cambios', async () => {
    await put().field('tag', 'PUBLICO').field('title', 'Título público').field('subtitle', 'Subtítulo').field('ctaLabel', 'Ir').field('ctaHref', '/tienda').expect(200);
    const res = await http().get('/api/v1/banner').expect(200);
    expect(res.body.tag).toBe('PUBLICO');
    expect(res.body.title).toBe('Título público');
  });
});
