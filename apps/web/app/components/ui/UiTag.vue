<script setup lang="ts">
export type TagTone =
  | 'accent'
  | 'ink'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral';

const props = withDefaults(defineProps<{ tone?: TagTone }>(), {
  tone: 'neutral',
});

const toneClass: Record<TagTone, string> = {
  accent: 'bg-accent text-ink',
  ink: 'bg-ink text-white',
  success: 'bg-success-bg text-success',
  danger: 'bg-danger-bg text-danger',
  warning: 'bg-warning-bg text-warning',
  info: 'bg-info-bg text-info',
  neutral: 'bg-neutral-bg text-neutral',
};
</script>

<template>
  <span
    class="inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold"
    :class="toneClass[props.tone]"
  >
    <slot />
  </span>
</template>
