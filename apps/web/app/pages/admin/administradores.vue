<script setup lang="ts">
import { adminCreateSchema, type AdminAccountDto } from '@zapadictos/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });
useHead({ title: 'Administradores' });

const api = useAdminApi();
const me = useAdminMe();
const { data: admins, refresh } = await useAsyncData('admin-admins', () => api.get<AdminAccountDto[]>('/admins'));

const message = ref<{ tone: 'success' | 'danger'; text: string } | null>(null);
async function act(fn: () => Promise<AdminAccountDto[]>, ok: string) {
  message.value = null;
  try {
    admins.value = await fn();
    message.value = { tone: 'success', text: ok };
  } catch (error) {
    message.value = { tone: 'danger', text: apiErrorBody(error).message ?? 'No se pudo guardar.' };
  }
}

function toggle(admin: AdminAccountDto) {
  return act(() => api.patch(`/admins/${admin.id}`, { active: !admin.active }), `${admin.name} ${admin.active ? 'desactivado' : 'activado'}.`);
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ── Crear administrador
const showNew = ref(false);
const newAdmin = useZodForm(adminCreateSchema, { name: '', email: '', temporaryPassword: '' });
async function createAdmin() {
  await newAdmin.submit(async (data) => {
    admins.value = await api.post<AdminAccountDto[]>('/admins', data);
    newAdmin.reset({ name: '', email: '', temporaryPassword: '' });
    showNew.value = false;
    message.value = { tone: 'success', text: `${data.name} creado con contraseña temporal.` };
  });
}

// ── Restablecer contraseña: un formulario a la vez
const resetting = ref<string | null>(null);
const resetPassword = ref('');
const resetError = ref<string | null>(null);
function startReset(id: string) {
  resetting.value = id;
  resetPassword.value = '';
  resetError.value = null;
}
async function confirmReset(admin: AdminAccountDto) {
  resetError.value = null;
  try {
    admins.value = await api.patch<AdminAccountDto[]>(`/admins/${admin.id}`, { temporaryPassword: resetPassword.value });
    resetting.value = null;
    message.value = { tone: 'success', text: `Contraseña de ${admin.name} restablecida.` };
  } catch (error) {
    resetError.value = apiErrorBody(error).message ?? 'No se pudo restablecer.';
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-[44px] font-black leading-none [font-stretch:110%]">Administradores</h1>
        <p class="mt-2 text-ink-soft">Todos tienen los mismos permisos. No hay registro público.</p>
      </div>
      <UiButton v-if="!showNew" @click="showNew = true">+ Nuevo administrador</UiButton>
    </div>

    <p
      v-if="message"
      :role="message.tone === 'danger' ? 'alert' : 'status'"
      class="rounded-xl px-4 py-3 text-sm font-medium"
      :class="message.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success'"
    >
      {{ message.text }}
    </p>

    <form v-if="showNew" class="card flex flex-col gap-4 p-7" novalidate @submit.prevent="createAdmin">
      <h2 class="font-display text-xl font-extrabold">Nuevo administrador</h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <UiField v-slot="{ id, describedBy, invalid }" label="Nombre" :error="newAdmin.errors.value.name">
          <input :id="id" v-model="newAdmin.values.name" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Correo" :error="newAdmin.errors.value.email">
          <input :id="id" v-model="newAdmin.values.email" type="email" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Contraseña temporal" hint="Mínimo 12 caracteres." :error="newAdmin.errors.value.temporaryPassword">
          <input :id="id" v-model="newAdmin.values.temporaryPassword" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
      </div>
      <p v-if="newAdmin.formError.value" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{{ newAdmin.formError.value }}</p>
      <div class="flex gap-3">
        <UiButton type="submit" :disabled="newAdmin.pending.value">Crear</UiButton>
        <UiButton variant="outline" @click="showNew = false">Cancelar</UiButton>
      </div>
    </form>

    <section class="card overflow-x-auto" aria-label="Lista de administradores">
      <table class="w-full border-collapse text-[15px]">
        <thead>
          <tr class="text-left text-ink-soft">
            <th class="px-5 py-3.5 font-medium">Nombre</th>
            <th class="px-4 py-3.5 font-medium">Correo</th>
            <th class="px-4 py-3.5 font-medium">Estado</th>
            <th class="px-4 py-3.5 font-medium">Último ingreso</th>
            <th class="px-4 py-3.5 font-medium">Creado por</th>
            <th class="px-5 py-3.5"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="admin in admins ?? []" :key="admin.id">
            <tr class="border-t border-line-soft">
              <td class="whitespace-nowrap px-5 py-3"><strong>{{ admin.name }}</strong></td>
              <td class="px-4">{{ admin.email }}</td>
              <td class="px-4">
                <span class="inline-flex flex-wrap items-center gap-2">
                  <UiTag :tone="admin.active ? 'success' : 'neutral'">{{ admin.active ? 'Activo' : 'Inactivo' }}</UiTag>
                  <UiTag v-if="admin.mustChangePassword" tone="warning">Pendiente de cambiar contraseña</UiTag>
                </span>
              </td>
              <td class="whitespace-nowrap px-4">{{ formatDate(admin.lastLoginAt) }}</td>
              <td class="whitespace-nowrap px-4">{{ admin.createdByName ?? '—' }}</td>
              <td class="whitespace-nowrap px-5 text-right">
                <button
                  type="button"
                  class="min-h-11 px-2 font-semibold underline disabled:cursor-not-allowed disabled:text-placeholder disabled:no-underline"
                  :disabled="admin.id === me?.id"
                  :title="admin.id === me?.id ? 'No puedes desactivarte a ti mismo' : undefined"
                  @click="toggle(admin)"
                >
                  {{ admin.active ? 'Desactivar' : 'Activar' }}
                </button>
                <button type="button" class="min-h-11 px-2 font-semibold underline" @click="startReset(admin.id)">Restablecer contraseña</button>
              </td>
            </tr>
            <tr v-if="resetting === admin.id" class="border-t border-line-soft bg-bg">
              <td colspan="6" class="px-5 py-4">
                <form class="flex flex-wrap items-end gap-3" novalidate @submit.prevent="confirmReset(admin)">
                  <UiField v-slot="{ id }" :label="`Nueva contraseña temporal para ${admin.name}`" class="flex-[1_1_280px]">
                    <input :id="id" v-model="resetPassword" class="input-base">
                  </UiField>
                  <UiButton type="submit" size="sm">Confirmar</UiButton>
                  <UiButton variant="outline" size="sm" @click="resetting = null">Cancelar</UiButton>
                  <span v-if="resetError" class="w-full text-sm font-medium text-danger">{{ resetError }}</span>
                </form>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>
  </div>
</template>
