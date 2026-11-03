import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { ProductCardDto } from '@zapadictos/shared';
import { describe, expect, it } from 'vitest';
import ProductCard from '~/components/store/ProductCard.vue';

const base: ProductCardDto = {
  slug: 'velo-stride-2',
  name: 'Velo Stride 2',
  brand: { slug: 'velo', name: 'Velo' },
  category: { slug: 'running', name: 'Running' },
  gender: 'UNISEX',
  price: 389900,
  salePrice: null,
  isNew: false,
  minSize: 37,
  maxSize: 45,
  lowStockSizes: [41],
  coverImage: null,
};

describe('ProductCard', () => {
  it('muestra precio, marca, categoría y rango de tallas', async () => {
    const card = await mountSuspended(ProductCard, { props: { product: base } });
    const text = card.text();
    expect(text).toContain('Velo · Running');
    expect(text).toContain('$389.900');
    expect(text).toContain('Tallas 37–45');
    expect(card.find('a').attributes('href')).toBe('/producto/velo-stride-2');
  });

  it('con oferta muestra el precio rebajado, el anterior tachado y el descuento', async () => {
    const card = await mountSuspended(ProductCard, {
      props: { product: { ...base, salePrice: 329900, isNew: true } },
    });
    const text = card.text();
    expect(text).toContain('$329.900');
    expect(card.find('.line-through').text()).toContain('$389.900');
    expect(text).toContain('Oferta −15%');
    expect(text).toContain('Nuevo');
  });

  it('avisa "Últimos pares" solo en la talla filtrada con poco stock', async () => {
    const low = await mountSuspended(ProductCard, {
      props: { product: base, highlightSize: 41 },
    });
    expect(low.text()).toContain('Últimos pares en 41');

    const plenty = await mountSuspended(ProductCard, {
      props: { product: base, highlightSize: 42 },
    });
    expect(plenty.text()).not.toContain('Últimos pares');
  });

  it('sin stock muestra "Agotado"', async () => {
    const card = await mountSuspended(ProductCard, {
      props: { product: { ...base, minSize: null, maxSize: null, lowStockSizes: [] } },
    });
    expect(card.text()).toContain('Agotado');
  });
});
