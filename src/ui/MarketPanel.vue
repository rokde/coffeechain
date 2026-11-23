<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { pickTool, useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { deliverableUnits } from '../sim/market/orders'
import type { GameState } from '../sim/state'
import de from './i18n/de.json'
import MarketBank from './market/MarketBank.vue'
import MarketSeed from './market/MarketSeed.vue'
import { tabKey } from './market/tablist'
import OrdersPanel from './OrdersPanel.vue'

const t = de.marketPanel
const game = useGameStore()
const selection = useSelectionStore()

const TABS = ['bank', 'orders', 'seed'] as const
type Tab = (typeof TABS)[number]
const tab = ref<Tab>('bank')
const tabs = ref<HTMLButtonElement[]>([])

// The count on "Aufträge": open orders, green as soon as one can be delivered.
const orders = computed(() => {
  // The sim function only reads the state, so the cast of the readonly snapshot is safe.
  const state = game.state as GameState
  const open = state.orders.open
  const ready = open.filter((o) => deliverableUnits(state, o) >= o.units).length
  return {
    open: open.length,
    ready,
    title: t.ordersCount.replace('{open}', String(open.length)).replace('{ready}', String(ready)),
  }
})

// Arrow keys, Home and End move between the tabs and select the focused one.
async function onKey(event: KeyboardEvent, index: number) {
  const next = tabKey(event.key, index, TABS.length)
  if (next === null) return
  event.preventDefault()
  tab.value = TABS[next]!
  await nextTick()
  tabs.value[next]?.focus()
}

const close = () => pickTool(selection, game.state as GameState, 'select')
</script>

<template>
  <section class="market" data-testid="market-panel" :aria-label="t.heading">
    <header>
      <h2 class="title">{{ t.heading }}</h2>
      <button
        type="button"
        class="close"
        data-testid="market-close"
        :aria-label="t.close"
        @click="close"
      >
        ×
      </button>
    </header>
    <div class="tabs" role="tablist" :aria-label="t.tabsLabel">
      <button
        v-for="(id, i) in TABS"
        :id="`market-tab-${id}`"
        :key="id"
        ref="tabs"
        type="button"
        role="tab"
        :aria-selected="tab === id"
        :aria-controls="`market-tabpanel-${id}`"
        :tabindex="tab === id ? 0 : -1"
        :data-testid="`market-tab-${id}`"
        @click="tab = id"
        @keydown="onKey($event, i)"
      >
        {{ t.tabs[id]
        }}<span
          v-if="id === 'orders'"
          class="count"
          :class="{ go: orders.ready > 0 }"
          :title="orders.title"
          data-testid="market-orders-count"
          >{{ orders.open }}</span
        >
      </button>
    </div>
    <div
      :id="`market-tabpanel-${tab}`"
      class="body"
      role="tabpanel"
      :aria-labelledby="`market-tab-${tab}`"
      tabindex="0"
    >
      <MarketBank v-if="tab === 'bank'" />
      <OrdersPanel v-else-if="tab === 'orders'" />
      <MarketSeed v-else />
    </div>
  </section>
</template>

<style scoped>
.market {
  --green: #9ccf7a;
  --red-fg: #ffb3a4;
  --hud-solid: #221e19;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
  padding: 14px 20px 0;
  font-variant-numeric: tabular-nums;
}
header {
  flex: none;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: -8px;
}
.title {
  margin: 8px 0 0;
  font-size: 20px;
  font-weight: 700;
}
button {
  border: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
:is(button, .body):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.close {
  flex: none;
  width: 44px;
  height: 44px;
  margin: -2px -8px 0 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 8%);
  font-size: 20px;
}
/* Tabs: the selection shows as an underline, not only as a colour. */
.tabs {
  flex: none;
  display: flex;
  margin-top: 6px;
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
  scrollbar-width: none;
}
[role='tab'] {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  background: none;
  color: var(--fg-2);
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}
[role='tab']:hover {
  color: var(--hud-fg);
}
[role='tab'][aria-selected='true'] {
  color: var(--accent);
}
[role='tab'][aria-selected='true']::after {
  content: '';
  position: absolute;
  inset: auto 0 -1px;
  border-block-end: 3px solid var(--accent);
}
[role='tab']:focus-visible {
  outline-offset: -2px;
}
.count {
  min-width: 22px;
  padding: 1px 7px;
  box-sizing: border-box;
  border-radius: 999px;
  background: rgb(255 255 255 / 8%);
  color: var(--hud-fg);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}
.count.go {
  background: var(--green);
  color: #1f2d14;
}
.body {
  flex: 1 1 auto;
  min-height: 0;
  margin-right: -12px;
  padding: 0 12px 0 0;
  overflow-y: auto;
}
/* The space below the list sits inside the tab, so the sticky sell button ends flush at the bottom. */
.body > * {
  padding-bottom: 16px;
}
@media (max-width: 480px) {
  .market {
    padding: 12px 16px 0;
  }
  .title {
    font-size: 18px;
  }
  [role='tab'] {
    flex: 1 0 auto;
    justify-content: center;
    padding: 0 10px;
  }
}
</style>
