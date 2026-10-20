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
    <span v-for="e in events" :key="e.type" data-testid="active-event">{{
      de.events[e.type].name
    }}</span>
  </span>
</template>

<style scoped>
/* The top bar has no room for more chips, so the events hang below it as a tab. */
.events {
  position: absolute;
  top: 100%;
  right: 12px;
  display: flex;
  gap: 12px;
  padding: 1px 8px;
  border-radius: 0 0 6px 6px;
  background: var(--hud-bg);
  font-size: 12px;
  font-weight: 600;
  line-height: 14px;
  white-space: nowrap;
}
/* Below 1024 px the stats are a tab too, so the events hang below the stats tab. */
@media (max-width: 1024px) {
  .events {
    right: 0;
  }
}
</style>
