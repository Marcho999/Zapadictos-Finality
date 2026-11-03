<script setup lang="ts">
import {
  adminBrandCreateSchema,
  type AdminBrandDto,
  type AdminCategoryDto,
} from '@zapadictos/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useHead({ title: 'Marcas y categorías' });

const api = useAdminApi();
const [{ data: brands, refresh: refreshBrands }, { data: categories, refresh: refreshCategories }] = await Promise.all([
  useAsyncData('admin-brands', () => api.get<AdminBrandDto[]>('/brands')),
  useAsyncData('admin-categories', () => api.get<AdminCategoryDto[]>('/categories')),
]);

const message = ref<{ tone: 'success' | 'danger'; text: string } | null>(null);

async function act(fn: () => Promise<unknown>, ok: string) {
  message.value = null;
  try {
    await fn();
    await Promise.all([refreshBrands(), refreshCategories()]);
    message.value = { tone: 'success', text: ok };
    return true;
  } catch (error) {
    message.value = { tone: 'danger', text: apiErrorBody(error).message ?? 'No se pudo guardar.' };
    return false;
  }
}

// Edición en línea: una fila a la vez.
const editing = ref<{ kind: 'brands' | 'categories'; id: string; name: string; slug: string } | null>(null);
function startEdit(kind: 'brands' | 'categories', row: { id: string; name: string; slug: string }) {
  editing.value = { kind, id: row.id, name: row.name, slug: row.slug };
}
async function saveEdit() {
  if (!editing.value) return;
  const { kind, id, name, slug } = editing.value;
  if (await act(() => api.patch(`/${kind}/${id}`, { name, slug }), 'Cambios guardados.')) editing.value = null;
}

function toggle(kind: 'brands' | 'categories', row: { id: string; active: boolean; name: string }) {
  return act(() => api.patch(`/${kind}/${row.id}`, { active: !row.active }), `${row.name} ${row.active ? 'desactivada' : 'activada'}.`);
}

async function moveCategory(index: number, direction: -1 | 1) {
  const list = categories.value ?? [];
  const a = list[index];
  const b = list[index + direction];
  if (!a || !b) return;
  // Con valores repetidos (0, 0) se normaliza usando la posición en la lista.
  const orderA = a.sortOrder === b.sortOrder ? index : a.sortOrder;
  const orderB = a.sortOrder === b.sortOrder ? index + direction : b.sortOrder;
  await act(async () => {
    await api.patch(`/categories/${a.id}`, { sortOrder: orderB });
    await api.patch(`/categories/${b.id}`, { sortOrder: orderA });
  }, 'Orden actualizado.');
}

const newBrand = useZodForm(adminBrandCreateSchema, { name: '' });
const newCategory = useZodForm(adminBrandCreateSchema, { name: '' });
async function createBrand() {
  await newBrand.submit(async (data) => {
    await api.post('/brands', data);
    newBrand.reset({ name: '' });
    await refreshBrands();
  });
}
async function createCategory() {
  await newCategory.submit(async (data) => {
    await api.post('/categories', data);
    newCategory.reset({ name: '' });
    await refreshCategories();
  });
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="font-display text-[44px] font-black leading-none [font-stretch:110%]">Marcas y categorías</h1>
      <p class="mt-2 text-ink-soft">Se usan en los filtros de la tienda y en "Compra por categoría" del inicio.</p>
    </div>

    <p
      v-if="message"
      :role="message.tone === 'danger' ? 'alert' : 'status'"
      class="rounded-xl px-4 py-3 text-sm font-medium"
      :class="message.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'"
    >
      {{ message.text }}
    </p>

    <div class="grid items-start gap-6 xl:grid-cols-2">
      <section v-for="kind in (['brands', 'categories'] as const)" :key="kind" class="card p-2 pb-4" :aria-labelledby="`t-${kind}`">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-2.5 pt-4">
          <h2 :id="`t-${kind}`" class="font-display text-xl font-extrabold">
            {{ kind === 'brands' ? 'Marcas' : 'Categorías' }}
            <span class="font-sans text-[15px] font-medium text-ink-soft">· {{ (kind === 'brands' ? brands : categories)?.length ?? 0 }}</span>
          </h2>
          <form class="flex items-start gap-2" novalidate @submit.prevent="kind === 'brands' ? createBrand() : createCategory()">
            <div>
              <label :for="`new-${kind}`" class="sr-only">Nombre de la nueva {{ kind === 'brands' ? 'marca' : 'categoría' }}</label>
              <input
                :id="`new-${kind}`"
                v-model="(kind === 'brands' ? newBrand : newCategory).values.name"
                class="input-base h-11 w-48"
                :placeholder="kind === 'brands' ? 'Nueva marca' : 'Nueva categoría'"
              >
              <span class="mt-1 block text-[13px] text-danger">{{ (kind === 'brands' ? newBrand : newCategory).errors.value.name ?? (kind === 'brands' ? newBrand : newCategory).formError.value }}</span>
            </div>
            <UiButton type="submit" size="sm">+ Agregar</UiButton>
          </form>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-[15px]">
            <thead>
              <tr class="text-left text-ink-soft">
                <th v-if="kind === 'categories'" class="px-3.5 py-2.5 font-medium">Orden</th>
                <th class="px-3.5 py-2.5 font-medium">Nombre</th><th class="px-3.5 font-medium">Slug</th>
                <th class="px-3.5 font-medium">Productos</th><th class="px-3.5 font-medium">Estado</th><th class="px-3.5"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in (kind === 'brands' ? brands : categories) ?? []" :key="row.id" class="border-t border-line-soft" :class="editing?.id === row.id && 'bg-bg'">
                <td v-if="kind === 'categories'" class="px-3.5 py-2">
                  <span class="flex gap-1">
                    <button type="button" class="size-9 rounded-lg border border-line-soft bg-surface disabled:opacity-30" :disabled="index === 0" :aria-label="`Subir ${row.name}`" @click="moveCategory(index, -1)"><UiIcon name="up" :size="14" class="mx-auto" /></button>
                    <button type="button" class="size-9 rounded-lg border border-line-soft bg-surface disabled:opacity-30" :disabled="index === (categories?.length ?? 0) - 1" :aria-label="`Bajar ${row.name}`" @click="moveCategory(index, 1)"><UiIcon name="down" :size="14" class="mx-auto" /></button>
                  </span>
                </td>
                <template v-if="editing?.id === row.id">
                  <td class="px-3.5 py-2"><input v-model="editing.name" class="input-base h-10 w-36" :aria-label="`Nombre de ${row.name}`"></td>
                  <td class="px-3.5"><input v-model="editing.slug" class="input-base h-10 w-32" :aria-label="`Slug de ${row.name}`"></td>
                </template>
                <template v-else>
                  <td class="px-3.5 py-2"><strong>{{ row.name }}</strong></td>
                  <td class="px-3.5 text-ink-soft">{{ row.slug }}</td>
                </template>
                <td class="px-3.5">{{ row.productCount }}</td>
                <td class="px-3.5"><UiTag :tone="row.active ? 'success' : 'neutral'">{{ row.active ? 'Activa' : 'Inactiva' }}</UiTag></td>
                <td class="whitespace-nowrap px-3.5 text-right">
                  <template v-if="editing?.id === row.id">
                    <UiButton size="sm" @click="saveEdit">Guardar</UiButton>
                    <button type="button" class="ml-1 min-h-11 px-2 font-semibold underline" @click="editing = null">Cancelar</button>
                  </template>
                  <template v-else>
                    <button type="button" class="min-h-11 px-2 font-semibold underline" @click="startEdit(kind, row)">Editar</button>
                    <button type="button" class="min-h-11 px-2 font-semibold underline" @click="toggle(kind, row)">{{ row.active ? 'Desactivar' : 'Activar' }}</button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mx-4 mt-3 text-[13px] text-ink-soft">
          {{ kind === 'brands'
            ? 'Una marca solo se puede desactivar si no tiene productos activos. Nunca se borra, para no romper los pedidos antiguos.'
            : 'El orden es el de las tarjetas de "Compra por categoría" en el inicio. La primera sale en negro.' }}
        </p>
      </section>
    </div>
  </div>
</template>
