<script setup lang="ts">
const route = useRoute();
const links = [
  { label: 'Perfil', to: '/cuenta', hash: '' },
  { label: 'Direcciones', to: '/cuenta', hash: '#direcciones' },
  { label: 'Mis pedidos', to: '/cuenta/pedidos', hash: '' },
];
</script>

<template>
  <nav class="card w-full p-3 md:max-w-[280px] md:flex-[1_1_240px]" aria-label="Mi cuenta">
    <NuxtLink
      v-for="link in links"
      :key="link.label"
      :to="{ path: link.to, hash: link.hash || undefined }"
      class="block rounded-xl px-4 py-3 font-medium"
      :class="route.path === link.to && route.hash === link.hash && 'bg-ink text-white'"
    >
      {{ link.label }}
    </NuxtLink>
    <button type="button" class="block w-full rounded-xl px-4 py-3 text-left font-medium text-ink-soft hover:bg-bg" @click="customerLogout">
      Cerrar sesión
    </button>
  </nav>
</template>
