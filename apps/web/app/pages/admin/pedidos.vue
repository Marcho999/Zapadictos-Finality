<script setup lang="ts">
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  formatCOP,
  type AdminOrderDetailDto,
  type AdminOrderRowDto,
  type Paginated,
} from '@zapadictos/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useHead({ title: 'Pedidos' });

const api = useAdminApi();
const route = useRoute();

const search = ref(typeof route.query.q === 'string' ? route.query.q : '');
const query = computed(() => ({
  status: typeof route.query.status === 'string' && route.query.status ? route.query.status : undefined,
  q: typeof route.query.q === 'string' && route.query.q ? route.query.q : undefined,
  from: typeof route.query.from === 'string' && route.query.from ? route.query.from : undefined,
  to: typeof route.query.to === 'string' && route.query.to ? route.query.to : undefined,
  needsReview: route.query.needsReview === 'true' ? 'true' : undefined,
  page: typeof route.query.page === 'string' ? route.query.page : undefined,
}));

const { data, status, error, refresh } = await useAsyncData(
  () => `admin-orders:${JSON.stringify(query.value)}`,
  () => api.get<Paginated<AdminOrderRowDto> & { counts: Record<string, number> }>('/orders', query.value),
  { watch: [query] },
);

function setQuery(patch: Record<string, string | undefined>) {
  return navigateTo({ query: { ...route.query, ...patch, page: undefined } });
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => setQuery({ q: value.trim() || undefined }), 300);
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
}

// ── Panel lateral de detalle (D-20), sincronizado con ?order= en la URL.
const dialog = ref<HTMLDialogElement>();
const selectedId = ref<string | null>(typeof route.query.order === 'string' ? route.query.order : null);
const detail = ref<AdminOrderDetailDto | null>(null);
const detailError = ref(false);

async function loadDetail(id: string) {
  detailError.value = false;
  detail.value = null;
  try {
    detail.value = await api.get<AdminOrderDetailDto>(`/orders/${id}`);
  } catch {
    detailError.value = true;
  }
}

function openOrder(id: string) {
  selectedId.value = id;
  navigateTo({ query: { ...route.query, order: id } }, { replace: true });
}

function closePanel() {
  selectedId.value = null;
  detail.value = null;
  const { order: _order, ...rest } = route.query;
  navigateTo({ query: rest }, { replace: true });
}

watch(selectedId, (id) => {
  if (id) {
    loadDetail(id);
    dialog.value?.showModal();
  } else {
    dialog.value?.close();
  }
});

// El ref de la plantilla solo existe tras montar: si se llega con ?order= en
// la URL (recarga o enlace compartido), el watcher de arriba no alcanza a
// abrir el <dialog> porque corre antes del montaje.
onMounted(() => {
  if (selectedId.value) {
    loadDetail(selectedId.value);
    dialog.value?.showModal();
  }
});

function onChanged(updated: AdminOrderDetailDto) {
  detail.value = updated;
  refresh();
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="font-display text-[44px] font-black leading-none [font-stretch:110%]">Pedidos</h1>
      <p class="mt-2 text-ink-soft">Estado de los pedidos y sus pagos.</p>
    </div>

    <ul v-if="data?.counts" class="flex flex-wrap gap-2">
      <li v-for="s in ORDER_STATUSES" :key="s">
        <NuxtLink :to="{ query: { ...route.query, status: route.query.status === s ? undefined : s, page: undefined } }">
          <UiTag :tone="route.query.status === s ? 'ink' : 'neutral'">{{ ORDER_STATUS_LABELS[s] }} · {{ data.counts[s] ?? 0 }}</UiTag>
        </NuxtLink>
      </li>
      <li v-if="data.counts.needsReview">
        <NuxtLink :to="{ query: { ...route.query, needsReview: route.query.needsReview === 'true' ? undefined : 'true', page: undefined } }">
          <UiTag :tone="route.query.needsReview === 'true' ? 'ink' : 'danger'">Necesitan revisión · {{ data.counts.needsReview }}</UiTag>
        </NuxtLink>
      </li>
    </ul>

    <div class="flex flex-wrap items-end gap-3">
      <label class="min-w-60 flex-[3_1_280px]">
        <span class="sr-only">Buscar por número o correo</span>
        <input v-model="search" type="search" placeholder="Buscar por número o correo" class="input-base">
      </label>
      <UiField v-slot="{ id }" label="Estado" class="flex-[1_1_160px]">
        <select :id="id" class="input-base" :value="query.status ?? ''" @change="setQuery({ status: ($event.target as HTMLSelectElement).value || undefined })">
          <option value="">Todos</option>
          <option v-for="s in ORDER_STATUSES" :key="s" :value="s">{{ ORDER_STATUS_LABELS[s] }}</option>
        </select>
      </UiField>
      <UiField v-slot="{ id }" label="Desde" class="flex-[1_1_150px]">
        <input :id="id" type="date" class="input-base" :value="query.from ?? ''" @change="setQuery({ from: ($event.target as HTMLInputElement).value || undefined })">
      </UiField>
      <UiField v-slot="{ id }" label="Hasta" class="flex-[1_1_150px]">
        <input :id="id" type="date" class="input-base" :value="query.to ?? ''" @change="setQuery({ to: ($event.target as HTMLInputElement).value || undefined })">
      </UiField>
    </div>

    <p v-if="error" role="alert" class="rounded-2xl bg-danger-bg p-4 text-danger">No se pudieron cargar los pedidos.</p>

    <section v-else class="card overflow-x-auto" :class="status === 'pending' && 'opacity-60'" aria-label="Lista de pedidos">
      <table class="w-full border-collapse text-[15px]">
        <thead>
          <tr class="text-left text-ink-soft">
            <th class="px-5 py-3.5 font-medium">Pedido</th>
            <th class="px-4 py-3.5 font-medium">Cliente</th>
            <th class="px-4 py-3.5 font-medium">Fecha</th>
            <th class="px-4 py-3.5 text-right font-medium">Total</th>
            <th class="px-4 py-3.5 font-medium">Estado</th>
            <th class="px-5 py-3.5"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.data" :key="row.id" class="border-t border-line-soft">
            <td class="whitespace-nowrap px-5 py-3"><strong>{{ row.number }}</strong></td>
            <td class="px-4">
              <span class="block">{{ row.customerName }}</span>
              <span class="block text-[13px] text-ink-soft">{{ row.customerEmail }}</span>
            </td>
            <td class="whitespace-nowrap px-4">{{ formatDate(row.createdAt) }}</td>
            <td class="whitespace-nowrap px-4 text-right">{{ formatCOP(row.total) }}</td>
            <td class="px-4">
              <span class="inline-flex flex-wrap items-center gap-2">
                <UiTag :tone="ORDER_STATUS_TONE[row.status]">{{ ORDER_STATUS_LABELS[row.status] }}</UiTag>
                <UiTag v-if="row.needsReview" tone="danger">Revisar</UiTag>
              </span>
            </td>
            <td class="px-5 text-right">
              <UiButton variant="outline" size="sm" @click="openOrder(row.id)">Ver</UiButton>
            </td>
          </tr>
          <tr v-if="data && data.data.length === 0">
            <td colspan="6" class="px-5 py-10 text-center text-ink-soft">No hay pedidos con esos filtros.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="data" class="flex flex-wrap items-center justify-between gap-4">
      <p class="text-sm text-ink-soft">Mostrando {{ data.data.length }} de {{ data.meta.total }} pedidos</p>
      <UiPagination :page="data.meta.page" :total-pages="data.meta.totalPages" />
    </div>

    <dialog
      ref="dialog"
      class="m-0 ml-auto h-dvh max-h-none w-[min(560px,92vw)] max-w-none overflow-y-auto bg-bg p-6"
      aria-label="Detalle del pedido"
      @close="closePanel"
    >
      <p v-if="detailError" role="alert" class="rounded-2xl bg-danger-bg p-5 text-danger">No se pudo cargar este pedido.</p>
      <AdminOrderPanel v-else-if="detail" :detail="detail" @close="dialog?.close()" @changed="onChanged" />
    </dialog>
  </div>
</template>
