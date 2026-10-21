<script setup lang="ts">
import { computed } from 'vue'
import {
  processAll,
  processUnits,
  sellAll,
  sellAllWashed,
  storedUnits,
  washedUnits,
} from '../app/market'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import type { Variety } from '../sim/farm/yield'
import { bankBuyPrice, bankSellPrice, priceHistory, sellIncome } from '../sim/market/market'
import { isVarietyUnlocked } from '../sim/progression/capital'
import { hasProcessing, isRunning, processCost, runningUntil } from '../sim/processing/process'
import type { GameState } from '../sim/state'
import { clock } from '../sim/time/time'
import de from './i18n/de.json'
import { formatMoney, formatUnitPrice } from './money'
import OrdersPanel from './OrdersPanel.vue'

const t = de.marketPanel
const game = useGameStore()
const cfg = balance()
// The sim functions only read the state, so the cast of the readonly snapshot is safe.
const varieties = computed(() =>
  (Object.keys(cfg.varieties) as Variety[]).filter(
    (v) =>
      isVarietyUnlocked(game.state as GameState, v) ||
      game.state.storage.batches.some((b) => b.variety === v),
  ),
)
const price = (cc: number) => formatUnitPrice(Math.round(cc * 100))
const hint = t.hint.replace('{units}', String(Math.round(1 / cfg.storage.costPerUnitPerDay)))
const money = (cents: number) => formatMoney(cents).replace(' ', '\u00a0')
// Label and zero-income warning of a sell button. A sale that pays 0 CC stays possible.
const sale = (state: GameState, variety: Variety, units: number, washed: boolean) => {
  const income = sellIncome(state, variety, units, washed)
  return {
    label:
      units > 0
        ? (washed ? t.sellWashedAmount : t.sellAmount)
            .replace('{units}', String(units))
            .replace('{income}', money(income))
        : washed
          ? t.sellWashed
          : t.sell,
    why: units > 0 && income === 0 ? t.sellZero : null,
  }
}
const lineLabel = (text: string) => text.replace('{days}', String(cfg.market.historyDays))

const W = 100
const H = 40
// Polyline points of one price line. A flat line sits in the middle.
function points(prices: number[]) {
  const min = Math.min(...prices)
  const span = Math.max(...prices) - min
  return prices
    .map((p, i) => {
      const y = span === 0 ? H / 2 : H - 2 - ((p - min) / span) * (H - 4)
      return `${(i * W) / (prices.length - 1)},${y}`
    })
    .join(' ')
}

const blocks = computed(() => {
  // The sim functions only read the state, so the cast of the readonly snapshot is safe.
  const state = game.state as GameState
  const busy = state.storage.batches.some((b) => isRunning(b, state.time.hour))
  return varieties.value.map((variety) => {
    const units = processUnits(state, variety)
    const until = runningUntil(state, variety)
    const cost = processCost(units)
    const stock = storedUnits(state, variety)
    const washed = washedUnits(state, variety)
    return {
      variety,
      stock,
      washed,
      sell: sale(state, variety, stock, false),
      sellWashed: sale(state, variety, washed, true),
      washedPrice: bankBuyPrice(state, variety, 0, true),
      processLabel:
        units > 0
          ? t.processAmount.replace('{units}', String(units)).replace('{cost}', money(cost))
          : t.process,
      // The first reason that blocks "Aufbereiten". The money check keeps a click from a throw.
      processWhy: !hasProcessing(state)
        ? t.processWhy.building
        : busy
          ? t.processWhy.running
          : units === 0
            ? t.processWhy.stock
            : cost > state.money
              ? t.processWhy.money
              : null,
      runningUntil:
        until === undefined ? null : t.processing.replace('{day}', String(clock(until).day)),
      seeds: state.market.seeds[variety] ?? 0,
      sellPrice: bankBuyPrice(state, variety),
      buyPrice: bankSellPrice(state, variety),
      coffeeLine: points(
        priceHistory(state, { kind: 'coffee', variety }).map((p) => p * cfg.market.bankBuyFactor),
      ),
      seedLine: points(priceHistory(state, { kind: 'seed', variety })),
    }
  })
})
</script>

<template>
  <section class="tool" data-testid="market-panel">
    <h2>{{ t.heading }}</h2>
    <p class="hint" data-testid="market-hint">{{ hint }}</p>
    <OrdersPanel />
    <article v-for="b in blocks" :key="b.variety" class="good" :data-testid="`market-${b.variety}`">
      <h3>{{ de.inspector.varieties[b.variety] }}</h3>
      <dl>
        <dt>{{ t.stock }}</dt>
        <dd data-testid="market-stock">{{ b.stock }}</dd>
        <dt>{{ t.seeds }}</dt>
        <dd data-testid="market-seeds">{{ b.seeds }}</dd>
        <dt>{{ t.sellPrice }}</dt>
        <dd data-testid="market-sell-price">{{ price(b.sellPrice) }}</dd>
        <dt>{{ t.buyPrice }}</dt>
        <dd data-testid="market-buy-price">{{ price(b.buyPrice) }}</dd>
        <dt>{{ t.washedStock }}</dt>
        <dd data-testid="market-washed-stock">{{ b.washed }}</dd>
        <dt>{{ t.washedSellPrice }}</dt>
        <dd data-testid="market-washed-sell-price">{{ price(b.washedPrice) }}</dd>
      </dl>
      <div class="lines">
        <figure v-for="line in ['coffee', 'seed'] as const" :key="line">
          <figcaption>{{ lineLabel(line === 'coffee' ? t.coffeeLine : t.seedLine) }}</figcaption>
          <svg
            :viewBox="`0 0 ${W} ${H}`"
            preserveAspectRatio="none"
            role="img"
            :aria-label="lineLabel(line === 'coffee' ? t.coffeeLine : t.seedLine)"
            :data-testid="`market-line-${line}`"
          >
            <polyline
              :points="line === 'coffee' ? b.coffeeLine : b.seedLine"
              fill="none"
              stroke="#f2c48d"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        </figure>
      </div>
      <button
        type="button"
        data-testid="market-sell"
        :disabled="b.stock === 0"
        :title="b.sell.why ?? undefined"
        :aria-label="b.sell.why ? `${b.sell.label}. ${b.sell.why}` : undefined"
        @click="sellAll(game, b.variety)"
      >
        {{ b.sell.label }}
      </button>
      <button
        type="button"
        data-testid="market-process"
        :disabled="b.processWhy !== null"
        :title="b.processWhy ?? undefined"
        :aria-label="b.processWhy ? `${b.processLabel}. ${b.processWhy}` : undefined"
        @click="processAll(game, b.variety)"
      >
        {{ b.processLabel }}
      </button>
      <p v-if="b.runningUntil" class="running" data-testid="market-processing">
        {{ b.runningUntil }}
      </p>
      <button
        type="button"
        data-testid="market-sell-washed"
        :disabled="b.washed === 0"
        :title="b.sellWashed.why ?? undefined"
        :aria-label="b.sellWashed.why ? `${b.sellWashed.label}. ${b.sellWashed.why}` : undefined"
        @click="sellAllWashed(game, b.variety)"
      >
        {{ b.sellWashed.label }}
      </button>
    </article>
  </section>
</template>

<style scoped>
.tool {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
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
  margin: 8px 0 8px;
  font-size: 13px;
  opacity: 0.8;
}
.good {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgb(255 255 255 / 6%);
}
h3 {
  margin: 0 0 6px;
  font-size: 14px;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  gap: 4px 10px;
  margin: 0 0 8px;
  font-size: 13px;
}
dt {
  opacity: 0.8;
}
dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}
.running {
  margin: 8px 0;
  font-size: 13px;
}
.lines {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}
figure {
  flex: 1;
  margin: 0;
}
figcaption {
  font-size: 11px;
  opacity: 0.8;
}
svg {
  display: block;
  width: 100%;
  height: 28px;
  border-bottom: 1px solid rgb(255 255 255 / 12%);
}
button + button {
  margin-top: 8px;
}
button {
  width: 100%;
  min-height: 34px;
  padding: 6px 10px;
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
@media (max-width: 480px) {
  .tool {
    padding: 12px;
  }
  /* Room for the label "(gewaschen)" without a hyphen. */
  .good {
    padding: 10px 8px;
  }
  dl {
    grid-template-columns: auto 1fr;
    column-gap: 6px;
  }
  .lines {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
