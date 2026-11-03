<script setup lang="ts">
export type IconName = 'grid' | 'box' | 'bag' | 'tag' | 'users' | 'image' | 'shield' | 'menu' | 'close' | 'truck' | 'lock' | 'check' | 'up' | 'down' | 'upload';
withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <template v-if="name === 'grid'">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </template>
    <template v-else-if="name === 'box'"><path d="M12 3l8 4v10l-8 4-8-4V7z" /><path d="M4 7l8 4 8-4M12 11v10" /></template>
    <template v-else-if="name === 'bag'"><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></template>
    <template v-else-if="name === 'tag'"><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8" r="1.4" /></template>
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.7 3 2.4 3.5 5.2" />
    </template>
    <template v-else-if="name === 'image'"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8" /></template>
    <template v-else-if="name === 'shield'"><path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z" /></template>
    <template v-else-if="name === 'menu'"><path d="M4 7h16M4 12h16M4 17h16" /></template>
    <template v-else-if="name === 'close'"><path d="M6 6l12 12M18 6L6 18" /></template>
    <template v-else-if="name === 'truck'"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></template>
    <template v-else-if="name === 'lock'"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></template>
    <template v-else-if="name === 'check'"><path d="M5 12.5l4.5 4.5L19 7.5" /></template>
    <template v-else-if="name === 'up'"><path d="M12 19V5M6 11l6-6 6 6" /></template>
    <template v-else-if="name === 'down'"><path d="M12 5v14M6 13l6 6 6-6" /></template>
    <template v-else-if="name === 'upload'"><path d="M12 16V5M7 10l5-5 5 5M5 19h14" /></template>
  </svg>
</template>
