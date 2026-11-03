import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';
import { FakeWompi, signedEvent } from './fake-wompi.js';
import { ORIGIN, cookieHeader, cookiesFrom, createApp, createPrisma, freshIp, loginAdmin } from './helpers.js';

describe('Carrito, pedidos y pagos (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = createPrisma();
  const wompi = new FakeWompi();
  const http = () => request(app.getHttpServer());
  let productId: string;
  /** Variantes de un producto de prueba, con stock controlado. */
  const v: Record<string, string> = {};

  let n = 0;
  async function customer() {
    const res = await http()
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', freshIp())
      .send({ name: 'Cliente Prueba', email: `compra${++n}.${Date.now()}@correo.test`, password: 'zapatos2026', acceptDataPolicy: true })
      .expect(201);
    const cookie = cookieHeader(cookiesFrom(res));
    // IP propia por cliente: el límite de checkouts por IP no mezcla pruebas.
    const ip = freshIp();
    const call = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
      http()[method](`/api/v1${path}`).set('Origin', ORIGIN).set('Cookie', cookie).set('X-Forwarded-For', ip);
    const addresses = await call('post', '/users/me/addresses')
      .send({ label: 'Casa', recipientName: 'Cliente Prueba', phone: '3001234567', department: 'Antioquia', city: 'Medellín', line1: 'Calle 1 # 2-3' })
      .expect(201);
    return { call, cookie, addressId: addresses.body[0].id as string, id: res.body.id as string };
  }

  async function setStock(size: number, stock: number) {
    await prisma.variant.update({ where: { id: v[size] }, data: { stock } });
  }
  const stockOf = async (size: number) => (await prisma.variant.findUniqueOrThrow({ where: { id: v[size] } })).stock;

  beforeAll(async () => {
    await wompi.start();
    app = await createApp();
    const brand = await prisma.brand.findUniqueOrThrow({ where: { slug: 'arca' } });
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'urbano' } });
    const product = await prisma.product.create({
      data: {
        reference: 'TST-CMP',
        name: 'Arca Compra Prueba',
        slug: 'arca-compra-prueba',
        description: 'Producto de las pruebas de compra.',
        gender: 'UNISEX',
        price: 200000,
        brandId: brand.id,
        categoryId: category.id,
        colors: { create: { name: 'Negro', hex: '#111111', code: 'NEG', variants: { create: [40, 41, 42].map((size) => ({ size, stock: 50, sku: `TST-CMP-NEG-${size}` })) } } },
      },
      include: { colors: { include: { variants: true } } },
    });
    productId = product.id;
    for (const variant of product.colors[0].variants) v[variant.size] = variant.id;
    // Oferta vigente: el pedido debe usar el precio rebajado.
    const admin = await prisma.admin.findFirstOrThrow();
    await prisma.offer.create({
      data: { productId, salePrice: 150000, startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000), createdById: admin.id },
    });
  });

  afterAll(async () => {
    await prisma.product.update({ where: { id: productId }, data: { active: false } });
    await prisma.$disconnect();
    await app.close();
    await wompi.stop();
  });

  describe('carrito', () => {
    it('GET /variants da precio vigente y disponibilidad sin sesión', async () => {
      const res = await http().get(`/api/v1/variants?ids=${v[40]},${v[41]}`).expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({ price: 200000, salePrice: 150000, available: true, productName: 'Arca Compra Prueba' });
    });

    it('agrega, limita a 5 por talla y al stock, cambia la cantidad y quita', async () => {
      const c = await customer();
      await setStock(40, 3);
      let cart = (await c.call('post', '/cart/items').send({ variantId: v[40], quantity: 2 }).expect(201)).body;
      expect(cart).toMatchObject({ count: 2, subtotal: 300000, shippingCost: 15000, total: 315000, canCheckout: true });

      await c.call('post', '/cart/items').send({ variantId: v[40], quantity: 2 }).expect(409);
      await c.call('post', '/cart/items').send({ variantId: v[41], quantity: 6 }).expect(400);

      const lineId = cart.lines[0].id;
      cart = (await c.call('patch', `/cart/items/${lineId}`).send({ quantity: 1 }).expect(200)).body;
      expect(cart.count).toBe(1);
      cart = (await c.call('delete', `/cart/items/${lineId}`).expect(200)).body;
      expect(cart).toMatchObject({ count: 0, shippingCost: 0, canCheckout: false });
      await setStock(40, 50);
    });

    it('al iniciar sesión une el carrito local sumando cantidades con tope', async () => {
      const c = await customer();
      await c.call('post', '/cart/items').send({ variantId: v[41], quantity: 3 }).expect(201);
      const inactiveVariant = (await prisma.variant.findFirstOrThrow({ where: { productColor: { product: { active: false } } } })).id;
      const cart = (
        await c.call('post', '/cart/merge').send({ items: [{ variantId: v[41], quantity: 4 }, { variantId: v[42], quantity: 1 }, { variantId: inactiveVariant, quantity: 1 }] }).expect(201)
      ).body;
      const qty = Object.fromEntries(cart.lines.map((l: { variant: { size: number }; quantity: number }) => [l.variant.size, l.quantity]));
      expect(qty).toEqual({ 41: 5, 42: 1 });
    });

    it('el carrito de un cliente no se puede tocar con la sesión de otro', async () => {
      const a = await customer();
      const b = await customer();
      const line = (await a.call('post', '/cart/items').send({ variantId: v[40] }).expect(201)).body.lines[0];
      await b.call('patch', `/cart/items/${line.id}`).send({ quantity: 2 }).expect(404);
      await b.call('delete', `/cart/items/${line.id}`).expect(404);
    });
  });

  describe('pedidos', () => {
    it('crea el pedido con precios de la API, reserva el stock y vacía el carrito', async () => {
      const c = await customer();
      const before = await stockOf(42);
      await c.call('post', '/cart/items').send({ variantId: v[42], quantity: 2 }).expect(201);
      const order = (await c.call('post', '/orders').send({ addressId: c.addressId }).expect(201)).body;

      expect(order).toMatchObject({ status: 'PENDING_PAYMENT', subtotal: 300000, shippingCost: 15000, total: 315000 });
      expect(order.number).toMatch(/^ZP-\d{6}$/);
      expect(order.items[0]).toMatchObject({ unitPrice: 150000, listPrice: 200000, size: 42, sku: 'TST-CMP-NEG-42' });
      expect(order.shipping.city).toBe('Medellín');
      expect(new Date(order.expiresAt).getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
      expect(await stockOf(42)).toBe(before - 2);
      expect((await c.call('get', '/cart').expect(200)).body.count).toBe(0);
    });

    it('ignora cualquier precio que mande el navegador', async () => {
      const c = await customer();
      await c.call('post', '/cart/items').send({ variantId: v[40], quantity: 1, price: 1 }).expect(400);
      await c.call('post', '/cart/items').send({ variantId: v[40] }).expect(201);
      await c.call('post', '/orders').send({ addressId: c.addressId, total: 1 }).expect(400);
    });

    it('sin stock suficiente responde 409 y no reserva nada', async () => {
      const c = await customer();
      await setStock(40, 2);
      await setStock(41, 2);
      await c.call('post', '/cart/items').send({ variantId: v[40], quantity: 2 }).expect(201);
      await c.call('post', '/cart/items').send({ variantId: v[41], quantity: 2 }).expect(201);
      await setStock(41, 1); // alguien compró mientras tanto
      const res = await c.call('post', '/orders').send({ addressId: c.addressId }).expect(409);
      expect(res.body.message).toMatch(/talla 41.*no se reservó nada/);
      expect(await stockOf(40)).toBe(2);
      expect(await stockOf(41)).toBe(1);
      await setStock(40, 50);
      await setStock(41, 50);
    });

    it('dos pedidos simultáneos por el último par: solo uno se completa', async () => {
      await setStock(40, 1);
      const a = await customer();
      const b = await customer();
      await a.call('post', '/cart/items').send({ variantId: v[40] }).expect(201);
      await b.call('post', '/cart/items').send({ variantId: v[40] }).expect(201);
      const results = await Promise.all([
        a.call('post', '/orders').send({ addressId: a.addressId }),
        b.call('post', '/orders').send({ addressId: b.addressId }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await stockOf(40)).toBe(0);
      await setStock(40, 50);
    });

    it('no acepta direcciones de otro cliente ni carritos vacíos, y limita a 3 pedidos pendientes', async () => {
      const a = await customer();
      const b = await customer();
      await a.call('post', '/orders').send({ addressId: a.addressId }).expect(400);
      await a.call('post', '/cart/items').send({ variantId: v[41] }).expect(201);
      await a.call('post', '/orders').send({ addressId: b.addressId }).expect(400);

      for (let i = 0; i < 3; i++) {
        await a.call('post', '/cart/items').send({ variantId: v[41] }).expect(201);
        await a.call('post', '/orders').send({ addressId: a.addressId }).expect(201);
      }
      await a.call('post', '/cart/items').send({ variantId: v[41] }).expect(201);
      const res = await a.call('post', '/orders').send({ addressId: a.addressId }).expect(409);
      expect(res.body.message).toMatch(/3 pedidos esperando pago/);
    });

    it('un cliente no puede ver ni pagar el pedido de otro (404)', async () => {
      const a = await customer();
      const b = await customer();
      await a.call('post', '/cart/items').send({ variantId: v[42] }).expect(201);
      const order = (await a.call('post', '/orders').send({ addressId: a.addressId }).expect(201)).body;
      await b.call('get', `/orders/${order.id}`).expect(404);
      await b.call('post', `/payments/${order.id}/checkout`).expect(404);
      expect((await b.call('get', '/orders').expect(200)).body.meta.total).toBe(0);
      expect((await a.call('get', '/orders').expect(200)).body.data[0]).toMatchObject({ id: order.id, itemCount: 1 });
    });
  });

  describe('pagos', () => {
    async function pendingOrder() {
      const c = await customer();
      await c.call('post', '/cart/items').send({ variantId: v[42] }).expect(201);
      const order = (await c.call('post', '/orders').send({ addressId: c.addressId }).expect(201)).body;
      return { c, order };
    }
    const webhook = (body: object) => http().post('/api/v1/payments/webhook').send(body);

    it('el checkout entrega la firma de integridad de Wompi y una referencia por intento', async () => {
      const { c, order } = await pendingOrder();
      const first = (await c.call('post', `/payments/${order.id}/checkout`).expect(201)).body;
      expect(first).toMatchObject({ publicKey: 'pub_test_e2e', currency: 'COP', amountInCents: 16500000, reference: `${order.number}-1` });
      const expected = createHash('sha256')
        .update(`${first.reference}${first.amountInCents}COP${first.expirationTime}e2e-integrity-secret`)
        .digest('hex');
      expect(first.signature).toBe(expected);
      expect(first.expirationTime).toBe(order.expiresAt);

      const second = (await c.call('post', `/payments/${order.id}/checkout`).expect(201)).body;
      expect(second.reference).toBe(`${order.number}-2`);
    });

    it('el webhook sin firma válida se rechaza y no cambia el pedido', async () => {
      const { c, order } = await pendingOrder();
      const { reference, amountInCents } = (await c.call('post', `/payments/${order.id}/checkout`).expect(201)).body;
      const forged = signedEvent({ id: 'tx-falsa', status: 'APPROVED', amount_in_cents: amountInCents, reference }, 'secreto-adivinado');
      await webhook(forged).expect(401);
      expect((await c.call('get', `/orders/${order.id}`).expect(200)).body.status).toBe('PENDING_PAYMENT');
    });

    it('un webhook APPROVED firmado marca el pedido como pagado, y repetirlo no cambia nada', async () => {
      const { c, order } = await pendingOrder();
      const { reference, amountInCents } = (await c.call('post', `/payments/${order.id}/checkout`).expect(201)).body;
      const event = signedEvent({ id: `tx-${Date.now()}`, status: 'APPROVED', amount_in_cents: amountInCents, reference });
      await webhook(event).expect(200);
      const paid = (await c.call('get', `/orders/${order.id}`).expect(200)).body;
      expect(paid.status).toBe('PAID');
      expect(paid.payments[0]).toMatchObject({ status: 'APPROVED', method: 'CARD' });

      await webhook(event).expect(200);
      const logs = await prisma.auditLog.count({ where: { entityId: order.id, action: 'PAYMENT_APPROVED' } });
      expect(logs).toBe(1);
    });

    it('un monto distinto al del pedido no aprueba nada', async () => {
      const { c, order } = await pendingOrder();
      const { reference } = (await c.call('post', `/payments/${order.id}/checkout`).expect(201)).body;
      await webhook(signedEvent({ id: `tx-m-${Date.now()}`, status: 'APPROVED', amount_in_cents: 100, reference })).expect(200);
      expect((await c.call('get', `/orders/${order.id}`).expect(200)).body.status).toBe('PENDING_PAYMENT');
      expect(await prisma.auditLog.count({ where: { entityId: order.id, action: 'PAYMENT_AMOUNT_MISMATCH' } })).toBe(1);
    });

    it('un pago rechazado deja el pedido pendiente para reintentar', async () => {
      const { c, order } = await pendingOrder();
      const { reference, amountInCents } = (await c.call('post', `/payments/${order.id}/checkout`).expect(201)).body;
      await webhook(signedEvent({ id: `tx-d-${Date.now()}`, status: 'DECLINED', amount_in_cents: amountInCents, reference })).expect(200);
      const after = (await c.call('get', `/orders/${order.id}`).expect(200)).body;
      expect(after.status).toBe('PENDING_PAYMENT');
      expect(after.payments[0].status).toBe('DECLINED');
      await c.call('post', `/payments/${order.id}/checkout`).expect(201);
    });

    it('verify consulta a Wompi de servidor a servidor y solo acepta transacciones del mismo pedido', async () => {
      const { c, order } = await pendingOrder();
      const other = await pendingOrder();
      const { reference, amountInCents } = (await c.call('post', `/payments/${order.id}/checkout`).expect(201)).body;
      const otherRef = (await other.c.call('post', `/payments/${other.order.id}/checkout`).expect(201)).body.reference;
      wompi.transactions.set('tx-verify-1', { id: 'tx-verify-1', status: 'APPROVED', amount_in_cents: amountInCents, currency: 'COP', reference, payment_method_type: 'PSE' });
      wompi.transactions.set('tx-verify-2', { id: 'tx-verify-2', status: 'APPROVED', amount_in_cents: amountInCents, currency: 'COP', reference: otherRef });

      await c.call('post', `/payments/${order.id}/verify`).send({ transactionId: 'tx-verify-2' }).expect(404);
      await c.call('post', `/payments/${order.id}/verify`).send({ transactionId: 'no-existe' }).expect(404);
      await c.call('post', `/payments/${order.id}/verify`).send({ transactionId: '../../admin' }).expect(400);
      const res = await c.call('post', `/payments/${order.id}/verify`).send({ transactionId: 'tx-verify-1' }).expect(200);
      expect(res.body).toMatchObject({ status: 'PAID' });
      expect(res.body.payments[0]).toMatchObject({ status: 'APPROVED', method: 'PSE' });
    });
  });

  describe('vencimiento', () => {
    it('cancela los pedidos vencidos y devuelve el stock', async () => {
      const c = await customer();
      await c.call('post', '/cart/items').send({ variantId: v[41], quantity: 2 }).expect(201);
      const order = (await c.call('post', '/orders').send({ addressId: c.addressId }).expect(201)).body;
      const reserved = await stockOf(41);
      await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

      await app.get(OrdersService).cancelExpired();
      const after = (await c.call('get', `/orders/${order.id}`).expect(200)).body;
      expect(after).toMatchObject({ status: 'CANCELLED', cancelReason: 'EXPIRED' });
      expect(await stockOf(41)).toBe(reserved + 2);
      await c.call('post', `/payments/${order.id}/checkout`).expect(409);
    });

    it('si el pago aprobado llega tarde y hay stock, el pedido revive; si no, queda para revisión', async () => {
      const make = async () => {
        const c = await customer();
        await c.call('post', '/cart/items').send({ variantId: v[42] }).expect(201);
        const order = (await c.call('post', '/orders').send({ addressId: c.addressId }).expect(201)).body;
        const pay = (await c.call('post', `/payments/${order.id}/checkout`).expect(201)).body;
        await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
        return { c, order, pay };
      };
      const revived = await make();
      const stranded = await make();
      await app.get(OrdersService).cancelExpired();

      await webhook(signedEvent({ id: `tx-late-1-${Date.now()}`, status: 'APPROVED', amount_in_cents: revived.pay.amountInCents, reference: revived.pay.reference })).expect(200);
      expect((await revived.c.call('get', `/orders/${revived.order.id}`).expect(200)).body.status).toBe('PAID');

      await setStock(42, 0);
      await webhook(signedEvent({ id: `tx-late-2-${Date.now()}`, status: 'APPROVED', amount_in_cents: stranded.pay.amountInCents, reference: stranded.pay.reference })).expect(200);
      const order = await prisma.order.findUniqueOrThrow({ where: { id: stranded.order.id } });
      expect(order).toMatchObject({ status: 'CANCELLED', needsReview: true });
      expect(await stockOf(42)).toBe(0);
      await setStock(42, 50);
    });

    function webhook(body: object) {
      return http().post('/api/v1/payments/webhook').send(body);
    }
  });

  describe('pedidos en el panel', () => {
    it('solo permite las transiciones definidas y cancelar devuelve el stock', async () => {
      const admin = cookieHeader(await loginAdmin(app));
      const asAdmin = (m: 'get' | 'patch', p: string) => http()[m](`/api/v1/admin/orders${p}`).set('Origin', ORIGIN).set('Cookie', admin);

      const c = await customer();
      await c.call('post', '/cart/items').send({ variantId: v[40], quantity: 2 }).expect(201);
      const order = (await c.call('post', '/orders').send({ addressId: c.addressId }).expect(201)).body;
      const pay = (await c.call('post', `/payments/${order.id}/checkout`).expect(201)).body;
      await http().post('/api/v1/payments/webhook').send(signedEvent({ id: `tx-adm-${Date.now()}`, status: 'APPROVED', amount_in_cents: pay.amountInCents, reference: pay.reference })).expect(200);

      const list = (await asAdmin('get', `?status=PAID&q=${order.number}`).expect(200)).body;
      expect(list.data.map((o: { id: string }) => o.id)).toContain(order.id);

      await asAdmin('patch', `/${order.id}/status`).send({ status: 'DELIVERED' }).expect(409);
      await asAdmin('patch', `/${order.id}/status`).send({ status: 'SHIPPED' }).expect(200);
      await asAdmin('patch', `/${order.id}/status`).send({ status: 'CANCELLED' }).expect(409);
      const delivered = (await asAdmin('patch', `/${order.id}/status`).send({ status: 'DELIVERED' }).expect(200)).body;
      expect(delivered.status).toBe('DELIVERED');
      expect(delivered.history.map((h: { action: string }) => h.action)).toEqual(
        expect.arrayContaining(['ORDER_CREATED', 'PAYMENT_APPROVED', 'ORDER_STATUS_CHANGED']),
      );

      const c2 = await customer();
      await c2.call('post', '/cart/items').send({ variantId: v[40], quantity: 2 }).expect(201);
      const toCancel = (await c2.call('post', '/orders').send({ addressId: c2.addressId }).expect(201)).body;
      const before = await stockOf(40);
      await asAdmin('patch', `/${toCancel.id}/status`).send({ status: 'CANCELLED', reason: 'Pedido de prueba' }).expect(200);
      expect(await stockOf(40)).toBe(before + 2);
    });

    it('la sesión de cliente no sirve para ver los pedidos del panel', async () => {
      const c = await customer();
      await http().get('/api/v1/admin/orders').set('Cookie', c.cookie).expect(401);
    });
  });
});
