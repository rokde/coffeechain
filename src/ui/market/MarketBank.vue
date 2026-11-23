<script setup lang="ts">
import { computed, ref } from 'vue'
import { storedUnits, washedUnits } from '../../app/market'
import { useGameStore } from '../../app/store'
import { balance } from '../../sim/balance'
import type { Variety } from '../../sim/farm/yield'
import { bankBuyPrice, bankReferencePrice, priceHistory } from '../../sim/market/market'
import { isRunning } from '../../sim/processing/process'
import { isVarietyUnlocked } from '../../sim/progression/capital'
import type { GameState } from '../../sim/state'
import de from '../i18n/de.json'
import SellTicket from './SellTicket.vue'
import { direction, formatChange, formatPrice, trend } from './sellTicket'

const t = de.marketPanel.bank
const game = useGameStore()
const cfg = balance()
const lead = t.lead.replace('{days}', String(cfg.market.volumeHalfLifeDays))

// One row per good: variety × raw / washed. Only one ticket is open at a time.
// Until the player opens or closes a row, the first row with sellable stock is open.
const open = ref<string | null | undefined>(undefined)
// Chosen amount per good. A good without one sells "Alles".
const amounts = ref<Record<string, number>>({})

const groups = computed(() => {
  // The sim functions only read the state, so the cast of the readonly snapshot is safe.
  const state = game.state as GameState
  const day = state.time.day
  const varieties = (Object.keys(cfg.varieties) as Variety[]).filter(
    (v) => isVarietyUnlocked(state, v) || state.storage.batches.some((b) => b.variety === v),
  )
  return varieties.map((variety) => {
    const batches = state.storage.batches.filter((b) => b.variety === variety)
    const rows = ([false, true] as const).map((washed) => {
      const key = `${variety}-${washed ? 'washed' : 'raw'}`
      const max = washed ? washedUnits(state, variety) : storedUnits(state, variety)
      const running = batches
        .filter((b) => (b.washed === true) === washed && isRunning(b, day))
        .reduce((n, b) => n + b.units, 0)
      const history = priceHistory(state, { kind: washed ? 'washed' : 'coffee', variety })
      const change = trend(history)
      const price = bankBuyPrice(state, variety, 0, washed)
      return {
        key,
        variety,
        washed,
        max,
        running,
        none: max + running === 0,
        price: formatPrice(price),
        percent: t.ofReference.replace(
          '{percent}',
          String(Math.round((price / bankReferencePrice(variety, washed)) * 100)),
        ),
        trend: formatChange(change),
        dir: direction(change),
      }
    })
    return {
      variety,
      units: batches.reduce((n, b) => n + b.units, 0),
      rows,
    }
  })
})

// A row with nothing in storage, not even in a running processing, cannot stay open.
const openKey = computed(() => {
  const rows = groups.value.flatMap((g) => g.rows)
  if (open.value === undefined) return rows.find((r) => r.max > 0)?.key ?? null
  return rows.some((r) => r.key === open.value && !r.none) ? open.value : null
})
const toggle = (key: string) => (open.value = openKey.value === key ? null : key)
const amountOf = (key: string, max: number) => Math.min(amounts.value[key] ?? max, max)
const setAmount = (key: string, units: number) =>
  (amounts.value = { ...amounts.value, [key]: units })
// After a sale the ticket goes back to "Alles".
const reset = (key: string) => {
  const rest = { ...amounts.value }
  delete rest[key]
  amounts.value = rest
}
</script>

<template>
  <div class="bank" data-testid="market-bank">
    <p class="lead" data-testid="market-lead">{{ lead }}</p>
    <div class="thead" aria-hidden="true">
      <span>{{ t.columns.state }}</span
      ><span>{{ t.columns.sellable }}</span
      ><span>{{ t.columns.price }}</span
      ><span>{{ t.columns.trend }}</span
      ><span />
    </div>
    <section
      v-for="g in groups"
      :key="g.variety"
      :aria-labelledby="`bank-${g.variety}`"
      :data-testid="`market-${g.variety}`"
    >
      <div class="group">
        <h3 :id="`bank-${g.variety}`">{{ de.inspector.varieties[g.variety] }}</h3>
        <span class="sum">{{ t.inStorage.replace('{units}', String(g.units)) }}</span>
      </div>
      <div
        v-for="r in g.rows"
        :key="r.key"
        class="good"
        :data-open="openKey === r.key"
        :data-testid="`bank-row-${r.key}`"
      >
        <button
          type="button"
          class="grow"
          :disabled="r.none"
          :aria-expanded="r.none ? undefined : openKey === r.key"
          :aria-controls="r.none ? undefined : `bank-ticket-${r.key}`"
          @click="toggle(r.key)"
        >
          <span class="c-tag"
            ><span class="tag" :class="{ washed: r.washed }">{{
              r.washed ? t.washed : t.raw
            }}</span></span
          >
          <span class="c-stock">
            <template v-if="r.none">{{ t.nothing }}</template>
            <template v-else
              ><b data-testid="bank-stock">{{ r.max }}</b> {{ t.units }}</template
            >
            <small v-if="r.running > 0">{{
              t.running.replace('{units}', String(r.running))
            }}</small>
          </span>
          <span class="c-price"
            ><span class="lab-n">{{ t.pays }}</span
            ><b data-testid="bank-price">{{ r.price }}</b
            ><small>{{ r.percent }}</small></span
          >
          <span class="c-trend"
            ><span class="trend" :class="r.dir" data-testid="bank-trend">{{ r.trend }}</span
            ><small>{{ t.toLastMonth }}</small></span
          >
          <span v-if="!r.none" class="chev" aria-hidden="true" />
        </button>
        <SellTicket
          v-if="openKey === r.key"
          :id="`bank-ticket-${r.key}`"
          :variety="r.variety"
          :washed="r.washed"
          :max="r.max"
          :amount="amountOf(r.key, r.max)"
          @update:amount="setAmount(r.key, $event)"
          @sold="reset(r.key)"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.lead {
  margin: 10px 0 2px;
  max-width: 68ch;
  font-size: 13px;
  color: var(--fg-2);
}
.thead,
.grow {
  display: grid;
  grid-template-columns: 104px minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 1fr) 28px;
  column-gap: 10px;
  align-items: center;
}
.thead {
  padding: 10px 10px 6px;
  font-size: 12px;
  color: var(--fg-2);
}
.group {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 12px 0 4px;
}
h3 {
  margin: 0;
  font-size: 15px;
}
.sum {
  font-size: 12px;
  color: var(--fg-2);
}
.good {
  margin-top: 4px;
  border-radius: 10px;
  background: rgb(255 255 255 / 5%);
}
.good[data-open='true'] {
  background: rgb(255 255 255 / 7%);
  outline: 1px solid var(--line);
}
.grow {
  width: 100%;
  min-height: 56px;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.grow:hover {
  background: rgb(255 255 255 / 5%);
}
.grow:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.grow:disabled {
  color: var(--fg-3);
  cursor: default;
}
.grow:disabled:hover {
  background: none;
}
.grow b {
  font-size: 15px;
  font-weight: 700;
}
.grow small {
  display: block;
  font-size: 12px;
  color: var(--fg-2);
}
.lab-n {
  display: none;
}
.chev {
  justify-self: end;
  width: 10px;
  height: 10px;
  border-right: 2px solid var(--fg-2);
  border-bottom: 2px solid var(--fg-2);
  transform: rotate(45deg) translate(-2px, -2px);
}
[aria-expanded='true'] > .chev {
  transform: rotate(225deg) translate(-2px, -2px);
}
@media (prefers-reduced-motion: no-preference) {
  .chev {
    transition: transform 0.15s;
  }
}
.tag {
  display: inline-block;
  padding: 2px 9px;
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.tag.washed {
  border-color: var(--green);
  background: var(--green);
  color: #1f2d14;
}
.trend {
  font-weight: 700;
  white-space: nowrap;
}
.up {
  color: var(--green);
}
.down {
  color: var(--red-fg);
}
/* Below 1280 px each row takes two lines and the table head goes. */
@media (max-width: 1279px) {
  .thead {
    display: none;
  }
  .grow {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 28px;
    grid-template-areas: 'tag price chev' 'stock trend chev';
    row-gap: 4px;
  }
  .c-tag {
    grid-area: tag;
  }
  .c-stock {
    grid-area: stock;
  }
  .c-price {
    grid-area: price;
    text-align: right;
  }
  .c-trend {
    grid-area: trend;
    text-align: right;
  }
  .chev {
    grid-area: chev;
  }
  .lab-n {
    display: inline;
  }
  .c-trend small,
  .c-price small {
    display: inline;
    margin-left: 4px;
  }
}
@media (max-width: 480px) {
  .lead {
    display: none;
  }
  .c-price small {
    display: block;
    margin-left: 0;
  }
}
</style>
