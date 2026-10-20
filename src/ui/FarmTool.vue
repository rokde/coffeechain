<script setup lang="ts">
import { computed } from 'vue'
import { farmTools, useSelectionStore, type FarmTool } from '../app/selection'
import { useGameStore } from '../app/store'
import { quoteCare } from '../sim/farm/care'
import type { GameState } from '../sim/state'
import { farmSelected, validParcels } from './farmAction'
import de from './i18n/de.json'
import { formatMoney } from './money'

const t = de.farmTool
const game = useGameStore()
const selection = useSelectionStore()
// Hud.vue shows this panel only for a farm tool.
const tool = computed(() => selection.tool as FarmTool)
// validParcels and quoteCare only read the state, so the cast of the readonly snapshot is safe.
const parcels = computed(() => validParcels(game.state as GameState, tool.value))
const cost = computed(() => {
  const type = farmTools[tool.value]
  return type === 'Harvest'
    ? 0
    : quoteCare(game.state as GameState, { type, parcels: parcels.value })
})
const tooExpensive = computed(() => cost.value > game.state.money)
const disabled = computed(() => parcels.value.length === 0 || tooExpensive.value)
</script>

<template>
  <section class="tool" data-testid="farm-tool">
    <h2>{{ t[tool].heading }}</h2>
    <p class="hint">{{ t[tool].hint }}</p>
    <dl>
      <dt>{{ t.count }}</dt>
      <dd data-testid="farm-tool-count">{{ parcels.length }}</dd>
      <template v-if="tool !== 'harvest'">
        <dt>{{ t.total }}</dt>
        <dd data-testid="farm-tool-total">{{ formatMoney(cost) }}</dd>
      </template>
    </dl>
    <p v-if="tooExpensive" class="short" data-testid="farm-tool-short">{{ t.tooExpensive }}</p>
    <button
      type="button"
      class="main"
      data-testid="farm-tool-apply"
      :disabled="disabled"
      @click="farmSelected(tool)"
    >
      {{ t[tool].action }}
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
.main {
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
.main:disabled {
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
