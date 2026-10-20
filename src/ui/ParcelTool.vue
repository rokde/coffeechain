<script setup lang="ts">
import { computed } from 'vue'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { quoteParcels } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import { createSelected, validParcels } from './farmAction'
import de from './i18n/de.json'
import { formatMoney } from './money'

const t = de.parcelTool
const game = useGameStore()
const selection = useSelectionStore()
// validParcels and quoteParcels only read the state, so the cast of the readonly snapshot is safe.
const parcels = computed(() => validParcels(game.state as GameState, 'parcel'))
const cost = computed(() => quoteParcels(game.state as GameState, parcels.value))
const tooExpensive = computed(() => cost.value > game.state.money)
const disabled = computed(() => parcels.value.length === 0 || tooExpensive.value)
</script>

<template>
  <section class="tool" data-testid="parcel-tool">
    <h2>{{ t.heading }}</h2>
    <p class="hint">{{ t.hint }}</p>
    <p v-if="selection.note" class="short" data-testid="tool-note">
      {{ de.toolNote[selection.note] }}
    </p>
    <template v-if="selection.parcels.length > 0">
      <dl>
        <dt>{{ t.count }}</dt>
        <dd data-testid="parcel-tool-count">{{ parcels.length }}</dd>
        <dt>{{ t.total }}</dt>
        <dd data-testid="parcel-tool-total">{{ formatMoney(cost) }}</dd>
      </dl>
      <p v-if="tooExpensive" class="short" data-testid="parcel-tool-short">{{ t.tooExpensive }}</p>
      <button
        type="button"
        data-testid="parcel-tool-create"
        :disabled="disabled"
        @click="createSelected"
      >
        {{ t.create }}
      </button>
    </template>
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
.short {
  margin: -8px 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #f29b8d;
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
