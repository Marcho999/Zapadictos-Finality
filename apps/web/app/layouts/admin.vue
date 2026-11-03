<script setup lang="ts">
import type { IconName } from '~/components/ui/UiIcon.vue';

const me = useAdminMe();
const route = useRoute();
const menuOpen = ref(false);
watch(() => route.fullPath, () => (menuOpen.value = false));

// Las secciones que aún no existen se muestran deshabilitadas con su fase.
const items: { label: string; to: string; icon: IconName; exact?: boolean; soon?: string }[] = [
  { label: 'Resumen', to: '/admin', icon: 'grid', exact: true, soon: 'Fase 5' },
  { label: 'Productos', to: '/admin/productos', icon: 'box' },
  { label: 'Pedidos', to: '/admin/pedidos', icon: 'bag', soon: 'Fase 4' },
  { label: 'Catálogo', to: '/admin/catalogo', icon: 'tag' },
  { label: 'Clientes', to: '/admin/clientes', icon: 'users', soon: 'Fase 5' },
  { label: 'Portada', to: '/admin/portada', icon: 'image', soon: 'Fase 5' },
  { label: 'Administradores', to: '/admin/administradores', icon: 'shield', soon: 'Fase 5' },
];


function isActive(item: (typeof items)[number]) {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to);
}

useHead({ titleTemplate: '%s · Panel Zapadictos', meta: [{ name: 'robots', content: 'noindex' }] });
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-bg md:flex-row">
    <aside class="bg-ink text-white md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:gap-7 md:px-4 md:py-7">
      <div class="flex items-center justify-between px-4 py-4 md:px-2 md:py-0">
        <NuxtLink to="/admin/productos" class="flex items-center gap-2.5">
          <span class="font-display text-[17px] font-black tracking-[0.03em] [font-stretch:120%]">ZAPADICTOS</span>
          <UiTag tone="accent" class="h-5 text-[10px]">ADMIN</UiTag>
        </NuxtLink>
        <button
          type="button"
          class="inline-flex size-11 items-center justify-center rounded-full border border-sidebar-line md:hidden"
          :aria-expanded="menuOpen"
          aria-controls="admin-menu"
          @click="menuOpen = !menuOpen"
        >
          <span class="sr-only">{{ menuOpen ? 'Cerrar menú' : 'Abrir menú' }}</span>
          <UiIcon :name="menuOpen ? 'close' : 'menu'" :size="20" />
        </button>
      </div>

      <div id="admin-menu" class="flex-1 flex-col gap-7 px-4 pb-6 md:flex md:p-0" :class="menuOpen ? 'flex' : 'hidden'">
        <nav aria-label="Panel" class="flex flex-col gap-1">
          <template v-for="item in items" :key="item.label">
            <span
              v-if="item.soon"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-base text-sidebar-soft"
              :title="`Disponible en la ${item.soon}`"
            >
              <UiIcon :name="item.icon" />
              {{ item.label }}
              <span class="ml-auto text-[11px]">{{ item.soon }}</span>
            </span>
            <NuxtLink
              v-else
              :to="item.to"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-base hover:bg-sidebar-active"
              :class="isActive(item) && 'bg-sidebar-active font-bold'"
              :aria-current="isActive(item) ? 'page' : undefined"
            >
              <UiIcon :name="item.icon" />
              {{ item.label }}
            </NuxtLink>
          </template>
        </nav>
        <div class="mt-auto flex flex-col gap-1 border-t border-sidebar-line pt-4">
          <NuxtLink to="/" class="rounded-xl px-3 py-2.5 hover:bg-sidebar-active">Ver tienda →</NuxtLink>
          <button type="button" class="rounded-xl px-3 py-2.5 text-left hover:bg-sidebar-active" @click="adminLogout">Cerrar sesión</button>
          <span v-if="me" class="px-3 py-2 text-[13px] text-sidebar-soft">{{ me.name }} · {{ me.email }}</span>
        </div>
      </div>
    </aside>

    <main class="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
      <slot />
    </main>
  </div>
</template>
