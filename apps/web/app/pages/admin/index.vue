<script setup lang="ts">
// El Resumen llega en la Fase 5; mientras tanto el panel abre en Productos.
definePageMeta({ layout: 'admin', middleware: 'admin' });
await navigateTo('/admin/productos', { replace: true });
</script>

<template>
  <div />
</template>
