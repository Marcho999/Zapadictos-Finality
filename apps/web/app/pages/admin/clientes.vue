<script setup lang="ts">
import type { AdminCustomerDetailDto, AdminCustomerRowDto, Paginated } from '@zapadictos/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useHead({ title: 'Clientes' });

const api = useAdminApi();
const route = useRoute();

const search = ref(typeof route.query.q === 'string' ? route.query.q : '');
const query = computed(() => ({
  q: typeof route.query.q === 'string' && route.query.q ? route.query.q : undefined,
  page: typeof route.query.page === 'string' ? route.query.page : undefined,
}));

const { data, status, error } = await useAsyncData(
  () => `admin-customers:${JSON.stringify(query.value)}`,
  () => api.get<Paginated<AdminCustomerRowDto>>('/customers', query.value),
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

// ── Panel lateral de detalle (D-20), sincronizado con ?cliente= en la URL.
const dialog = ref<HTMLDialogElement>();
const selectedId = ref<string | null>(typeof route.query.cliente === 'string' ? route.query.cliente : null);
const detail = ref<AdminCustomerDetailDto | null>(null);
const detailError = ref(false);

async function loadDetail(id: string) {
  detailError.value = false;
  detail.value = null;
  try {
    detail.value = await api.get<AdminCustomerDetailDto>(`/customers/${id}`);
  } catch {
    detailError.value = true;
  }
}

function openCustomer(id: string) {
  selectedId.value = id;
  navigateTo({ query: { ...route.query, cliente: id } }, { replace: true });
}

function closePanel() {
  selectedId.value = null;
  detail.value = null;
  const { cliente: _cliente, ...rest } = route.query;
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

// El ref de la plantilla solo existe tras montar: si se llega con ?cliente=
// en la URL (recarga o enlace compartido), hay que abrir el <dialog> aquí.
onMounted(() => {
  if (selectedId.value) {
    loadDetail(selectedId.value);
    dialog.value?.showModal();
  }
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="font-display text-[44px] font-black leading-none [font-stretch:110%]">Clientes</h1>
      <p class="mt-2 text-ink-soft">Solo lectura: perfil, direcciones y pedidos.</p>
    </div>

    <label class="min-w-60 max-w-sm">
      <span class="sr-only">Buscar por nombre o correo</span>
      <input v-model="search" type="search" placeholder="Buscar por nombre o correo" class="input-base">
    </label>

    <p v-if="error" role="alert" class="rounded-2xl bg-danger-bg p-4 text-danger">No se pudieron cargar los clientes.</p>

    <section v-else class="card overflow-x-auto" :class="status === 'pending' && 'opacity-60'" aria-label="Lista de clientes">
      <table class="w-full border-collapse text-[15px]">
        <thead>
          <tr class="text-left text-ink-soft">
            <th class="px-5 py-3.5 font-medium">Nombre</th>
            <th class="px-4 py-3.5 font-medium">Correo</th>
            <th class="px-4 py-3.5 font-medium">Teléfono</th>
            <th class="px-4 py-3.5 text-right font-medium">Pedidos</th>
            <th class="px-4 py-3.5 font-medium">Cliente desde</th>
            <th class="px-5 py-3.5"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.data" :key="row.id" class="border-t border-line-soft">
            <td class="whitespace-nowrap px-5 py-3"><strong>{{ row.name }}</strong></td>
            <td class="px-4">{{ row.email }}</td>
            <td class="whitespace-nowrap px-4">{{ row.phone ?? '—' }}</td>
            <td class="whitespace-nowrap px-4 text-right">{{ row.ordersCount }}</td>
            <td class="whitespace-nowrap px-4">{{ formatDate(row.createdAt) }}</td>
            <td class="px-5 text-right">
              <UiButton variant="outline" size="sm" @click="openCustomer(row.id)">Ver</UiButton>
            </td>
          </tr>
          <tr v-if="data && data.data.length === 0">
            <td colspan="6" class="px-5 py-10 text-center text-ink-soft">No hay clientes con esa búsqueda.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="data" class="flex flex-wrap items-center justify-between gap-4">
      <p class="text-sm text-ink-soft">Mostrando {{ data.data.length }} de {{ data.meta.total }} clientes</p>
      <UiPagination :page="data.meta.page" :total-pages="data.meta.totalPages" />
    </div>

    <dialog
      ref="dialog"
      class="m-0 ml-auto h-dvh max-h-none w-[min(560px,92vw)] max-w-none overflow-y-auto bg-bg p-6"
      aria-label="Detalle del cliente"
      @close="closePanel"
    >
      <p v-if="detailError" role="alert" class="rounded-2xl bg-danger-bg p-5 text-danger">No se pudo cargar este cliente.</p>
      <AdminCustomerPanel v-else-if="detail" :detail="detail" @close="dialog?.close()" />
    </dialog>
  </div>
</template>
