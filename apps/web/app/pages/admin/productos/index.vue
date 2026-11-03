<script setup lang="ts">
import { formatCOP, LOW_STOCK_TOTAL, type AdminBrandDto, type AdminProductRowDto, type Paginated } from '@zapadictos/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useHead({ title: 'Productos' });

const api = useAdminApi();
const route = useRoute();

const search = ref(typeof route.query.q === 'string' ? route.query.q : '');
const query = computed(() => ({
  q: typeof route.query.q === 'string' && route.query.q ? route.query.q : undefined,
  brand: typeof route.query.brand === 'string' && route.query.brand ? route.query.brand : undefined,
  status: route.query.status === 'active' || route.query.status === 'inactive' ? route.query.status : undefined,
  page: typeof route.query.page === 'string' ? route.query.page : undefined,
}));

const { data: brands } = await useAsyncData('admin-brands', () => api.get<AdminBrandDto[]>('/brands'));
const { data, status, error } = await useAsyncData(
  () => `admin-products:${JSON.stringify(query.value)}`,
  () => api.get<Paginated<AdminProductRowDto>>('/products', query.value),
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

function stockTag(row: AdminProductRowDto) {
  if (row.totalStock === 0) return { tone: 'danger' as const, label: 'Agotado' };
  if (row.totalStock <= LOW_STOCK_TOTAL) return { tone: 'danger' as const, label: 'Stock bajo' };
  return null;
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-[44px] font-black leading-none [font-stretch:110%]">Productos</h1>
        <p class="mt-2 text-ink-soft">Catálogo, variantes por talla y stock.</p>
      </div>
      <UiButton to="/admin/productos/nuevo">+ Nuevo producto</UiButton>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <label class="min-w-60 flex-[3_1_280px]">
        <span class="sr-only">Buscar productos</span>
        <input v-model="search" type="search" placeholder="Buscar por nombre o referencia" class="input-base">
      </label>
      <UiField v-slot="{ id }" label="Marca" class="flex-[1_1_160px]">
        <select :id="id" class="input-base" :value="query.brand ?? ''" @change="setQuery({ brand: ($event.target as HTMLSelectElement).value || undefined })">
          <option value="">Todas</option>
          <option v-for="b in brands" :key="b.id" :value="b.slug">{{ b.name }}</option>
        </select>
      </UiField>
      <UiField v-slot="{ id }" label="Estado" class="flex-[1_1_160px]">
        <select :id="id" class="input-base" :value="query.status ?? ''" @change="setQuery({ status: ($event.target as HTMLSelectElement).value || undefined })">
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </UiField>
    </div>

    <p v-if="error" role="alert" class="rounded-2xl bg-danger-bg p-4 text-danger">No se pudieron cargar los productos.</p>

    <section v-else class="card overflow-x-auto" :class="status === 'pending' && 'opacity-60'" aria-label="Lista de productos">
      <table class="w-full border-collapse text-[15px]">
        <thead>
          <tr class="text-left text-ink-soft">
            <th class="px-5 py-3.5 font-medium">Producto</th>
            <th class="px-4 py-3.5 font-medium">Marca</th>
            <th class="px-4 py-3.5 font-medium">Categoría</th>
            <th class="px-4 py-3.5 text-right font-medium">Precio</th>
            <th class="px-4 py-3.5 font-medium">Stock total</th>
            <th class="px-4 py-3.5 text-right font-medium">Tallas</th>
            <th class="px-4 py-3.5 font-medium">Estado</th>
            <th class="px-5 py-3.5"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.data" :key="row.id" class="border-t border-line-soft">
            <td class="px-5 py-3">
              <div class="flex items-center gap-3.5">
                <span class="flex size-[54px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg">
                  <img v-if="row.coverUrl" :src="row.coverUrl" alt="" class="size-full object-cover">
                  <UiShoePlaceholder v-else :width="36" />
                </span>
                <span>
                  <strong class="block">{{ row.name }}</strong>
                  <span class="text-[13px] text-ink-soft">{{ row.reference }}</span>
                </span>
              </div>
            </td>
            <td class="whitespace-nowrap px-4">{{ row.brand }}</td>
            <td class="whitespace-nowrap px-4">{{ row.category }}</td>
            <td class="whitespace-nowrap px-4 text-right">
              {{ formatCOP(row.salePrice ?? row.price) }}
              <span v-if="row.salePrice" class="block text-[13px] text-ink-soft line-through">{{ formatCOP(row.price) }}</span>
            </td>
            <td class="whitespace-nowrap px-4">
              <span class="inline-flex items-center gap-2.5">
                <strong>{{ row.totalStock }}</strong>
                <UiTag v-if="stockTag(row)" :tone="stockTag(row)!.tone">{{ stockTag(row)!.label }}</UiTag>
              </span>
            </td>
            <td class="px-4 text-right">{{ row.sizesCount }}</td>
            <td class="px-4">
              <UiTag :tone="row.active ? 'success' : 'neutral'">{{ row.active ? 'Activo' : 'Inactivo' }}</UiTag>
            </td>
            <td class="px-5 text-right">
              <UiButton :to="`/admin/productos/${row.id}`" variant="outline" size="sm">Editar</UiButton>
            </td>
          </tr>
          <tr v-if="data && data.data.length === 0">
            <td colspan="8" class="px-5 py-10 text-center text-ink-soft">No hay productos con esos filtros.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="data" class="flex flex-wrap items-center justify-between gap-4">
      <p class="text-sm text-ink-soft">Mostrando {{ data.data.length }} de {{ data.meta.total }} productos</p>
      <UiPagination :page="data.meta.page" :total-pages="data.meta.totalPages" />
    </div>
  </div>
</template>
