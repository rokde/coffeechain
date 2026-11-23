<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../app/store'
import { balance } from '../../sim/balance'
import type { Variety } from '../../sim/farm/yield'
import { bankSellPrice, priceHistory } from '../../sim/market/market'
import { isVarietyUnlocked } from '../../sim/progression/capital'
import type { GameState } from '../../sim/state'
import de from '../i18n/de.json'
import PriceChart from './PriceChart.vue'
import { formatPrice } from './sellTicket'

// Seed as the market showed it before #20: stock, price and price history per variety.
// The seed purchase in the panel follows with #26.
const t = de.marketPanel.seed
const game = useGameStore()
const cfg = balance()

const rows = computed(() => {
  // The sim functions only read the state, so the cast of the readonly snapshot is safe.
  const state = game.state as GameState
  return (Object.keys(cfg.varieties) as Variety[])
    .filter(
      (v) => isVarietyUnlocked(state, v) || state.storage.batches.some((b) => b.variety === v),
    )
    .map((variety) => ({
      variety,
      seeds: state.market.seeds[variety] ?? 0,
      price: formatPrice(bankSellPrice(state, variety)),
      reference: cfg.varieties[variety].seedCost,
      history: priceHistory(state, { kind: 'seed', variety }),
    }))
})
</script>

<template>
  <div class="seed" data-testid="market-seed">
    <p class="lead">{{ t.lead }}</p>
    <article v-for="r in rows" :key="r.variety" class="good" :data-testid="`seed-${r.variety}`">
      <h3>{{ de.inspector.varieties[r.variety] }}</h3>
      <dl>
        <dt>{{ t.stock }}</dt>
        <dd data-testid="seed-stock">{{ r.seeds }}</dd>
        <dt>{{ t.price }}</dt>
        <dd data-testid="seed-price">{{ r.price }}</dd>
      </dl>
      <h4>{{ t.chartHeading.replace('{months}', String(r.history.length)) }}</h4>
      <PriceChart
        :history="r.history"
        :reference="r.reference"
        :after="null"
        :day="game.state.time.day"
      />
    </article>
  </div>
</template>

<style scoped>
.lead {
  margin: 10px 0 2px;
  max-width: 68ch;
  font-size: 13px;
  color: var(--fg-2);
}
.good {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgb(255 255 255 / 5%);
}
h3 {
  margin: 0 0 6px;
  font-size: 15px;
}
h4 {
  margin: 8px 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-2);
}
dl {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  gap: 4px 10px;
  margin: 0;
  font-size: 13px;
}
dt {
  color: var(--fg-2);
}
dd {
  margin: 0;
  font-weight: 700;
  white-space: nowrap;
}
@media (max-width: 480px) {
  dl {
    grid-template-columns: auto 1fr;
  }
}
</style>
