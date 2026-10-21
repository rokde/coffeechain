<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import { warnedEvents } from '../sim/events/schedule'
import { overripeFactor } from '../sim/farm/overripe'
import { growth } from '../sim/farm/plants'
import { fieldNeedsCare } from '../sim/farm/status'
import type { GameState } from '../sim/state'
import { storageCapacity } from '../sim/storage/capacity'
import { storageUsed } from '../sim/storage/storage'
import { clock } from '../sim/time/time'
import de from './i18n/de.json'

const t = de.messages
const game = useGameStore()
const warnings = computed(() => {
  const state = game.state as GameState
  const tomorrow = clock(state.time.hour).day + 1
  const events = [...warnedEvents(state)].sort((a, b) => a.startDay - b.startDay)
  return events.map((e) => {
    const { warning, hint } = de.events[e.type]
    const text = e.startDay === tomorrow ? de.events.warnTomorrow : de.events.warnDay
    return { text: text.replace('{warning}', warning).replace('{day}', String(e.startDay)), hint }
  })
})
const messages = computed(() => {
  // The helpers only read the state, so the cast of the readonly snapshot is safe.
  const state = game.state as GameState
  const { farm, storage, time, milestones } = state
  const status = new Map<number, 'ripe' | 'overripe'>()
  for (const [index, plant] of Object.entries(farm.plants)) {
    const field = farm.parcels[Number(index)]
    if (field === undefined || status.get(field) === 'overripe') continue
    if (overripeFactor(plant, time.hour) < 1) status.set(field, 'overripe')
    else if (growth(plant, time.hour).stage === 'reif') status.set(field, 'ripe')
  }
  const list = farm.fields.flatMap((f) => {
    const key = status.get(f.id)
    const out = key ? [t[key].replace('{name}', f.name)] : []
    if (fieldNeedsCare(state, f.id)) out.push(t.needsCare.replace('{name}', f.name))
    return out
  })
  if (storageUsed(storage) >= storageCapacity(state)) list.push(t.storageFull)
  const { harvestProHour } = milestones
  const { ticksPerGameDay } = balance().time
  const days = balance().progression.harvestProMessageDays
  if (harvestProHour !== undefined && time.hour < harvestProHour + days * ticksPerGameDay)
    list.push(t.harvestPro)
  return list
})
</script>

<template>
  <section v-if="warnings.length || messages.length" class="messages" data-testid="message-panel">
    <h2>{{ t.heading }}</h2>
    <ul>
      <li v-for="w in warnings" :key="w.text" data-testid="message">
        {{ w.text }}<small class="hint">{{ w.hint }}</small>
      </li>
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
.hint {
  display: block;
  font-size: 12px;
  opacity: 0.8;
}
</style>
