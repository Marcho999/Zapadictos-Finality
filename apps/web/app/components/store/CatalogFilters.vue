<script setup lang="ts">
import { GENDER_LABELS, SIZE_MAX, SIZE_MIN, type BrandDto, type CategoryDto } from '@zapadictos/shared';

defineProps<{ brands: BrandDto[]; categories: CategoryDto[] }>();
const route = useRoute();

const selectedBrands = computed(() =>
  typeof route.query.brand === 'string' ? route.query.brand.split(',').filter(Boolean) : [],
);
const sizes = Array.from({ length: 46 - 35 + 1 }, (_, i) => 35 + i).filter((s) => s >= SIZE_MIN && s <= SIZE_MAX);

/** Cada filtro cambia la URL (y vuelve a la página 1); la URL pide los productos. */
function setFilter(patch: Record<string, string | undefined>) {
  return navigateTo({ query: { ...route.query, ...patch, page: undefined } }, { replace: true });
}

function toggleBrand(slug: string) {
  const next = selectedBrands.value.includes(slug)
    ? selectedBrands.value.filter((b) => b !== slug)
    : [...selectedBrands.value, slug];
  return setFilter({ brand: next.length ? next.join(',') : undefined });
}

const minPrice = ref(typeof route.query.minPrice === 'string' ? route.query.minPrice : '');
const maxPrice = ref(typeof route.query.maxPrice === 'string' ? route.query.maxPrice : '');
watch(() => route.query, (q) => {
  minPrice.value = typeof q.minPrice === 'string' ? q.minPrice : '';
  maxPrice.value = typeof q.maxPrice === 'string' ? q.maxPrice : '';
});
function applyPrice() {
  const clean = (v: string) => (v.replace(/\D/g, '') || undefined);
  return setFilter({ minPrice: clean(minPrice.value), maxPrice: clean(maxPrice.value) });
}

const hasFilters = computed(() =>
  ['brand', 'size', 'gender', 'category', 'minPrice', 'maxPrice', 'onSale', 'q'].some((k) => route.query[k]),
);
function clearAll() {
  return navigateTo({ query: route.query.sort ? { sort: route.query.sort } : {} });
}

</script>

<template>
  <div class="flex flex-col gap-7">
    <fieldset>
      <legend class="mb-3 font-bold">Marca</legend>
      <div class="flex flex-col gap-1">
        <label v-for="brand in brands" :key="brand.slug" class="flex min-h-10 cursor-pointer items-center gap-3">
          <input type="checkbox" class="size-[18px] accent-ink" :checked="selectedBrands.includes(brand.slug)" @change="toggleBrand(brand.slug)">
          {{ brand.name }}
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend class="mb-3 font-bold">Talla (EU)</legend>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="size in sizes"
          :key="size"
          type="button"
          class="h-11 rounded-xl border text-[15px]"
          :class="route.query.size === String(size) ? 'border-ink bg-ink text-white' : 'border-line bg-surface'"
          :aria-pressed="route.query.size === String(size)"
          @click="setFilter({ size: route.query.size === String(size) ? undefined : String(size) })"
        >
          {{ size }}
        </button>
      </div>
    </fieldset>

    <fieldset>
      <legend class="mb-3 font-bold">Género</legend>
      <div class="flex flex-col gap-1">
        <label class="flex min-h-10 cursor-pointer items-center gap-3">
          <input type="radio" name="gender" class="size-[18px] accent-ink" :checked="!route.query.gender" @change="setFilter({ gender: undefined })">
          Todos
        </label>
        <label v-for="(label, value) in { MEN: GENDER_LABELS.MEN, WOMEN: GENDER_LABELS.WOMEN }" :key="value" class="flex min-h-10 cursor-pointer items-center gap-3">
          <input type="radio" name="gender" class="size-[18px] accent-ink" :checked="route.query.gender === value" @change="setFilter({ gender: value })">
          {{ label }} <span class="text-sm text-ink-soft">(incluye unisex)</span>
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend class="mb-3 font-bold">Categoría</legend>
      <select class="input-base" :value="route.query.category ?? ''" aria-label="Categoría" @change="setFilter({ category: ($event.target as HTMLSelectElement).value || undefined })">
        <option value="">Todas</option>
        <option v-for="c in categories" :key="c.slug" :value="c.slug">{{ c.name }}</option>
      </select>
    </fieldset>

    <fieldset>
      <legend class="mb-3 font-bold">Precio (COP)</legend>
      <form class="flex flex-col gap-3" @submit.prevent="applyPrice">
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1.5 text-sm text-ink-soft">Mínimo
            <input v-model="minPrice" inputmode="numeric" placeholder="$0" class="input-base">
          </label>
          <label class="flex flex-col gap-1.5 text-sm text-ink-soft">Máximo
            <input v-model="maxPrice" inputmode="numeric" placeholder="$600.000" class="input-base">
          </label>
        </div>
        <UiButton type="submit" size="sm" variant="outline">Aplicar precio</UiButton>
      </form>
    </fieldset>

    <fieldset>
      <legend class="mb-3 font-bold">Ofertas</legend>
      <label class="flex min-h-10 cursor-pointer items-center gap-3">
        <input type="checkbox" class="size-[18px] accent-ink" :checked="route.query.onSale === 'true'" @change="setFilter({ onSale: ($event.target as HTMLInputElement).checked ? 'true' : undefined })">
        Solo productos en oferta
      </label>
    </fieldset>

    <UiButton v-if="hasFilters" variant="outline" block @click="clearAll">Limpiar filtros</UiButton>
  </div>
</template>
