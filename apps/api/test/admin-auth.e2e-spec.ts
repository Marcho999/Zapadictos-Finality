import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ORIGIN,
  cookieHeader,
  cookiesFrom,
  createApp,
  createPrisma,
  createTestAdmin,
  freshIp,
  loginAdmin,
} from './helpers.js';

describe('Sesión del administrador (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = createPrisma();
  const http = () => request(app.getHttpServer());
  const post = (path: string) => http().post(`/api/v1${path}`).set('Origin', ORIGIN).set('X-Forwarded-For', freshIp());

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('el login deja cookies httpOnly, Secure, SameSite=Strict y con ruta limitada', async () => {
    const res = await post('/admin/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }).expect(200);
    expect(res.body).toMatchObject({ email: ADMIN_EMAIL, mustChangePassword: false });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|"password"|\$argon2/);

    const raw = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(raw).toMatch(/zp_admin=[^;]+;.*Path=\/api\/v1\/admin;.*HttpOnly;.*Secure;.*SameSite=Strict/);
    expect(raw).toMatch(/zp_admin_rt=[^;]+;.*Path=\/api\/v1\/admin\/auth;.*HttpOnly;.*Secure;.*SameSite=Strict/);
  });

  it('contraseña incorrecta y correo inexistente dan el mismo mensaje', async () => {
    const wrong = await post('/admin/auth/login').send({ email: ADMIN_EMAIL, password: 'no-es-esta-clave' }).expect(401);
    const unknown = await post('/admin/auth/login').send({ email: 'nadie@zapadictos.co', password: 'no-es-esta-clave' }).expect(401);
    expect(wrong.body.message).toBe('Correo o contraseña incorrectos');
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('las peticiones que modifican datos exigen el Origin de la web', async () => {
    const body = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
    await http().post('/api/v1/admin/auth/login').set('X-Forwarded-For', freshIp()).send(body).expect(403);
    const res = await http()
      .post('/api/v1/admin/auth/login')
      .set('Origin', 'https://sitio-malicioso.example')
      .set('X-Forwarded-For', freshIp())
      .send(body)
      .expect(403);
    expect(res.body.message).toBe('Origen de la petición no permitido');
  });

  it('el panel rechaza peticiones sin sesión o con un token falsificado', async () => {
    await http().get('/api/v1/admin/products').expect(401);
    const forged = await new JwtService().signAsync(
      { sub: '00000000-0000-4000-8000-000000000000', sid: '00000000-0000-4000-8000-000000000000' },
      { secret: 'otro-secreto-que-no-es-el-del-panel-123456', audience: 'zapadictos-admin', issuer: 'zapadictos-api' },
    );
    await http().get('/api/v1/admin/products').set('Cookie', `zp_admin=${forged}`).expect(401);
  });

  it('el refresh rota el token y detecta si alguien reutiliza uno viejo', async () => {
    const first = await loginAdmin(app);

    const rotated = await post('/admin/auth/refresh').set('Cookie', cookieHeader({ zp_admin_rt: first.zp_admin_rt })).expect(200);
    const second = cookiesFrom(rotated);
    expect(second.zp_admin_rt).toBeDefined();
    expect(second.zp_admin_rt).not.toBe(first.zp_admin_rt);

    // Reutilizar el token viejo revoca toda la cadena, incluido el nuevo.
    await post('/admin/auth/refresh').set('Cookie', cookieHeader({ zp_admin_rt: first.zp_admin_rt })).expect(401);
    await post('/admin/auth/refresh').set('Cookie', cookieHeader({ zp_admin_rt: second.zp_admin_rt })).expect(401);
    await http().get('/api/v1/admin/auth/me').set('Cookie', cookieHeader({ zp_admin: second.zp_admin })).expect(401);

    const reused = await prisma.auditLog.count({ where: { action: 'ADMIN_REFRESH_REUSED' } });
    expect(reused).toBeGreaterThan(0);
  });

  it('cerrar sesión invalida el token de acceso al instante', async () => {
    const cookies = await loginAdmin(app);
    await http().get('/api/v1/admin/auth/me').set('Cookie', cookieHeader(cookies)).expect(200);
    await post('/admin/auth/logout').set('Cookie', cookieHeader(cookies)).expect(204);
    await http().get('/api/v1/admin/auth/me').set('Cookie', cookieHeader(cookies)).expect(401);
  });

  it('bloquea la cuenta 15 minutos después de 5 intentos fallidos', async () => {
    const email = 'bloqueo@zapadictos.test';
    const password = 'clave-correcta-larga';
    await createTestAdmin(prisma, { email, password });
    for (let i = 0; i < 5; i++) {
      await post('/admin/auth/login').send({ email, password: `incorrecta-${i}` }).expect(401);
    }
    const locked = await post('/admin/auth/login').send({ email, password }).expect(429);
    expect(locked.body.message).toMatch(/15 minutos/);
    const admin = await prisma.admin.findUniqueOrThrow({ where: { email } });
    expect(admin.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
  });

  it('limita el login a 3 intentos por minuto por IP', async () => {
    const ip = freshIp();
    const attempt = () =>
      http().post('/api/v1/admin/auth/login').set('Origin', ORIGIN).set('X-Forwarded-For', ip).send({ email: 'x@y.co', password: 'zzz' });
    await attempt().expect(401);
    await attempt().expect(401);
    await attempt().expect(401);
    const res = await attempt().expect(429);
    expect(res.body.message).toBe('Demasiados intentos. Espera un momento e inténtalo de nuevo');
  });

  it('con contraseña temporal solo puede cambiarla; al hacerlo se cierran sus otras sesiones', async () => {
    const email = 'temporal@zapadictos.test';
    const temp = 'temporal-entregada-1';
    await createTestAdmin(prisma, { email, password: temp, mustChangePassword: true });

    const otherDevice = await loginAdmin(app, email, temp);
    const cookies = await loginAdmin(app, email, temp);
    const blocked = await http().get('/api/v1/admin/products').set('Cookie', cookieHeader(cookies)).expect(403);
    expect(blocked.body.message).toBe('Debes cambiar tu contraseña temporal');

    await post('/admin/auth/change-password')
      .set('Cookie', cookieHeader(cookies))
      .send({ currentPassword: temp, newPassword: 'corta' })
      .expect(400);
    const changed = await post('/admin/auth/change-password')
      .set('Cookie', cookieHeader(cookies))
      .send({ currentPassword: temp, newPassword: 'mi-clave-propia-segura' })
      .expect(200);
    expect(changed.body.mustChangePassword).toBe(false);

    await http().get('/api/v1/admin/products').set('Cookie', cookieHeader(cookies)).expect(200);
    await http().get('/api/v1/admin/auth/me').set('Cookie', cookieHeader(otherDevice)).expect(401);
  });

  it('un administrador desactivado pierde el acceso aunque tenga sesión abierta', async () => {
    const email = 'desactivar@zapadictos.test';
    const password = 'clave-de-quien-se-va';
    await createTestAdmin(prisma, { email, password });
    const cookies = await loginAdmin(app, email, password);
    await prisma.admin.update({ where: { email }, data: { active: false } });
    await http().get('/api/v1/admin/auth/me').set('Cookie', cookieHeader(cookies)).expect(401);
  });

  it('la auditoría registra los intentos fallidos sin guardar la contraseña', async () => {
    const secret = 'clave-que-no-debe-quedar-guardada';
    await post('/admin/auth/login').send({ email: ADMIN_EMAIL, password: secret }).expect(401);
    const logs = await prisma.auditLog.findMany({ where: { action: 'ADMIN_LOGIN_FAILED' } });
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain(secret);
  });
});
