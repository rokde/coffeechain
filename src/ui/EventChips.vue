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
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0 12px;
  padding: 1px 8px;
  border-radius: 6px;
  background: var(--hud-bg);
  font-size: 12px;
  font-weight: 600;
  line-height: 14px;
  white-space: nowrap;
}
/* Below 1280 px the panels are near the centre, so the tab moves to the right, away from the seed tab. */
@media (max-width: 1279px) {
  .events {
    left: auto;
    right: 12px;
    transform: none;
  }
}
/* The tab must not reach the seed tab, so it wraps to a second line. */
@media (max-width: 480px) {
  .events {
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: calc(100% - 164px);
  }
}
</style>
