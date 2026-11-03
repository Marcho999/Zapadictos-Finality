<template>
  <footer class="mt-24">
    <div class="bg-muted">
      <ul class="container-page grid gap-6 py-8 text-[15px] sm:grid-cols-3">
        <li>
          <strong class="block">Stock real por talla</strong>
          <span class="text-ink-soft">Ves qué tallas quedan antes de agregar al carrito.</span>
        </li>
        <li>
          <strong class="block">Pago seguro con Wompi</strong>
          <span class="text-ink-soft">Tarjeta, PSE y otros medios; tus datos no pasan por nuestra tienda.</span>
        </li>
        <li>
          <strong class="block">Envío a toda Colombia</strong>
          <span class="text-ink-soft">Tarifa fija y seguimiento desde tu cuenta.</span>
        </li>
      </ul>
    </div>
    <div class="bg-ink text-white">
      <div class="container-page grid gap-8 py-10 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p class="font-display text-xl font-black tracking-[0.04em] [font-stretch:125%]">ZAPADICTOS</p>
          <p class="mt-2 max-w-60 text-sm text-[#d9d3ca]">Tienda de zapatillas. Proyecto final de universidad.</p>
        </div>
        <nav aria-label="Tienda" class="flex flex-col gap-2 text-sm">
          <strong>Tienda</strong>
          <NuxtLink to="/tienda" class="hover:text-accent">Catálogo</NuxtLink>
          <NuxtLink :to="{ path: '/', hash: '#marcas' }" class="hover:text-accent">Marcas</NuxtLink>
          <NuxtLink :to="{ path: '/tienda', query: { sort: 'newest' } }" class="hover:text-accent">Novedades</NuxtLink>
        </nav>
        <nav aria-label="Ayuda" class="flex flex-col gap-2 text-sm">
          <strong>Ayuda</strong>
          <NuxtLink to="/envios" class="hover:text-accent">Envíos</NuxtLink>
          <NuxtLink to="/contacto" class="hover:text-accent">Contacto</NuxtLink>
          <NuxtLink to="/privacidad" class="hover:text-accent">Tratamiento de datos</NuxtLink>
        </nav>
      </div>
      <p class="container-page border-t border-[#2e2e2e] py-5 text-xs text-[#a8a29a]">© 2026 Zapadictos</p>
    </div>
  </footer>
</template>
