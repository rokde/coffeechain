<script setup lang="ts">
import { useViewStore } from '../app/view'
import { balance } from '../sim/balance'
import de from './i18n/de.json'
import { overlays, tools } from './toolbar'

const view = useViewStore()

const num = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) =>
    typeof values[key] === 'number' ? num.format(values[key]) : (values[key] ?? `{${key}}`),
  )
const cfg = balance()
const w = cfg.processing.washed
const st = cfg.storage
const washing = de.help.washing.map((text) =>
  fill(text, {
    cost: w.buildCost,
    phase: w.requiresPhase,
    batch: w.batchCapacity,
    unitCost: w.costPerUnit,
    days: w.durationDays,
    dayUnit: w.durationDays === 1 ? de.help.dayOne : de.help.dayMany,
    factor: w.valueMultiplier,
    // Washing pays when raw price * (multiplier - 1) is more than the cost per unit.
    breakEven: w.costPerUnit / (w.valueMultiplier - 1),
  }),
)
const storage = [
  ...de.help.storage.map((text) => fill(text, { start: st.startCapacity })),
  ...st.upgrades.map((u, i) =>
    fill(de.help.storageStage, {
      n: i + 1,
      capacity: u.capacity,
      cost: u.cost,
      phase: u.requiresPhase,
    }),
  ),
  ...de.help.storageAfter.map((text) =>
    fill(text, {
      units: Math.round(1 / st.costPerUnitPerDay),
      loss: st.qualityLossPerDayRaw,
    }),
  ),
]
</script>

<template>
  <div class="backdrop">
    <section
      class="help"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-heading"
      data-testid="help-overlay"
    >
      <header>
        <h2 id="help-heading">{{ de.help.heading }}</h2>
        <button
          type="button"
          data-testid="help-close"
          :aria-label="de.help.close"
          @click="view.toggleHelp()"
        >
          ×
        </button>
      </header>
      <h3>{{ de.help.loopHeading }}</h3>
      <ol data-testid="help-loop">
        <li v-for="step in de.help.loop" :key="step.name">
          <strong>{{ step.name }}</strong> {{ step.text }}
        </li>
      </ol>
      <h3>{{ de.help.washingHeading }}</h3>
      <ol data-testid="help-washing">
        <li v-for="text in washing" :key="text">{{ text }}</li>
      </ol>
      <h3>{{ de.help.storageHeading }}</h3>
      <ol data-testid="help-storage">
        <li v-for="text in storage" :key="text">{{ text }}</li>
      </ol>
      <h3>{{ de.help.controlsHeading }}</h3>
      <dl data-testid="help-controls">
        <template v-for="row in de.help.controls" :key="row.keys">
          <dt>{{ row.keys }}</dt>
          <dd>{{ row.text }}</dd>
        </template>
        <template v-for="tool in tools" :key="tool.id">
          <dt>{{ tool.key }}</dt>
          <dd>{{ de.help.toolKey.replace('{label}', tool.label) }}</dd>
        </template>
        <template v-for="overlay in overlays" :key="overlay.id">
          <dt>{{ overlay.key }}</dt>
          <dd>{{ de.help.overlayKey.replace('{label}', overlay.title) }}</dd>
        </template>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: rgb(0 0 0 / 50%);
  pointer-events: auto;
}
.help {
  box-sizing: border-box;
  width: min(520px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 16px 20px;
  border-radius: 12px;
  background: var(--hud-bg);
  color: var(--hud-fg);
  font-size: 14px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  margin: 0;
  font-size: 20px;
}
h3 {
  margin: 16px 0 8px;
  font-size: 15px;
  color: #f2c48d;
}
button {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  font: inherit;
  font-size: 22px;
  cursor: pointer;
}
button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
ol {
  margin: 0;
  padding-left: 20px;
}
li {
  margin-bottom: 4px;
}
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0;
}
dt {
  font-weight: 600;
}
dd {
  margin: 0;
}
@media (max-width: 480px) {
  dl {
    grid-template-columns: 1fr;
    gap: 0;
  }
  dd {
    margin-bottom: 6px;
  }
}
</style>
