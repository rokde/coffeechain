<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../app/store'
import { bankBuyPrice, sellIncome } from '../sim/market/market'
import { orderStock, type Lot, type Order } from '../sim/market/orders'
import { roundIncome } from '../sim/money'
import type { GameState } from '../sim/state'
import { calendar } from '../sim/time/time'
import { dateParts } from './date'
import de from './i18n/de.json'
import { formatMoney, formatUnitPrice } from './money'

const t = de.orders
const game = useGameStore()

// A deadline this close or closer stands out.
const SOON_DAYS = 30

type Filter = 'all' | 'ready'
const filter = ref<Filter>('all')

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key]))
const percent = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
// "+4 %", "−2,5 %", "±0 %"
const signed = (x: number) => {
  const n = Math.round(Math.abs(x) * 1000) / 10
  return `${n === 0 ? '±' : x > 0 ? '+' : '−'}${percent.format(n)} %`
}
const initials = (name: string) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
// Keeps an amount and its unit on one line.
const NBSP = String.fromCharCode(0xa0)
const nbsp = (text: string) => text.replaceAll(' ', NBSP)
const lotText = (l: Lot) => fill(t.lot, { units: l.units, quality: l.quality })

function card(state: GameState, order: Order) {
  const today = state.time.day
  const variety = de.inspector.varieties[order.variety]
  const stock = orderStock(state, order)
  const ready = stock.have >= order.units
  const income = roundIncome(order.units * order.price)
  const bankUnit = bankBuyPrice(state, order.variety)
  const daysLeft = order.deadlineDay - today
  const [date, year] = dateParts(order.deadlineDay)
  const sameYear = calendar(order.deadlineDay).year === calendar(today).year
  const values = { state: t.raw, quality: order.minQuality, variety }
  const near = stock.near
  const why = ready
    ? ''
    : stock.have === 0
      ? [fill(t.missingAll, values), near ? fill(t.nearAll, { quality: near.quality }) : ''].join(
          ' ',
        )
      : [
          fill(t.missing, { ...values, missing: order.units - stock.have }),
          near ? fill(t.near, { ...near }) : '',
        ].join(' ')
  const buyer = t.buyers[order.id % t.buyers.length]!
  return {
    id: order.id,
    order,
    ready,
    buyer,
    initials: initials(buyer),
    soon: daysLeft <= SOON_DAYS,
    due: fill(t.due, { date }),
    year: sameYear ? '' : year,
    left:
      daysLeft === 0
        ? t.lastDay
        : daysLeft === 1
          ? t.dayLeft
          : fill(t.daysLeft, { days: daysLeft }),
    ask: fill(t.ask, { units: order.units, variety }),
    minQuality: fill(t.minQuality, { quality: order.minQuality }),
    price: formatUnitPrice(order.price),
    bankPrice: fill(t.bankPrice, { price: nbsp(formatUnitPrice(Math.round(bankUnit * 100))) }),
    // Positive: the order pays more per unit than the bank today.
    diff: order.price / (bankUnit * 100) - 1,
    income: formatMoney(income),
    bankIncome: fill(t.bankIncome, {
      units: order.units,
      income: nbsp(formatMoney(sellIncome(state, order.variety, order.units))),
    }),
    have: Math.min(stock.have, order.units),
    bar: `${Math.min(100, (stock.have / order.units) * 100)}%`,
    barLabel: fill(t.stockBar, { have: Math.min(stock.have, order.units), units: order.units }),
    lots: stock.lots.length > 0 ? stock.lots.map(lotText).join(', ') : t.noLot,
    why: why.trim(),
    deliver: ready ? fill(t.deliverFor, { income: formatMoney(income) }) : t.deliver,
  }
}

const cards = computed(() => {
  // The sim functions only read the state, so the cast of the readonly snapshot is safe.
  const state = game.state as GameState
  // Deliverable orders first, then by deadline.
  return state.orders.open
    .map((order) => card(state, order))
    .sort(
      (a, b) =>
        Number(b.ready) - Number(a.ready) ||
        a.order.deadlineDay - b.order.deadlineDay ||
        a.id - b.id,
    )
})
const readyCount = computed(() => cards.value.filter((c) => c.ready).length)
const shown = computed(() => cards.value.filter((c) => filter.value === 'all' || c.ready))
</script>

<template>
  <section class="orders" data-testid="orders-panel">
    <h3>{{ t.heading }}</h3>
    <p v-if="cards.length === 0" class="none">{{ t.none }}</p>
    <template v-else>
      <div class="filters" role="group" :aria-label="t.filter">
        <button
          type="button"
          data-testid="orders-filter-all"
          :aria-pressed="filter === 'all'"
          @click="filter = 'all'"
        >
          {{ fill(t.filters.all, { n: cards.length }) }}
        </button>
        <button
          type="button"
          data-testid="orders-filter-ready"
          :aria-pressed="filter === 'ready'"
          @click="filter = 'ready'"
        >
          {{ fill(t.filters.ready, { n: readyCount }) }}
        </button>
        <span class="sort">{{ t.sort }}</span>
      </div>
      <p v-if="shown.length === 0" class="none" data-testid="orders-none-ready">
        {{ t.noneReady }}
      </p>
      <article
        v-for="o in shown"
        :key="o.id"
        class="order"
        :class="{ ready: o.ready }"
        :data-testid="`order-${o.id}`"
        :aria-labelledby="`order-${o.id}-buyer`"
      >
        <div class="head">
          <span class="avatar" aria-hidden="true">{{ o.initials }}</span>
          <h4 :id="`order-${o.id}-buyer`">{{ o.buyer }}</h4>
          <p class="due" :class="{ soon: o.soon }" data-testid="order-deadline">
            <b
              ><span>{{ o.due }}</span
              ><template v-if="o.year"
                >{{ de.time.separator }}<span>{{ o.year }}</span></template
              ></b
            >
            <small data-testid="order-days-left">{{ o.left }}</small>
          </p>
        </div>
        <div class="ask" data-testid="order-ask">
          <span>{{ o.ask }}</span> <span class="tag">{{ t.raw }}</span> {{ ' '
          }}<span class="q">{{ o.minQuality }}</span>
        </div>
        <div class="cells">
          <div class="cell" data-testid="order-price">
            <span class="lab">{{ t.price }}</span>
            <b>{{ o.price }}</b>
            <span class="nowrap">{{ o.bankPrice }}</span> ·
            <span class="nowrap" :class="o.diff >= 0 ? 'up' : 'down'">{{ signed(o.diff) }}</span>
          </div>
          <div class="cell" data-testid="order-income">
            <span class="lab">{{ t.income }}</span>
            <b>{{ o.income }}</b>
            {{ o.bankIncome }}
          </div>
          <div class="cell stock" data-testid="order-stock">
            <span class="lab">{{ t.stock }}</span>
            <b>{{ o.have }} / {{ o.order.units }}</b>
            <span class="match" role="img" :aria-label="o.barLabel"
              ><i :style="{ width: o.bar }"
            /></span>
            <span data-testid="order-lots">{{ o.lots }}</span>
          </div>
        </div>
        <div class="act">
          <p :id="`order-${o.id}-why`" data-testid="order-why">
            <template v-if="o.ready"
              ><span class="ok">{{ t.ready }}</span> {{ t.readyHint }}</template
            >
            <template v-else>{{ o.why }}</template>
          </p>
          <button
            type="button"
            data-testid="order-deliver"
            :class="{ primary: o.ready }"
            :disabled="!o.ready"
            :aria-describedby="`order-${o.id}-why`"
            @click="game.dispatch({ type: 'DeliverOrder', id: o.id })"
          >
            {{ o.deliver }}
          </button>
        </div>
      </article>
    </template>
  </section>
</template>

<style scoped>
/* The card works in the 330 px tool panel and in the 640 px market panel. */
.orders {
  --green: #9ccf7a;
  --red-fg: #ffb3a4;
  container: orders / inline-size;
}
h3 {
  margin: 10px 0 0;
  font-size: 14px;
}
.none {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--fg-2);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.filters button {
  min-height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.filters button[aria-pressed='true'] {
  background: var(--accent);
  color: var(--on-accent);
}
.sort {
  margin-left: auto;
  font-size: 12px;
  color: var(--fg-2);
}
.order {
  display: grid;
  gap: 10px;
  margin-top: 10px;
  padding: 12px;
  border-radius: 10px;
  background: rgb(255 255 255 / 5%);
}
.order.ready {
  outline: 1px solid rgb(156 207 122 / 55%);
}
.head {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 4px 10px;
  align-items: center;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 14px;
  background: rgb(255 255 255 / 14%);
}
h4 {
  margin: 0;
  font-size: 15px;
  overflow-wrap: anywhere;
}
.due {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 13px;
}
.due b span {
  white-space: nowrap;
}
.due small {
  margin-left: 8px;
  font-size: 12px;
  color: var(--fg-2);
  white-space: nowrap;
}
.due.soon,
.due.soon small {
  color: var(--accent);
}
.ask {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  font-size: 15px;
  font-weight: 700;
}
.tag {
  padding: 2px 9px;
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
}
.q {
  padding: 2px 9px;
  border-radius: 6px;
  background: rgb(255 255 255 / 8%);
  font-size: 12px;
  white-space: nowrap;
}
.cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.cell {
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgb(0 0 0 / 22%);
  font-size: 12px;
  color: var(--fg-2);
}
.cell.stock {
  grid-column: 1 / -1;
}
.cell b {
  display: block;
  font-size: 15px;
  color: var(--hud-fg);
}
.lab {
  display: block;
  margin-bottom: 1px;
}
.nowrap {
  white-space: nowrap;
}
.up {
  color: var(--green);
}
.down {
  color: var(--red-fg);
}
.match {
  display: block;
  height: 5px;
  margin: 4px 0;
  border-radius: 3px;
  background: rgb(255 255 255 / 15%);
  overflow: hidden;
}
.match i {
  display: block;
  height: 100%;
  background: var(--accent);
}
.ready .match i {
  background: var(--green);
}
.act {
  display: grid;
  gap: 8px;
}
.act p {
  margin: 0;
  font-size: 13px;
}
.ok {
  color: var(--green);
  font-weight: 700;
}
.act button {
  width: 100%;
  min-height: 44px;
  padding: 6px 14px;
  border: 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.act button.primary {
  background: var(--accent);
  color: var(--on-accent);
}
.act button:disabled {
  color: var(--fg-3);
  cursor: not-allowed;
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* The wide market panel: deadline beside the buyer, three cells, button beside its reason. */
@container orders (min-width: 520px) {
  .head {
    grid-template-columns: 40px minmax(0, 1fr) auto;
  }
  .due {
    grid-column: auto;
    text-align: right;
  }
  .due small {
    display: block;
    margin-left: 0;
  }
  .cells {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .cell.stock {
    grid-column: auto;
  }
  .act {
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 12px;
    align-items: center;
  }
}
</style>
