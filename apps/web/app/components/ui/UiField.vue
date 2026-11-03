<script setup lang="ts">
/**
 * Campo con etiqueta, ayuda y error. El input va en el slot y recibe `id`
 * y `aria-describedby` para que los lectores de pantalla lean el error.
 */
const props = defineProps<{ label: string; error?: string; hint?: string }>();
const id = useId();
const describedBy = computed(() =>
  [props.hint && `${id}-hint`, props.error && `${id}-error`].filter(Boolean).join(' ') || undefined,
);
</script>

<template>
  <div class="flex flex-col gap-1.5 text-sm font-medium text-neutral">
    <label :for="id">{{ label }}</label>
    <slot :id="id" :described-by="describedBy" :invalid="Boolean(error)" />
    <span v-if="hint" :id="`${id}-hint`" class="text-[13px] font-normal text-ink-soft">{{ hint }}</span>
    <span v-if="error" :id="`${id}-error`" class="text-[13px] font-medium text-danger">{{ error }}</span>
  </div>
</template>
