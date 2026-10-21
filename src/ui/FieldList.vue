<script setup lang="ts">
import { computed } from 'vue'
import { focusField } from '../app/fieldFocus'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { useViewStore } from '../app/view'
import { fieldSummaries } from '../sim/farm/status'
import type { GameState } from '../sim/state'
import de from './i18n/de.json'

const t = de.fieldList
const game = useGameStore()
const selection = useSelectionStore()
const view = useViewStore()
// The helpers only read the state, so the cast of the readonly snapshot is safe.
const rows = computed(() => fieldSummaries(game.state as GameState))
const selected = computed(() => {
  const p = selection.parcel
  return p ? game.state.farm.parcels[p.y * game.state.world.size + p.x] : undefined
})
const parcelsText = (n: number) => (n === 1 ? t.parcelsOne : t.parcels.replace('{n}', String(n)))
</script>

<template>
  <section class="fields" data-testid="field-list">
    <h2>{{ t.heading }}</h2>
    <p v-if="rows.length === 0" class="empty" data-testid="field-list-empty">{{ t.empty }}</p>
    <button
      v-for="row in rows"
      :key="row.id"
      type="button"
      data-testid="field-row"
      :aria-current="row.id === selected ? 'true' : undefined"
      @click="focusField(game.state as GameState, row.id, selection, view)"
    >
      <span class="line">
        <strong>{{ de.field.label.replace('{name}', row.name) }}</strong>
        <span v-if="row.state" class="badge" :data-state="row.state" data-testid="field-state">{{
          t.states[row.state]
        }}</span>
        <span v-else class="progress">{{
          t.progress
            .replace('{stage}', de.inspector.stages[row.stage])
            .replace('{n}', String(row.percent))
        }}</span>
      </span>
      <small>{{ parcelsText(row.parcels) }} · {{ de.inspector.varieties[row.variety] }}</small>
      <span
        class="bar"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="row.percent"
        :data-ripe="row.state === 'ripe' || row.state === 'overripe'"
        ><span :style="{ width: `${row.percent}%` }"></span
      ></span>
    </button>
  </section>
</template>

<style scoped>
.fields {
  box-sizing: border-box;
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 20px;
}
h2 {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #f2c48d;
}
.empty {
  margin: 0;
  font-size: 13px;
  opacity: 0.8;
}
button {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: calc(100% + 16px);
  margin: 0 -8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
button[aria-current='true'] {
  background: rgb(255 255 255 / 8%);
}
button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: -2px;
}
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 2px 8px;
  font-size: 14px;
}
.badge {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: #c0392b;
  color: #fff;
}
.badge[data-state='care'] {
  background: #f2c48d;
  color: #2b2420;
}
.progress {
  font-size: 12px;
  opacity: 0.8;
}
small {
  font-size: 12px;
  opacity: 0.8;
}
.bar {
  display: block;
  height: 4px;
  border-radius: 2px;
  background: rgb(255 255 255 / 12%);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: #8bc34a;
}
.bar[data-ripe='true'] span {
  background: #c0392b;
}
@media (max-width: 480px) {
  .fields {
    padding: 10px 12px;
  }
  h2 {
    font-size: 11px;
    letter-spacing: 0.04em;
  }
}
</style>
