<script setup lang="ts">
import {
  GENDERS,
  GENDER_LABELS,
  adminProductCreateSchema,
  slugify,
  type AdminBrandDto,
  type AdminCategoryDto,
  type AdminProductCreateInput,
  type z,
} from '@zapadictos/shared';

const props = defineProps<{
  initial: AdminProductCreateInput;
  brands: AdminBrandDto[];
  categories: AdminCategoryDto[];
  submitLabel: string;
  /** Al crear, la referencia y el slug se sugieren a partir de la marca y el nombre. */
  suggest?: boolean;
  save: (data: z.output<typeof adminProductCreateSchema>) => Promise<unknown>;
}>();

const form = useZodForm(adminProductCreateSchema, { ...props.initial });
const saved = ref(false);

watch(
  () => props.initial,
  (next) => form.reset({ ...next }),
);

// Sugerencias al crear: VEL-STRI a partir de "Velo" + "Stride"; slug del nombre.
const touched = reactive({ reference: false, slug: false });
watch(
  () => [form.values.name, form.values.brandId] as const,
  ([name, brandId]) => {
    if (!props.suggest) return;
    const brand = props.brands.find((b) => b.id === brandId);
    if (!touched.slug) form.values.slug = name ? slugify(name) : '';
    if (!touched.reference && brand && name) {
      const words = slugify(name).split('-').filter((w) => w !== brand.slug);
      const model = words.map((w) => w.slice(0, w.length > 4 ? 3 : 4)).join('').slice(0, 6).toUpperCase();
      form.values.reference = `${brand.slug.slice(0, 3).toUpperCase()}-${model || 'MOD'}`;
    }
  },
);

const descriptionLength = computed(() => (form.values.description ?? '').length);

async function onSubmit() {
  saved.value = false;
  // Un slug vacío significa "generarlo a partir del nombre".
  if (!form.values.slug) form.values.slug = undefined;
  saved.value = await form.submit(props.save);
}
</script>

<template>
  <form class="card flex flex-col gap-5 p-6 sm:p-8" novalidate @submit.prevent="onSubmit">
    <UiField v-slot="{ id, describedBy, invalid }" label="Nombre" :error="form.errors.value.name">
      <input :id="id" v-model="form.values.name" class="input-base" maxlength="80" :aria-invalid="invalid" :aria-describedby="describedBy">
    </UiField>

    <div class="grid gap-[18px] sm:grid-cols-2">
      <UiField v-slot="{ id, describedBy, invalid }" label="Marca" :error="form.errors.value.brandId">
        <select :id="id" v-model="form.values.brandId" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
          <option value="" disabled>Elige una marca</option>
          <option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}{{ b.active ? '' : ' (inactiva)' }}</option>
        </select>
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Categoría" :error="form.errors.value.categoryId">
        <select :id="id" v-model="form.values.categoryId" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
          <option value="" disabled>Elige una categoría</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}{{ c.active ? '' : ' (inactiva)' }}</option>
        </select>
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Referencia"
        :hint="`Base de los SKU: ${form.values.reference || 'REF'}-NEG-41`"
        :error="form.errors.value.reference"
      >
        <input :id="id" v-model="form.values.reference" class="input-base uppercase" maxlength="20" :aria-invalid="invalid" :aria-describedby="describedBy" @input="touched.reference = true">
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Slug"
        :hint="`URL: /producto/${form.values.slug || '…'}`"
        :error="form.errors.value.slug"
      >
        <input :id="id" v-model="form.values.slug" class="input-base" maxlength="80" :aria-invalid="invalid" :aria-describedby="describedBy" @input="touched.slug = true">
      </UiField>
    </div>

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-2 text-sm font-medium text-neutral">Género</legend>
      <div class="flex flex-wrap gap-2.5">
        <label
          v-for="g in GENDERS"
          :key="g"
          class="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[15px]"
          :class="form.values.gender === g ? 'border-ink' : 'border-line'"
        >
          <input v-model="form.values.gender" type="radio" name="gender" :value="g" class="size-[18px] accent-ink">
          {{ GENDER_LABELS[g] }}
        </label>
      </div>
      <span class="text-[13px] text-ink-soft">Unisex aparece también en Hombre y en Mujer.</span>
    </fieldset>

    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Precio normal (COP)"
      hint="IVA incluido, sin puntos. El precio de oferta se define en la pestaña Oferta."
      :error="form.errors.value.price"
      class="max-w-80"
    >
      <input :id="id" v-model.number="form.values.price" type="number" min="1" step="100" inputmode="numeric" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
    </UiField>

    <UiField v-slot="{ id, describedBy, invalid }" label="Descripción" :error="form.errors.value.description">
      <textarea
        :id="id"
        v-model="form.values.description"
        rows="6"
        maxlength="2000"
        class="input-base h-auto py-3 leading-normal"
        :aria-invalid="invalid"
        :aria-describedby="describedBy"
      />
      <span class="text-right text-[13px] font-normal text-ink-soft">{{ descriptionLength }} / 2.000 · Solo texto, sin formato</span>
    </UiField>

    <label class="flex cursor-pointer items-center gap-3 text-[15px]">
      <input v-model="form.values.active" type="checkbox" class="size-5 accent-ink">
      <span><strong>Activo</strong> <span class="text-ink-soft">— se muestra en la tienda</span></span>
    </label>

    <p v-if="form.formError.value" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{{ form.formError.value }}</p>
    <p v-else-if="saved" role="status" class="rounded-xl bg-success-bg px-4 py-3 text-sm font-medium text-success">Cambios guardados.</p>

    <UiButton type="submit" class="self-start" :disabled="form.pending.value">{{ form.pending.value ? 'Guardando…' : submitLabel }}</UiButton>
  </form>
</template>
