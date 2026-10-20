<script setup lang="ts">
import { computed } from 'vue'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { quoteParcels } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import de from './i18n/de.json'
import { formatMoney } from './money'

const t = de.parcelTool
const game = useGameStore()
const selection = useSelectionStore()
// quoteParcels only reads the state, so the cast of the readonly snapshot is safe.
const cost = computed(() => quoteParcels(game.state as GameState, selection.parcels))
const disabled = computed(() => selection.parcels.length === 0 || cost.value > game.state.money)

function create() {
  game.dispatch({ type: 'CreateParcels', parcels: selection.parcels })
  selection.parcels = []
}
</script>

<template>
  <section class="tool" data-testid="parcel-tool">
    <h2>{{ t.heading }}</h2>
    <p class="hint">{{ t.hint }}</p>
    <dl>
      <dt>{{ t.count }}</dt>
      <dd data-testid="parcel-tool-count">{{ selection.parcels.length }}</dd>
      <dt>{{ t.total }}</dt>
      <dd data-testid="parcel-tool-total">{{ formatMoney(cost) }}</dd>
    </dl>
    <button type="button" data-testid="parcel-tool-create" :disabled="disabled" @click="create">
      {{ t.create }}
    </button>
  </section>
</template>

<style scoped>
.tool {
  padding: 20px;
}
h2 {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #f2c48d;
}
.hint {
  margin: 8px 0 16px;
  font-size: 13px;
  opacity: 0.8;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px 16px;
  margin: 0 0 20px;
  font-size: 14px;
}
dt {
  opacity: 0.8;
}
dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
}
button {
  width: 100%;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: #f2c48d;
  color: #2b2420;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  background: rgb(255 255 255 / 8%);
  color: inherit;
  opacity: 0.6;
  cursor: not-allowed;
}
button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
</style>
