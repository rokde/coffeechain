<script setup lang="ts">
import { computed } from 'vue'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { buildMenu } from '../sim/buildings/build'
import type { GameState } from '../sim/state'
import { buildSelected, validParcels } from './farmAction'
import de from './i18n/de.json'
import { formatMoney } from './money'

const t = de.buildTool
const game = useGameStore()
const selection = useSelectionStore()
// buildMenu and validParcels only read the state, so the cast of the readonly snapshot is safe.
const menu = computed(() => buildMenu(game.state as GameState))
const targets = computed(() => validParcels(game.state as GameState, 'build').length)
const hasTarget = computed(() => targets.value > 0)
</script>

<template>
  <section class="tool" data-testid="build-tool">
    <h2>{{ t.heading }}</h2>
    <p class="hint">{{ t.hint }}</p>
    <p v-if="selection.note" class="short" data-testid="tool-note">
      {{ de.toolNote[selection.note] }}
    </p>
    <p v-if="targets > 1" class="hint" data-testid="build-tool-first">{{ t.first }}</p>
    <ul>
      <li v-for="entry in menu" :key="entry.kind" :data-testid="`build-tool-${entry.kind}`">
        <div class="row">
          <strong>{{ t.buildings[entry.kind] }}</strong>
          <span v-if="entry.available" class="cost" data-testid="build-tool-cost">{{
            formatMoney(entry.cost)
          }}</span>
        </div>
        <p v-if="entry.locked" class="short" data-testid="build-tool-locked">
          {{ t.locked.replace('{phase}', String(entry.requiredPhase)) }}
        </p>
        <p v-else-if="!entry.available" class="short" data-testid="build-tool-maxed">
          {{ t.maxed }}
        </p>
        <p v-else-if="entry.cost > game.state.money" class="short" data-testid="build-tool-short">
          {{ t.tooExpensive }}
        </p>
        <button
          type="button"
          class="main"
          :data-testid="`build-tool-build-${entry.kind}`"
          :disabled="
            !hasTarget || entry.locked || !entry.available || entry.cost > game.state.money
          "
          @click="buildSelected(entry.kind)"
        >
          {{ t.build }}
        </button>
      </li>
    </ul>
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
ul {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  justify-content: space-between;
  margin: 0 0 8px;
  font-size: 14px;
}
.row strong,
.cost {
  white-space: nowrap;
}
.cost {
  font-weight: 600;
}
.short {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #f29b8d;
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
