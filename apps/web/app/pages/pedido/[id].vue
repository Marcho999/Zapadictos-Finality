<script setup lang="ts">
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, formatCOP, type OrderDto } from '@zapadictos/shared';

definePageMeta({ middleware: 'account' });

const route = useRoute();
const id = computed(() => String(route.params.id));
const api = useAccountApi();
const wompi = useWompiCheckout();

const { data: order, error, refresh } = await useAsyncData<OrderDto>(() => `order:${id.value}`, () => api.get<OrderDto>(`/orders/${id.value}`), {
  server: false,
});
if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Pedido no encontrado', fatal: true });
}

useSeoMeta({ title: () => (order.value ? `Pedido ${order.value.number}` : 'Pedido'), robots: 'noindex' });

const canRetry = computed(() => order.value?.status === 'PENDING_PAYMENT' && new Date(order.value.expiresAt) > new Date());
const retrying = ref(false);
const retryError = ref<string | null>(null);

async function retryPayment() {
  if (!order.value) return;
  retryError.value = null;
  retrying.value = true;
  try {
    const { transactionId } = await wompi.pay(order.value.id);
    if (transactionId) await wompi.verify(order.value.id, transactionId).catch(() => undefined);
    await refresh();
  } catch (error) {
    retryError.value = apiErrorBody(error).message ?? 'No pudimos abrir el pago. Inténtalo de nuevo.';
  } finally {
    retrying.value = false;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
}
</script>

<template>
  <div v-if="order" class="container-page pt-7">
    <nav aria-label="Migas de pan" class="mb-5 text-[15px] text-ink-soft">
      <NuxtLink to="/" class="underline">Inicio</NuxtLink> / Pedido {{ order.number }}
    </nav>

    <div class="mb-7 flex flex-wrap items-center gap-4">
      <h1 class="font-display-wide text-[clamp(2.25rem,7vw,3.5rem)]">PEDIDO {{ order.number }}</h1>
      <UiTag :tone="ORDER_STATUS_TONE[order.status]">{{ ORDER_STATUS_LABELS[order.status] }}</UiTag>
    </div>

    <div class="grid items-start gap-10 lg:grid-cols-[1.6fr_1fr]">
      <div class="flex flex-col gap-7">
        <section class="card flex flex-col gap-4 p-7 sm:p-8" aria-labelledby="t-items">
          <h2 id="t-items" class="font-display text-2xl font-extrabold [font-stretch:110%]">Productos</h2>
          <ul class="flex flex-col gap-4">
            <li v-for="(item, index) in order.items" :key="index" class="flex items-center gap-4">
              <div class="flex aspect-square w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line-soft bg-surface">
                <img v-if="item.imageUrl" :src="item.imageUrl" alt="" class="size-full object-cover">
                <UiShoePlaceholder v-else :width="48" />
              </div>
              <div class="min-w-0 flex-1">
                <NuxtLink v-if="item.productSlug" :to="`/producto/${item.productSlug}`" class="font-bold hover:underline">{{ item.productName }}</NuxtLink>
                <p v-else class="font-bold">{{ item.productName }}</p>
                <p class="text-sm text-ink-soft">{{ item.colorName }} · Talla {{ item.size }} · x{{ item.quantity }}</p>
              </div>
              <p class="font-bold">{{ formatCOP(item.unitPrice * item.quantity) }}</p>
            </li>
          </ul>
        </section>

        <section class="card flex flex-col gap-2 p-7 text-[15px] sm:p-8" aria-labelledby="t-envio">
          <h2 id="t-envio" class="font-display text-2xl font-extrabold [font-stretch:110%]">Envío</h2>
          <p>{{ order.shipping.recipientName }} · {{ order.shipping.phone }}</p>
          <p class="text-ink-soft">{{ order.shipping.line1 }}<template v-if="order.shipping.notes">, {{ order.shipping.notes }}</template><br>{{ order.shipping.city }}, {{ order.shipping.department }}</p>
        </section>

        <section v-if="order.payments.length" class="card flex flex-col gap-3 p-7 sm:p-8" aria-labelledby="t-pagos">
          <h2 id="t-pagos" class="font-display text-2xl font-extrabold [font-stretch:110%]">Intentos de pago</h2>
          <ul class="flex flex-col gap-2 text-[15px]">
            <li v-for="p in order.payments" :key="p.reference" class="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-2 last:border-0 last:pb-0">
              <span>{{ p.reference }}<span v-if="p.method"> · {{ p.method }}</span></span>
              <span class="flex items-center gap-3"><span class="text-ink-soft">{{ formatDate(p.createdAt) }}</span><UiTag :tone="PAYMENT_STATUS_TONE[p.status]">{{ PAYMENT_STATUS_LABELS[p.status] }}</UiTag></span>
            </li>
          </ul>
        </section>
      </div>

      <aside class="card sticky top-6 flex flex-col gap-4 p-7" aria-labelledby="t-resumen">
        <h2 id="t-resumen" class="font-display text-2xl font-extrabold [font-stretch:110%]">Resumen</h2>
        <dl class="flex flex-col gap-2.5 text-[15px]">
          <div class="flex justify-between"><dt class="text-ink-soft">Subtotal</dt><dd>{{ formatCOP(order.subtotal) }}</dd></div>
          <div class="flex justify-between"><dt class="text-ink-soft">Envío</dt><dd>{{ formatCOP(order.shippingCost) }}</dd></div>
          <div class="flex justify-between border-t border-line pt-2.5 text-lg font-bold"><dt>Total</dt><dd>{{ formatCOP(order.total) }}</dd></div>
        </dl>

        <template v-if="order.status === 'PENDING_PAYMENT'">
          <p v-if="canRetry" class="text-sm text-ink-soft">Tu pedido vence el {{ formatDate(order.expiresAt) }} si no se paga.</p>
          <p v-else class="text-sm font-medium text-danger">Este pedido venció y se liberó el stock.</p>
          <p v-if="retryError" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{{ retryError }}</p>
          <UiButton v-if="canRetry" block :disabled="retrying" @click="retryPayment">
            <UiIcon name="lock" :size="16" /> {{ retrying ? 'Abriendo el pago…' : 'Reintentar pago' }}
          </UiButton>
        </template>
        <p v-else-if="order.status === 'CANCELLED' && order.cancelReason" class="text-sm text-ink-soft">Motivo: {{ order.cancelReason }}</p>

        <UiButton to="/tienda" variant="outline" block>Seguir comprando</UiButton>
      </aside>
    </div>
  </div>
</template>
