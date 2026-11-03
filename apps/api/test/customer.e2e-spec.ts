import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ORIGIN, cookieHeader, cookiesFrom, createApp, createPrisma, freshIp, loginAdmin } from './helpers.js';

describe('Cuentas de cliente (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = createPrisma();
  const http = () => request(app.getHttpServer());
  const post = (path: string, ip = freshIp()) =>
    http().post(`/api/v1${path}`).set('Origin', ORIGIN).set('X-Forwarded-For', ip);

  let counter = 0;
  const newCustomer = () => ({
    name: 'Laura Gómez',
    email: `laura${++counter}.${Date.now()}@correo.test`,
    password: 'zapatos2026',
    phone: '300 123 4567',
    acceptDataPolicy: true,
  });

  async function register(data = newCustomer()) {
    const res = await post('/auth/register').send(data).expect(201);
    return { data, cookies: cookiesFrom(res), body: res.body };
  }

  const address = {
    label: 'Casa',
    recipientName: 'Laura Gómez',
    phone: '3001234567',
    department: 'Antioquia',
    city: 'Medellín',
    line1: 'Calle 45 # 12-30, apto 502',
  };

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('registro', () => {
    it('crea la cuenta, inicia sesión y guarda la aceptación de la política de datos', async () => {
      const { data, cookies, body } = await register();
      expect(body).toMatchObject({ name: 'Laura Gómez', email: data.email, phone: '3001234567' });
      expect(JSON.stringify(body)).not.toMatch(/passwordHash|\$argon2/);
      expect(cookies.zp_session).toBeDefined();
      expect(cookies.zp_session_rt).toBeDefined();

      const customer = await prisma.customer.findUniqueOrThrow({ where: { email: data.email } });
      expect(customer.dataPolicyAcceptedAt).toBeInstanceOf(Date);
      expect(customer.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    });

    it('exige aceptar la política de datos (Ley 1581) y una contraseña con letra y número', async () => {
      const noPolicy = await post('/auth/register').send({ ...newCustomer(), acceptDataPolicy: false }).expect(400);
      expect(JSON.stringify(noPolicy.body.errors)).toMatch(/política de tratamiento de datos/);

      const weak = await post('/auth/register').send({ ...newCustomer(), password: 'solamenteletras' }).expect(400);
      expect(JSON.stringify(weak.body.errors)).toMatch(/al menos un número/);

      await post('/auth/register').send({ ...newCustomer(), phone: '12345' }).expect(400);
    });

    it('no permite registrarse como administrador ni enviar campos de más', async () => {
      await post('/auth/register').send({ ...newCustomer(), role: 'ADMIN' }).expect(400);
      await post('/auth/register').send({ ...newCustomer(), active: false }).expect(400);
    });

    it('un correo repetido responde 409', async () => {
      const { data } = await register();
      const res = await post('/auth/register').send({ ...data, email: data.email.toUpperCase() }).expect(409);
      expect(res.body.message).toMatch(/Ya existe una cuenta con ese correo/);
    });
  });

  describe('sesión', () => {
    it('las cookies de la tienda son httpOnly, Secure, SameSite=Strict, y el refresh solo viaja a /auth', async () => {
      const res = await post('/auth/register').send(newCustomer()).expect(201);
      const raw = (res.headers['set-cookie'] as unknown as string[]).join('\n');
      expect(raw).toMatch(/zp_session=[^;]+;.*Path=\/api\/v1;.*HttpOnly;.*Secure;.*SameSite=Strict/);
      expect(raw).toMatch(/zp_session_rt=[^;]+;.*Path=\/api\/v1\/auth;.*HttpOnly;.*Secure;.*SameSite=Strict/);
    });

    it('login con mensaje genérico y límite de 5 intentos por minuto por IP', async () => {
      const { data } = await register();
      await post('/auth/login').send({ email: data.email, password: data.password }).expect(200);

      const ip = freshIp();
      const wrong = await post('/auth/login', ip).send({ email: data.email, password: 'otra1234' }).expect(401);
      const unknown = await post('/auth/login', ip).send({ email: 'nadie@correo.test', password: 'otra1234' }).expect(401);
      expect(wrong.body.message).toBe('Correo o contraseña incorrectos');
      expect(unknown.body.message).toBe(wrong.body.message);
      for (let i = 0; i < 3; i++) await post('/auth/login', ip).send({ email: data.email, password: 'otra1234' }).expect(401);
      await post('/auth/login', ip).send({ email: data.email, password: data.password }).expect(429);
    });

    it('el refresh rota el token y una reutilización cierra la sesión', async () => {
      const { cookies } = await register();
      const rotated = cookiesFrom(await post('/auth/refresh').set('Cookie', cookieHeader({ zp_session_rt: cookies.zp_session_rt })).expect(200));
      expect(rotated.zp_session_rt).not.toBe(cookies.zp_session_rt);

      await post('/auth/refresh').set('Cookie', cookieHeader({ zp_session_rt: cookies.zp_session_rt })).expect(401);
      await post('/auth/refresh').set('Cookie', cookieHeader({ zp_session_rt: rotated.zp_session_rt })).expect(401);
      await http().get('/api/v1/users/me').set('Cookie', cookieHeader({ zp_session: rotated.zp_session })).expect(401);
    });

    it('cerrar sesión invalida el token de acceso al instante', async () => {
      const { cookies } = await register();
      await http().get('/api/v1/users/me').set('Cookie', cookieHeader(cookies)).expect(200);
      await post('/auth/logout').set('Cookie', cookieHeader(cookies)).expect(204);
      await http().get('/api/v1/users/me').set('Cookie', cookieHeader(cookies)).expect(401);
    });
  });

  describe('separación de accesos (D-01)', () => {
    it('la sesión de cliente no sirve en el panel', async () => {
      const { cookies } = await register();
      await http().get('/api/v1/admin/products').set('Cookie', cookieHeader(cookies)).expect(401);
      // Ni aunque se renombre la cookie para que parezca la del panel.
      await http().get('/api/v1/admin/products').set('Cookie', `zp_admin=${cookies.zp_session}`).expect(401);
    });

    it('la sesión del panel no sirve en la tienda', async () => {
      const admin = await loginAdmin(app);
      await http().get('/api/v1/users/me').set('Cookie', cookieHeader(admin)).expect(401);
      await http().get('/api/v1/users/me').set('Cookie', `zp_session=${admin.zp_admin}`).expect(401);
    });

    it('un administrador no puede ingresar a la tienda con su cuenta del panel', async () => {
      const res = await post('/auth/login').send({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }).expect(401);
      expect(res.body.message).toBe('Correo o contraseña incorrectos');
    });
  });

  describe('perfil y direcciones', () => {
    it('edita nombre y celular, pero no el correo', async () => {
      const { cookies, data } = await register();
      const api = () => http().patch('/api/v1/users/me').set('Origin', ORIGIN).set('Cookie', cookieHeader(cookies));
      const res = await api().send({ name: 'Laura G.', phone: '' }).expect(200);
      expect(res.body).toMatchObject({ name: 'Laura G.', phone: null, email: data.email });
      await api().send({ email: 'otro@correo.test' }).expect(400);
    });

    it('la primera dirección queda como predeterminada y solo puede haber una', async () => {
      const { cookies } = await register();
      const api = (m: 'post' | 'patch' | 'delete', p = '') =>
        http()[m](`/api/v1/users/me/addresses${p}`).set('Origin', ORIGIN).set('Cookie', cookieHeader(cookies));

      let list = (await api('post').send(address).expect(201)).body;
      expect(list[0].isDefault).toBe(true);

      list = (await api('post').send({ ...address, label: 'Oficina', department: 'Bogotá D.C.', city: 'Bogotá', isDefault: true }).expect(201)).body;
      expect(list.filter((a: { isDefault: boolean }) => a.isDefault).map((a: { label: string }) => a.label)).toEqual(['Oficina']);

      // Al borrar la predeterminada, otra pasa a serlo.
      const office = list.find((a: { label: string }) => a.label === 'Oficina');
      list = (await api('delete', `/${office.id}`).expect(200)).body;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ label: 'Casa', isDefault: true });

      await api('post').send({ ...address, department: 'Narnia' }).expect(400);
    });

    it('permite hasta 5 direcciones', async () => {
      const { cookies } = await register();
      const create = () => http().post('/api/v1/users/me/addresses').set('Origin', ORIGIN).set('Cookie', cookieHeader(cookies)).send(address);
      for (let i = 0; i < 5; i++) await create().expect(201);
      const res = await create().expect(409);
      expect(res.body.message).toMatch(/hasta 5 direcciones/);
    });

    it('un cliente no puede ver, editar ni borrar las direcciones de otro', async () => {
      const a = await register();
      const b = await register();
      const created = await http().post('/api/v1/users/me/addresses').set('Origin', ORIGIN).set('Cookie', cookieHeader(a.cookies)).send(address).expect(201);
      const id = created.body[0].id;

      const asB = (m: 'patch' | 'delete') => http()[m](`/api/v1/users/me/addresses/${id}`).set('Origin', ORIGIN).set('Cookie', cookieHeader(b.cookies));
      await asB('patch').send({ city: 'Cali' }).expect(404);
      await asB('delete').expect(404);
      const listB = await http().get('/api/v1/users/me/addresses').set('Cookie', cookieHeader(b.cookies)).expect(200);
      expect(listB.body).toEqual([]);

      const still = await prisma.address.findUniqueOrThrow({ where: { id } });
      expect(still.city).toBe('Medellín');
    });
  });
});
