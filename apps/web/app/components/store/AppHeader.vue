<script setup lang="ts">
const route = useRoute();
const customer = useCustomer();
// La sesión se consulta en el navegador, nunca en el SSR (D-03).
onMounted(() => loadCustomer());
const search = ref(typeof route.query.q === 'string' ? route.query.q : '');
const menuOpen = ref(false);

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
    search.value = typeof route.query.q === 'string' ? route.query.q : '';
  },
);

const nav = [
  { label: 'Tienda', to: { path: '/tienda' }, active: () => route.path === '/tienda' && !route.query.gender && !route.query.onSale },
  { label: 'Hombre', to: { path: '/tienda', query: { gender: 'MEN' } }, active: () => route.query.gender === 'MEN' },
  { label: 'Mujer', to: { path: '/tienda', query: { gender: 'WOMEN' } }, active: () => route.query.gender === 'WOMEN' },
  { label: 'Ofertas', to: { path: '/tienda', query: { onSale: 'true' } }, active: () => route.query.onSale === 'true', accent: true },
  { label: 'Marcas', to: { path: '/', hash: '#marcas' }, active: () => false },
];

function submitSearch() {
  const q = search.value.trim();
  return navigateTo({ path: '/tienda', query: q ? { q } : {} });
}
</script>

<template>
  <div class="bg-ink px-4 py-2 text-center text-[13px] text-white">
    Envío a toda Colombia · Pago seguro con Wompi
  </div>
  <header class="border-b border-line">
    <div class="container-page flex min-h-[72px] flex-wrap items-center gap-x-7 gap-y-3 py-3">
      <NuxtLink to="/" class="font-display text-2xl font-black tracking-[0.04em] [font-stretch:125%]">ZAPADICTOS</NuxtLink>

      <!-- En móvil el menú se abre con el botón; en escritorio siempre está visible. -->
      <nav
        id="menu-principal"
        aria-label="Principal"
        class="order-last w-full flex-col gap-1 md:order-none md:flex md:w-auto md:flex-row md:gap-5"
        :class="menuOpen ? 'flex' : 'hidden'"
      >
        <NuxtLink
          v-for="item in nav"
          :key="item.label"
          :to="item.to"
          class="py-2 text-base md:py-0"
          :class="[item.accent && 'font-bold text-warning', item.active() && 'underline decoration-2 underline-offset-8']"
          :aria-current="item.active() ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-3 md:flex-[1_1_220px] md:justify-end md:gap-4">
        <form role="search" class="hidden flex-[0_1_270px] md:block" @submit.prevent="submitSearch">
          <label for="buscar" class="sr-only">Buscar modelo o marca</label>
          <input id="buscar" v-model="search" type="search" name="q" maxlength="60" placeholder="Buscar modelo o marca" class="h-11 w-full rounded-full border border-line bg-surface px-4 placeholder:text-ink-soft">
        </form>
        <NuxtLink v-if="customer" to="/cuenta" class="hidden font-semibold sm:inline">Hola, {{ firstName(customer.name) }}</NuxtLink>
        <NuxtLink v-else to="/cuenta/ingresar" class="hidden font-semibold underline underline-offset-4 sm:inline">Ingresar</NuxtLink>
        <!-- El carrito llega en la Fase 4. -->
        <UiButton to="/carrito" size="sm">
          <UiIcon name="bag" :size="16" />
          <span>Carrito (0)</span>
        </UiButton>
        <button
          type="button"
          class="inline-flex size-11 items-center justify-center rounded-full border border-line md:hidden"
          :aria-expanded="menuOpen"
          aria-controls="menu-principal"
          @click="menuOpen = !menuOpen"
        >
          <span class="sr-only">{{ menuOpen ? 'Cerrar menú' : 'Abrir menú' }}</span>
          <UiIcon :name="menuOpen ? 'close' : 'menu'" :size="20" />
        </button>
      </div>

      <NuxtLink v-if="menuOpen" :to="customer ? '/cuenta' : '/cuenta/ingresar'" class="order-last w-full py-2 font-semibold sm:hidden">
        {{ customer ? `Mi cuenta (${firstName(customer.name)})` : 'Ingresar o crear cuenta' }}
      </NuxtLink>
      <form v-if="menuOpen" role="search" class="order-last w-full md:hidden" @submit.prevent="submitSearch">
        <label for="buscar-movil" class="sr-only">Buscar modelo o marca</label>
        <input id="buscar-movil" v-model="search" type="search" maxlength="60" placeholder="Buscar modelo o marca" class="h-11 w-full rounded-full border border-line bg-surface px-4">
      </form>
    </div>
  </header>
</template>
