<script setup lang="ts">
import {
  adminOfferCreateSchema,
  discountPercent,
  formatCOP,
  type AdminOfferDto,
  type AdminProductDetailDto,
  type OfferState,
} from '@zapadictos/shared';

const props = defineProps<{ product: AdminProductDetailDto }>();
const emit = defineEmits<{ updated: [product: AdminProductDetailDto] }>();
const api = useAdminApi();
const message = ref<{ tone: 'success' | 'danger'; text: string } | null>(null);

const current = computed(() => props.product.offers.find((o) => o.state === 'current'));

/** "2026-11-03T05:00:00Z" → "2026-11-03T00:00" en la hora local, para <input type="datetime-local">. */
function toLocalInput(iso: string | Date) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const stateTag: Record<OfferState, { tone: 'accent' | 'info' | 'neutral'; label: string }> = {
  current: { tone: 'accent', label: 'Vigente' },
  scheduled: { tone: 'info', label: 'Programada' },
  inactive: { tone: 'neutral', label: 'Desactivada' },
  ended: { tone: 'neutral', label: 'Terminada' },
};

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
tomorrow.setHours(0, 0, 0, 0);
const inTwoWeeks = new Date(tomorrow.getTime() + 14 * 24 * 60 * 60 * 1000 - 60_000);

const form = useZodForm(adminOfferCreateSchema, {
  salePrice: Math.round((props.product.price * 0.9) / 100) * 100,
  startsAt: toLocalInput(tomorrow) as unknown as Date,
  endsAt: toLocalInput(inTwoWeeks) as unknown as Date,
  active: true,
});

const preview = computed(() => discountPercent(props.product.price, Number(form.values.salePrice)));

async function create() {
  message.value = null;
  // Las fechas del formulario están en hora local; se envían en ISO (UTC).
  await form.submit(async (data) => {
    emit('updated', await api.post<AdminProductDetailDto>(`/products/${props.product.id}/offers`, {
      ...data,
      startsAt: data.startsAt.toISOString(),
      endsAt: data.endsAt.toISOString(),
    }));
    message.value = { tone: 'success', text: 'Oferta programada.' };
  });
}

async function act(fn: () => Promise<AdminProductDetailDto>, ok: string) {
  message.value = null;
  try {
    emit('updated', await fn());
    message.value = { tone: 'success', text: ok };
  } catch (error) {
    message.value = { tone: 'danger', text: apiErrorBody(error).message ?? 'No se pudo guardar.' };
  }
}

function toggle(offer: AdminOfferDto) {
  return act(
    () => api.patch(`/offers/${offer.id}`, { active: !offer.active }),
    offer.active ? 'Oferta desactivada: ya no se ve en la tienda.' : 'Oferta activada.',
  );
}

function remove(offer: AdminOfferDto) {
  if (!confirm('¿Borrar esta oferta programada?')) return;
  return act(() => api.del(`/offers/${offer.id}`), 'Oferta borrada.');
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <p
      v-if="message"
      :role="message.tone === 'danger' ? 'alert' : 'status'"
      class="rounded-xl px-4 py-3 text-sm font-medium"
      :class="message.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'"
    >
      {{ message.text }}
    </p>

    <div class="flex flex-wrap items-start gap-6">
      <section class="card flex flex-[1_1_420px] flex-col gap-4 p-7" :class="current && 'border-2 border-accent'" aria-labelledby="t-vig">
        <h2 id="t-vig" class="font-display text-xl font-extrabold">Oferta vigente</h2>
        <template v-if="current">
          <div class="flex flex-wrap items-baseline gap-3.5">
            <span class="font-display text-4xl font-black">{{ formatCOP(current.salePrice) }}</span>
            <span class="text-xl text-ink-soft line-through">{{ formatCOP(product.price) }}</span>
            <UiTag tone="accent">−{{ discountPercent(product.price, current.salePrice) }}% · ahorro {{ formatCOP(product.price - current.salePrice) }}</UiTag>
          </div>
          <div class="grid gap-3 text-[15px] sm:grid-cols-2">
            <div class="rounded-2xl bg-bg p-3.5"><span class="block text-[13px] text-ink-soft">Desde</span><strong>{{ formatDate(current.startsAt) }}</strong></div>
            <div class="rounded-2xl bg-bg p-3.5"><span class="block text-[13px] text-ink-soft">Hasta</span><strong>{{ formatDate(current.endsAt) }}</strong></div>
          </div>
          <p class="text-sm text-ink-soft">Desactivarla la quita de la tienda al instante. Los pedidos ya creados conservan el precio con el que se compraron.</p>
          <UiButton variant="outline" class="self-start" @click="toggle(current)">Desactivar oferta</UiButton>
        </template>
        <p v-else class="text-ink-soft">Este producto no tiene una oferta vigente. Se vende a {{ formatCOP(product.price) }}.</p>
      </section>

      <form class="card flex flex-[1_1_420px] flex-col gap-4 p-7" novalidate @submit.prevent="create">
        <h2 class="font-display text-xl font-extrabold">Programar oferta</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField
            v-slot="{ id, describedBy, invalid }"
            label="Precio de oferta (COP)"
            :hint="preview > 0 ? `−${preview}% sobre ${formatCOP(product.price)}` : `Debe ser menor que ${formatCOP(product.price)}`"
            :error="form.errors.value.salePrice"
          >
            <input :id="id" v-model.number="form.values.salePrice" type="number" min="1" step="100" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
          </UiField>
          <div class="flex flex-col gap-1.5 text-sm font-medium text-neutral">
            <span>Precio normal</span>
            <span class="input-base flex items-center bg-bg text-ink-soft">{{ formatCOP(product.price) }}</span>
          </div>
          <UiField v-slot="{ id, invalid }" label="Empieza" :error="form.errors.value.startsAt">
            <input :id="id" v-model="form.values.startsAt" type="datetime-local" class="input-base" :aria-invalid="invalid">
          </UiField>
          <UiField v-slot="{ id, invalid }" label="Termina" :error="form.errors.value.endsAt">
            <input :id="id" v-model="form.values.endsAt" type="datetime-local" class="input-base" :aria-invalid="invalid">
          </UiField>
        </div>
        <p v-if="form.formError.value" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{{ form.formError.value }}</p>
        <UiButton type="submit" class="self-start" :disabled="form.pending.value">Programar oferta</UiButton>
        <p class="text-[13px] text-ink-soft">Un producto solo puede tener una oferta activa a la vez; puedes programar la siguiente para cuando termine la actual.</p>
      </form>
    </div>

    <section class="card overflow-x-auto p-2" aria-labelledby="t-hist">
      <h2 id="t-hist" class="px-4 pb-2 pt-4 font-display text-xl font-extrabold">Historial de ofertas</h2>
      <table class="w-full border-collapse text-[15px]">
        <thead>
          <tr class="text-left text-ink-soft">
            <th class="px-4 py-3 font-medium">Precio de oferta</th><th class="px-4 font-medium">Fechas</th>
            <th class="px-4 font-medium">Estado</th><th class="px-4 font-medium">Creada por</th><th class="px-4"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="offer in product.offers" :key="offer.id" class="border-t border-line-soft">
            <td class="whitespace-nowrap px-4 py-3"><strong>{{ formatCOP(offer.salePrice) }}</strong> <span class="text-ink-soft">−{{ discountPercent(product.price, offer.salePrice) }}%</span></td>
            <td class="whitespace-nowrap px-4">{{ formatDate(offer.startsAt) }} – {{ formatDate(offer.endsAt) }}</td>
            <td class="px-4"><UiTag :tone="stateTag[offer.state].tone">{{ stateTag[offer.state].label }}</UiTag></td>
            <td class="px-4">{{ offer.createdBy }}</td>
            <td class="whitespace-nowrap px-4 text-right">
              <button v-if="offer.state !== 'ended'" type="button" class="min-h-11 px-2 font-semibold underline" @click="toggle(offer)">
                {{ offer.active ? 'Desactivar' : 'Activar' }}
              </button>
              <button v-if="offer.state === 'scheduled' || (offer.state === 'inactive' && new Date(offer.startsAt) > new Date())" type="button" class="min-h-11 px-2 font-semibold underline" @click="remove(offer)">Borrar</button>
            </td>
          </tr>
          <tr v-if="!product.offers.length"><td colspan="5" class="px-4 py-6 text-center text-ink-soft">Este producto nunca ha tenido ofertas.</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
