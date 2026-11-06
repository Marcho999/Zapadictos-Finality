<script setup lang="ts">
import { customerLoginSchema, customerRegisterSchema, type CustomerMeDto } from '@zapadictos/shared';

useSeoMeta({ title: 'Ingresar o crear cuenta', robots: 'noindex' });

const route = useRoute();
// Solo rutas internas de la tienda; nunca el panel ni otros sitios.
const nextPath = () => {
  const target = safeRedirect(route.query.volver, '/', '/cuenta');
  return target.startsWith('/admin') ? '/cuenta' : target;
};

onMounted(async () => {
  if (await loadCustomer()) await navigateTo(nextPath(), { replace: true });
});

const showPassword = ref(false);
const login = useZodForm(customerLoginSchema, { email: '', password: '' });
async function submitLogin() {
  await login.submit(async (data) => {
    setCustomer(await $fetch<CustomerMeDto>('/api/v1/auth/login', { method: 'POST', body: data }));
    await useCart().merge();
    await navigateTo(nextPath());
  });
}

const register = useZodForm(customerRegisterSchema, {
  name: '',
  email: '',
  phone: '',
  password: '',
  acceptDataPolicy: false as unknown as true,
});
async function submitRegister() {
  await register.submit(async (data) => {
    setCustomer(await $fetch<CustomerMeDto>('/api/v1/auth/register', { method: 'POST', body: data }));
    await useCart().merge();
    await navigateTo(nextPath());
  });
}
</script>

<template>
  <div class="container-page pt-7">
    <nav aria-label="Migas de pan" class="mb-5 text-[15px] text-ink-soft">
      <NuxtLink to="/" class="underline">Inicio</NuxtLink> / Cuenta
    </nav>
    <h1 class="font-display-wide text-[clamp(2.75rem,10vw,4.5rem)]">Tu cuenta</h1>
    <p class="mb-9 mt-3 max-w-2xl text-[17px] text-ink-soft">
      Ingresa para comprar y seguir tus pedidos. Si es tu primera vez, crea tu cuenta en un minuto.
    </p>

    <div class="grid items-start gap-7 md:grid-cols-2">
      <form class="card flex flex-col gap-5 p-7 sm:p-9" novalidate aria-labelledby="t-login" @submit.prevent="submitLogin">
        <div>
          <h2 id="t-login" class="font-display text-[26px] font-extrabold [font-stretch:110%]">Ingresar</h2>
          <p class="mt-1.5 text-ink-soft">Tu carrito se une a tu cuenta al ingresar.</p>
        </div>
        <UiField v-slot="{ id, describedBy, invalid }" label="Correo" :error="login.errors.value.email">
          <input :id="id" v-model="login.values.email" type="email" autocomplete="email" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Contraseña" :error="login.errors.value.password">
          <div class="flex gap-2">
            <input :id="id" v-model="login.values.password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
            <UiButton variant="outline" size="sm" class="shrink-0" @click="showPassword = !showPassword">{{ showPassword ? 'Ocultar' : 'Mostrar' }}</UiButton>
          </div>
        </UiField>
        <p v-if="login.formError.value" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{{ login.formError.value }}</p>
        <UiButton type="submit" block :disabled="login.pending.value">{{ login.pending.value ? 'Ingresando…' : 'Ingresar' }}</UiButton>
        <p class="text-sm text-ink-soft">¿Olvidaste tu contraseña? Escríbenos desde <NuxtLink to="/contacto" class="underline">Contacto</NuxtLink>.</p>
      </form>

      <form class="card flex flex-col gap-5 p-7 sm:p-9" novalidate aria-labelledby="t-reg" @submit.prevent="submitRegister">
        <div>
          <h2 id="t-reg" class="font-display text-[26px] font-extrabold [font-stretch:110%]">Crear cuenta</h2>
          <p class="mt-1.5 text-ink-soft">Solo pedimos lo necesario para enviarte tus pedidos.</p>
        </div>
        <UiField v-slot="{ id, describedBy, invalid }" label="Nombre completo" :error="register.errors.value.name">
          <input :id="id" v-model="register.values.name" autocomplete="name" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField v-slot="{ id, describedBy, invalid }" label="Correo" :error="register.errors.value.email">
            <input :id="id" v-model="register.values.email" type="email" autocomplete="email" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
          </UiField>
          <UiField v-slot="{ id, describedBy, invalid }" label="Celular (opcional)" :error="register.errors.value.phone">
            <input :id="id" v-model="register.values.phone" inputmode="numeric" autocomplete="tel" placeholder="3001234567" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
          </UiField>
        </div>
        <UiField v-slot="{ id, describedBy, invalid }" label="Contraseña" hint="Mínimo 8 caracteres, con al menos una letra y un número." :error="register.errors.value.password">
          <input :id="id" v-model="register.values.password" type="password" autocomplete="new-password" class="input-base" :aria-invalid="invalid" :aria-describedby="describedBy">
        </UiField>
        <div>
          <label class="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
            <input v-model="register.values.acceptDataPolicy" type="checkbox" class="mt-0.5 size-5 shrink-0 accent-ink" :aria-invalid="Boolean(register.errors.value.acceptDataPolicy)">
            <span>Acepto la <NuxtLink to="/privacidad" target="_blank" class="underline">política de tratamiento de datos personales</NuxtLink> de Zapadictos (Ley 1581 de 2012).</span>
          </label>
          <p v-if="register.errors.value.acceptDataPolicy" class="mt-1.5 text-[13px] font-medium text-danger">{{ register.errors.value.acceptDataPolicy }}</p>
        </div>
        <p v-if="register.formError.value" role="alert" class="rounded-xl bg-danger-bg px-4 py-3 text-sm font-medium text-danger">{{ register.formError.value }}</p>
        <UiButton type="submit" variant="outline" block :disabled="register.pending.value">{{ register.pending.value ? 'Creando cuenta…' : 'Crear cuenta' }}</UiButton>
      </form>
    </div>

    <ul class="mt-11 flex flex-wrap gap-x-12 gap-y-5 text-[15px]">
      <li class="flex items-center gap-2.5"><UiIcon name="box" :size="20" />Stock real por talla</li>
      <li class="flex items-center gap-2.5"><UiIcon name="lock" :size="20" />Pago seguro con Wompi</li>
      <li class="flex items-center gap-2.5"><UiIcon name="truck" :size="20" />Sigue el estado de tus pedidos</li>
    </ul>
  </div>
</template>
