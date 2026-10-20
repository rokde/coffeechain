<script setup lang="ts">
import { computed } from 'vue'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { forecastYield } from '../sim/farm/forecast'
import type { GameState } from '../sim/state'
import { inspectParcel } from '../sim/world/inspect'
import type { World } from '../sim/world/types'
import de from './i18n/de.json'

const t = de.inspector
const game = useGameStore()
const selection = useSelectionStore()
const info = computed(() => {
  const p = selection.parcel
  // inspectParcel only reads the world, so the cast of the readonly snapshot is safe.
  return p && inspectParcel(game.state.world as World, p.x, p.y)
})
const forecast = computed(() => {
  const p = selection.parcel
  return p ? forecastYield(game.state as GameState, p.x, p.y) : null
})
</script>

<template>
  <section v-if="selection.parcel && info" class="inspector" data-testid="parcel-inspector">
    <header>
      <div>
        <h2>{{ t.heading }}</h2>
        <p class="title">
          {{
            t.position
              .replace('{x}', String(selection.parcel.x))
              .replace('{y}', String(selection.parcel.y))
          }}
        </p>
      </div>
      <button
        type="button"
        data-testid="inspector-close"
        :aria-label="t.close"
        @click="selection.parcel = null"
      >
        ×
      </button>
    </header>
    <dl>
      <dt>{{ t.zone }}</dt>
      <dd data-testid="inspector-zone">{{ t.zones[info.zone] }}</dd>
      <dt>{{ t.soilClass }}</dt>
      <dd data-testid="inspector-soil">{{ t.soilClasses[info.soilClass] }}</dd>
      <dt>{{ t.variety }}</dt>
      <dd data-testid="inspector-variety">
        {{ info.variety ? t.varieties[info.variety] : t.noVariety }}
      </dd>
      <dt>{{ t.terrain }}</dt>
      <dd data-testid="inspector-buildable">
        {{ info.buildable ? t.buildable : t.notBuildable }}
      </dd>
      <template v-if="forecast !== null">
        <dt>{{ t.yield }}</dt>
        <dd data-testid="inspector-yield">{{ t.yieldUnits.replace('{n}', String(forecast)) }}</dd>
      </template>
    </dl>
  </section>
</template>

<style scoped>
.inspector {
  padding: 20px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
h2 {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #f2c48d;
}
.title {
  margin: 4px 0 0;
  font-size: 20px;
  font-weight: 700;
}
button {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  font-size: 20px;
  cursor: pointer;
}
button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px 16px;
  margin: 0;
  font-size: 14px;
}
dt {
  opacity: 0.8;
}
dd {
  margin: 0;
  font-weight: 600;
}
</style>
