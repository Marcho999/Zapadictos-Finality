<script setup lang="ts">
withDefaults(defineProps<{ width?: number }>(), { width: 120 });
</script>

<template>
  <!-- Se muestra mientras un producto no tiene fotos (las fotos llegan en la Fase 2). -->
  <svg
    :width="width"
    :height="Math.round(width * 0.37)"
    viewBox="0 0 120 44"
    fill="none"
    class="stroke-placeholder"
    stroke-width="3"
    aria-hidden="true"
  >
    <path d="M4 40h112M4 40V8h26l10 10c18 2 46 4 64 10 8 3 12 6 12 12" />
    <path d="M30 8l-6 9M37 14l-6 7" />
  </svg>
</template>
