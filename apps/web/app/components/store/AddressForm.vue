<script setup lang="ts">
import { DEPARTMENTS, addressCreateSchema, type AddressDto, type z } from '@zapadictos/shared';

const props = defineProps<{
  address?: AddressDto;
  defaultRecipient?: string;
  save: (data: z.output<typeof addressCreateSchema>) => Promise<unknown>;
}>();
const emit = defineEmits<{ cancel: [] }>();

const form = useZodForm(addressCreateSchema, {
  label: props.address?.label ?? '',
  recipientName: props.address?.recipientName ?? props.defaultRecipient ?? '',
  phone: props.address?.phone ?? '',
  department: (props.address?.department ?? '') as (typeof DEPARTMENTS)[number],
  city: props.address?.city ?? '',
  line1: props.address?.line1 ?? '',
  notes: props.address?.notes ?? '',
  isDefault: props.address?.isDefault ?? false,
});

const submit = () => form.submit(props.save);
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UiField v-slot="{ id, describedBy, invalid }" label="Nombre para identificarla" :error="form.errors.value.label">
        <input :id="id" v-model="form.values.label" placeholder="Ej. Casa" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Quién recibe" :error="form.errors.value.recipientName">
        <input :id="id" v-model="form.values.recipientName" autocomplete="name" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Celular de contacto" :error="form.errors.value.phone">
        <input :id="id" v-model="form.values.phone" inputmode="numeric" autocomplete="tel" placeholder="3001234567" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Departamento" :error="form.errors.value.department">
        <select :id="id" v-model="form.values.department" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
          <option value="" disabled>Selecciona…</option>
          <option v-for="d in DEPARTMENTS" :key="d" :value="d">{{ d }}</option>
        </select>
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Ciudad o municipio" :error="form.errors.value.city">
        <input :id="id" v-model="form.values.city" autocomplete="address-level2" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Dirección" :error="form.errors.value.line1">
        <input :id="id" v-model="form.values.line1" autocomplete="address-line1" placeholder="Calle 10 # 20-30" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
      </UiField>
    </div>
    <UiField v-slot="{ id, describedBy, invalid }" label="Indicaciones (opcional)" :error="form.errors.value.notes">
      <input :id="id" v-model="form.values.notes" autocomplete="address-line2" placeholder="Apartamento, torre, conjunto o referencia" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
    </UiField>
    <label v-if="!address?.isDefault" class="flex cursor-pointer items-center gap-2.5 text-[15px]">
      <input v-model="form.values.isDefault" type="checkbox" class="size-5 accent-ink"> Usar como dirección predeterminada
    </label>
    <p v-if="form.formError.value" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{{ form.formError.value }}</p>
    <div class="flex flex-wrap gap-3">
      <UiButton type="submit" :disabled="form.pending.value">{{ form.pending.value ? 'Guardando…' : 'Guardar dirección' }}</UiButton>
      <UiButton variant="outline" @click="emit('cancel')">Cancelar</UiButton>
    </div>
  </form>
</template>
