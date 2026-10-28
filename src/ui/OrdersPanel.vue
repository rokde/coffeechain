<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../app/store'
import { bankBuyPrice } from '../sim/market/market'
import { deliverableUnits } from '../sim/market/orders'
import type { GameState } from '../sim/state'
import { dateParts } from './date'
import de from './i18n/de.json'
import { formatUnitPrice } from './money'

const t = de.orders
const game = useGameStore()

const rows = computed(() => {
  // The sim functions only read the state, so the cast of the readonly snapshot is safe.
  const state = game.state as GameState
  return state.orders.open.map((order) => {
    const have = deliverableUnits(state, order)
    const bank = formatUnitPrice(Math.round(bankBuyPrice(state, order.variety) * 100))
    return {
      ...order,
      buyer: t.buyers[order.id % t.buyers.length],
      ready: have >= order.units,
      deadline: dateParts(order.deadlineDay),
      bank: t.bank.replace('{price}', bank),
      stock: t.stock.replace('{have}', String(have)).replace('{units}', String(order.units)),
    }
  })
})
</script>

<template>
  <section class="orders" data-testid="orders-panel">
    <h3>{{ t.heading }}</h3>
    <p v-if="rows.length === 0" class="none">{{ t.none }}</p>
    <article v-for="o in rows" :key="o.id" class="order" :data-testid="`order-${o.id}`">
      <h4>
        <span>{{ o.buyer }}</span>
        <span>{{ o.units }} {{ de.inspector.varieties[o.variety] }}</span>
      </h4>
      <dl>
        <dt>{{ t.minQuality }}</dt>
        <dd>{{ o.minQuality }}</dd>
        <dt>{{ t.deadline }}</dt>
        <dd class="date" data-testid="order-deadline">
          <span>{{ o.deadline[0] }}</span
          >{{ de.time.separator }}<span>{{ o.deadline[1] }}</span>
        </dd>
        <dt>{{ t.price }}</dt>
        <dd class="price" data-testid="order-price">
          <span>{{ formatUnitPrice(o.price) }}</span> <span>{{ o.bank }}</span>
        </dd>
      </dl>
      <p v-if="!o.ready" class="stock" data-testid="order-stock">{{ o.stock }}</p>
      <button
        type="button"
        data-testid="order-deliver"
        :disabled="!o.ready"
        :title="o.ready ? undefined : o.stock"
        @click="game.dispatch({ type: 'DeliverOrder', id: o.id })"
      >
        {{ t.deliver }}
      </button>
    </article>
  </section>
</template>

<style scoped>
h3 {
  margin: 10px 0 0;
  font-size: 14px;
}
/* The bank price and the year wrap to their own line in a narrow panel. */
.price,
.date {
  white-space: normal;
}
.price span,
.date span {
  white-space: nowrap;
}
@media (max-width: 480px) {
  .price {
    grid-column: 1 / -1;
  }
}
.stock {
  margin: 0 0 6px;
  font-size: 12px;
}
.none {
  margin: 4px 0 0;
  font-size: 13px;
  opacity: 0.8;
}
.order {
  margin-top: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgb(255 255 255 / 6%);
}
h4 {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0 10px;
  margin: 0 0 4px;
  font-size: 13px;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 8px;
  margin: 0 0 6px;
  font-size: 12px;
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
</style>
