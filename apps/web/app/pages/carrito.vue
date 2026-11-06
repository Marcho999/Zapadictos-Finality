<script setup lang="ts">
import { MAX_QTY_PER_ITEM, discountPercent, formatCOP, type CartLineDto } from '@zapadictos/shared';

useSeoMeta({ title: 'Carrito', robots: 'noindex' });

const cart = useCart();
onMounted(() => cart.load());

const checkoutNotice = ref(false);
const busyLine = ref<string | null>(null);

async function changeQuantity(line: CartLineDto, quantity: number) {
  if (quantity < 1 || quantity > MAX_QTY_PER_ITEM || quantity === line.quantity) return;
  busyLine.value = line.id;
  try {
    await cart.updateQuantity(line.id, quantity);
  } finally {
    busyLine.value = null;
  }
}

async function removeLine(line: CartLineDto) {
  busyLine.value = line.id;
  try {
    await cart.remove(line.id);
  } finally {
    busyLine.value = null;
  }
}
</script>

<template>
  <div class="container-page pt-7">
    <nav aria-label="Migas de pan" class="mb-5 text-[15px] text-ink-soft">
      <NuxtLink to="/" class="underline">Inicio</NuxtLink> / Carrito
    </nav>
    <h1 class="font-display-wide mb-9 text-[clamp(2.75rem,10vw,4.5rem)]">TU CARRITO</h1>

    <div v-if="!cart.cart.value && cart.loading.value" class="card p-10 text-center text-ink-soft">Cargando tu carrito…</div>

    <div v-else-if="!cart.cart.value?.lines.length" class="card p-10 text-center">
      <p class="text-lg font-bold">Tu carrito está vacío.</p>
      <p class="mt-2 text-ink-soft">Explora la tienda y encuentra tu próximo par.</p>
      <UiButton to="/tienda" class="mt-5">Ver catálogo</UiButton>
    </div>

    <div v-else class="grid items-start gap-10 lg:grid-cols-[1.6fr_1fr]">
      <ul class="flex flex-col gap-5">
        <li v-for="line in cart.cart.value.lines" :key="line.id" class="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div class="flex aspect-square w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line-soft bg-surface">
            <img v-if="line.variant.imageUrl" :src="line.variant.imageUrl" alt="" class="size-full object-cover">
            <UiShoePlaceholder v-else :width="70" />
          </div>

          <div class="min-w-0 flex-1">
            <p class="text-sm text-ink-soft">{{ line.variant.brandName }}</p>
            <NuxtLink :to="`/producto/${line.variant.productSlug}`" class="font-bold hover:underline">{{ line.variant.productName }}</NuxtLink>
            <p class="text-sm text-ink-soft">{{ line.variant.colorName }} · Talla {{ line.variant.size }}</p>
            <p class="mt-1 flex items-baseline gap-2">
              <strong>{{ formatCOP(line.unitPrice) }}</strong>
              <span v-if="line.variant.salePrice !== null" class="text-sm text-ink-soft line-through">{{ formatCOP(line.variant.price) }}</span>
              <UiTag v-if="line.variant.salePrice !== null" tone="accent">−{{ discountPercent(line.variant.price, line.variant.salePrice) }}%</UiTag>
            </p>
            <p v-if="line.problem" role="alert" class="mt-2 inline-block rounded-xl bg-danger-bg px-3 py-1.5 text-sm font-medium text-danger">
              {{ line.problem }}
            </p>
          </div>

          <div class="flex items-center justify-between gap-5 sm:flex-col sm:items-end sm:justify-start">
            <div class="flex items-center gap-1 rounded-full border border-line">
              <button
                type="button"
                class="flex size-11 items-center justify-center text-lg font-bold disabled:cursor-not-allowed disabled:text-placeholder"
                :disabled="line.quantity <= 1 || busyLine === line.id"
                :aria-label="`Quitar una unidad de ${line.variant.productName}`"
                @click="changeQuantity(line, line.quantity - 1)"
              >
                −
              </button>
              <span class="w-6 text-center font-bold" aria-live="polite">{{ line.quantity }}</span>
              <button
                type="button"
                class="flex size-11 items-center justify-center text-lg font-bold disabled:cursor-not-allowed disabled:text-placeholder"
                :disabled="line.quantity >= MAX_QTY_PER_ITEM || line.quantity >= line.variant.stock || busyLine === line.id"
                :aria-label="`Agregar una unidad de ${line.variant.productName}`"
                @click="changeQuantity(line, line.quantity + 1)"
              >
                +
              </button>
            </div>
            <p class="font-bold">{{ formatCOP(line.lineTotal) }}</p>
            <button
              type="button"
              class="min-h-11 text-sm font-semibold underline underline-offset-4 disabled:cursor-not-allowed disabled:text-placeholder"
              :disabled="busyLine === line.id"
              @click="removeLine(line)"
            >
              Eliminar
            </button>
          </div>
        </li>
      </ul>

      <aside class="card sticky top-6 flex flex-col gap-4 p-7" aria-labelledby="t-resumen">
        <h2 id="t-resumen" class="font-display text-2xl font-extrabold [font-stretch:110%]">Resumen del pedido</h2>
        <dl class="flex flex-col gap-2.5 text-[15px]">
          <div class="flex justify-between"><dt class="text-ink-soft">Subtotal</dt><dd>{{ formatCOP(cart.cart.value.subtotal) }}</dd></div>
          <div class="flex justify-between"><dt class="text-ink-soft">Envío</dt><dd>{{ formatCOP(cart.cart.value.shippingCost) }}</dd></div>
          <div class="flex justify-between border-t border-line pt-2.5 text-lg font-bold"><dt>Total</dt><dd>{{ formatCOP(cart.cart.value.total) }}</dd></div>
        </dl>
        <UiButton block :disabled="!cart.cart.value.canCheckout" @click="checkoutNotice = true">Continuar al pago</UiButton>
        <p v-if="checkoutNotice" role="status" class="rounded-xl bg-info-bg px-4 py-3 text-sm text-info">
          El pago se habilita en el siguiente paso del proyecto.
        </p>
        <p v-else-if="!cart.cart.value.canCheckout" class="text-sm text-danger">Resuelve los productos marcados antes de continuar.</p>
      </aside>
    </div>
  </div>
</template>
