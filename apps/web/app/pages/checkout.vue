<script setup lang="ts">
import { formatCOP, type AddressDto, type OrderDto } from '@zapadictos/shared';

definePageMeta({ middleware: 'account' });
useSeoMeta({ title: 'Checkout', robots: 'noindex' });

const api = useAccountApi();
const cart = useCart();
const wompi = useWompiCheckout();
onMounted(() => cart.load());

const { data: addresses } = await useAsyncData('addresses', () => api.get<AddressDto[]>('/users/me/addresses'), { server: false });

const selectedAddressId = ref<string | null>(null);
const addingAddress = ref(false);
watch(
  addresses,
  (list) => {
    if (!list?.length) {
      addingAddress.value = true;
      return;
    }
    if (!selectedAddressId.value || !list.some((a) => a.id === selectedAddressId.value)) {
      selectedAddressId.value = list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null;
    }
  },
  { immediate: true },
);

async function createAddress(data: object) {
  addresses.value = await api.post<AddressDto[]>('/users/me/addresses', data);
  // La API ordena [isDefault desc, createdAt asc]: la que se acaba de crear queda última.
  selectedAddressId.value = addresses.value.at(-1)?.id ?? null;
  addingAddress.value = false;
}

const paying = ref(false);
const payError = ref<string | null>(null);

async function pay() {
  if (!selectedAddressId.value) return;
  payError.value = null;
  paying.value = true;
  let order: OrderDto;
  try {
    order = await api.post<OrderDto>('/orders', { addressId: selectedAddressId.value });
  } catch (error) {
    payError.value = apiErrorBody(error).message ?? 'No pudimos crear tu pedido. Inténtalo de nuevo.';
    paying.value = false;
    return;
  }
  try {
    const { transactionId } = await wompi.pay(order.id);
    if (transactionId) await wompi.verify(order.id, transactionId).catch(() => undefined);
  } catch {
    // El pedido ya existe; se puede reintentar el pago desde /pedido/:id.
  }
  await navigateTo(`/pedido/${order.id}`);
}
</script>

<template>
  <div class="container-page pt-7">
    <nav aria-label="Migas de pan" class="mb-5 text-[15px] text-ink-soft">
      <NuxtLink to="/" class="underline">Inicio</NuxtLink> /
      <NuxtLink to="/carrito" class="underline">Carrito</NuxtLink> / Checkout
    </nav>
    <h1 class="font-display-wide mb-9 text-[clamp(2.75rem,10vw,4.5rem)]">CHECKOUT</h1>

    <div v-if="!cart.cart.value?.lines.length || !cart.cart.value?.canCheckout" class="card p-10 text-center">
      <p class="text-lg font-bold">
        {{ cart.cart.value?.lines.length ? 'Resuelve los productos marcados en tu carrito antes de continuar.' : 'Tu carrito está vacío.' }}
      </p>
      <UiButton to="/carrito" class="mt-5">Ir al carrito</UiButton>
    </div>

    <div v-else class="grid items-start gap-10 lg:grid-cols-[1.6fr_1fr]">
      <div class="flex flex-col gap-7">
        <section class="card flex flex-col gap-5 p-7 sm:p-8" aria-labelledby="t-envio">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <h2 id="t-envio" class="font-display text-2xl font-extrabold [font-stretch:110%]">Dirección de envío</h2>
            <UiButton v-if="!addingAddress && addresses?.length" variant="outline" size="sm" @click="addingAddress = true">
              + Nueva dirección
            </UiButton>
          </div>

          <fieldset v-if="addresses?.length && !addingAddress" class="grid gap-3 sm:grid-cols-2">
            <legend class="sr-only">Elige una dirección</legend>
            <label
              v-for="a in addresses"
              :key="a.id"
              class="flex cursor-pointer flex-col gap-1 rounded-2xl p-4 text-[15px] leading-relaxed"
              :class="a.id === selectedAddressId ? 'border-[1.5px] border-ink' : 'border border-line-soft'"
            >
              <span class="flex items-start gap-2.5">
                <input v-model="selectedAddressId" type="radio" name="direccion" :value="a.id" class="mt-1 size-4 accent-ink">
                <span class="flex flex-wrap items-center gap-2"><strong>{{ a.label }}</strong> <UiTag v-if="a.isDefault">Predeterminada</UiTag></span>
              </span>
              <span class="pl-6 text-ink-soft">{{ a.recipientName }} · {{ a.phone }}<br>{{ a.line1 }}, {{ a.city }}, {{ a.department }}</span>
            </label>
          </fieldset>

          <div v-else-if="addingAddress">
            <AddressForm :save="createAddress" @cancel="addresses?.length ? (addingAddress = false) : undefined" />
          </div>
        </section>

        <section class="card flex flex-col gap-4 p-7 sm:p-8" aria-labelledby="t-items">
          <h2 id="t-items" class="font-display text-2xl font-extrabold [font-stretch:110%]">Tu pedido</h2>
          <ul class="flex flex-col gap-4">
            <li v-for="line in cart.cart.value.lines" :key="line.id" class="flex items-center gap-4">
              <div class="flex aspect-square w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line-soft bg-surface">
                <img v-if="line.variant.imageUrl" :src="line.variant.imageUrl" alt="" class="size-full object-cover">
                <UiShoePlaceholder v-else :width="48" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-bold">{{ line.variant.productName }}</p>
                <p class="text-sm text-ink-soft">{{ line.variant.colorName }} · Talla {{ line.variant.size }} · x{{ line.quantity }}</p>
              </div>
              <p class="font-bold">{{ formatCOP(line.lineTotal) }}</p>
            </li>
          </ul>
        </section>
      </div>

      <aside class="card sticky top-6 flex flex-col gap-4 p-7" aria-labelledby="t-resumen">
        <h2 id="t-resumen" class="font-display text-2xl font-extrabold [font-stretch:110%]">Resumen</h2>
        <dl class="flex flex-col gap-2.5 text-[15px]">
          <div class="flex justify-between"><dt class="text-ink-soft">Subtotal</dt><dd>{{ formatCOP(cart.cart.value.subtotal) }}</dd></div>
          <div class="flex justify-between"><dt class="text-ink-soft">Envío</dt><dd>{{ formatCOP(cart.cart.value.shippingCost) }}</dd></div>
          <div class="flex justify-between border-t border-line pt-2.5 text-lg font-bold"><dt>Total</dt><dd>{{ formatCOP(cart.cart.value.total) }}</dd></div>
        </dl>
        <p v-if="payError" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{{ payError }}</p>
        <UiButton block :disabled="!selectedAddressId || paying" @click="pay">
          <UiIcon name="lock" :size="16" /> {{ paying ? 'Abriendo el pago…' : 'Pagar con Wompi' }}
        </UiButton>
      </aside>
    </div>
  </div>
</template>
