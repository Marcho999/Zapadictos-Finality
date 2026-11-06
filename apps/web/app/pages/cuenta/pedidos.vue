<script setup lang="ts">
import { ORDER_STATUS_LABELS, formatCOP, type OrderSummaryDto, type Paginated } from '@zapadictos/shared';

definePageMeta({ middleware: 'account' });
useSeoMeta({ title: 'Mis pedidos', robots: 'noindex' });

const api = useAccountApi();
const route = useRoute();
const page = computed(() => (typeof route.query.page === 'string' ? route.query.page : '1'));

const { data, status, error } = await useAsyncData(
  () => `orders:${page.value}`,
  () => api.get<Paginated<OrderSummaryDto>>('/orders', { page: page.value }),
  { watch: [page], server: false },
);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
}
</script>

<template>
  <div class="container-page pt-7">
    <nav aria-label="Migas de pan" class="mb-5 text-[15px] text-ink-soft">
      <NuxtLink to="/" class="underline">Inicio</NuxtLink> /
      <NuxtLink to="/cuenta" class="underline">Mi cuenta</NuxtLink> / Mis pedidos
    </nav>
    <h1 class="font-display-wide mb-9 text-[clamp(2.75rem,10vw,4.5rem)]">MIS PEDIDOS</h1>

    <div class="flex flex-wrap items-start gap-8">
      <AccountNav />

      <div class="min-w-0 flex-[999_1_560px]">
        <p v-if="error" role="alert" class="rounded-2xl bg-danger-bg p-5 text-danger">No pudimos cargar tus pedidos. Inténtalo de nuevo.</p>

        <template v-else-if="data">
          <div v-if="!data.data.length" class="card p-10 text-center">
            <p class="text-lg font-bold">Aún no tienes pedidos.</p>
            <UiButton to="/tienda" class="mt-5">Ver catálogo</UiButton>
          </div>

          <ul v-else class="flex flex-col gap-4" :class="status === 'pending' && 'opacity-60'">
            <li v-for="order in data.data" :key="order.id">
              <NuxtLink :to="`/pedido/${order.id}`" class="card flex flex-wrap items-center gap-4 p-5 hover:bg-bg sm:p-6">
                <div class="min-w-0 flex-1">
                  <p class="flex flex-wrap items-center gap-2.5">
                    <strong class="text-lg">{{ order.number }}</strong>
                    <UiTag :tone="ORDER_STATUS_TONE[order.status]">{{ ORDER_STATUS_LABELS[order.status] }}</UiTag>
                  </p>
                  <p class="text-sm text-ink-soft">{{ formatDate(order.createdAt) }} · {{ order.itemCount }} {{ order.itemCount === 1 ? 'producto' : 'productos' }}</p>
                </div>
                <strong class="text-lg">{{ formatCOP(order.total) }}</strong>
              </NuxtLink>
            </li>
          </ul>

          <UiPagination class="mt-10" :page="data.meta.page" :total-pages="data.meta.totalPages" />
        </template>
      </div>
    </div>
  </div>
</template>
