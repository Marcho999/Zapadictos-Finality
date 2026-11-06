import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { MAX_QTY_PER_ITEM, type CartVariantDto, type CustomerMeDto } from '@zapadictos/shared';
import { getQuery, readBody } from 'h3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { setCustomer } from '~/composables/useAccount';
import { useCart } from '~/composables/useCart';

const variant: CartVariantDto = {
  id: 'v1',
  sku: 'VEL-STR2-NEG-41',
  size: 41,
  stock: 4,
  available: true,
  colorName: 'Negro',
  colorCode: 'NEG',
  productName: 'Velo Stride 2',
  productSlug: 'velo-stride-2',
  brandName: 'Velo',
  price: 389900,
  salePrice: null,
  imageUrl: null,
};

const customer: CustomerMeDto = {
  id: 'c1',
  name: 'Laura Gómez',
  email: 'laura@example.com',
  phone: null,
  dataPolicyAcceptedAt: new Date().toISOString(),
};

// useCart usa useState, que necesita un contexto de app Nuxt activo: se monta
// un componente vacío solo para exponer el composable al test.
const Harness = defineComponent({ setup: () => ({ cart: useCart() }), render: () => null });
async function mountCart() {
  const wrapper = await mountSuspended(Harness);
  return wrapper.vm.cart as ReturnType<typeof useCart>;
}

/** Sirve GET /api/v1/variants?ids=... con la lista de variantes dada. */
function mockVariants(variants: CartVariantDto[]) {
  return registerEndpoint('/api/v1/variants', {
    method: 'GET',
    handler: (event) => {
      const ids = String(getQuery(event).ids ?? '').split(',');
      return variants.filter((v) => ids.includes(v.id));
    },
  });
}

describe('useCart (carrito de visitante)', () => {
  const cleanups: (() => void)[] = [];

  beforeEach(() => {
    localStorage.clear();
    setCustomer(null);
  });

  afterEach(() => {
    cleanups.splice(0).forEach((fn) => fn());
  });

  it('agrega una variante, calcula subtotal + envío y respeta el tope de 5 por talla', async () => {
    cleanups.push(mockVariants([{ ...variant, stock: 10 }]));

    const cart = await mountCart();
    for (let i = 0; i < 6; i++) await cart.add('v1');

    const result = cart.cart.value!;
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity).toBe(MAX_QTY_PER_ITEM);
    expect(result.subtotal).toBe(variant.price * MAX_QTY_PER_ITEM);
    expect(result.shippingCost).toBeGreaterThan(0);
    expect(result.total).toBe(result.subtotal + result.shippingCost);
    expect(result.canCheckout).toBe(true);
    expect(cart.itemCount.value).toBe(MAX_QTY_PER_ITEM);
  });

  it('avisa cuando el stock no alcanza y bloquea el checkout', async () => {
    cleanups.push(mockVariants([{ ...variant, stock: 1 }]));

    const cart = await mountCart();
    await cart.add('v1', 1);
    localStorage.setItem('zp_cart', JSON.stringify([{ variantId: 'v1', quantity: 3 }]));
    await cart.load();

    const line = cart.cart.value!.lines[0];
    expect(line.problem).toBe('Solo queda 1 par en esta talla');
    expect(cart.cart.value!.canCheckout).toBe(false);
  });

  it('avisa cuando la variante ya no está disponible', async () => {
    cleanups.push(mockVariants([{ ...variant, available: false }]));

    const cart = await mountCart();
    await cart.add('v1', 1);

    expect(cart.cart.value!.lines[0].problem).toBe('Este producto ya no está disponible');
    expect(cart.cart.value!.canCheckout).toBe(false);
  });

  it('une el carrito local al iniciar sesión y vacía el localStorage', async () => {
    localStorage.setItem('zp_cart', JSON.stringify([{ variantId: 'v1', quantity: 2 }]));
    const merged = { lines: [], count: 2, subtotal: 779800, shippingCost: 15000, total: 794800, canCheckout: true };
    cleanups.push(
      registerEndpoint('/api/v1/cart/merge', {
        method: 'POST',
        handler: async (event) => {
          expect(await readBody(event)).toEqual({ items: [{ variantId: 'v1', quantity: 2 }] });
          return merged;
        },
      }),
    );
    setCustomer(customer);

    const cart = await mountCart();
    await cart.merge();

    expect(cart.cart.value).toEqual(merged);
    expect(localStorage.getItem('zp_cart')).toBeNull();
  });
});
