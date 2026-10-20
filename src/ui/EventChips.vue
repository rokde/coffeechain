<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../app/store'
import { activeEvents } from '../sim/events/schedule'
import type { GameState } from '../sim/state'
import de from './i18n/de.json'

const game = useGameStore()
// activeEvents only reads the state, so the cast of the readonly snapshot is safe.
const events = computed(() => activeEvents(game.state as GameState))
</script>

<template>
  <span v-if="events.length" class="events">
    <span v-for="e in events" :key="e.type" class="chip" data-testid="active-event">{{
      de.events[e.type].name
    }}</span>
  </span>
</template>

<style scoped>
.events {
  display: contents;
}
/* Same as .chip in Hud.vue: scoped styles of the parent do not reach this component. */
.chip {
  padding: 8px 16px;
  border-radius: 999px;
  background: rgb(255 255 255 / 8%);
  white-space: nowrap;
}
@media (max-width: 480px) {
  /* The stats tab has no room, so the events hang below it as a second tab. */
  .events {
    position: absolute;
    top: 100%;
    right: 0;
    display: flex;
    gap: 8px;
    padding: 1px 8px;
    border-radius: 0 0 6px 6px;
    background: var(--hud-bg);
  }
  .chip {
    padding: 0;
    background: none;
  }
}
</style>
