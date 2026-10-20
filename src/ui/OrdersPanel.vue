<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../app/store'
import { deliverableUnits } from '../sim/market/orders'
import type { GameState } from '../sim/state'
import de from './i18n/de.json'
import { formatMoney } from './money'

const t = de.orders
const game = useGameStore()

const rows = computed(() => {
  // deliverableUnits only reads the state, so the cast of the readonly snapshot is safe.
  const state = game.state as GameState
  return state.orders.open.map((order) => ({
    ...order,
    buyer: t.buyers[order.id % t.buyers.length],
    ready: deliverableUnits(state, order) >= order.units,
  }))
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
        <dd>{{ o.deadlineDay }}</dd>
        <dt>{{ t.price }}</dt>
        <dd>{{ formatMoney(o.price) }}</dd>
      </dl>
      <button
        type="button"
        data-testid="order-deliver"
        :disabled="!o.ready"
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
  grid-template-columns: auto 1fr auto 1fr;
  gap: 4px 8px;
  margin: 0 0 6px;
  font-size: 12px;
}
dt {
  opacity: 0.8;
  white-space: nowrap;
}
dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}
button {
  width: 100%;
  height: 30px;
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
  dl {
    grid-template-columns: auto 1fr;
  }
}
</style>
