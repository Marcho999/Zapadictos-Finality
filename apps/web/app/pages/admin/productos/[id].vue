<script setup lang="ts">
import type { AdminBrandDto, AdminCategoryDto, AdminProductDetailDto } from '@zapadictos/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useAdminApi();
const route = useRoute();
const id = computed(() => String(route.params.id));

const [{ data: product, error }, { data: brands }, { data: categories }] = await Promise.all([
  useAsyncData(`admin-product:${id.value}`, () => api.get<AdminProductDetailDto>(`/products/${id.value}`)),
  useAsyncData('admin-brands', () => api.get<AdminBrandDto[]>('/brands')),
  useAsyncData('admin-categories', () => api.get<AdminCategoryDto[]>('/categories')),
]);

useHead({ title: () => product.value?.name ?? 'Producto' });

type Tab = 'datos' | 'colores' | 'oferta';
const tab = computed<Tab>(() => (['colores', 'oferta'].includes(String(route.query.tab)) ? (route.query.tab as Tab) : 'datos'));
const tabs: { id: Tab; label: string }[] = [
  { id: 'datos', label: 'Datos' },
  { id: 'colores', label: 'Colores, tallas y fotos' },
  { id: 'oferta', label: 'Oferta' },
];

const formInitial = computed(() =>
  product.value
    ? {
        name: product.value.name,
        reference: product.value.reference,
        slug: product.value.slug,
        brandId: product.value.brandId,
        categoryId: product.value.categoryId,
        gender: product.value.gender,
        price: product.value.price,
        description: product.value.description,
        active: product.value.active,
      }
    : null,
);

async function save(data: Record<string, unknown>) {
  product.value = await api.patch<AdminProductDetailDto>(`/products/${id.value}`, data);
}

function onUpdated(next: AdminProductDetailDto) {
  product.value = next;
}

const hasCurrentOffer = computed(() => product.value?.offers.some((o) => o.state === 'current'));
const totalStock = computed(
  () => product.value?.colors.filter((c) => c.active).flatMap((c) => c.variants).filter((v) => v.active).reduce((s, v) => s + v.stock, 0) ?? 0,
);
</script>

<template>
  <p v-if="error" role="alert" class="rounded-2xl bg-danger-bg p-5 text-danger">
    No encontramos este producto. <NuxtLink to="/admin/productos" class="underline">Volver a Productos</NuxtLink>
  </p>
  <div v-else-if="product" class="flex flex-col gap-6">
    <div>
      <p class="mb-3 text-[15px] text-ink-soft"><NuxtLink to="/admin/productos" class="underline">Productos</NuxtLink> / {{ product.name }}</p>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-3.5">
          <h1 class="font-display text-[44px] font-black leading-none [font-stretch:110%]">{{ product.name }}</h1>
          <UiTag :tone="product.active ? 'success' : 'neutral'">{{ product.active ? 'Activo' : 'Inactivo' }}</UiTag>
          <span class="text-ink-soft">{{ totalStock }} pares</span>
        </div>
        <UiButton v-if="product.active" :to="`/producto/${product.slug}`" variant="outline" target="_blank">Ver en la tienda ↗</UiButton>
      </div>
    </div>

    <div class="flex flex-wrap gap-1 border-b border-line" role="tablist" aria-label="Secciones del producto">
      <NuxtLink
        v-for="t in tabs"
        :key="t.id"
        :to="{ query: { tab: t.id === 'datos' ? undefined : t.id } }"
        role="tab"
        :aria-selected="tab === t.id"
        class="-mb-px inline-flex min-h-12 items-center gap-2 border-b-[3px] px-4 font-semibold"
        :class="tab === t.id ? 'border-ink text-ink' : 'border-transparent text-ink-soft'"
      >
        {{ t.label }}
        <span v-if="t.id === 'colores'" class="font-medium text-ink-soft">{{ product.colors.length }}</span>
        <UiTag v-if="t.id === 'oferta' && hasCurrentOffer" tone="accent">Activa</UiTag>
      </NuxtLink>
    </div>

    <div v-if="tab === 'datos' && formInitial" class="max-w-3xl">
      <AdminProductForm :initial="formInitial" :brands="brands ?? []" :categories="categories ?? []" submit-label="Guardar cambios" :save="save" />
    </div>
    <AdminColorsPanel v-else-if="tab === 'colores'" :product="product" @updated="onUpdated" />
    <AdminOfferPanel v-else-if="tab === 'oferta'" :product="product" @updated="onUpdated" />
  </div>
</template>
