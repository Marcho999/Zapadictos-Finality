import { MAX_QTY_PER_ITEM, SHIPPING_COST, type CartDto, type CartLineDto, type CartVariantDto } from '@zapadictos/shared';

/** Carrito del visitante en localStorage (docs/05-reglas-negocio.md, Carrito). */
const LOCAL_KEY = 'zp_cart';
interface LocalItem {
  variantId: string;
  quantity: number;
}

function readLocal(): LocalItem[] {
  if (!import.meta.client) return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((i): i is LocalItem => typeof i?.variantId === 'string' && Number.isInteger(i?.quantity))
      : [];
  } catch {
    return [];
  }
}

function writeLocal(items: LocalItem[]) {
  if (!import.meta.client) return;
  try {
    if (items.length) localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    // El almacenamiento puede estar lleno o bloqueado; el carrito sigue en memoria.
  }
}

function emptyCart(): CartDto {
  return { lines: [], count: 0, subtotal: 0, shippingCost: 0, total: 0, canCheckout: false };
}

/** Mismo mensaje que `lineProblem` en apps/api/src/modules/cart/cart.service.ts. */
function lineProblem(variant: CartVariantDto, quantity: number): string | null {
  if (!variant.available) return 'Este producto ya no está disponible';
  if (variant.stock === 0) return 'Se agotó esta talla';
  if (variant.stock < quantity) return `Solo ${variant.stock === 1 ? 'queda 1 par' : `quedan ${variant.stock} pares`} en esta talla`;
  return null;
}

/** Arma un CartDto a partir del carrito local y los datos actuales de las variantes (GET /variants). */
function buildGuestCart(items: LocalItem[], variants: CartVariantDto[]): CartDto {
  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines: CartLineDto[] = [];
  for (const item of items) {
    const variant = byId.get(item.variantId);
    if (!variant) continue; // la variante ya no existe
    const unitPrice = variant.salePrice ?? variant.price;
    lines.push({
      id: variant.id,
      quantity: item.quantity,
      variant,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      problem: lineProblem(variant, item.quantity),
    });
  }
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const shippingCost = lines.length ? SHIPPING_COST : 0;
  return {
    lines,
    count: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal,
    shippingCost,
    total: subtotal + shippingCost,
    canCheckout: lines.length > 0 && lines.every((l) => l.problem === null),
  };
}

/**
 * Carrito único para visitante (localStorage) y cliente (API), con la misma
 * forma de datos (CartDto) en los dos casos (docs/05-reglas-negocio.md).
 */
export function useCart() {
  const cart = useState<CartDto | null>('cart', () => null);
  const loading = useState<boolean>('cart:loading', () => false);
  const itemCount = computed(() => cart.value?.count ?? 0);

  async function guestCart(): Promise<CartDto> {
    const items = readLocal();
    if (!items.length) return emptyCart();
    const ids = items.map((i) => i.variantId).join(',');
    const variants = await $fetch<CartVariantDto[]>('/api/v1/variants', { query: { ids } });
    return buildGuestCart(items, variants);
  }

  async function load() {
    if (!import.meta.client) return;
    loading.value = true;
    try {
      cart.value = useCustomer().value ? await useAccountApi().get<CartDto>('/cart') : await guestCart();
    } finally {
      loading.value = false;
    }
  }

  async function add(variantId: string, quantity = 1) {
    if (useCustomer().value) {
      cart.value = await useAccountApi().post<CartDto>('/cart/items', { variantId, quantity });
      return;
    }
    const items = readLocal();
    const existing = items.find((i) => i.variantId === variantId);
    if (existing) existing.quantity = Math.min(MAX_QTY_PER_ITEM, existing.quantity + quantity);
    else items.push({ variantId, quantity: Math.min(MAX_QTY_PER_ITEM, quantity) });
    writeLocal(items);
    await load();
  }

  async function updateQuantity(id: string, quantity: number) {
    if (useCustomer().value) {
      cart.value = await useAccountApi().patch<CartDto>(`/cart/items/${id}`, { quantity });
      return;
    }
    const items = readLocal();
    const item = items.find((i) => i.variantId === id);
    if (item) item.quantity = quantity;
    writeLocal(items);
    await load();
  }

  async function remove(id: string) {
    if (useCustomer().value) {
      cart.value = await useAccountApi().del<CartDto>(`/cart/items/${id}`);
      return;
    }
    writeLocal(readLocal().filter((i) => i.variantId !== id));
    await load();
  }

  /** Une el carrito local al iniciar sesión (se llama justo después del login/registro). */
  async function merge() {
    const items = readLocal();
    cart.value = items.length
      ? await useAccountApi().post<CartDto>('/cart/merge', { items })
      : await useAccountApi().get<CartDto>('/cart');
    writeLocal([]);
  }

  return { cart, loading, itemCount, load, add, updateQuantity, remove, merge };
}
