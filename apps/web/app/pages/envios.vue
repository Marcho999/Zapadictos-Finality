<script setup lang="ts">
useSeoMeta({ title: 'Envíos', description: 'Envíos a toda Colombia con tarifa fija de $15.000.' });
</script>

<template>
  <article class="container-page max-w-3xl pt-10">
    <h1 class="font-display-wide text-[clamp(2.5rem,8vw,3.5rem)]">Envíos</h1>
    <div class="mt-8 flex flex-col gap-5 text-[17px] leading-relaxed text-neutral">
      <p><strong class="text-ink">Enviamos a toda Colombia</strong> con una tarifa fija de <strong class="text-ink">$15.000</strong>, sin importar la ciudad ni cuántos pares compres.</p>
      <p>Preparamos tu pedido cuando Wompi confirma el pago. Puedes seguir el estado desde <NuxtLink to="/cuenta/pedidos" class="underline">Mis pedidos</NuxtLink>: pagado, enviado y entregado.</p>
      <p>Si tu pago no se confirma en 30 minutos, el pedido se cancela automáticamente y las tallas vuelven a la tienda. No se hace ningún cobro.</p>
      <p class="text-sm text-ink-soft">Zapadictos es un proyecto académico: los pagos funcionan en modo de pruebas y no se envían productos reales.</p>
    </div>
  </article>
</template>
