<script setup lang="ts">
import { GENDER_LABELS, PRODUCT_SORTS, formatCOP, type BrandDto, type CategoryDto, type ProductSort } from '@zapadictos/shared';

const route = useRoute();
const query = computed(() => pickProductQuery(route.query));

const [{ data, status, error }, { data: brands }, { data: categories }] = await Promise.all([
  useProducts(query),
  useFetch<BrandDto[]>('/api/v1/brands', { key: 'brands' }),
  useFetch<CategoryDto[]>('/api/v1/categories', { key: 'categories' }),
]);

const sortLabels: Record<ProductSort, string> = {
  newest: 'Novedades',
  price_asc: 'Precio: menor a mayor',
  price_desc: 'Precio: mayor a menor',
};

const sort = computed<ProductSort>(() =>
  PRODUCT_SORTS.includes(route.query.sort as ProductSort) ? (route.query.sort as ProductSort) : 'newest',
);

const highlightSize = computed(() => {
  const size = Number(route.query.size);
  return Number.isInteger(size) ? size : undefined;
});

const title = computed(() => {
  if (route.query.onSale === 'true') return 'Ofertas';
  if (route.query.gender === 'MEN') return 'Hombre';
  if (route.query.gender === 'WOMEN') return 'Mujer';
  const category = categories.value?.find((c) => c.slug === route.query.category);
  return category?.name ?? 'Tienda';
});

useSeoMeta({
  title: () => title.value,
  description: () => `${title.value}: zapatillas por marca, talla y precio, con envío a toda Colombia.`,
});

function changeSort(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  return navigateTo({ query: { ...route.query, sort: value === 'newest' ? undefined : value, page: undefined } });
}

/** Chips de los filtros activos, cada uno con su forma de quitarlo. */
const chips = computed(() => {
  const q = route.query;
  const list: { label: string; remove: Record<string, string | undefined> }[] = [];
  if (typeof q.q === 'string') list.push({ label: `“${q.q}”`, remove: { q: undefined } });
  if (typeof q.brand === 'string') {
    const slugs = q.brand.split(',');
    for (const slug of slugs) {
      const rest = slugs.filter((s) => s !== slug);
      list.push({
        label: brands.value?.find((b) => b.slug === slug)?.name ?? slug,
        remove: { brand: rest.length ? rest.join(',') : undefined },
      });
    }
  }
  if (typeof q.size === 'string') list.push({ label: `Talla ${q.size}`, remove: { size: undefined } });
  if (q.gender === 'MEN' || q.gender === 'WOMEN') list.push({ label: GENDER_LABELS[q.gender], remove: { gender: undefined } });
  if (typeof q.category === 'string') {
    list.push({ label: categories.value?.find((c) => c.slug === q.category)?.name ?? q.category, remove: { category: undefined } });
  }
  if (typeof q.minPrice === 'string') list.push({ label: `Desde ${formatCOP(Number(q.minPrice))}`, remove: { minPrice: undefined } });
  if (typeof q.maxPrice === 'string') list.push({ label: `Hasta ${formatCOP(Number(q.maxPrice))}`, remove: { maxPrice: undefined } });
  if (q.onSale === 'true') list.push({ label: 'En oferta', remove: { onSale: undefined } });
  return list;
});

const total = computed(() => data.value?.meta.total ?? 0);
const errorMessage = computed(() => {
  const message = (error.value?.data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' ? message : 'Inténtalo de nuevo en un momento.';
});

// Panel de filtros en móvil (un <dialog> nativo: atrapa el foco y se cierra con Esc).
const filtersDialog = ref<HTMLDialogElement>();
watch(() => route.fullPath, () => filtersDialog.value?.close());
</script>

<template>
  <div class="container-page pt-7">
    <nav aria-label="Migas de pan" class="mb-5 text-[15px] text-ink-soft">
      <NuxtLink to="/" class="underline">Inicio</NuxtLink> / {{ title }}
    </nav>
    <h1 class="font-display-wide text-[clamp(2.75rem,11vw,4.5rem)]">{{ title }}</h1>

    <div class="mt-8 flex items-start gap-10">
      <aside class="hidden w-64 shrink-0 lg:block" aria-label="Filtros">
        <CatalogFilters :brands="brands ?? []" :categories="categories ?? []" />
      </aside>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-2.5">
            <p class="mr-1 font-bold" aria-live="polite">{{ total }} {{ total === 1 ? 'producto' : 'productos' }}</p>
            <NuxtLink
              v-for="chip in chips"
              :key="chip.label"
              :to="{ query: { ...route.query, ...chip.remove, page: undefined } }"
              class="inline-flex h-10 items-center gap-2 rounded-full bg-neutral-bg px-3.5 text-[15px]"
            >
              {{ chip.label }} <span aria-hidden="true">×</span><span class="sr-only">(quitar filtro)</span>
            </NuxtLink>
          </div>
          <div class="flex items-center gap-3">
            <UiButton variant="outline" size="sm" class="lg:hidden" @click="filtersDialog?.showModal()">Filtrar</UiButton>
            <label class="flex items-center gap-3 text-ink-soft">
              <span class="hidden sm:inline">Ordenar por</span>
              <select :value="sort" class="h-11 rounded-xl border border-line bg-surface px-4 text-ink" aria-label="Ordenar por" @change="changeSort">
                <option v-for="option in PRODUCT_SORTS" :key="option" :value="option">{{ sortLabels[option] }}</option>
              </select>
            </label>
          </div>
        </div>

        <div v-if="error" role="alert" class="mt-8 rounded-2xl bg-danger-bg p-5 text-danger">
          No pudimos cargar los productos. {{ errorMessage }}
        </div>

        <template v-else-if="data">
          <ul
            v-if="data.data.length"
            class="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-7 xl:grid-cols-3"
            :class="status === 'pending' && 'opacity-60'"
          >
            <li v-for="product in data.data" :key="product.slug">
              <ProductCard :product="product" :highlight-size="highlightSize" />
            </li>
          </ul>
          <div v-else class="card mt-10 p-10 text-center">
            <p class="text-lg font-bold">No encontramos zapatillas con esos filtros.</p>
            <UiButton to="/tienda" variant="outline" class="mt-5">Ver todo el catálogo</UiButton>
          </div>
          <UiPagination class="mt-12" :page="data.meta.page" :total-pages="data.meta.totalPages" />
        </template>
      </div>
    </div>

    <dialog
      ref="filtersDialog"
      class="m-0 ml-auto h-dvh max-h-none w-[min(360px,90vw)] max-w-none overflow-y-auto bg-bg p-6"
      aria-label="Filtros"
    >
      <div class="mb-6 flex items-center justify-between">
        <h2 class="font-display text-2xl font-extrabold">Filtros</h2>
        <button type="button" class="inline-flex size-11 items-center justify-center rounded-full border border-line" @click="filtersDialog?.close()">
          <span class="sr-only">Cerrar filtros</span>
          <UiIcon name="close" :size="20" />
        </button>
      </div>
      <CatalogFilters :brands="brands ?? []" :categories="categories ?? []" />
    </dialog>
  </div>
</template>
