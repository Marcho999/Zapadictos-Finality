import type { INestApplication } from '@nestjs/common';
import type { AdminProductDetailDto } from '@zapadictos/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ORIGIN, PNG_1PX, cookieHeader, createApp, createPrisma, loginAdmin } from './helpers.js';

describe('Catálogo del panel (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let brandId: string;
  let categoryId: string;
  let product: AdminProductDetailDto;
  const prisma = createPrisma();

  const api = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
    request(app.getHttpServer())[method](`/api/v1/admin${path}`).set('Origin', ORIGIN).set('Cookie', cookie);

  const day = 24 * 60 * 60 * 1000;
  const at = (days: number) => new Date(Date.now() + days * day).toISOString();

  beforeAll(async () => {
    app = await createApp();
    cookie = cookieHeader(await loginAdmin(app));
    brandId = (await prisma.brand.findUniqueOrThrow({ where: { slug: 'velo' } })).id;
    categoryId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'running' } })).id;
  });

  afterAll(async () => {
    // Deja el catálogo público como estaba para las demás pruebas.
    if (product) await prisma.product.update({ where: { id: product.id }, data: { active: false } });
    await prisma.$disconnect();
    await app.close();
  });

  it('valida los datos del producto con mensajes en español', async () => {
    const res = await api('post', '/products').send({ name: 'X', price: -5 }).expect(400);
    const fields = res.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'price', 'reference', 'brandId']));
    expect(JSON.stringify(res.body.errors)).toMatch(/precio debe ser mayor que 0/);
  });

  it('crea un producto inactivo con slug automático', async () => {
    const res = await api('post', '/products')
      .send({
        name: 'Velo Prueba Uno',
        reference: 'vel-prb1',
        brandId,
        categoryId,
        gender: 'UNISEX',
        price: 300000,
        description: 'Producto creado por las pruebas automáticas.',
      })
      .expect(201);
    product = res.body;
    expect(product).toMatchObject({ slug: 'velo-prueba-uno', reference: 'VEL-PRB1', active: false });

    await api('post', '/products')
      .send({ name: 'Otro', reference: 'VEL-PRB1', brandId, categoryId, gender: 'MEN', price: 1000, description: 'Referencia repetida' })
      .expect(409)
      .expect((r) => expect(r.body.message).toBe('Ya existe un producto con esa referencia'));
  });

  it('agrega un color, sus tallas con SKU y registra los ajustes de stock', async () => {
    let res = await api('post', `/products/${product.id}/colors`).send({ name: 'Negro', hex: '#111111', code: 'neg' }).expect(201);
    const color = res.body.colors[0];
    expect(color.code).toBe('NEG');

    res = await api('post', `/colors/${color.id}/variants`).send({ from: 38, to: 40, stock: 2 }).expect(201);
    const variants = res.body.colors[0].variants;
    expect(variants.map((v: { sku: string }) => v.sku)).toEqual(['VEL-PRB1-NEG-38', 'VEL-PRB1-NEG-39', 'VEL-PRB1-NEG-40']);

    await api('post', `/colors/${color.id}/variants`).send({ from: 38, to: 39 }).expect(409);
    await api('patch', `/variants/${variants[0].id}`).send({ stock: -1 }).expect(400);
    await api('patch', `/variants/${variants[0].id}`).send({ stock: 7 }).expect(200);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'STOCK_ADJUSTED', entityId: variants[0].id } });
    expect(log.details).toMatchObject({ stock: { before: 2, after: 7 } });
  });

  it('cambiar la referencia regenera los SKU', async () => {
    const res = await api('patch', `/products/${product.id}`).send({ reference: 'VEL-PRB9' }).expect(200);
    expect(res.body.colors[0].variants[0].sku).toBe('VEL-PRB9-NEG-38');
  });

  it('acepta solo imágenes reales de hasta 5 MB', async () => {
    const colorId = (await api('get', `/products/${product.id}`)).body.colors[0].id;

    const ok = await api('post', `/colors/${colorId}/images`).attach('file', PNG_1PX, 'foto.png').expect(201);
    const image = ok.body.colors[0].images[0];
    expect(image.alt).toBe('Velo Prueba Uno Negro');
    await request(app.getHttpServer()).get(image.url).expect(200).expect('Content-Type', 'image/png');

    await api('post', `/colors/${colorId}/images`)
      .attach('file', Buffer.from('<svg onload="alert(1)"></svg>'), { filename: 'falsa.png', contentType: 'image/png' })
      .expect(415);
    await api('post', `/colors/${colorId}/images`)
      .attach('file', Buffer.concat([PNG_1PX, Buffer.alloc(5 * 1024 * 1024)]), 'grande.png')
      .expect(413);

    await api('delete', `/images/${image.id}`).expect(200);
    await request(app.getHttpServer()).get(image.url).expect(404);
  });

  it('las ofertas deben ser más baratas y no cruzarse con otra activa', async () => {
    await api('post', `/products/${product.id}/offers`)
      .send({ salePrice: 300000, startsAt: at(-1), endsAt: at(10) })
      .expect(400);

    const res = await api('post', `/products/${product.id}/offers`)
      .send({ salePrice: 250000, startsAt: at(-1), endsAt: at(10) })
      .expect(201);
    const current = res.body.offers[0];
    expect(current.state).toBe('current');

    const overlap = await api('post', `/products/${product.id}/offers`)
      .send({ salePrice: 240000, startsAt: at(5), endsAt: at(20) })
      .expect(409);
    expect(overlap.body.message).toMatch(/Se cruza con otra oferta activa/);

    const scheduled = await api('post', `/products/${product.id}/offers`)
      .send({ salePrice: 240000, startsAt: at(11), endsAt: at(20) })
      .expect(201);
    expect(scheduled.body.offers.map((o: { state: string }) => o.state)).toEqual(['scheduled', 'current']);

    // El precio normal no puede quedar por debajo de una oferta.
    await api('patch', `/products/${product.id}`).send({ price: 245000 }).expect(409);

    await api('delete', `/offers/${current.id}`).expect(409);
    await api('delete', `/offers/${scheduled.body.offers[0].id}`).expect(200);
  });

  it('al activarlo aparece en la tienda con su oferta', async () => {
    const before = await request(app.getHttpServer()).get('/api/v1/products/velo-prueba-uno');
    expect(before.status).toBe(404);

    await api('patch', `/products/${product.id}`).send({ active: true }).expect(200);
    const after = await request(app.getHttpServer()).get('/api/v1/products/velo-prueba-uno').expect(200);
    expect(after.body).toMatchObject({ price: 300000, salePrice: 250000 });

    await api('delete', `/products/${product.id}`).expect(204);
    await request(app.getHttpServer()).get('/api/v1/products/velo-prueba-uno').expect(404);
  });

  it('una marca con productos activos no se puede desactivar', async () => {
    const res = await api('patch', `/brands/${brandId}`).send({ active: false }).expect(409);
    expect(res.body.message).toMatch(/tiene \d+ productos activos/);

    const created = await api('post', '/categories').send({ name: 'Categoría Temporal' }).expect(201);
    expect(created.body.slug).toBe('categoria-temporal');
    await api('patch', `/categories/${created.body.id}`).send({ active: false }).expect(200);
  });

  it('cada cambio del panel queda en la auditoría con el administrador', async () => {
    const actions = await prisma.auditLog.findMany({
      where: { entityId: product.id },
      select: { action: true, adminId: true },
    });
    expect(actions.map((a) => a.action)).toEqual(expect.arrayContaining(['PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DEACTIVATED']));
    expect(actions.every((a) => a.adminId)).toBe(true);
  });
});
