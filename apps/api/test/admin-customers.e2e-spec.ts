import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ORIGIN, cookieHeader, cookiesFrom, createApp, createPrisma, freshIp, loginAdmin } from './helpers.js';

describe('Clientes del panel (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = createPrisma();
  const http = () => request(app.getHttpServer());
  let adminCookie: string;
  let customerId: string;
  let customerEmail: string;
  let customerCookie: string;
  let orderId: string;

  const api = (path: string) => http().get(`/api/v1/admin/customers${path}`).set('Origin', ORIGIN).set('Cookie', adminCookie);

  beforeAll(async () => {
    app = await createApp();
    adminCookie = cookieHeader(await loginAdmin(app));

    customerEmail = `clientes.panel.${Date.now()}@correo.test`;
    const register = await http()
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', freshIp())
      .send({ name: 'Cliente Panel Admin', email: customerEmail, password: 'zapatos2026', acceptDataPolicy: true })
      .expect(201);
    customerId = register.body.id;
    customerCookie = cookieHeader(cookiesFrom(register));
    const ip = freshIp();
    const call = (method: 'get' | 'post', path: string) =>
      http()[method](`/api/v1${path}`).set('Origin', ORIGIN).set('Cookie', customerCookie).set('X-Forwarded-For', ip);

    const addresses = await call('post', '/users/me/addresses')
      .send({ label: 'Casa', recipientName: 'Cliente Panel Admin', phone: '3001234567', department: 'Antioquia', city: 'Medellín', line1: 'Calle 1 # 2-3' })
      .expect(201);

    const brand = await prisma.brand.findUniqueOrThrow({ where: { slug: 'arca' } });
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'urbano' } });
    const product = await prisma.product.create({
      data: {
        reference: 'TST-CLI',
        name: 'Arca Cliente Prueba',
        slug: 'arca-cliente-prueba',
        description: 'Producto de las pruebas de clientes.',
        gender: 'UNISEX',
        price: 150000,
        brandId: brand.id,
        categoryId: category.id,
        colors: { create: { name: 'Negro', hex: '#111111', code: 'NEG', variants: { create: [{ size: 40, stock: 10, sku: 'TST-CLI-NEG-40' }] } } },
      },
      include: { colors: { include: { variants: true } } },
    });
    await call('post', '/cart/items').send({ variantId: product.colors[0].variants[0].id, quantity: 1 }).expect(201);
    const order = await call('post', '/orders').send({ addressId: addresses.body[0].id }).expect(201);
    orderId = order.body.id;

    await prisma.product.update({ where: { id: product.id }, data: { active: false } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('una sesión de cliente no puede listar ni ver otros clientes', async () => {
    await http().get('/api/v1/admin/customers').set('Cookie', customerCookie).expect(401);
    await http().get(`/api/v1/admin/customers/${customerId}`).set('Cookie', customerCookie).expect(401);
  });

  it('encuentra al cliente por nombre o por correo', async () => {
    const byName = await api('?q=Cliente Panel Admin').expect(200);
    expect(byName.body.data.map((c: { id: string }) => c.id)).toContain(customerId);

    const byEmail = await api(`?q=${customerEmail}`).expect(200);
    expect(byEmail.body.data.map((c: { id: string }) => c.id)).toContain(customerId);

    const row = byEmail.body.data.find((c: { id: string }) => c.id === customerId);
    expect(row.ordersCount).toBe(1);
  });

  it('el detalle trae el perfil, las direcciones y los pedidos, de solo lectura', async () => {
    const res = await api(`/${customerId}`).expect(200);
    expect(res.body.email).toBe(customerEmail);
    expect(res.body.addresses).toHaveLength(1);
    expect(res.body.addresses[0].city).toBe('Medellín');
    expect(res.body.orders.map((o: { id: string }) => o.id)).toContain(orderId);
  });

  it('responde 404 para un cliente que no existe', async () => {
    await api('/00000000-0000-0000-0000-000000000000').expect(404);
  });
});
