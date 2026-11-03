<script setup lang="ts">
import type { AdminBrandDto, AdminCategoryDto, AdminProductDetailDto } from '@zapadictos/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useHead({ title: 'Nuevo producto' });

const api = useAdminApi();

const [{ data: brands }, { data: categories }] = await Promise.all([
  useAsyncData('admin-brands', () => api.get<AdminBrandDto[]>('/brands')),
  useAsyncData('admin-categories', () => api.get<AdminCategoryDto[]>('/categories')),
]);

const initial = {
  name: '',
  reference: '',
  slug: '',
  brandId: '',
  categoryId: '',
  gender: 'UNISEX' as const,
  price: 0,
  description: '',
  active: false,
};

async function save(data: Record<string, unknown>) {
  const product = await api.post<AdminProductDetailDto>('/products', data);
  // Lo siguiente es agregar colores y tallas.
  await navigateTo(`/admin/productos/${product.id}?tab=colores`);
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-6">
    <div>
      <p class="mb-3 text-[15px] text-ink-soft"><NuxtLink to="/admin/productos" class="underline">Productos</NuxtLink> / Nuevo</p>
      <h1 class="font-display text-[44px] font-black leading-none [font-stretch:110%]">Nuevo producto</h1>
      <p class="mt-2 text-ink-soft">Se crea inactivo. Después agregas los colores, las tallas y las fotos, y lo activas.</p>
    </div>
    <AdminProductForm
      :initial="initial"
      :brands="brands ?? []"
      :categories="categories ?? []"
      submit-label="Crear producto"
      suggest
      :save="save"
    />
  </div>
</template>
