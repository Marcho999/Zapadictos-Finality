<script setup lang="ts">
import { ORDER_STATUSES, ORDER_STATUS_LABELS, formatCOP, type AdminSummaryDto } from '@zapadictos/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useHead({ title: 'Resumen' });

const api = useAdminApi();
const { data, error } = await useAsyncData('admin-summary', () => api.get<AdminSummaryDto>('/summary'));
</script>

<template>
  <div class="flex flex-col gap-7">
    <div>
      <h1 class="font-display text-[44px] font-black leading-none [font-stretch:110%]">Resumen</h1>
      <p class="mt-2 text-ink-soft">Ventas, pedidos y catálogo de un vistazo.</p>
    </div>

    <p v-if="error" role="alert" class="rounded-2xl bg-danger-bg p-4 text-danger">No se pudo cargar el resumen.</p>

    <template v-else-if="data">
      <NuxtLink
        v-if="data.ordersNeedingReview > 0"
        to="/admin/pedidos?needsReview=true"
        class="card flex items-center justify-between gap-4 border-2 border-danger bg-danger-bg p-6 text-danger"
      >
        <span class="font-bold">
          {{ data.ordersNeedingReview }} {{ data.ordersNeedingReview === 1 ? 'pedido necesita' : 'pedidos necesitan' }} revisión
        </span>
        <span aria-hidden="true">→</span>
      </NuxtLink>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card p-6">
          <p class="text-sm text-ink-soft">Ventas de hoy</p>
          <p class="mt-1 font-display text-3xl font-black">{{ formatCOP(data.salesToday) }}</p>
        </div>
        <div class="card p-6">
          <p class="text-sm text-ink-soft">Ventas del mes</p>
          <p class="mt-1 font-display text-3xl font-black">{{ formatCOP(data.salesMonth) }}</p>
        </div>
        <NuxtLink to="/admin/productos" class="card p-6 hover:bg-bg">
          <p class="text-sm text-ink-soft">Productos con stock bajo</p>
          <p class="mt-1 font-display text-3xl font-black">{{ data.lowStockProducts }}</p>
        </NuxtLink>
        <div class="card p-6">
          <p class="text-sm text-ink-soft">Ofertas activas</p>
          <p class="mt-1 font-display text-3xl font-black">{{ data.activeOffers }}</p>
        </div>
      </div>

      <section aria-labelledby="t-estados" class="card p-6">
        <h2 id="t-estados" class="mb-4 font-display text-xl font-extrabold">Pedidos por estado</h2>
        <ul class="flex flex-wrap gap-3">
          <li v-for="s in ORDER_STATUSES" :key="s">
            <NuxtLink :to="`/admin/pedidos?status=${s}`">
              <UiTag :tone="ORDER_STATUS_TONE[s]">{{ ORDER_STATUS_LABELS[s] }} · {{ data.ordersByStatus[s] }}</UiTag>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
