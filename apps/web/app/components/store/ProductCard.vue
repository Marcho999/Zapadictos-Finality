<script setup lang="ts">
import { discountPercent, formatCOP, type ProductCardDto } from '@zapadictos/shared';

const props = defineProps<{
  product: ProductCardDto;
  /** Talla filtrada: muestra "Últimos pares en X" si quedan pocos. */
  highlightSize?: number;
}>();

const lowStockInSize = computed(
  () =>
    props.highlightSize !== undefined &&
    props.product.lowStockSizes.includes(props.highlightSize),
);

const discount = computed(() =>
  props.product.salePrice === null
    ? 0
    : discountPercent(props.product.price, props.product.salePrice),
);

const soldOut = computed(() => props.product.minSize === null);

const sizeRange = computed(() => {
  const { minSize, maxSize } = props.product;
  if (minSize === null || maxSize === null) return 'Agotado';
  return minSize === maxSize ? `Talla ${minSize}` : `Tallas ${minSize}–${maxSize}`;
});
</script>

<template>
  <article class="group relative">
    <div
      class="relative flex aspect-[1/0.95] items-center justify-center overflow-hidden rounded-card border border-line-soft bg-surface"
    >
      <div class="absolute left-3 top-3 flex flex-wrap gap-1.5">
        <UiTag v-if="lowStockInSize" tone="accent">Últimos pares en {{ highlightSize }}</UiTag>
        <UiTag v-if="discount > 0" tone="accent">Oferta −{{ discount }}%</UiTag>
        <UiTag v-if="product.isNew" tone="ink">Nuevo</UiTag>
      </div>
      <img
        v-if="product.coverImage"
        :src="product.coverImage.url"
        :alt="product.coverImage.alt"
        loading="lazy"
        class="size-full object-cover"
      >
      <UiShoePlaceholder v-else />
    </div>

    <p class="mt-3.5 text-sm text-ink-soft">
      {{ product.brand.name }} · {{ product.category.name }}
    </p>
    <h3 class="text-lg font-bold">
      <!-- El enlace cubre toda la tarjeta. -->
      <NuxtLink :to="`/producto/${product.slug}`" class="after:absolute after:inset-0">
        {{ product.name }}
      </NuxtLink>
    </h3>
    <p class="mt-0.5 flex flex-wrap items-baseline gap-2.5 text-lg">
      <strong>{{ formatCOP(product.salePrice ?? product.price) }}</strong>
      <span v-if="product.salePrice !== null" class="text-[15px] text-ink-soft line-through">
        <span class="sr-only">Antes</span>
        {{ formatCOP(product.price) }}
      </span>
    </p>
    <p class="text-sm" :class="soldOut ? 'font-bold text-danger' : 'text-ink-soft'">
      {{ sizeRange }}
    </p>
  </article>
</template>
