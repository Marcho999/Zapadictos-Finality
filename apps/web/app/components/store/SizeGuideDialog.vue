<script setup lang="ts">
const dialog = ref<HTMLDialogElement>();
defineExpose({ open: () => dialog.value?.showModal() });

// Equivalencias aproximadas de referencia (EU → largo del pie). Texto de ejemplo.
const rows = [
  { eu: 35, cm: 22.5, us: 4.5 }, { eu: 36, cm: 23, us: 5 }, { eu: 37, cm: 23.5, us: 5.5 },
  { eu: 38, cm: 24, us: 6 }, { eu: 39, cm: 25, us: 7 }, { eu: 40, cm: 25.5, us: 7.5 },
  { eu: 41, cm: 26, us: 8 }, { eu: 42, cm: 26.5, us: 8.5 }, { eu: 43, cm: 27.5, us: 9.5 },
  { eu: 44, cm: 28, us: 10 }, { eu: 45, cm: 29, us: 11 }, { eu: 46, cm: 29.5, us: 11.5 },
];
</script>

<template>
  <dialog ref="dialog" class="m-auto w-[min(520px,92vw)] rounded-card bg-surface p-0" aria-labelledby="t-guia">
    <div class="flex flex-col gap-4 p-7">
      <div class="flex items-center justify-between gap-4">
        <h2 id="t-guia" class="font-display text-2xl font-extrabold">Guía de tallas</h2>
        <button type="button" class="inline-flex size-11 items-center justify-center rounded-full border border-line" @click="dialog?.close()">
          <span class="sr-only">Cerrar guía de tallas</span>
          <UiIcon name="close" :size="20" />
        </button>
      </div>
      <p class="text-[15px] text-ink-soft">
        Mide tu pie de talón a punta, de pie y al final del día. Si quedas entre dos tallas, elige la mayor.
      </p>
      <div class="max-h-[50vh] overflow-y-auto rounded-2xl border border-line-soft">
        <table class="w-full border-collapse text-[15px]">
          <thead class="sticky top-0 bg-bg">
            <tr class="text-left"><th class="px-4 py-2.5">EU</th><th class="px-4">Largo del pie</th><th class="px-4">US hombre</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.eu" class="border-t border-line-soft">
              <td class="px-4 py-2 font-bold">{{ r.eu }}</td><td class="px-4">{{ r.cm }} cm</td><td class="px-4">{{ r.us }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-[13px] text-ink-soft">Las equivalencias son de referencia y pueden variar según la marca.</p>
    </div>
  </dialog>
</template>
