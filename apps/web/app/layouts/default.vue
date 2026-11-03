<template>
  <div class="flex min-h-dvh flex-col">
    <a href="#contenido" class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
      Saltar al contenido
    </a>
    <AppHeader />
    <main id="contenido" class="flex-1">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
