import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { AdminProductDetailDto } from '@zapadictos/shared';
import { describe, expect, it } from 'vitest';
import AdminColorsPanel from '~/components/admin/AdminColorsPanel.vue';
import AdminOfferPanel from '~/components/admin/AdminOfferPanel.vue';
import AdminProductForm from '~/components/admin/AdminProductForm.vue';

const day = 24 * 60 * 60 * 1000;
const product: AdminProductDetailDto = {
  id: 'p1',
  name: 'Velo Stride 2',
  reference: 'VEL-STR2',
  slug: 'velo-stride-2',
  description: 'Zapatilla de running para entrenamiento diario.',
  gender: 'UNISEX',
  price: 389900,
  active: true,
  brandId: 'b1',
  categoryId: 'c1',
  createdAt: new Date().toISOString(),
  colors: [
    {
      id: 'col1',
      name: 'Negro',
      hex: '#111111',
      code: 'NEG',
      sortOrder: 0,
      active: true,
      images: [],
      variants: [
        { id: 'v1', size: 37, sku: 'VEL-STR2-NEG-37', stock: 0, active: true },
        { id: 'v2', size: 38, sku: 'VEL-STR2-NEG-38', stock: 2, active: true },
        { id: 'v3', size: 39, sku: 'VEL-STR2-NEG-39', stock: 9, active: true },
      ],
    },
  ],
  offers: [
    {
      id: 'o1',
      salePrice: 329900,
      startsAt: new Date(Date.now() - day).toISOString(),
      endsAt: new Date(Date.now() + 10 * day).toISOString(),
      active: true,
      state: 'current',
      createdBy: 'Marvin',
    },
  ],
};

describe('Panel: colores, tallas y fotos', () => {
  it('muestra cada talla con su SKU y su estado de stock', async () => {
    const panel = await mountSuspended(AdminColorsPanel, { props: { product } });
    const text = panel.text();
    expect(text).toContain('Color: Negro');
    expect(text).toContain('VEL-STR2-NEG-38');
    expect(text).toContain('Agotada');
    expect(text).toContain('Últimos pares');
    expect(text).toContain('Disponible');
    expect(text).toContain('11 pares');
    expect(text).toContain('0 de 8');
  });
});

describe('Panel: oferta', () => {
  it('muestra la oferta vigente con su descuento y el historial', async () => {
    const panel = await mountSuspended(AdminOfferPanel, { props: { product } });
    const text = panel.text();
    expect(text).toContain('$329.900');
    expect(text).toContain('−15% · ahorro $60.000');
    expect(text).toContain('Vigente');
    expect(text).toContain('Marvin');
  });
});

describe('Panel: formulario de producto', () => {
  it('valida con los esquemas compartidos antes de llamar a la API', async () => {
    let called = false;
    const form = await mountSuspended(AdminProductForm, {
      props: {
        initial: { name: '', reference: '', slug: '', brandId: '', categoryId: '', gender: 'UNISEX', price: 0, description: '', active: false },
        brands: [],
        categories: [],
        submitLabel: 'Crear producto',
        save: async () => {
          called = true;
        },
      },
    });
    await form.find('form').trigger('submit');
    await new Promise((r) => setTimeout(r, 0));
    expect(called).toBe(false);
    expect(form.text()).toContain('Escribe el nombre');
    expect(form.text()).toContain('El precio debe ser mayor que 0');
  });
});
