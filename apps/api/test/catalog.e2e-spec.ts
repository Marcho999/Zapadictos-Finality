import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Paginated, ProductCardDto } from '@zapadictos/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/setup-app.js';

describe('Catálogo (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const list = async (query = '') => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/products${query}`)
      .expect(200);
    return res.body as Paginated<ProductCardDto>;
  };

  it('lista solo productos activos, 12 por página, los más nuevos primero', async () => {
    const page = await list();
    expect(page.meta).toMatchObject({ page: 1, pageSize: 12, total: 11 });
    expect(page.data.map((p) => p.slug)).not.toContain('tundra-skate-pro');
    expect(page.data[0].slug).toBe('velo-tempo');
  });

  it('aplica la oferta vigente y marca los productos nuevos', async () => {
    const page = await list('?q=stride');
    expect(page.data).toHaveLength(1);
    expect(page.data[0]).toMatchObject({
      price: 389900,
      salePrice: 329900,
      isNew: true,
      minSize: 37,
      maxSize: 45,
    });
  });

  it('Hombre incluye los modelos unisex', async () => {
    const page = await list('?gender=MEN');
    const genders = new Set(page.data.map((p) => p.gender));
    expect([...genders].sort()).toEqual(['MEN', 'UNISEX']);
  });

  it('filtra por talla con stock y por varias marcas', async () => {
    const page = await list('?brand=velo,nomad&size=44');
    expect(page.data.length).toBeGreaterThan(0);
    for (const p of page.data) {
      expect(['velo', 'nomad']).toContain(p.brand.slug);
      expect(p.maxSize).toBeGreaterThanOrEqual(44);
    }
  });

  it('filtra y ordena por el precio vigente (con oferta)', async () => {
    const page = await list('?onSale=true&sort=price_asc');
    expect(page.data.map((p) => p.salePrice)).toEqual([269900, 329900]);

    const range = await list('?minPrice=320000&maxPrice=330000');
    expect(range.data.map((p) => p.slug).sort()).toEqual([
      'nomad-city-mid',
      'velo-stride-2',
    ]);
  });

  it('la búsqueda ignora tildes y mayúsculas, y trata % como texto', async () => {
    expect((await list('?q=K%C3%93RA')).meta.total).toBe(2);
    expect((await list('?q=%25')).meta.total).toBe(0);
  });

  it('rechaza parámetros desconocidos o inválidos con un error en español', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products?size=99&admin=true')
      .expect(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      message: 'Los datos enviados no son válidos',
    });
  });

  it('el detalle trae colores y tallas, sin revelar el stock exacto alto', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products/velo-stride-2')
      .expect(200);
    expect(res.body.colors.map((c: { code: string }) => c.code)).toEqual([
      'NEG',
      'BLA',
      'NAR',
    ]);
    expect(res.body.offer.salePrice).toBe(329900);
    for (const color of res.body.colors) {
      for (const v of color.variants) expect(v.stock).toBeLessThanOrEqual(10);
    }
  });

  it('un producto inactivo responde 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products/tundra-skate-pro')
      .expect(404);
    expect(res.body.message).toBe('No encontramos lo que buscas');
  });

  it('marcas y categorías vienen ordenadas', async () => {
    const brands = await request(app.getHttpServer()).get('/api/v1/brands');
    expect(brands.body[0]).toEqual({ slug: 'arca', name: 'Arca' });
    const categories = await request(app.getHttpServer()).get(
      '/api/v1/categories',
    );
    expect(categories.body.map((c: { slug: string }) => c.slug).slice(0, 4)).toEqual([
      'running',
      'urbano',
      'basket',
      'skate',
    ]);
  });

  it('envía encabezados de seguridad y no revela la tecnología', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
