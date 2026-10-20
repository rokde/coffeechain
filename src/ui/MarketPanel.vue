<script setup lang="ts">
import { computed } from 'vue'
import { sellAll, storedUnits } from '../app/market'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import type { Variety } from '../sim/farm/yield'
import { bankBuyPrice, bankSellPrice, priceHistory } from '../sim/market/market'
import type { GameState } from '../sim/state'
import de from './i18n/de.json'
import { formatMoney } from './money'
import OrdersPanel from './OrdersPanel.vue'

const t = de.marketPanel
const game = useGameStore()
const cfg = balance()
const varieties = (Object.keys(cfg.varieties) as Variety[]).filter(
  (v) => cfg.varieties[v].unlockCapital === 0,
)
const price = (cc: number) => formatMoney(Math.round(cc * 100))
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
  return varieties.map((variety) => ({
    variety,
    stock: storedUnits(state, variety),
    seeds: state.market.seeds[variety] ?? 0,
    sellPrice: bankBuyPrice(state, variety),
    buyPrice: bankSellPrice(state, variety),
    coffeeLine: points(
      priceHistory(state, { kind: 'coffee', variety }).map((p) => p * cfg.market.bankBuyFactor),
    ),
    seedLine: points(priceHistory(state, { kind: 'seed', variety })),
  }))
})
</script>

<template>
  <section class="tool" data-testid="market-panel">
    <h2>{{ t.heading }}</h2>
    <p class="hint">{{ t.hint }}</p>
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
        @click="sellAll(game, b.variety)"
      >
        {{ t.sell }}
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
button {
  width: 100%;
  height: 34px;
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
  dl {
    grid-template-columns: auto 1fr;
  }
  .lines {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
