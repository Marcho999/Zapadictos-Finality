<script setup lang="ts">
import type { BrandDto, CategoryDto } from '@zapadictos/shared';

interface BannerDto {
  tag: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaHref: string;
}

useSeoMeta({
  title: 'Zapatillas en Colombia',
  titleTemplate: 'Zapadictos · %s',
  description: 'Filtra por marca, talla y precio, paga seguro y recibe tus zapatillas en cualquier ciudad de Colombia.',
});

const [{ data: banner }, { data: newest }, { data: categories }, { data: brands }] = await Promise.all([
  useFetch<BannerDto | null>('/api/v1/banner', { key: 'banner' }),
  useProducts({ sort: 'newest' }),
  useFetch<CategoryDto[]>('/api/v1/categories', { key: 'categories' }),
  useFetch<BrandDto[]>('/api/v1/brands', { key: 'brands' }),
]);

// El enlace de la portada solo puede ser una ruta interna (docs/06-seguridad.md A03).
const ctaHref = computed(() => {
  const href = banner.value?.ctaHref ?? '/tienda';
  return href.startsWith('/') && !href.startsWith('//') ? href : '/tienda';
});
</script>

<template>
  <div class="container-page">
    <section class="grid items-center gap-10 py-14 md:grid-cols-2" aria-labelledby="t-hero">
      <div class="flex flex-col gap-5">
        <UiTag tone="accent" class="self-start">{{ banner?.tag ?? 'NUEVA TEMPORADA' }}</UiTag>
        <h1 id="t-hero" class="font-display-wide text-[clamp(2.75rem,7vw,4.75rem)]">
          {{ banner?.title ?? 'Tu talla, en stock y lista para salir.' }}
        </h1>
        <p class="max-w-md text-ink-soft">{{ banner?.subtitle }}</p>
        <div class="flex flex-wrap gap-3">
          <UiButton :to="ctaHref">{{ banner?.ctaLabel ?? 'Ver catálogo' }}</UiButton>
          <UiButton :to="{ path: '/tienda', query: { gender: 'MEN' } }" variant="outline">Hombre</UiButton>
          <UiButton :to="{ path: '/tienda', query: { gender: 'WOMEN' } }" variant="outline">Mujer</UiButton>
        </div>
      </div>
      <div class="relative pl-3.5 pt-3.5">
        <div class="absolute bottom-3.5 left-0 right-3.5 top-0 rounded-[22px] bg-accent" aria-hidden="true" />
        <div class="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[22px] bg-muted">
          <img v-if="banner?.imageUrl" :src="banner.imageUrl" alt="" class="size-full object-cover">
          <UiShoePlaceholder v-else :width="140" />
        </div>
      </div>
    </section>

    <section v-if="categories?.length" class="py-6" aria-labelledby="t-cat">
      <h2 id="t-cat" class="font-display text-3xl font-extrabold [font-stretch:110%]">Compra por categoría</h2>
      <ul class="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <li v-for="(category, index) in categories" :key="category.slug">
          <NuxtLink
            :to="{ path: '/tienda', query: { category: category.slug } }"
            class="flex h-32 flex-col justify-between rounded-2xl p-4 sm:h-[118px]"
            :class="index === 0 ? 'bg-ink text-white' : 'bg-muted'"
          >
            <span class="text-[13px]">Ver modelos →</span>
            <span class="font-display-wide text-2xl">{{ category.name }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section v-if="brands?.length" id="marcas" class="scroll-mt-6 py-8" aria-labelledby="t-mar">
      <h2 id="t-mar" class="font-display text-3xl font-extrabold [font-stretch:110%]">Marcas</h2>
      <ul class="mt-5 flex flex-wrap gap-3">
        <li v-for="brand in brands" :key="brand.slug">
          <NuxtLink :to="{ path: '/tienda', query: { brand: brand.slug } }" class="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 font-bold">
            {{ brand.name }}
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section v-if="newest?.data.length" class="py-8" aria-labelledby="t-new">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="t-new" class="font-display text-3xl font-extrabold [font-stretch:110%]">Novedades</h2>
        <NuxtLink to="/tienda" class="font-bold underline underline-offset-4">Ver todo el catálogo →</NuxtLink>
      </div>
      <ul class="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-7 lg:grid-cols-4">
        <li v-for="product in newest.data.slice(0, 4)" :key="product.slug">
          <ProductCard :product="product" />
        </li>
      </ul>
    </section>
  </div>
</template>
