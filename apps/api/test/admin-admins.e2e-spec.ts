import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ADMIN_EMAIL, ORIGIN, cookieHeader, cookiesFrom, createApp, createPrisma, freshIp, loginAdmin } from './helpers.js';

describe('Administradores del panel (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = createPrisma();
  const http = () => request(app.getHttpServer());
  let rootCookie: string;

  let n = 0;
  function newEmail() {
    return `admin.panel.${++n}.${Date.now()}@correo.test`;
  }

  function asAdmin(cookie: string, method: 'get' | 'post' | 'patch', path: string) {
    return http()[method](`/api/v1/admin${path}`).set('Origin', ORIGIN).set('Cookie', cookie).set('X-Forwarded-For', freshIp());
  }

  beforeAll(async () => {
    app = await createApp();
    rootCookie = cookieHeader(await loginAdmin(app));
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('una sesión de cliente no puede listar ni crear administradores', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('X-Forwarded-For', freshIp())
      .send({ name: 'Cliente Prueba', email: newEmail(), password: 'zapatos2026', acceptDataPolicy: true })
      .expect(201);
    const customerCookie = cookieHeader(cookiesFrom(res));
    await http().get('/api/v1/admin/admins').set('Cookie', customerCookie).expect(401);
  });

  it('crea un administrador con contraseña temporal: debe cambiarla antes de usar el panel', async () => {
    const email = newEmail();
    const list = (await asAdmin(rootCookie, 'post', '/admins').send({ name: 'Nuevo Admin', email, temporaryPassword: 'temporal-123456' }).expect(201)).body;
    const created = list.find((a: { email: string }) => a.email === email);
    expect(created.mustChangePassword).toBe(true);
    expect(created.createdByName).toBeTruthy();

    const loginRes = await http().post('/api/v1/admin/auth/login').set('Origin', ORIGIN).set('X-Forwarded-For', freshIp()).send({ email, password: 'temporal-123456' }).expect(200);
    const newCookie = cookieHeader(cookiesFrom(loginRes));

    // Con contraseña pendiente, solo puede usar me/change-password/logout.
    await http().get('/api/v1/admin/admins').set('Origin', ORIGIN).set('Cookie', newCookie).expect(403);
    await http().get('/api/v1/admin/auth/me').set('Origin', ORIGIN).set('Cookie', newCookie).expect(200);

    await http()
      .post('/api/v1/admin/auth/change-password')
      .set('Origin', ORIGIN)
      .set('Cookie', newCookie)
      .send({ currentPassword: 'temporal-123456', newPassword: 'contrasena-definitiva-1' })
      .expect(200);
    await asAdmin(newCookie, 'get', '/admins').expect(200);
  });

  it('un correo repetido responde 409', async () => {
    await asAdmin(rootCookie, 'post', '/admins').send({ name: 'Duplicado', email: ADMIN_EMAIL, temporaryPassword: 'temporal-123456' }).expect(409);
  });

  it('un administrador no puede desactivarse a sí mismo', async () => {
    const me = (await http().get('/api/v1/admin/auth/me').set('Cookie', rootCookie).expect(200)).body;
    await asAdmin(rootCookie, 'patch', `/admins/${me.id}`).send({ active: false }).expect(409);
  });

  it('no se puede desactivar al último administrador activo', async () => {
    const email = newEmail();
    await asAdmin(rootCookie, 'post', '/admins').send({ name: 'Único Activo', email, temporaryPassword: 'temporal-123456' }).expect(201);
    const loginRes = await http().post('/api/v1/admin/auth/login').set('Origin', ORIGIN).set('X-Forwarded-For', freshIp()).send({ email, password: 'temporal-123456' }).expect(200);
    const onlyAdminCookie = cookieHeader(cookiesFrom(loginRes));
    // Con contraseña temporal pendiente, el guard solo deja usar me/change-password/logout.
    await http()
      .post('/api/v1/admin/auth/change-password')
      .set('Origin', ORIGIN)
      .set('Cookie', onlyAdminCookie)
      .send({ currentPassword: 'temporal-123456', newPassword: 'contrasena-definitiva-2' })
      .expect(200);

    // Desde la cuenta raíz desactiva a todos los demás menos el seed y el
    // recién creado (nunca se desactiva a sí misma: usaría la regla distinta
    // de "no puedes desactivarte a ti mismo").
    const list = (await asAdmin(rootCookie, 'get', '/admins').expect(200)).body as { id: string; email: string; active: boolean }[];
    for (const a of list) {
      if (a.email !== email && a.email !== ADMIN_EMAIL && a.active) {
        await asAdmin(rootCookie, 'patch', `/admins/${a.id}`).send({ active: false }).expect(200);
      }
    }

    // Quedan dos activos (seed y el nuevo): el nuevo sí puede desactivar al
    // seed, porque él mismo sigue contando como "otro activo".
    const seedAdmin = list.find((a) => a.email === ADMIN_EMAIL)!;
    await asAdmin(onlyAdminCookie, 'patch', `/admins/${seedAdmin.id}`).send({ active: false }).expect(200);

    // Ahora el nuevo es el único activo: no puede desactivarse a sí mismo.
    const self = (await http().get('/api/v1/admin/auth/me').set('Cookie', onlyAdminCookie).expect(200)).body;
    const res = await asAdmin(onlyAdminCookie, 'patch', `/admins/${self.id}`).send({ active: false }).expect(409);
    expect(res.body.message).toMatch(/desactivarte a ti mismo/);

    // Reactiva al admin del seed para no romper el resto de las pruebas e2e.
    // Desactivarlo revocó su sesión anterior, así que `rootCookie` también se
    // renueva con un login nuevo.
    await asAdmin(onlyAdminCookie, 'patch', `/admins/${seedAdmin.id}`).send({ active: true }).expect(200);
    rootCookie = cookieHeader(await loginAdmin(app));
  });

  it('desactivar a un administrador revoca sus sesiones, y restablecer la contraseña también', async () => {
    const email = newEmail();
    await asAdmin(rootCookie, 'post', '/admins').send({ name: 'Para Revocar', email, temporaryPassword: 'temporal-123456' }).expect(201);
    const loginRes = await http().post('/api/v1/admin/auth/login').set('Origin', ORIGIN).set('X-Forwarded-For', freshIp()).send({ email, password: 'temporal-123456' }).expect(200);
    const cookies = cookiesFrom(loginRes);
    const targetCookie = cookieHeader(cookies);
    const targetId = (await http().get('/api/v1/admin/auth/me').set('Cookie', targetCookie).expect(200)).body.id;

    await asAdmin(rootCookie, 'patch', `/admins/${targetId}`).send({ active: false }).expect(200);
    await http().post('/api/v1/admin/auth/refresh').set('Origin', ORIGIN).set('Cookie', `zp_admin_rt=${cookies.zp_admin_rt}`).expect(401);

    await asAdmin(rootCookie, 'patch', `/admins/${targetId}`).send({ active: true, temporaryPassword: 'otra-temporal-99' }).expect(200);
    const afterReset = (await asAdmin(rootCookie, 'get', '/admins').expect(200)).body as { id: string; mustChangePassword: boolean }[];
    expect(afterReset.find((a) => a.id === targetId)?.mustChangePassword).toBe(true);
  });
});
