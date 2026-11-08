<script setup lang="ts">
// A 16 x 16 line icon of the toolbar, shown at 18 px.
defineProps<{ d: string }>()
</script>

<template>
  <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
    <path :d="d" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
  </svg>
</template>
