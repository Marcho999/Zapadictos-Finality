<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'outline';
    size?: 'md' | 'sm';
    to?: RouteLocationRaw;
    type?: 'button' | 'submit';
    disabled?: boolean;
    block?: boolean;
  }>(),
  { variant: 'primary', size: 'md', type: 'button', disabled: false, block: false },
);

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] font-bold no-underline transition-colors',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
  props.size === 'md' ? 'min-h-12 px-7 text-base' : 'min-h-11 px-5 text-[15px]',
  props.block && 'w-full',
  props.disabled
    ? 'cursor-not-allowed border-muted bg-muted text-ink-soft'
    : props.variant === 'primary'
      ? 'border-ink bg-ink text-white hover:bg-neutral'
      : 'border-ink bg-surface text-ink hover:bg-bg',
]);
</script>

<template>
  <NuxtLink v-if="to && !disabled" :to="to" :class="classes">
    <slot />
  </NuxtLink>
  <button v-else :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>
