<script setup lang="ts">
useSeoMeta({
  title: 'Política de tratamiento de datos',
  description: 'Cómo tratamos tus datos personales según la Ley 1581 de 2012.',
});
</script>

<template>
  <article class="container-page max-w-3xl pt-10">
    <h1 class="font-display-wide text-[clamp(2rem,6vw,3rem)]">Tratamiento de datos personales</h1>
    <p class="mt-4 text-sm text-ink-soft">
      Borrador para un proyecto académico. Antes de usarse con datos reales, debe revisarlo una persona con conocimiento legal.
    </p>
    <div class="mt-8 flex flex-col gap-6 text-[17px] leading-relaxed text-neutral">
      <section>
        <h2 class="mb-2 text-xl font-bold text-ink">Qué datos pedimos y para qué</h2>
        <p>Nombre, correo, celular y dirección de envío. Los usamos solo para crear tu cuenta, procesar y enviar tus pedidos y comunicarnos contigo sobre ellos (Ley 1581 de 2012 y Decreto 1377 de 2013).</p>
      </section>
      <section>
        <h2 class="mb-2 text-xl font-bold text-ink">Qué no guardamos</h2>
        <p>Los datos de tu tarjeta o cuenta bancaria nunca pasan por Zapadictos: los procesa directamente la pasarela de pagos Wompi. Tu contraseña se guarda cifrada y nadie del equipo puede verla.</p>
      </section>
      <section>
        <h2 class="mb-2 text-xl font-bold text-ink">Tus derechos</h2>
        <p>Puedes conocer, actualizar y rectificar tus datos desde <NuxtLink to="/cuenta" class="underline">Mi cuenta</NuxtLink>, y pedir que los eliminemos escribiendo a <NuxtLink to="/contacto" class="underline">Contacto</NuxtLink>. Al registrarte aceptas esta política; guardamos la fecha en que la aceptaste.</p>
      </section>
    </div>
  </article>
</template>
