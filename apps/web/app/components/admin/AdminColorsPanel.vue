<script setup lang="ts">
import {
  ALLOWED_IMAGE_TYPES,
  LOW_STOCK_PER_SIZE,
  MAX_IMAGES_PER_COLOR,
  MAX_IMAGE_BYTES,
  SIZE_MAX,
  SIZE_MIN,
  adminColorCreateSchema,
  adminColorUpdateSchema,
  adminVariantsCreateSchema,
  type AdminColorDto,
  type AdminProductDetailDto,
} from '@zapadictos/shared';

const props = defineProps<{ product: AdminProductDetailDto }>();
const emit = defineEmits<{ updated: [product: AdminProductDetailDto] }>();
const api = useAdminApi();

const selectedId = ref<string | null>(props.product.colors[0]?.id ?? null);
const selected = computed<AdminColorDto | undefined>(() => props.product.colors.find((c) => c.id === selectedId.value));
const message = ref<{ tone: 'success' | 'danger'; text: string } | null>(null);
const busy = ref(false);

/** Ejecuta una acción del panel y actualiza el producto con la respuesta de la API. */
async function run(action: () => Promise<AdminProductDetailDto | { product: AdminProductDetailDto; deleted: boolean }>, ok?: string) {
  busy.value = true;
  message.value = null;
  try {
    const result = await action();
    const product = 'product' in result ? result.product : result;
    emit('updated', product);
    if (ok) message.value = { tone: 'success', text: ok };
    return result;
  } catch (error) {
    message.value = { tone: 'danger', text: apiErrorBody(error).message ?? 'No se pudo guardar.' };
    return null;
  } finally {
    busy.value = false;
  }
}

// ── Nuevo color
const showNewColor = ref(props.product.colors.length === 0);
const newColor = useZodForm(adminColorCreateSchema, { name: '', hex: '#111111', code: '' });
watch(() => newColor.values.name, (name) => {
  newColor.values.code = (name ?? '').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
});
async function addColor() {
  await newColor.submit(async (data) => {
    const product = await api.post<AdminProductDetailDto>(`/products/${props.product.id}/colors`, data);
    emit('updated', product);
    selectedId.value = product.colors.at(-1)?.id ?? null;
    showNewColor.value = false;
    newColor.reset({ name: '', hex: '#111111', code: '' });
  });
}

// ── Editar color seleccionado
const colorForm = useZodForm(adminColorUpdateSchema, { name: '', hex: '', code: '', active: true });
watch(selected, (c) => c && colorForm.reset({ name: c.name, hex: c.hex, code: c.code, active: c.active }), { immediate: true });
async function saveColor() {
  if (!selected.value) return;
  const id = selected.value.id;
  await colorForm.submit(async (data) => {
    emit('updated', await api.patch<AdminProductDetailDto>(`/colors/${id}`, data));
    message.value = { tone: 'success', text: 'Color guardado.' };
  });
}

async function moveColor(color: AdminColorDto, direction: -1 | 1) {
  const list = props.product.colors;
  const index = list.findIndex((c) => c.id === color.id);
  const other = list[index + direction];
  if (!other) return;
  await run(async () => {
    await api.patch(`/colors/${color.id}`, { sortOrder: other.sortOrder });
    return api.patch<AdminProductDetailDto>(`/colors/${other.id}`, { sortOrder: color.sortOrder });
  });
}

async function deleteColor() {
  const color = selected.value;
  if (!color || !confirm(`¿Eliminar el color ${color.name}? Si ya se vendió, solo se desactiva.`)) return;
  const result = await run(() => api.del(`/colors/${color.id}`));
  if (result && 'deleted' in result) {
    message.value = {
      tone: 'success',
      text: result.deleted ? 'Color eliminado.' : 'El color tiene ventas: se desactivó para conservar el historial.',
    };
    if (result.deleted) selectedId.value = result.product.colors[0]?.id ?? null;
  }
}

// ── Tallas
const sizes = Array.from({ length: SIZE_MAX - SIZE_MIN + 1 }, (_, i) => SIZE_MIN + i);
const newSizes = useZodForm(adminVariantsCreateSchema, { from: 37, to: 45, stock: 0 });
async function addSizes() {
  if (!selected.value) return;
  const id = selected.value.id;
  await newSizes.submit(async (data) => {
    emit('updated', await api.post<AdminProductDetailDto>(`/colors/${id}/variants`, data));
  });
}

const stockDraft = reactive<Record<string, number>>({});
watch(selected, (c) => c?.variants.forEach((v) => (stockDraft[v.id] = v.stock)), { immediate: true });

async function saveStock(variantId: string, current: number) {
  const next = Number(stockDraft[variantId]);
  if (!Number.isInteger(next) || next < 0) {
    stockDraft[variantId] = current;
    message.value = { tone: 'danger', text: 'El stock debe ser un número entero, 0 o mayor.' };
    return;
  }
  if (next === current) return;
  await run(() => api.patch<AdminProductDetailDto>(`/variants/${variantId}`, { stock: next }), 'Stock actualizado.');
}

function toggleVariant(variantId: string, active: boolean) {
  return run(() => api.patch<AdminProductDetailDto>(`/variants/${variantId}`, { active }));
}

const colorStock = computed(() => selected.value?.variants.filter((v) => v.active).reduce((s, v) => s + v.stock, 0) ?? 0);

// ── Fotos
const fileInput = ref<HTMLInputElement>();
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !selected.value) return;
  // Validación previa en el navegador (la API la repite por contenido real).
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    message.value = { tone: 'danger', text: 'Solo se permiten imágenes JPEG, PNG o WebP.' };
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    message.value = { tone: 'danger', text: 'La imagen supera los 5 MB.' };
    return;
  }
  const form = new FormData();
  form.append('file', file);
  const id = selected.value.id;
  await run(() => api.upload<AdminProductDetailDto>(`/colors/${id}/images`, form), 'Foto subida.');
}

async function moveImage(index: number, direction: -1 | 1) {
  const images = selected.value?.images ?? [];
  const a = images[index];
  const b = images[index + direction];
  if (!a || !b) return;
  await run(async () => {
    await api.patch(`/images/${a.id}`, { sortOrder: b.sortOrder });
    return api.patch<AdminProductDetailDto>(`/images/${b.id}`, { sortOrder: a.sortOrder });
  });
}

function deleteImage(id: string) {
  if (!confirm('¿Borrar esta foto?')) return;
  return run(() => api.del<AdminProductDetailDto>(`/images/${id}`), 'Foto borrada.');
}

function stockTag(stock: number, active: boolean) {
  if (!active) return { tone: 'neutral' as const, label: 'Inactiva' };
  if (stock === 0) return { tone: 'danger' as const, label: 'Agotada' };
  if (stock <= LOW_STOCK_PER_SIZE) return { tone: 'warning' as const, label: 'Últimos pares' };
  return { tone: 'success' as const, label: 'Disponible' };
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <p
      v-if="message"
      :role="message.tone === 'danger' ? 'alert' : 'status'"
      class="rounded-xl px-4 py-3 text-sm font-medium"
      :class="message.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'"
    >
      {{ message.text }}
    </p>

    <div class="flex flex-wrap items-start gap-6">
      <!-- Lista de colores -->
      <section class="flex w-full flex-col gap-2.5 md:max-w-80 md:flex-[1_1_260px]" aria-label="Colores">
        <div v-for="(color, index) in product.colors" :key="color.id" class="flex items-center gap-2">
          <button
            type="button"
            class="flex flex-1 items-center gap-3.5 rounded-2xl border-[1.5px] bg-surface p-3.5 text-left"
            :class="color.id === selectedId ? 'border-ink' : 'border-line-soft'"
            :aria-pressed="color.id === selectedId"
            @click="selectedId = color.id"
          >
            <span class="size-8 shrink-0 rounded-full border border-line" :style="{ background: color.hex }" />
            <span class="flex-1">
              <strong>{{ color.name }}</strong>
              <UiTag v-if="!color.active" class="ml-2">Inactivo</UiTag>
              <span class="block text-[13px] text-ink-soft">
                {{ color.code }} · {{ color.variants.length }} tallas · {{ color.variants.reduce((s, v) => s + v.stock, 0) }} pares
              </span>
            </span>
          </button>
          <div class="flex flex-col gap-1">
            <button type="button" class="size-9 rounded-lg border border-line-soft bg-surface disabled:opacity-30" :disabled="index === 0 || busy" :aria-label="`Subir ${color.name}`" @click="moveColor(color, -1)"><UiIcon name="up" :size="16" class="mx-auto" /></button>
            <button type="button" class="size-9 rounded-lg border border-line-soft bg-surface disabled:opacity-30" :disabled="index === product.colors.length - 1 || busy" :aria-label="`Bajar ${color.name}`" @click="moveColor(color, 1)"><UiIcon name="down" :size="16" class="mx-auto" /></button>
          </div>
        </div>

        <form v-if="showNewColor" class="card flex flex-col gap-3 p-4" novalidate @submit.prevent="addColor">
          <strong>Nuevo color</strong>
          <UiField v-slot="{ id, invalid }" label="Nombre" :error="newColor.errors.value.name">
            <input :id="id" v-model="newColor.values.name" class="input-base" placeholder="Negro" :aria-invalid="invalid">
          </UiField>
          <div class="grid grid-cols-2 gap-3">
            <UiField v-slot="{ id, invalid }" label="Color" :error="newColor.errors.value.hex">
              <input :id="id" v-model="newColor.values.hex" type="color" class="input-base p-1" :aria-invalid="invalid">
            </UiField>
            <UiField v-slot="{ id, invalid }" label="Código" :error="newColor.errors.value.code">
              <input :id="id" v-model="newColor.values.code" class="input-base uppercase" maxlength="5" :aria-invalid="invalid">
            </UiField>
          </div>
          <p v-if="newColor.formError.value" role="alert" class="text-sm text-danger">{{ newColor.formError.value }}</p>
          <div class="flex gap-2">
            <UiButton type="submit" size="sm" :disabled="newColor.pending.value">Agregar</UiButton>
            <UiButton v-if="product.colors.length" size="sm" variant="outline" @click="showNewColor = false">Cancelar</UiButton>
          </div>
        </form>
        <UiButton v-else variant="outline" block class="border-dashed" @click="showNewColor = true">+ Agregar color</UiButton>
        <p class="text-[13px] text-ink-soft">El primer color es el que se ve en la tienda.</p>
      </section>

      <div v-if="selected" class="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
        <!-- Datos del color -->
        <form class="card flex flex-col gap-4 p-6" novalidate @submit.prevent="saveColor">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-display text-xl font-extrabold">Color: {{ selected.name }}</h2>
            <label class="flex cursor-pointer items-center gap-2.5 text-[15px]">
              <input v-model="colorForm.values.active" type="checkbox" class="size-5 accent-ink"> Color activo
            </label>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <UiField v-slot="{ id, invalid }" label="Nombre" :error="colorForm.errors.value.name">
              <input :id="id" v-model="colorForm.values.name" class="input-base" :aria-invalid="invalid">
            </UiField>
            <UiField v-slot="{ id, invalid }" label="Color (hex)" :error="colorForm.errors.value.hex">
              <div class="flex gap-2">
                <input v-model="colorForm.values.hex" type="color" class="h-[46px] w-12 shrink-0 rounded-xl border border-line p-1" aria-label="Elegir color">
                <input :id="id" v-model="colorForm.values.hex" class="input-base" :aria-invalid="invalid">
              </div>
            </UiField>
            <UiField v-slot="{ id, invalid }" label="Código" hint="Parte del SKU" :error="colorForm.errors.value.code">
              <input :id="id" v-model="colorForm.values.code" class="input-base uppercase" maxlength="5" :aria-invalid="invalid">
            </UiField>
          </div>
          <p v-if="colorForm.formError.value" role="alert" class="text-sm text-danger">{{ colorForm.formError.value }}</p>
          <div class="flex flex-wrap gap-2">
            <UiButton type="submit" size="sm" :disabled="colorForm.pending.value">Guardar color</UiButton>
            <UiButton size="sm" variant="outline" class="border-danger text-danger" :disabled="busy" @click="deleteColor">Eliminar color</UiButton>
          </div>
        </form>

        <!-- Tallas y stock -->
        <section class="card p-2 pb-4" aria-labelledby="t-tallas">
          <div class="flex flex-wrap items-end justify-between gap-3 px-4 pb-2 pt-4">
            <h2 id="t-tallas" class="font-display text-xl font-extrabold">
              Tallas y stock <span class="font-sans text-[15px] font-medium text-ink-soft">· {{ colorStock }} pares</span>
            </h2>
            <form class="flex flex-wrap items-end gap-2" novalidate @submit.prevent="addSizes">
              <UiField v-slot="{ id }" label="Desde">
                <select :id="id" v-model.number="newSizes.values.from" class="input-base h-11 w-20"><option v-for="s in sizes" :key="s" :value="s">{{ s }}</option></select>
              </UiField>
              <UiField v-slot="{ id }" label="Hasta" :error="newSizes.errors.value.to">
                <select :id="id" v-model.number="newSizes.values.to" class="input-base h-11 w-20"><option v-for="s in sizes" :key="s" :value="s">{{ s }}</option></select>
              </UiField>
              <UiField v-slot="{ id }" label="Stock inicial">
                <input :id="id" v-model.number="newSizes.values.stock" type="number" min="0" class="input-base h-11 w-24">
              </UiField>
              <UiButton type="submit" size="sm" variant="outline" :disabled="newSizes.pending.value">+ Agregar tallas</UiButton>
            </form>
          </div>
          <p v-if="newSizes.formError.value" role="alert" class="px-4 text-sm text-danger">{{ newSizes.formError.value }}</p>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-[15px]">
              <thead>
                <tr class="text-left text-ink-soft">
                  <th class="px-4 py-2.5 font-medium">Talla</th><th class="px-4 font-medium">SKU</th><th class="px-4 font-medium">Stock</th>
                  <th class="px-4 font-medium">Estado</th><th class="px-4 font-medium">Activa</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="v in selected.variants" :key="v.id" class="border-t border-line-soft">
                  <td class="px-4 py-2"><strong>{{ v.size }}</strong></td>
                  <td class="whitespace-nowrap px-4 text-ink-soft">{{ v.sku }}</td>
                  <td class="px-4">
                    <input
                      v-model.number="stockDraft[v.id]"
                      type="number"
                      min="0"
                      class="h-10 w-[84px] rounded-[10px] border border-line px-2.5 font-semibold"
                      :aria-label="`Stock talla ${v.size}`"
                      @change="saveStock(v.id, v.stock)"
                    >
                  </td>
                  <td class="px-4"><UiTag :tone="stockTag(v.stock, v.active).tone">{{ stockTag(v.stock, v.active).label }}</UiTag></td>
                  <td class="px-4">
                    <input type="checkbox" class="size-5 accent-ink" :checked="v.active" :aria-label="`Talla ${v.size} activa`" @change="toggleVariant(v.id, ($event.target as HTMLInputElement).checked)">
                  </td>
                </tr>
                <tr v-if="!selected.variants.length"><td colspan="5" class="px-4 py-6 text-center text-ink-soft">Este color aún no tiene tallas.</td></tr>
              </tbody>
            </table>
          </div>
          <p class="mx-4 mt-3 text-[13px] text-ink-soft">Escribe la cantidad real contada. Cada ajuste queda en el registro con el valor anterior y el nuevo.</p>
        </section>

        <!-- Fotos -->
        <section class="card flex flex-col gap-4 p-6" aria-labelledby="t-fotos">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 id="t-fotos" class="font-display text-xl font-extrabold">
              Fotos de {{ selected.name }} <span class="font-sans text-[15px] font-medium text-ink-soft">· {{ selected.images.length }} de {{ MAX_IMAGES_PER_COLOR }}</span>
            </h2>
            <span class="text-[13px] text-ink-soft">JPEG, PNG o WebP · máximo 5 MB cada una</span>
          </div>
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3.5">
            <li v-for="(image, index) in selected.images" :key="image.id" class="relative aspect-square overflow-hidden rounded-2xl bg-bg">
              <img :src="image.url" :alt="image.alt" class="size-full object-cover">
              <UiTag v-if="index === 0" tone="ink" class="absolute left-2.5 top-2.5">Portada</UiTag>
              <div class="absolute inset-x-2 bottom-2 flex justify-between">
                <span class="flex gap-1">
                  <button type="button" class="size-9 rounded-full bg-surface disabled:opacity-30" :disabled="index === 0 || busy" :aria-label="`Mover foto ${index + 1} antes`" @click="moveImage(index, -1)">←</button>
                  <button type="button" class="size-9 rounded-full bg-surface disabled:opacity-30" :disabled="index === selected.images.length - 1 || busy" :aria-label="`Mover foto ${index + 1} después`" @click="moveImage(index, 1)">→</button>
                </span>
                <button type="button" class="size-9 rounded-full bg-surface text-lg" :aria-label="`Borrar foto ${index + 1}`" :disabled="busy" @click="deleteImage(image.id)">×</button>
              </div>
            </li>
            <li v-if="selected.images.length < MAX_IMAGES_PER_COLOR">
              <label class="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-placeholder bg-surface p-3 text-center focus-within:outline-2 focus-within:outline-ink">
                <UiIcon name="upload" :size="28" />
                <strong class="text-[15px]">{{ busy ? 'Subiendo…' : 'Subir foto' }}</strong>
                <input ref="fileInput" type="file" :accept="ALLOWED_IMAGE_TYPES.join(',')" class="sr-only" :disabled="busy" @change="upload">
              </label>
            </li>
          </ul>
          <p class="text-[13px] text-ink-soft">La primera foto es la portada del color en la tienda.</p>
        </section>
      </div>
    </div>
  </div>
</template>
