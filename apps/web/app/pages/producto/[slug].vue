<script setup lang="ts">
import {
  GENDER_LABELS,
  LOW_STOCK_PER_SIZE,
  discountPercent,
  formatCOP,
  type ProductDetailDto,
} from '@zapadictos/shared';

const route = useRoute();
const slug = computed(() => String(route.params.slug));

const { data: product, error } = await useFetch<ProductDetailDto>(() => `/api/v1/products/${slug.value}`, {
  key: () => `product:${slug.value}`,
});
if (error.value || !product.value) {
  throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado', fatal: true });
}

// El color va en la URL (?color=NEG) para que se pueda compartir y Google lo vea.
const color = computed(() => {
  const colors = product.value?.colors ?? [];
  return colors.find((c) => c.code === route.query.color) ?? colors[0];
});
function chooseColor(code: string) {
  selectedSize.value = null;
  imageIndex.value = 0;
  return navigateTo({ query: { ...route.query, color: code } }, { replace: true });
}

const selectedSize = ref<number | null>(null);
const variant = computed(() => color.value?.variants.find((v) => v.size === selectedSize.value));
const imageIndex = ref(0);
const mainImage = computed(() => color.value?.images[imageIndex.value] ?? color.value?.images[0]);

const discount = computed(() =>
  product.value?.salePrice ? discountPercent(product.value.price, product.value.salePrice) : 0,
);

const availability = computed(() => {
  if (!variant.value) return 'Elige tu talla para ver la disponibilidad.';
  if (variant.value.stock <= LOW_STOCK_PER_SIZE) {
    return `Últimos pares: ${variant.value.stock === 1 ? 'queda 1' : `quedan ${variant.value.stock}`} en talla ${variant.value.size}.`;
  }
  return `Disponible en talla ${variant.value.size}.`;
});

/** "Velo Stride 2" → "Stride 2": la marca ya se muestra arriba. */
const modelName = computed(() => {
  const { name, brand } = product.value!;
  const prefix = `${brand.name} `;
  return name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name;
});

const cart = useCart();
const cartNotice = ref<{ tone: 'success' | 'danger'; text: string } | null>(null);
const addingToCart = ref(false);
async function addToCart() {
  if (!variant.value) return;
  cartNotice.value = null;
  addingToCart.value = true;
  try {
    await cart.add(variant.value.id);
    cartNotice.value = { tone: 'success', text: `Agregamos talla ${variant.value.size} en ${color.value?.name} a tu carrito.` };
  } catch (error) {
    cartNotice.value = { tone: 'danger', text: apiErrorBody(error).message ?? 'No pudimos agregarlo al carrito.' };
  } finally {
    addingToCart.value = false;
  }
}
const sizeGuide = ref<{ open: () => void }>();

function formatEndDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });
}

useSeoMeta({
  title: () => product.value?.name ?? 'Producto',
  description: () => product.value?.description.slice(0, 155),
  ogTitle: () => product.value?.name,
  ogImage: () => product.value?.colors[0]?.images[0]?.url,
});
</script>

<template>
  <div v-if="product && color" class="container-page pt-7">
    <nav aria-label="Migas de pan" class="mb-5 flex flex-wrap gap-x-1 text-[15px] text-ink-soft">
      <NuxtLink to="/" class="underline">Inicio</NuxtLink> /
      <NuxtLink to="/tienda" class="underline">Tienda</NuxtLink> /
      <NuxtLink :to="{ path: '/tienda', query: { category: product.category.slug } }" class="underline">{{ product.category.name }}</NuxtLink> /
      <span>{{ product.name }}</span>
    </nav>

    <div class="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
      <!-- Galería -->
      <section aria-label="Fotos del producto">
        <div class="card flex aspect-[1.24] items-center justify-center overflow-hidden">
          <img v-if="mainImage" :src="mainImage.url" :alt="mainImage.alt" class="size-full object-cover">
          <div v-else class="flex flex-col items-center gap-3 text-ink-soft">
            <UiShoePlaceholder :width="230" />
            <span>Sin fotos todavía</span>
          </div>
        </div>
        <ul v-if="color.images.length > 1" class="mt-3 grid grid-cols-4 gap-3">
          <li v-for="(image, index) in color.images" :key="image.url">
            <button
              type="button"
              class="aspect-[1.6] w-full overflow-hidden rounded-2xl border-2 bg-surface"
              :class="index === imageIndex ? 'border-ink' : 'border-line-soft'"
              :aria-label="`Ver foto ${index + 1}`"
              :aria-pressed="index === imageIndex"
              @click="imageIndex = index"
            >
              <img :src="image.url" alt="" class="size-full object-cover">
            </button>
          </li>
        </ul>
      </section>

      <!-- Compra -->
      <section class="flex flex-col gap-6" aria-labelledby="t-producto">
        <div>
          <p class="text-sm font-bold tracking-[0.08em] text-ink-soft">{{ product.brand.name.toUpperCase() }}</p>
          <h1 id="t-producto" class="font-display-wide mt-1 text-[clamp(2.25rem,6vw,3.5rem)]">
            {{ modelName }}
          </h1>
          <p class="mt-2 text-ink-soft">{{ product.category.name }} · {{ GENDER_LABELS[product.gender] }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <p class="flex flex-wrap items-baseline gap-3">
            <strong class="font-display text-[32px] font-black">{{ formatCOP(product.salePrice ?? product.price) }}</strong>
            <span v-if="product.salePrice" class="text-lg text-ink-soft line-through"><span class="sr-only">Antes</span>{{ formatCOP(product.price) }}</span>
          </p>
          <UiTag v-if="discount" tone="accent" class="self-start">Ahorras {{ formatCOP(product.price - product.salePrice!) }} (−{{ discount }}%)</UiTag>
          <p class="text-sm text-ink-soft">
            Precio en COP, IVA incluido<span v-if="product.offer"> · Oferta válida hasta el {{ formatEndDate(product.offer.endsAt) }}</span>
          </p>
        </div>

        <fieldset v-if="product.colors.length">
          <legend class="mb-3"><strong>Color:</strong> {{ color.name }}</legend>
          <div class="flex flex-wrap gap-3">
            <button
              v-for="c in product.colors"
              :key="c.code"
              type="button"
              class="flex size-12 items-center justify-center rounded-full border-2"
              :class="c.code === color.code ? 'border-ink' : 'border-transparent'"
              :aria-label="c.name"
              :aria-pressed="c.code === color.code"
              @click="chooseColor(c.code)"
            >
              <span class="size-10 rounded-full border border-line" :style="{ background: c.hex }" />
            </button>
          </div>
        </fieldset>

        <fieldset>
          <div class="mb-3 flex items-center justify-between">
            <legend class="font-bold">Talla (EU)</legend>
            <button type="button" class="min-h-11 font-medium underline underline-offset-4" @click="sizeGuide?.open()">Guía de tallas</button>
          </div>
          <div class="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
            <button
              v-for="v in color.variants"
              :key="v.id"
              type="button"
              class="h-12 rounded-xl border text-base"
              :class="
                v.stock === 0
                  ? 'cursor-not-allowed border-dashed border-line bg-transparent text-placeholder line-through'
                  : v.size === selectedSize
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-surface'
              "
              :disabled="v.stock === 0"
              :aria-pressed="v.size === selectedSize"
              :aria-label="v.stock === 0 ? `Talla ${v.size}, agotada` : `Talla ${v.size}`"
              @click="selectedSize = v.size"
            >
              {{ v.size }}
            </button>
          </div>
          <p class="mt-3 text-[15px]" :class="variant && variant.stock <= LOW_STOCK_PER_SIZE ? 'font-bold' : 'text-ink-soft'" aria-live="polite">
            <span v-if="variant && variant.stock <= LOW_STOCK_PER_SIZE" class="mr-1.5 inline-block size-2 rounded-full bg-accent align-middle" />
            {{ availability }}
          </p>
          <p v-if="!color.variants.some((v) => v.stock > 0)" class="mt-2 font-bold text-danger">Este color está agotado.</p>
        </fieldset>

        <div class="flex flex-col gap-3">
          <UiButton block :disabled="!variant || addingToCart" @click="addToCart">
            {{ variant ? (addingToCart ? 'Agregando…' : 'Agregar al carrito') : 'Elige una talla' }}
          </UiButton>
          <p
            v-if="cartNotice"
            :role="cartNotice.tone === 'danger' ? 'alert' : 'status'"
            class="rounded-xl px-4 py-3 text-sm font-medium"
            :class="cartNotice.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'"
          >
            {{ cartNotice.text }}
          </p>
        </div>

        <ul class="flex flex-col gap-3 border-t border-line pt-5 text-[15px]">
          <li class="flex items-center gap-3"><UiIcon name="truck" :size="20" /> Envío a toda Colombia con tarifa fija</li>
          <li class="flex items-center gap-3"><UiIcon name="lock" :size="20" /> Pago seguro con Wompi: tarjeta, PSE y otros medios</li>
        </ul>
      </section>
    </div>

    <div class="mt-16 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <section aria-labelledby="t-desc">
        <h2 id="t-desc" class="font-display text-2xl font-extrabold">Descripción</h2>
        <!-- Texto plano: nunca se interpreta como HTML (docs/06-seguridad.md A03). -->
        <p class="mt-3 whitespace-pre-line text-ink-soft">{{ product.description }}</p>
      </section>
      <section aria-labelledby="t-det">
        <h2 id="t-det" class="font-display text-2xl font-extrabold">Detalles</h2>
        <dl class="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-[15px]">
          <dt class="text-ink-soft">Marca</dt><dd>{{ product.brand.name }}</dd>
          <dt class="text-ink-soft">Categoría</dt><dd>{{ product.category.name }}</dd>
          <dt class="text-ink-soft">Género</dt><dd>{{ GENDER_LABELS[product.gender] }}</dd>
          <dt class="text-ink-soft">Referencia</dt><dd>{{ variant?.sku ?? `${product.reference}-${color.code}` }}</dd>
        </dl>
      </section>
    </div>

    <SizeGuideDialog ref="sizeGuide" />
  </div>
</template>
