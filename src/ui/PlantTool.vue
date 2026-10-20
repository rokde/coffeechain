<script setup lang="ts">
import { computed } from 'vue'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { quotePlant } from '../sim/farm/plants'
import type { GameState } from '../sim/state'
import de from './i18n/de.json'
import { formatMoney } from './money'
import { plantSelected, plantVarieties } from './plantAction'

const t = de.plantTool
const game = useGameStore()
const selection = useSelectionStore()
// quotePlant only reads the state, so the cast of the readonly snapshot is safe.
const cost = computed(() =>
  quotePlant(game.state as GameState, selection.variety, selection.parcels.length),
)
const tooExpensive = computed(() => cost.value > game.state.money)
const disabled = computed(() => selection.parcels.length === 0 || tooExpensive.value)
</script>

<template>
  <section class="tool" data-testid="plant-tool">
    <h2>{{ t.heading }}</h2>
    <p class="hint">{{ t.hint }}</p>
    <div class="varieties" role="group" :aria-label="t.variety">
      <button
        v-for="v in plantVarieties"
        :key="v"
        type="button"
        :data-testid="`plant-tool-variety-${v}`"
        :aria-pressed="selection.variety === v"
        @click="selection.variety = v"
      >
        {{ de.inspector.varieties[v] }}
      </button>
    </div>
    <dl>
      <dt>{{ t.count }}</dt>
      <dd data-testid="plant-tool-count">{{ selection.parcels.length }}</dd>
      <dt>{{ t.total }}</dt>
      <dd data-testid="plant-tool-total">{{ formatMoney(cost) }}</dd>
    </dl>
    <p v-if="tooExpensive" class="short" data-testid="plant-tool-short">{{ t.tooExpensive }}</p>
    <button
      type="button"
      class="main"
      data-testid="plant-tool-plant"
      :disabled="disabled"
      @click="plantSelected"
    >
      {{ t.plant }}
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
.varieties {
  display: flex;
  gap: 4px;
  margin: 0 0 16px;
  padding: 2px;
  border-radius: 10px;
  background: rgb(255 255 255 / 8%);
}
.varieties button {
  flex: 1;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.varieties button[aria-pressed='true'] {
  background: #f2c48d;
  color: #2b2420;
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
