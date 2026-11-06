<script setup lang="ts">
import { ORDER_STATUS_LABELS, formatCOP, type AdminCustomerDetailDto } from '@zapadictos/shared';

const props = defineProps<{ detail: AdminCustomerDetailDto }>();
defineEmits<{ close: [] }>();

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
}

const acceptedAt = computed(() =>
  new Date(props.detail.dataPolicyAcceptedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }),
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2.5">
        <h2 class="font-display text-2xl font-extrabold [font-stretch:110%]">{{ detail.name }}</h2>
        <UiTag :tone="detail.active ? 'success' : 'neutral'">{{ detail.active ? 'Activo' : 'Inactivo' }}</UiTag>
      </div>
      <button type="button" class="inline-flex size-11 items-center justify-center rounded-full border border-line" @click="$emit('close')">
        <span class="sr-only">Cerrar</span>
        <UiIcon name="close" :size="20" />
      </button>
    </div>

    <section aria-labelledby="t-perfil" class="text-[15px]">
      <h3 id="t-perfil" class="mb-2 font-display text-lg font-extrabold">Perfil</h3>
      <p>{{ detail.email }}<span v-if="detail.phone"> · {{ detail.phone }}</span></p>
      <p class="text-ink-soft">Cliente desde el {{ formatDate(detail.createdAt) }} · aceptó la política de datos el {{ acceptedAt }}</p>
    </section>

    <section aria-labelledby="t-dir">
      <h3 id="t-dir" class="mb-2 font-display text-lg font-extrabold">Direcciones <span class="font-sans text-sm font-medium text-ink-soft">({{ detail.addresses.length }})</span></h3>
      <p v-if="!detail.addresses.length" class="text-ink-soft">No tiene direcciones guardadas.</p>
      <ul v-else class="grid gap-3 sm:grid-cols-2">
        <li v-for="a in detail.addresses" :key="a.id" class="flex flex-col gap-1 rounded-2xl border border-line-soft p-4 text-[15px]">
          <span class="flex flex-wrap items-center gap-2"><strong>{{ a.label }}</strong> <UiTag v-if="a.isDefault">Predeterminada</UiTag></span>
          <span class="text-ink-soft">{{ a.recipientName }} · {{ a.phone }}<br>{{ a.line1 }}, {{ a.city }}, {{ a.department }}</span>
        </li>
      </ul>
    </section>

    <section aria-labelledby="t-pedidos">
      <h3 id="t-pedidos" class="mb-2 font-display text-lg font-extrabold">Pedidos <span class="font-sans text-sm font-medium text-ink-soft">({{ detail.orders.length }})</span></h3>
      <p v-if="!detail.orders.length" class="text-ink-soft">Este cliente todavía no tiene pedidos.</p>
      <ul v-else class="flex flex-col gap-2">
        <li v-for="o in detail.orders" :key="o.id">
          <NuxtLink :to="`/admin/pedidos?order=${o.id}`" class="flex flex-wrap items-center justify-between gap-2 rounded-xl p-2 text-[15px] hover:bg-bg">
            <span class="flex flex-wrap items-center gap-2.5">
              <strong>{{ o.number }}</strong>
              <span class="text-ink-soft">{{ formatDate(o.createdAt) }}</span>
              <UiTag :tone="ORDER_STATUS_TONE[o.status]">{{ ORDER_STATUS_LABELS[o.status] }}</UiTag>
            </span>
            <strong>{{ formatCOP(o.total) }}</strong>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
