<script setup lang="ts">
import { computed } from 'vue'
import { processUnits } from '../../app/market'
import { useGameStore } from '../../app/store'
import { balance } from '../../sim/balance'
import type { Variety } from '../../sim/farm/yield'
import { bankBuyPrice, bankReferencePrice, priceHistory } from '../../sim/market/market'
import { hasProcessing, isRunning, processCost, runningUntil } from '../../sim/processing/process'
import type { GameState } from '../../sim/state'
import { formatDate } from '../date'
import de from '../i18n/de.json'
import { formatMoney } from '../money'
import PriceChart from './PriceChart.vue'
import {
  clampAmount,
  direction,
  formatChange,
  formatPrice,
  presetAmount,
  PRESETS,
  sellPreview,
} from './sellTicket'

const props = defineProps<{
  variety: Variety
  washed: boolean
  // Sellable units of the good.
  max: number
  // Chosen amount, from 0 to max.
  amount: number
}>()
const emit = defineEmits<{ 'update:amount': [units: number]; sold: [] }>()

const t = de.marketPanel.ticket
const game = useGameStore()
const cfg = balance()
const id = computed(() => `ticket-${props.variety}-${props.washed ? 'washed' : 'raw'}`)
const money = (cents: number) => formatMoney(cents).replace(' ', ' ')
const setAmount = (value: number) => emit('update:amount', clampAmount(value, props.max))
const onInput = (event: Event) => setAmount(Number((event.target as HTMLInputElement).value))

const v = computed(() => {
  // The sim functions only read the state, so the cast of the readonly snapshot is safe.
  const state = game.state as GameState
  const { variety, washed, max } = props
  const units = clampAmount(props.amount, max)
  const preview = sellPreview(state, variety, washed, units, max)
  const reference = bankReferencePrice(variety, washed)
  const history = priceHistory(state, { kind: washed ? 'washed' : 'coffee', variety }).map(
    (p) => p * cfg.market.bankBuyFactor,
  )
  const list = preview.batches
    .map((b) => t.batch.replace('{units}', String(b.units)).replace('{quality}', String(b.quality)))
    .join(', ')
  // Washed units in a running processing: sellable from their ready day on.
  const day = state.time.day
  const running = state.storage.batches.filter(
    (b) => b.variety === variety && b.washed === true && isRunning(b, day),
  )
  const runningUnits = running.reduce((n, b) => n + b.units, 0)
  const until = runningUntil(state, variety)
  const runningNote =
    washed && runningUnits > 0 && until !== undefined
      ? t.running
          .replace('{units}', String(runningUnits))
          .replace('{date}', formatDate(until))
          .replace('{days}', String(until - day))
      : null
  return {
    units,
    preview,
    reference,
    history,
    runningNote,
    tooSmall: units > 0 && preview.income === 0,
    cta:
      units === 0
        ? t.choose
        : t.sell.replace('{units}', String(units)).replace('{income}', money(preview.income)),
    batches: units > 0 && list ? t.batches.replace('{list}', list) : t.batchesNone,
  }
})

// "Aufbereiten" in the ticket of raw coffee: one full batch at most, as before.
const processing = computed(() => {
  if (props.washed) return null
  const state = game.state as GameState
  const units = processUnits(state, props.variety)
  const cost = processCost(units)
  const busy = state.storage.batches.some((b) => isRunning(b, state.time.day))
  const why = !hasProcessing(state)
    ? t.processWhy.building
    : busy
      ? t.processWhy.running
      : units === 0
        ? t.processWhy.stock
        : cost > state.money
          ? t.processWhy.money
          : null
  return {
    units,
    why,
    lead: t.processPays.replace(
      '{price}',
      formatPrice(bankBuyPrice(state, props.variety, 0, true)),
    ),
    label:
      units > 0
        ? t.processAmount.replace('{units}', String(units)).replace('{cost}', money(cost))
        : t.process,
  }
})

function sell() {
  const units = v.value.units
  if (units === 0 || v.value.tooSmall) return
  game.dispatch({
    type: 'Sell',
    variety: props.variety,
    units,
    ...(props.washed && { washed: true as const }),
  })
  emit('sold')
}

function process() {
  const p = processing.value
  if (!p || p.why !== null) return
  game.dispatch({ type: 'Process', variety: props.variety, units: p.units })
}
</script>

<template>
  <div class="ticket" :data-testid="`ticket-${variety}-${washed ? 'washed' : 'raw'}`">
    <div v-if="v.runningNote" class="t-notes">
      <p class="hintrow" data-testid="ticket-running">{{ v.runningNote }}</p>
    </div>
    <div class="t-chart">
      <h4>{{ t.chartHeading.replace('{months}', String(v.history.length)) }}</h4>
      <PriceChart
        :history="v.history"
        :reference="v.reference"
        :after="v.units > 0 ? v.preview.after : null"
        :day="game.state.time.day"
      />
      <p class="note">{{ t.chartNote.replace('{price}', formatPrice(v.reference)) }}</p>
    </div>
    <div v-if="max === 0" class="t-form">
      <p class="empty" data-testid="ticket-empty">
        <strong>{{ t.nothing }}</strong>
        <span>{{ v.runningNote ? t.nothingRunning : t.nothingStock }}</span>
      </p>
    </div>
    <div v-else class="t-form">
      <div class="amount">
        <label :for="`${id}-n`">{{ t.amount }}</label>
        <div class="num">
          <input
            :id="`${id}-n`"
            type="number"
            inputmode="numeric"
            min="0"
            :max="max"
            step="1"
            :value="v.units"
            data-testid="ticket-amount"
            @input="onInput"
          />
          <span>{{ t.of.replace('{max}', String(max)) }}</span>
        </div>
        <input
          type="range"
          min="0"
          :max="max"
          step="1"
          :value="v.units"
          :aria-label="t.amount"
          :aria-valuetext="
            t.amountText.replace('{units}', String(v.units)).replace('{max}', String(max))
          "
          :style="{ '--p': `${(v.units / max) * 100}%` }"
          data-testid="ticket-range"
          @input="onInput"
        />
        <div class="presets" role="group" :aria-label="t.presetsLabel">
          <button
            v-for="(share, i) in PRESETS"
            :key="share"
            type="button"
            :aria-pressed="v.units === presetAmount(max, share)"
            :data-testid="`ticket-preset-${share}`"
            @click="setAmount(presetAmount(max, share))"
          >
            {{ t.presets[i] }}
          </button>
        </div>
      </div>
      <dl class="preview" aria-live="polite" data-testid="ticket-preview">
        <dt class="total">{{ t.income }}</dt>
        <dd class="total" data-testid="preview-income">{{ money(v.preview.income) }}</dd>
        <dt>{{ t.average }}</dt>
        <dd data-testid="preview-average">{{ formatPrice(v.preview.average, 3) }}</dd>
        <dt>{{ t.after }}</dt>
        <dd data-testid="preview-after">
          {{ formatPrice(v.preview.after, 3)
          }}<small v-if="v.units > 0" :class="direction(v.preview.change)">{{
            formatChange(v.preview.change)
          }}</small>
        </dd>
        <dt>{{ t.rest }}</dt>
        <dd data-testid="preview-rest">{{ t.units.replace('{units}', String(v.preview.rest)) }}</dd>
      </dl>
    </div>
    <div v-if="processing" class="t-second">
      <p :id="`${id}-process`">
        <b>{{ t.processLead }}</b> {{ processing.lead }}
        <template v-if="processing.why">
          {{ t.processBlocked.replace('{why}', processing.why) }}</template
        >
      </p>
      <button
        type="button"
        class="btn"
        data-testid="ticket-process"
        :disabled="processing.why !== null"
        :aria-describedby="`${id}-process`"
        @click="process"
      >
        {{ processing.label }}
      </button>
    </div>
    <div v-if="max > 0" class="t-actions">
      <button
        type="button"
        class="btn primary"
        data-testid="ticket-sell"
        :disabled="v.units === 0 || v.tooSmall"
        :aria-describedby="`${id}-lots`"
        @click="sell"
      >
        {{ v.cta }}
      </button>
      <p :id="`${id}-lots`" class="why" data-testid="ticket-batches">
        {{ v.tooSmall ? t.tooSmall : v.batches }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Wide: the chart on the left, amount and preview on the right, the actions below. */
.ticket {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px 20px;
  padding: 6px 12px 14px;
}
h4 {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-2);
}
.note {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--fg-3);
}
.t-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.amount label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-2);
}
.num {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--fg-2);
}
.num input {
  box-sizing: border-box;
  width: 92px;
  height: 44px;
  padding: 0 10px;
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 8px;
  background: rgb(0 0 0 / 25%);
  color: var(--hud-fg);
  font: inherit;
  font-size: 18px;
  font-weight: 700;
  text-align: right;
}
.presets {
  display: flex;
  gap: 6px;
}
button {
  border: 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.presets button {
  flex: 1;
  min-height: 36px;
  padding: 0 8px;
  font-size: 13px;
  white-space: nowrap;
}
.presets button[aria-pressed='true'] {
  background: var(--accent);
  color: var(--on-accent);
}
:is(button, input):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* Native range input. WebKit fills the track through --p, Firefox through its progress element. */
input[type='range'] {
  --track: 6px;
  --thumb: 22px;
  display: block;
  width: 100%;
  height: 36px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  appearance: none;
  cursor: pointer;
}
input[type='range']::-webkit-slider-runnable-track {
  height: var(--track);
  border-radius: 999px;
  background: linear-gradient(to right, var(--accent) var(--p), rgb(255 255 255 / 28%) var(--p));
}
input[type='range']::-webkit-slider-thumb {
  width: var(--thumb);
  height: var(--thumb);
  margin-top: calc((var(--track) - var(--thumb)) / 2);
  border: 3px solid var(--hud-solid);
  border-radius: 50%;
  background: var(--accent);
  appearance: none;
}
input[type='range']::-moz-range-track {
  height: var(--track);
  border-radius: 999px;
  background: rgb(255 255 255 / 28%);
}
input[type='range']::-moz-range-progress {
  height: var(--track);
  border-radius: 999px;
  background: var(--accent);
}
input[type='range']::-moz-range-thumb {
  width: var(--thumb);
  height: var(--thumb);
  border: 3px solid var(--hud-solid);
  border-radius: 50%;
  background: var(--accent);
}
input[type='range']:focus-visible {
  outline-offset: 0;
}
.preview {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 5px 12px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgb(0 0 0 / 22%);
  font-size: 13px;
}
.preview dt {
  color: var(--fg-2);
}
.preview dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
}
.preview .total {
  font-size: 18px;
}
.preview dt.total {
  font-size: 13px;
  align-self: center;
}
.preview small {
  margin-left: 4px;
  font-weight: 600;
}
.up {
  color: var(--green);
}
.down {
  color: var(--red-fg);
}
.t-notes {
  grid-column: 1 / -1;
}
.hintrow {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgb(242 196 141 / 12%);
  font-size: 13px;
}
.empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  font-size: 13px;
  color: var(--fg-2);
}
.empty strong {
  color: var(--hud-fg);
}
.t-second {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 12px;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}
.t-second p {
  margin: 0;
  font-size: 13px;
  color: var(--fg-2);
}
.t-second b {
  color: var(--hud-fg);
}
/* The main action sticks to the bottom of the list, so it stays in reach without scrolling. */
.t-actions {
  grid-column: 1 / -1;
  position: sticky;
  bottom: 0;
  z-index: 2;
  margin: 0 -12px -14px;
  padding: 10px 12px 14px;
  border-radius: 0 0 10px 10px;
  background: #322e29;
  box-shadow: 0 -1px 0 var(--line);
}
.btn {
  width: 100%;
  min-height: 44px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 700;
}
.btn.primary {
  background: var(--accent);
  color: var(--on-accent);
}
.btn:disabled {
  background: rgb(255 255 255 / 8%);
  color: var(--fg-3);
  cursor: not-allowed;
}
.why {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--fg-2);
}
/* Below 1280 px one column: the amount before the chart, so the preview shows above the button. */
@media (max-width: 1279px) {
  .ticket {
    grid-template-columns: minmax(0, 1fr);
  }
  .t-chart {
    order: 2;
  }
  .t-second {
    order: 3;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .t-actions {
    order: 4;
  }
}
</style>
