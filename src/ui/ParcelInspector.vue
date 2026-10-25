<script setup lang="ts">
import { computed } from 'vue'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { quoteCare } from '../sim/farm/care'
import { forecastYield } from '../sim/farm/forecast'
import { isFree, quoteParcels } from '../sim/farm/parcels'
import { fieldStatus } from '../sim/farm/status'
import type { GameState } from '../sim/state'
import { inspectParcel } from '../sim/world/inspect'
import type { World } from '../sim/world/types'
import { careParcel } from './farmAction'
import de from './i18n/de.json'
import { formatMoney } from './money'

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

// S21e field status: growth, ripe days and open cares of a planted parcel.
const status = computed(() => {
  const p = selection.parcel
  return p ? fieldStatus(game.state as GameState, p.x, p.y) : null
})
const days = computed(() => {
  const s = status.value
  if (!s) return null
  const [n, many, one] =
    s.daysToRipe !== null
      ? [s.daysToRipe, t.daysToRipe, t.daysToRipeOne]
      : [s.daysToOverripe, t.daysToOverripe, t.daysToOverripeOne]
  if (n === null) return null
  return n === 1 ? one : many.replace('{n}', String(n))
})
const careDone = computed(() => {
  const s = status.value
  if (!s) return ''
  const done = (Object.keys(t.careDone) as (keyof typeof t.careDone)[]).filter((c) => s.cares[c])
  return done.length ? done.map((c) => t.careDone[c]).join(', ') : t.careNone
})
const careCost = (command: 'Fertilize' | 'Irrigate') =>
  quoteCare(game.state as GameState, { type: command, parcels: [selection.parcel!] })

// Only for a parcel that the farm can buy.
const price = computed(() => {
  const p = selection.parcel
  const state = game.state as GameState
  const owned = p && p.y * state.world.size + p.x in state.farm.parcels
  return p && !owned && isFree(state, p.x, p.y) ? quoteParcels(state, [p]) : null
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
      <dt :title="t.tips.zone">{{ t.zone }}</dt>
      <dd data-testid="inspector-zone">{{ t.zones[info.zone] }}</dd>
      <dt :title="t.tips.soilClass">{{ t.soilClass }}</dt>
      <dd data-testid="inspector-soil">{{ t.soilClasses[info.soilClass] }}</dd>
      <dt :title="t.tips.variety">{{ t.variety }}</dt>
      <dd data-testid="inspector-variety">
        {{ info.variety ? t.varieties[info.variety] : t.noVariety }}
      </dd>
      <dt :title="t.tips.terrain">{{ t.terrain }}</dt>
      <dd data-testid="inspector-buildable">
        {{ info.buildable ? t.buildable : t.notBuildable }}
      </dd>
      <template v-if="forecast !== null">
        <dt :title="t.tips.yield">{{ t.yield }}</dt>
        <dd data-testid="inspector-yield">{{ t.yieldUnits.replace('{n}', String(forecast)) }}</dd>
      </template>
      <!-- S21e field status -->
      <template v-if="status">
        <dt :title="t.tips.stage">{{ t.stage }}</dt>
        <dd data-testid="inspector-stage">
          {{ status.overripe ? t.overripe : t.stages[status.stage] }}
        </dd>
        <dt :title="t.tips.growth">{{ t.growth }}</dt>
        <dd data-testid="inspector-growth">
          {{ t.percent.replace('{n}', String(status.percent)) }}
        </dd>
        <template v-if="days">
          <dt :title="t.tips.ripeness">{{ t.ripeness }}</dt>
          <dd data-testid="inspector-days">{{ days }}</dd>
        </template>
        <dt :title="t.tips.care">{{ t.care }}</dt>
        <dd data-testid="inspector-care">{{ careDone }}</dd>
      </template>
      <template v-if="price !== null">
        <dt :title="t.tips.price">{{ t.price }}</dt>
        <dd data-testid="inspector-price">{{ formatMoney(price) }}</dd>
      </template>
    </dl>
    <!-- S21e open cares -->
    <div v-if="status && status.open.length" class="care">
      <p v-for="c in status.open" :key="c" data-testid="inspector-care-hint">
        {{ t.careHints[c] }}
      </p>
      <div class="care-actions">
        <button
          v-for="c in status.open"
          :key="c"
          type="button"
          data-testid="inspector-care-action"
          :disabled="careCost(c) > game.state.money"
          :title="
            careCost(c) > game.state.money
              ? t.careTooExpensive.replace('{cost}', formatMoney(careCost(c)))
              : undefined
          "
          @click="careParcel(c, selection.parcel)"
        >
          {{ t.careActions[c] }}
        </button>
      </div>
    </div>
  </section>
  <p v-else class="empty" data-testid="inspector-empty">{{ t.empty }}</p>
</template>

<style scoped>
.inspector {
  padding: 20px;
}
.empty {
  margin: 0;
  padding: 20px;
  font-size: 13px;
  opacity: 0.8;
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
.care p {
  margin: 12px 0 0;
  font-size: 13px;
  opacity: 0.8;
}
.care-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.care-actions button {
  flex: 1 1 auto;
  width: auto;
  min-height: 44px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 600;
}
.care-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
dd {
  min-width: 0;
  margin: 0;
  font-weight: 600;
  overflow-wrap: break-word;
}
/* The right panel is narrow on a phone, so each value goes below its label. */
@media (max-width: 480px) {
  dl {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  dd {
    margin-bottom: 8px;
  }
}
</style>
