<script setup lang="ts">
import { MAX_ADDRESSES, profileUpdateSchema, type AddressDto, type CustomerMeDto } from '@zapadictos/shared';

definePageMeta({ middleware: 'account' });
useSeoMeta({ title: 'Mi cuenta', robots: 'noindex' });

const api = useAccountApi();
const customer = useCustomer();

const { data: addresses } = await useAsyncData('addresses', () => api.get<AddressDto[]>('/users/me/addresses'), { server: false });

// ── Perfil
const profile = useZodForm(profileUpdateSchema, { name: customer.value?.name ?? '', phone: customer.value?.phone ?? '' });
watch(customer, (c) => c && profile.reset({ name: c.name, phone: c.phone ?? '' }), { immediate: true });
const profileSaved = ref(false);
async function saveProfile() {
  profileSaved.value = await profile.submit(async (data) => {
    setCustomer(await api.patch<CustomerMeDto>('/users/me', data));
  });
}

const acceptedAt = computed(() =>
  customer.value
    ? new Date(customer.value.dataPolicyAcceptedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : '',
);

// ── Direcciones: un formulario a la vez ('new' o el id de la que se edita)
const editing = ref<string | null>(null);
const message = ref<{ tone: 'success' | 'danger'; text: string } | null>(null);

async function createAddress(data: object) {
  addresses.value = await api.post<AddressDto[]>('/users/me/addresses', data);
  editing.value = null;
  message.value = { tone: 'success', text: 'Dirección guardada.' };
}

function updateAddress(id: string) {
  return async (data: object) => {
    addresses.value = await api.patch<AddressDto[]>(`/users/me/addresses/${id}`, data);
    editing.value = null;
    message.value = { tone: 'success', text: 'Dirección actualizada.' };
  };
}

async function act(fn: () => Promise<AddressDto[]>, ok: string) {
  message.value = null;
  try {
    addresses.value = await fn();
    message.value = { tone: 'success', text: ok };
  } catch (error) {
    message.value = { tone: 'danger', text: apiErrorBody(error).message ?? 'No se pudo guardar.' };
  }
}

function makeDefault(a: AddressDto) {
  return act(() => api.patch(`/users/me/addresses/${a.id}`, { isDefault: true }), `${a.label} es ahora tu dirección predeterminada.`);
}

function remove(a: AddressDto) {
  if (!confirm(`¿Eliminar la dirección "${a.label}"?`)) return;
  return act(() => api.del(`/users/me/addresses/${a.id}`), 'Dirección eliminada.');
}
</script>

<template>
  <div class="container-page pt-7">
    <nav aria-label="Migas de pan" class="mb-5 text-[15px] text-ink-soft">
      <NuxtLink to="/" class="underline">Inicio</NuxtLink> / Mi cuenta
    </nav>
    <h1 class="font-display-wide mb-9 text-[clamp(2.75rem,10vw,4.5rem)]">Mi cuenta</h1>

    <div class="flex flex-wrap items-start gap-8">
      <AccountNav />

      <div class="flex min-w-0 flex-[999_1_560px] flex-col gap-7">
        <form class="card flex flex-col gap-5 p-7 sm:p-8" novalidate aria-labelledby="t-perfil" @submit.prevent="saveProfile">
          <h2 id="t-perfil" class="font-display text-2xl font-extrabold [font-stretch:110%]">Perfil</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <UiField v-slot="{ id, describedBy, invalid }" label="Nombre completo" :error="profile.errors.value.name">
              <input :id="id" v-model="profile.values.name" autocomplete="name" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
            </UiField>
            <UiField v-slot="{ id, describedBy, invalid }" label="Celular" :error="profile.errors.value.phone">
              <input :id="id" v-model="profile.values.phone" inputmode="numeric" autocomplete="tel" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
            </UiField>
          </div>
          <UiField v-slot="{ id, describedBy }" label="Correo" hint="El correo no se puede cambiar por ahora.">
            <input :id="id" :value="customer?.email" disabled class="input-base" :aria-describedby="describedBy">
          </UiField>
          <p v-if="profile.formError.value" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{{ profile.formError.value }}</p>
          <p v-else-if="profileSaved" role="status" class="rounded-xl bg-success-bg px-4 py-3 text-sm font-medium text-success">Perfil actualizado.</p>
          <div class="flex flex-wrap items-center gap-3">
            <UiButton type="submit" :disabled="profile.pending.value">Guardar cambios</UiButton>
            <span class="text-sm text-ink-soft">Aceptaste la política de datos el {{ acceptedAt }}.</span>
          </div>
        </form>

        <section id="direcciones" class="card flex scroll-mt-6 flex-col gap-5 p-7 sm:p-8" aria-labelledby="t-dir">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <h2 id="t-dir" class="font-display text-2xl font-extrabold [font-stretch:110%]">
              Direcciones <span class="font-sans text-base font-medium text-ink-soft">{{ addresses?.length ?? 0 }} de {{ MAX_ADDRESSES }}</span>
            </h2>
            <UiButton v-if="editing === null && (addresses?.length ?? 0) < MAX_ADDRESSES" variant="outline" size="sm" @click="editing = 'new'">
              + Agregar dirección
            </UiButton>
          </div>

          <p
            v-if="message"
            :role="message.tone === 'danger' ? 'alert' : 'status'"
            class="rounded-xl px-4 py-3 text-sm font-medium"
            :class="message.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'"
          >
            {{ message.text }}
          </p>

          <p v-if="addresses && !addresses.length && editing !== 'new'" class="text-ink-soft">
            Aún no tienes direcciones. Agrega una para que el checkout sea más rápido.
          </p>

          <ul class="grid gap-4 sm:grid-cols-2">
            <li
              v-for="a in addresses"
              :key="a.id"
              class="flex flex-col gap-1.5 rounded-2xl p-5 text-[15px] leading-relaxed"
              :class="[a.isDefault ? 'border-[1.5px] border-ink' : 'border border-line-soft', editing === a.id && 'sm:col-span-2']"
            >
              <template v-if="editing === a.id">
                <AddressForm :address="a" :save="updateAddress(a.id)" @cancel="editing = null" />
              </template>
              <template v-else>
                <span class="flex flex-wrap items-center gap-2.5">
                  <strong class="text-[17px]">{{ a.label }}</strong>
                  <UiTag v-if="a.isDefault">Predeterminada</UiTag>
                </span>
                <span>{{ a.recipientName }} · {{ a.phone }}</span>
                <span class="text-ink-soft">{{ a.line1 }}<template v-if="a.notes">, {{ a.notes }}</template><br>{{ a.city }}, {{ a.department }}</span>
                <span class="mt-1 flex flex-wrap gap-3">
                  <button type="button" class="min-h-11 font-semibold underline" @click="editing = a.id">Editar</button>
                  <button type="button" class="min-h-11 font-semibold underline" @click="remove(a)">Eliminar</button>
                  <button v-if="!a.isDefault" type="button" class="min-h-11 font-semibold underline" @click="makeDefault(a)">Hacer predeterminada</button>
                </span>
              </template>
            </li>
          </ul>

          <div v-if="editing === 'new'" class="border-t border-line-soft pt-6">
            <h3 class="mb-4 text-lg font-bold">Nueva dirección</h3>
            <AddressForm :default-recipient="customer?.name" :save="createAddress" @cancel="editing = null" />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
