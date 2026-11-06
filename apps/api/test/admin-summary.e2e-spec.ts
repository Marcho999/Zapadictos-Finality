import type { INestApplication } from '@nestjs/common';
import { LOW_STOCK_TOTAL, type AdminSummaryDto } from '@zapadictos/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { FakeWompi, signedEvent } from './fake-wompi.js';
import { ORIGIN, cookieHeader, cookiesFrom, createApp, createPrisma, freshIp, loginAdmin } from './helpers.js';

/**
 * Las pruebas e2e comparten la misma base y corren una tras otra
 * (fileParallelism: false), pero otros archivos dejan sus propios pedidos y
 * ofertas. Por eso cada prueba compara el resumen antes/después de su propia
 * acción en vez de esperar un número absoluto.
 */
describe('Resumen del panel (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = createPrisma();
  const wompi = new FakeWompi();
  const http = () => request(app.getHttpServer());
  let cookie: string;
  let productId: string;

  async function summary(): Promise<AdminSummaryDto> {
    return (await http().get('/api/v1/admin/summary').set('Origin', ORIGIN).set('Cookie', cookie).expect(200)).body;
  }

  let n = 0;
  async function customer() {
    const res = await http()
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', freshIp())
      .send({ name: 'Cliente Resumen', email: `resumen${++n}.${Date.now()}@correo.test`, password: 'zapatos2026', acceptDataPolicy: true })
      .expect(201);
    const sessionCookie = cookieHeader(cookiesFrom(res));
    const ip = freshIp();
    const call = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
      http()[method](`/api/v1${path}`).set('Origin', ORIGIN).set('Cookie', sessionCookie).set('X-Forwarded-For', ip);
    const addresses = await call('post', '/users/me/addresses')
      .send({ label: 'Casa', recipientName: 'Cliente Resumen', phone: '3001234567', department: 'Antioquia', city: 'Medellín', line1: 'Calle 1 # 2-3' })
      .expect(201);
    return { call, addressId: addresses.body[0].id as string };
  }

  beforeAll(async () => {
    await wompi.start();
    app = await createApp();
    cookie = cookieHeader(await loginAdmin(app));
    const brand = await prisma.brand.findUniqueOrThrow({ where: { slug: 'arca' } });
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'urbano' } });
    const product = await prisma.product.create({
      data: {
        reference: 'TST-SUM',
        name: 'Arca Resumen Prueba',
        slug: 'arca-resumen-prueba',
        description: 'Producto de las pruebas de resumen.',
        gender: 'UNISEX',
        price: 200000,
        brandId: brand.id,
        categoryId: category.id,
        colors: { create: { name: 'Negro', hex: '#111111', code: 'NEG', variants: { create: [{ size: 40, stock: 50, sku: 'TST-SUM-NEG-40' }] } } },
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.product.update({ where: { id: productId }, data: { active: false } });
    await prisma.$disconnect();
    await app.close();
    await wompi.stop();
  });

  it('una sesión de cliente no puede ver el resumen', async () => {
    const c = await customer();
    await c.call('get', '/admin/summary').expect(401);
  });

  it('suma las ventas de hoy y del mes, y cuenta el pedido pagado por estado', async () => {
    const before = await summary();

    const c = await customer();
    const variant = await prisma.variant.findFirstOrThrow({ where: { productColor: { productId } } });
    await c.call('post', '/cart/items').send({ variantId: variant.id, quantity: 1 }).expect(201);
    const order = (await c.call('post', '/orders').send({ addressId: c.addressId }).expect(201)).body;
    const pay = (await c.call('post', `/payments/${order.id}/checkout`).expect(201)).body;
    await http()
      .post('/api/v1/payments/webhook')
      .send(signedEvent({ id: `tx-sum-${Date.now()}`, status: 'APPROVED', amount_in_cents: pay.amountInCents, reference: pay.reference }))
      .expect(200);

    const after = await summary();
    expect(after.salesToday).toBe(before.salesToday + order.total);
    expect(after.salesMonth).toBe(before.salesMonth + order.total);
    expect(after.ordersByStatus.PAID).toBe(before.ordersByStatus.PAID + 1);
  });

  it('cuenta las ofertas activas, el stock bajo y los pedidos que necesitan revisión', async () => {
    const before = await summary();

    const admin = await prisma.admin.findFirstOrThrow();
    await prisma.offer.create({
      data: {
        productId,
        salePrice: 150000,
        startsAt: new Date(Date.now() - 86_400_000),
        endsAt: new Date(Date.now() + 86_400_000),
        createdById: admin.id,
      },
    });

    const variant = await prisma.variant.findFirstOrThrow({ where: { productColor: { productId } } });
    await prisma.variant.update({ where: { id: variant.id }, data: { stock: LOW_STOCK_TOTAL } });

    const c = await customer();
    await c.call('post', '/cart/items').send({ variantId: variant.id, quantity: 1 }).expect(201);
    const toReview = (await c.call('post', '/orders').send({ addressId: c.addressId }).expect(201)).body;
    await prisma.order.update({ where: { id: toReview.id }, data: { needsReview: true } });

    const after = await summary();
    expect(after.activeOffers).toBe(before.activeOffers + 1);
    expect(after.lowStockProducts).toBe(before.lowStockProducts + 1);
    expect(after.ordersNeedingReview).toBe(before.ordersNeedingReview + 1);
  });
});
