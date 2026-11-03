<script setup lang="ts">
const props = defineProps<{ page: number; totalPages: number }>();
const route = useRoute();

/** Enlaces reales (no botones): funcionan sin JavaScript y Google los sigue. */
function linkTo(page: number) {
  return { query: { ...route.query, page: page > 1 ? String(page) : undefined } };
}

const pages = computed(() =>
  Array.from({ length: props.totalPages }, (_, i) => i + 1),
);
</script>

<template>
  <nav v-if="totalPages > 1" aria-label="Paginación" class="flex flex-wrap items-center justify-center gap-2">
    <NuxtLink
      v-if="page > 1"
      :to="linkTo(page - 1)"
      class="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 font-bold"
    >
      ← Anterior
    </NuxtLink>
    <NuxtLink
      v-for="p in pages"
      :key="p"
      :to="linkTo(p)"
      :aria-current="p === page ? 'page' : undefined"
      class="inline-flex size-11 items-center justify-center rounded-full border text-base font-bold"
      :class="p === page ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink'"
    >
      {{ p }}
    </NuxtLink>
    <NuxtLink
      v-if="page < totalPages"
      :to="linkTo(page + 1)"
      class="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 font-bold"
    >
      Siguiente →
    </NuxtLink>
  </nav>
</template>
