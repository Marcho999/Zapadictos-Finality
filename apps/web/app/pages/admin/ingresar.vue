<script setup lang="ts">
import { adminChangePasswordSchema, adminLoginSchema, type AdminMeDto } from '@zapadictos/shared';

definePageMeta({ layout: false });
useHead({ title: 'Ingresar al panel', meta: [{ name: 'robots', content: 'noindex' }] });

const route = useRoute();
const me = useAdminMe();
const showPassword = ref(false);

/** Solo se vuelve a rutas internas del panel (evita redirecciones abiertas). */
const nextPath = () => safeRedirect(route.query.volver, '/admin', '/admin/productos');

onMounted(async () => {
  const current = await loadAdminMe();
  if (current && !current.mustChangePassword) await navigateTo(nextPath());
});

const step = computed(() => (me.value?.mustChangePassword ? 'password' : 'login'));

const login = useZodForm(adminLoginSchema, { email: '', password: '' });
async function submitLogin() {
  await login.submit(async (data) => {
    setAdminMe(await $fetch<AdminMeDto>('/api/v1/admin/auth/login', { method: 'POST', body: data }));
    login.values.password = '';
    if (!me.value?.mustChangePassword) await navigateTo(nextPath());
  });
}

const change = useZodForm(adminChangePasswordSchema, { currentPassword: '', newPassword: '' });
const confirmPassword = ref('');
const confirmError = computed(() =>
  confirmPassword.value && confirmPassword.value !== change.values.newPassword ? 'Las contraseñas no coinciden' : undefined,
);
async function submitChange() {
  if (confirmPassword.value !== change.values.newPassword) return;
  await change.submit(async (data) => {
    setAdminMe(await $fetch<AdminMeDto>('/api/v1/admin/auth/change-password', { method: 'POST', body: data }));
    await navigateTo('/admin/productos');
  });
}
</script>

<template>
  <div class="min-h-dvh bg-ink px-6 pb-20 pt-12 text-white">
    <div class="mx-auto max-w-[520px]">
      <div class="mb-12 flex flex-wrap items-center gap-3">
        <span class="font-display text-[26px] font-black tracking-[0.04em] [font-stretch:125%]">ZAPADICTOS</span>
        <UiTag tone="accent" class="h-[22px] text-[11px]">ADMIN</UiTag>
        <NuxtLink to="/" class="ml-auto text-[15px] text-muted hover:text-accent">Ir a la tienda →</NuxtLink>
      </div>

      <form v-if="step === 'login'" class="card flex flex-col gap-5 p-8 text-ink sm:p-10" novalidate @submit.prevent="submitLogin">
        <div>
          <h1 class="font-display text-[26px] font-extrabold [font-stretch:110%]">Panel de administración</h1>
          <p class="mt-2 text-ink-soft">Acceso exclusivo para el personal de la tienda. Las cuentas de cliente no funcionan aquí.</p>
        </div>

        <UiField v-slot="{ id, describedBy, invalid }" label="Correo" :error="login.errors.value.email">
          <input :id="id" v-model="login.values.email" type="email" autocomplete="username" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>

        <UiField v-slot="{ id, describedBy, invalid }" label="Contraseña" :error="login.errors.value.password">
          <div class="flex gap-2">
            <input
              :id="id"
              v-model="login.values.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              class="input-base"
              :aria-invalid="invalid"
              :aria-describedby="describedBy"
            >
            <UiButton variant="outline" size="sm" class="shrink-0" @click="showPassword = !showPassword">
              {{ showPassword ? 'Ocultar' : 'Mostrar' }}
            </UiButton>
          </div>
        </UiField>

        <p v-if="login.formError.value" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">
          {{ login.formError.value }}
        </p>

        <UiButton type="submit" block :disabled="login.pending.value">
          {{ login.pending.value ? 'Ingresando…' : 'Ingresar al panel' }}
        </UiButton>
        <p class="text-sm text-ink-soft">Después de 5 intentos fallidos la cuenta queda bloqueada 15 minutos. Todos los intentos quedan registrados.</p>
      </form>

      <form v-else class="card flex flex-col gap-5 p-8 text-ink sm:p-10" novalidate @submit.prevent="submitChange">
        <div>
          <p class="mb-2 text-[13px] font-bold tracking-[0.08em] text-ink-soft">PRIMER INGRESO</p>
          <h1 class="font-display text-[26px] font-extrabold [font-stretch:110%]">Cambia tu contraseña temporal</h1>
          <p class="mt-2 text-ink-soft">Hola, {{ me?.name }}. Antes de usar el panel, elige tu propia contraseña.</p>
        </div>
        <UiField v-slot="{ id, describedBy, invalid }" label="Contraseña temporal" :error="change.errors.value.currentPassword">
          <input :id="id" v-model="change.values.currentPassword" type="password" autocomplete="current-password" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Nueva contraseña" hint="Al menos 12 caracteres y distinta de la temporal." :error="change.errors.value.newPassword">
          <input :id="id" v-model="change.values.newPassword" type="password" autocomplete="new-password" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Confirmar nueva contraseña" :error="confirmError">
          <input :id="id" v-model="confirmPassword" type="password" autocomplete="new-password" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
        <p v-if="change.formError.value" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">
          {{ change.formError.value }}
        </p>
        <UiButton type="submit" block :disabled="change.pending.value || Boolean(confirmError)">Guardar y entrar</UiButton>
        <p class="text-sm text-ink-soft">Al cambiarla se cierran tus otras sesiones abiertas.</p>
      </form>
    </div>
  </div>
</template>
