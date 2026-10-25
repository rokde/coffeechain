<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import type { GameState } from '../sim/state'
import { storageCapacity } from '../sim/storage/capacity'
import { storageUsed } from '../sim/storage/storage'
import de from './i18n/de.json'

const t = de.messages
const game = useGameStore()
const messages = computed(() => {
  // The helpers only read the state, so the cast of the readonly snapshot is safe.
  const state = game.state as GameState
  const { storage, time, milestones } = state
  // Field states are not here: the badges of the field list above show them.
  const list: string[] = []
  if (storageUsed(storage) >= storageCapacity(state)) list.push(t.storageFull)
  const { harvestProDay } = milestones
  const days = balance().progression.harvestProMessageDays
  if (harvestProDay !== undefined && time.day < harvestProDay + days) list.push(t.harvestPro)
  return list
})
</script>

<template>
  <section v-if="messages.length" class="messages" data-testid="message-panel">
    <h2>{{ t.heading }}</h2>
    <ul>
      <li v-for="text in messages" :key="text" data-testid="message">{{ text }}</li>
    </ul>
  </section>
</template>

<style scoped>
/* Below the field list, at most half of the left panel. */
.messages {
  box-sizing: border-box;
  flex: none;
  max-height: calc(var(--left-max, 220px) / 2);
  overflow-y: auto;
  padding: 12px 20px;
  border-top: 1px solid rgb(255 255 255 / 8%);
}
h2 {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #f2c48d;
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}
li {
  padding: 6px 0;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}
</style>
