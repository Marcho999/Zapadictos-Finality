<script setup lang="ts">
import {
  ADMIN_ORDER_TRANSITIONS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatCOP,
  type AdminOrderDetailDto,
  type OrderStatus,
} from '@zapadictos/shared';

const props = defineProps<{ detail: AdminOrderDetailDto }>();
const emit = defineEmits<{ close: []; changed: [detail: AdminOrderDetailDto] }>();

const api = useAdminApi();
const message = ref<{ tone: 'success' | 'danger'; text: string } | null>(null);
const pending = ref(false);
const cancelReason = ref('');
const cancelling = ref(false);

const transitions = computed(() => ADMIN_ORDER_TRANSITIONS[props.detail.status]);
const actionLabel: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '',
  PAID: '',
  SHIPPED: 'Marcar como enviado',
  DELIVERED: 'Marcar como entregado',
  CANCELLED: 'Cancelar pedido',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
}

async function changeStatus(status: 'SHIPPED' | 'DELIVERED' | 'CANCELLED', reason?: string) {
  message.value = null;
  pending.value = true;
  try {
    emit('changed', await api.patch<AdminOrderDetailDto>(`/orders/${props.detail.id}/status`, { status, reason }));
    cancelling.value = false;
    cancelReason.value = '';
  } catch (error) {
    message.value = { tone: 'danger', text: apiErrorBody(error).message ?? 'No se pudo cambiar el estado.' };
  } finally {
    pending.value = false;
  }
}

async function resolveReview() {
  message.value = null;
  pending.value = true;
  try {
    emit('changed', await api.post<AdminOrderDetailDto>(`/orders/${props.detail.id}/resolve-review`));
    message.value = { tone: 'success', text: 'Revisión marcada como resuelta.' };
  } catch (error) {
    message.value = { tone: 'danger', text: apiErrorBody(error).message ?? 'No se pudo marcar la revisión.' };
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2.5">
        <h2 class="font-display text-2xl font-extrabold [font-stretch:110%]">{{ detail.number }}</h2>
        <UiTag :tone="ORDER_STATUS_TONE[detail.status]">{{ ORDER_STATUS_LABELS[detail.status] }}</UiTag>
        <UiTag v-if="detail.needsReview" tone="danger">Necesita revisión</UiTag>
      </div>
      <button type="button" class="inline-flex size-11 items-center justify-center rounded-full border border-line" @click="emit('close')">
        <span class="sr-only">Cerrar</span>
        <UiIcon name="close" :size="20" />
      </button>
    </div>

    <p
      v-if="message"
      :role="message.tone === 'danger' ? 'alert' : 'status'"
      class="rounded-xl px-4 py-3 text-sm font-medium"
      :class="message.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'"
    >
      {{ message.text }}
    </p>

    <section aria-labelledby="t-cliente" class="text-[15px]">
      <h3 id="t-cliente" class="mb-2 font-display text-lg font-extrabold">Cliente</h3>
      <p>{{ detail.customer.name }} · {{ detail.customer.email }}</p>
    </section>

    <section aria-labelledby="t-envio" class="text-[15px]">
      <h3 id="t-envio" class="mb-2 font-display text-lg font-extrabold">Envío</h3>
      <p>{{ detail.shipping.recipientName }} · {{ detail.shipping.phone }}</p>
      <p class="text-ink-soft">{{ detail.shipping.line1 }}<template v-if="detail.shipping.notes">, {{ detail.shipping.notes }}</template><br>{{ detail.shipping.city }}, {{ detail.shipping.department }}</p>
    </section>

    <section aria-labelledby="t-items">
      <h3 id="t-items" class="mb-2 font-display text-lg font-extrabold">Productos</h3>
      <ul class="flex flex-col gap-3">
        <li v-for="(item, index) in detail.items" :key="index" class="flex items-center gap-3 text-[15px]">
          <div class="flex aspect-square w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line-soft bg-surface">
            <img v-if="item.imageUrl" :src="item.imageUrl" alt="" class="size-full object-cover">
            <UiShoePlaceholder v-else :width="34" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-bold">{{ item.productName }}</p>
            <p class="text-ink-soft">{{ item.colorName }} · Talla {{ item.size }} · x{{ item.quantity }}</p>
          </div>
          <p class="font-bold">{{ formatCOP(item.unitPrice * item.quantity) }}</p>
        </li>
      </ul>
      <dl class="mt-4 flex flex-col gap-1.5 border-t border-line-soft pt-4 text-[15px]">
        <div class="flex justify-between"><dt class="text-ink-soft">Subtotal</dt><dd>{{ formatCOP(detail.subtotal) }}</dd></div>
        <div class="flex justify-between"><dt class="text-ink-soft">Envío</dt><dd>{{ formatCOP(detail.shippingCost) }}</dd></div>
        <div class="flex justify-between text-lg font-bold"><dt>Total</dt><dd>{{ formatCOP(detail.total) }}</dd></div>
      </dl>
    </section>

    <section v-if="detail.payments.length" aria-labelledby="t-pagos">
      <h3 id="t-pagos" class="mb-2 font-display text-lg font-extrabold">Intentos de pago</h3>
      <ul class="flex flex-col gap-1.5 text-[15px]">
        <li v-for="p in detail.payments" :key="p.reference" class="flex flex-wrap items-center justify-between gap-2">
          <span>{{ p.reference }}<span v-if="p.method"> · {{ p.method }}</span></span>
          <span class="flex items-center gap-2 text-ink-soft">{{ formatDate(p.createdAt) }} <UiTag :tone="PAYMENT_STATUS_TONE[p.status]">{{ PAYMENT_STATUS_LABELS[p.status] }}</UiTag></span>
        </li>
      </ul>
    </section>

    <section v-if="detail.history.length" aria-labelledby="t-hist">
      <h3 id="t-hist" class="mb-2 font-display text-lg font-extrabold">Historial</h3>
      <ul class="flex flex-col gap-1.5 text-[15px] text-ink-soft">
        <li v-for="(h, index) in detail.history" :key="index">{{ formatDate(h.at) }} · {{ h.actor }} · {{ h.action }}</li>
      </ul>
    </section>

    <div class="flex flex-col gap-3 border-t border-line pt-5">
      <UiButton v-if="detail.needsReview" variant="outline" :disabled="pending" @click="resolveReview">Marcar revisión resuelta</UiButton>

      <template v-for="status in transitions" :key="status">
        <template v-if="status === 'CANCELLED'">
          <div v-if="cancelling" class="flex flex-col gap-2">
            <UiField v-slot="{ id }" label="Motivo (opcional)">
              <input :id="id" v-model="cancelReason" maxlength="200" class="input-base" placeholder="Ej. el cliente pidió cancelar">
            </UiField>
            <div class="flex gap-2">
              <UiButton :disabled="pending" @click="changeStatus('CANCELLED', cancelReason.trim() || undefined)">Confirmar cancelación</UiButton>
              <UiButton variant="outline" @click="cancelling = false">Volver</UiButton>
            </div>
          </div>
          <UiButton v-else variant="outline" :disabled="pending" @click="cancelling = true">{{ actionLabel[status] }}</UiButton>
        </template>
        <UiButton v-else :disabled="pending" @click="changeStatus(status as 'SHIPPED' | 'DELIVERED')">{{ actionLabel[status] }}</UiButton>
      </template>
    </div>
  </div>
</template>
