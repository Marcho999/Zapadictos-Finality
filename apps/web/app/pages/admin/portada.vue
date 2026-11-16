<script setup lang="ts">
import {
  ALLOWED_IMAGE_TYPES,
  BANNER_CTA_OPTIONS,
  MAX_IMAGE_BYTES,
  adminBannerUpdateSchema,
  type AdminBannerDto,
} from '@zapadictos/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useHead({ title: 'Portada' });

const api = useAdminApi();
const { data: banner, refresh } = await useAsyncData('admin-banner', () => api.get<AdminBannerDto>('/banner'));

const form = useZodForm(adminBannerUpdateSchema, {
  tag: banner.value?.tag ?? '',
  title: banner.value?.title ?? '',
  subtitle: banner.value?.subtitle ?? '',
  ctaLabel: banner.value?.ctaLabel ?? '',
  ctaHref: (banner.value?.ctaHref ?? BANNER_CTA_OPTIONS[0].value) as (typeof BANNER_CTA_OPTIONS)[number]['value'],
});
watch(
  banner,
  (b) => b && form.reset({ tag: b.tag, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, ctaHref: b.ctaHref as never }),
  { immediate: true },
);

const fileInput = ref<HTMLInputElement>();
const selectedFile = ref<File | null>(null);
const fileError = ref<string | null>(null);
function pickFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  fileError.value = null;
  if (file) {
    // Validación previa en el navegador (la API la repite por contenido real).
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      fileError.value = 'Solo se permiten imágenes JPEG, PNG o WebP.';
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      fileError.value = 'La imagen supera los 5 MB.';
      input.value = '';
      return;
    }
  }
  selectedFile.value = file;
}

const saved = ref(false);
async function save() {
  saved.value = false;
  await form.submit(async (data) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(data)) body.append(key, value);
    if (selectedFile.value) body.append('file', selectedFile.value);
    banner.value = await api.upload<AdminBannerDto>('/banner', body, 'PUT');
    selectedFile.value = null;
    if (fileInput.value) fileInput.value.value = '';
    saved.value = true;
    await refresh();
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-6">
    <div>
      <h1 class="font-display text-[44px] font-black leading-none [font-stretch:110%]">Portada</h1>
      <p class="mt-2 text-ink-soft">El bloque principal del inicio. Los botones Hombre y Mujer son fijos; esto solo cambia el botón principal.</p>
    </div>

    <form class="card flex flex-col gap-5 p-7" novalidate @submit.prevent="save">
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField v-slot="{ id, describedBy, invalid }" label="Etiqueta" hint="Ej. NUEVA TEMPORADA" :error="form.errors.value.tag">
          <input :id="id" v-model="form.values.tag" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Texto del botón" :error="form.errors.value.ctaLabel">
          <input :id="id" v-model="form.values.ctaLabel" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
      </div>
      <UiField v-slot="{ id, describedBy, invalid }" label="Título" :error="form.errors.value.title">
        <input :id="id" v-model="form.values.title" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Subtítulo" :error="form.errors.value.subtitle">
        <textarea :id="id" v-model="form.values.subtitle" rows="3" class="input-base h-auto py-2.5" :aria-invalid="invalid" :aria-describedby="describedBy" />
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="El botón lleva a" :error="form.errors.value.ctaHref">
        <select :id="id" v-model="form.values.ctaHref" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
          <option v-for="opt in BANNER_CTA_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </UiField>

      <div class="flex flex-wrap items-center gap-5">
        <div class="flex aspect-[4/3] w-44 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line-soft bg-surface">
          <img v-if="banner?.imageUrl" :src="banner.imageUrl" alt="" class="size-full object-cover">
          <UiShoePlaceholder v-else :width="80" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="font-semibold" :for="'banner-file'">Foto de la portada</label>
          <input id="banner-file" ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="text-sm" @change="pickFile">
          <span v-if="selectedFile" class="text-sm text-ink-soft">Se reemplazará al guardar: {{ selectedFile.name }}</span>
          <span v-if="fileError" class="text-[13px] font-medium text-danger">{{ fileError }}</span>
        </div>
      </div>

      <p v-if="form.formError.value" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{{ form.formError.value }}</p>
      <p v-else-if="saved" role="status" class="rounded-xl bg-success-bg px-4 py-3 text-sm font-medium text-success">Portada publicada.</p>

      <div class="flex flex-wrap items-center gap-3">
        <UiButton type="submit" :disabled="form.pending.value">{{ form.pending.value ? 'Publicando…' : 'Publicar portada' }}</UiButton>
        <span v-if="banner?.updatedByName" class="text-sm text-ink-soft">Último cambio: {{ formatDate(banner.updatedAt) }} · {{ banner.updatedByName }}</span>
      </div>
    </form>
  </div>
</template>
