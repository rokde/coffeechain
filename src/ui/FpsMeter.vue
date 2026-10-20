<script setup lang="ts">
import { useViewStore } from '../app/view'
import de from './i18n/de.json'

const view = useViewStore()
</script>

<template>
  <output class="fps-meter" data-testid="fps-meter">{{
    de.debug.fps.replace('{fps}', String(view.fps))
  }}</output>
</template>

<style scoped>
.fps-meter {
  position: absolute;
  bottom: 16px;
  left: 16px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--hud-bg);
  font: 600 12px monospace;
}
@media (max-width: 480px) {
  /* The toolbar has two rows here and fills the width, so the meter sits above it. */
  .fps-meter {
    bottom: 140px;
  }
}
</style>
