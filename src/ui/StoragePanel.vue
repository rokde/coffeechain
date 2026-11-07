<script setup lang="ts">
import { computed, ref } from 'vue'
import { pickTool, useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { useViewStore } from '../app/view'
import { balance } from '../sim/balance'
import type { GameState } from '../sim/state'
import { storageOverview, type OverviewRow } from '../sim/storage/overview'
import { formatDate, formatMonth } from './date'
import de from './i18n/de.json'
import { formatMoney } from './money'

const t = de.storagePanel
const game = useGameStore()
const view = useViewStore()
const selection = useSelectionStore()
const cfg = balance()
const min = cfg.storage.shelfLifeMinQuality
const loss = cfg.storage.qualityLossPerDayRaw
type Filter = keyof typeof t.filters
const filter = ref<Filter>('all')
const decimals = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const cc = (cents: number) => de.money.replace('{n}', decimals.format(cents / 100))
const pct = (units: number, capacity: number) => `${(units / capacity) * 100}%`

// The sim function only reads the state, so the cast of the readonly snapshot is safe.
const o = computed(() => storageOverview(game.state as GameState))
const used = computed(() => o.value.raw + o.value.washed)
const groups = computed(() =>
  o.value.groups
    .map((g) => ({
      ...g,
      rows: g.rows.filter(
        (r) => filter.value === 'all' || (filter.value === 'washed') === r.washed,
      ),
    }))
    .filter((g) => g.rows.length > 0),
)

function shelf(r: OverviewRow) {
  if (r.shelfMonths === null) return { cls: '', main: t.shelfForever, sub: '' }
  if (r.shelfUntilDay === null)
    return { cls: 'under', main: t.shelfUnder.replace('{quality}', String(min)), sub: '' }
  return {
    cls: r.shelfMonths <= 3 ? 'soon' : '',
    main: t.shelfUntil.replace('{month}', formatMonth(r.shelfUntilDay, game.state.time.day)),
    sub: t.shelfLeft.replace('{months}', String(r.shelfMonths)),
  }
}

function ready(r: OverviewRow) {
  const today = game.state.time.day
  if (r.readyDay === undefined) return null
  return r.readyDay <= today
    ? { cls: 'ok', main: t.readyNow, sub: t.readySince.replace('{date}', formatDate(r.readyDay)) }
    : {
        cls: 'wait',
        main: formatDate(r.readyDay),
        sub: t.readyIn.replace('{days}', String(r.readyDay - today)),
      }
}

function toMarket() {
  view.storageOpen = false
  pickTool(selection, game.state as GameState, 'market')
}
</script>

<template>
  <section class="storage-panel" data-testid="storage-panel" :aria-label="t.heading">
    <header>
      <div>
        <h2>{{ t.heading }}</h2>
        <p class="title">
          {{ used }} <small>{{ t.used.replace('{capacity}', String(o.capacity)) }}</small>
        </p>
      </div>
      <button type="button" class="close" :aria-label="t.close" @click="view.storageOpen = false">
        ×
      </button>
    </header>
    <div class="capacity">
      <div
        class="meter"
        role="img"
        :aria-label="
          t.meter.replace('{used}', String(used)).replace('{capacity}', String(o.capacity))
        "
      >
        <i class="raw" :style="{ width: pct(o.raw, o.capacity) }" /><i
          class="washed"
          :style="{ width: pct(o.washed, o.capacity) }"
        />
      </div>
      <div class="keys">
        <b class="k-raw">{{ t.raw.replace('{units}', String(o.raw)) }}</b>
        <b class="k-washed">{{ t.washed.replace('{units}', String(o.washed)) }}</b>
        <b>{{ t.free.replace('{units}', String(o.free)) }}</b>
      </div>
      <div class="booking" data-testid="storage-booking">
        {{ t.nextMonth }} <strong>{{ formatDate(o.nextMonthDay) }}</strong
        ><br />
        {{ t.cost }} <strong>{{ formatMoney(o.cost) }}</strong>
        <span v-if="o.cost !== o.costExact">
          {{ t.costExact.replace('{cost}', decimals.format(o.costExact / 100)) }}</span
        >
      </div>
    </div>
    <p v-if="o.free === 0" class="alert" data-testid="storage-full">{{ t.full }}</p>
    <div class="filters" role="group" :aria-label="t.filter">
      <button
        v-for="(label, id) in t.filters"
        :key="id"
        type="button"
        :data-testid="`storage-filter-${id}`"
        :aria-pressed="filter === id"
        @click="filter = id"
      >
        {{ label }}
      </button>
      <span class="thr" :title="t.thresholdHint"
        >{{ t.threshold }} <b>{{ min }}</b></span
      >
    </div>
    <div class="list">
      <div v-if="o.groups.length === 0" class="empty" data-testid="storage-empty">
        <strong>{{ t.empty }}</strong
        ><span>{{ t.emptyHint }}</span>
      </div>
      <template v-else>
        <div class="thead">
          <span>{{ t.columns.state }}</span
          ><span class="r">{{ t.columns.units }}</span
          ><span>{{ t.columns.quality }}</span
          ><span class="r">{{ t.columns.loss }}</span
          ><span class="r">{{ t.columns.cost }}</span
          ><span>{{ t.columns.shelf }}</span
          ><span>{{ t.columns.ready }}</span>
        </div>
        <template v-for="g in groups" :key="g.variety">
          <div class="group">
            <h3>{{ de.inspector.varieties[g.variety] }}</h3>
            <span class="sum">{{ t.units.replace('{units}', String(g.units)) }}</span>
          </div>
          <div
            v-for="r in g.rows"
            :key="`${r.washed}-${r.quality}-${r.readyDay}`"
            class="row"
            :class="shelf(r).cls"
            data-testid="storage-row"
          >
            <div class="c-state">
              <span class="tag" :class="{ washed: r.washed }">{{
                r.washed ? t.state.washed : t.state.raw
              }}</span>
            </div>
            <div class="c-units r">
              <b>{{ r.units }}</b>
              <span class="u">{{ t.units.replace('{units}', '').trim() }}</span>
            </div>
            <div class="c-q qv">
              <b>{{ t.quality.replace('{quality}', String(r.quality)) }}</b>
              <span class="bar"
                ><i :style="{ width: `${Math.min(100, r.quality)}%` }" /><s
                  :style="{ left: `${min}%` }"
              /></span>
            </div>
            <div class="stats-cells">
              <div class="r">
                <span class="lab">{{ t.columns.loss }}</span
                >{{ t.loss.replace('{loss}', String(loss)) }}
              </div>
              <div class="r">
                <span class="lab">{{ t.columns.cost }}</span
                >{{ cc(r.cost) }}
              </div>
              <div>
                <span class="lab">{{ t.columns.shelfShort }}</span
                ><span class="hold">{{ shelf(r).main }}</span
                ><small v-if="shelf(r).sub">{{ shelf(r).sub }}</small>
              </div>
              <div class="c-ready" :class="{ none: !ready(r) }">
                <span class="lab">{{ t.columns.ready }}</span>
                <template v-if="ready(r)"
                  ><span :class="ready(r)!.cls">{{ ready(r)!.main }}</span
                  ><small>{{ ready(r)!.sub }}</small></template
                >
                <span v-else class="dash">–</span>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>
    <footer>
      <p>{{ t.footer }}</p>
      <button type="button" class="primary" data-testid="storage-to-market" @click="toMarket">
        {{ t.toMarket }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.storage-panel {
  --green: #9ccf7a;
  --red: #e8735f;
  --line: rgb(255 255 255 / 12%);
  position: absolute;
  top: 92px;
  right: 16px;
  width: 640px;
  max-height: calc(100vh - 92px - 16px - 82px - 12px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 14px;
  border-radius: 12px;
  /* Opaque: the panel covers the inspector, and the toolbar at 480 px or less. */
  background: #2b2420;
  pointer-events: auto;
  font-size: 14px;
  line-height: 1.35;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
h2 {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #f2c48d;
}
.title {
  margin: 2px 0 0;
  font-size: 20px;
  font-weight: 700;
}
.title small {
  font-size: 14px;
  font-weight: 400;
  opacity: 0.8;
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
button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
.close {
  flex: none;
  width: 44px;
  height: 44px;
  margin: -4px -6px 0 8px;
  font-size: 20px;
}
.capacity {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 24px;
  align-items: end;
}
.meter {
  grid-column: 1 / -1;
  display: flex;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  background: rgb(255 255 255 / 15%);
}
.meter i {
  display: block;
  height: 100%;
}
.meter .raw {
  background: #f2c48d;
}
.meter .washed {
  background: var(--green);
}
.keys {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  font-size: 12px;
  opacity: 0.85;
}
.keys b::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 50%;
  background: rgb(255 255 255 / 25%);
}
.keys .k-raw::before {
  background: #f2c48d;
}
.keys .k-washed::before {
  background: var(--green);
}
.booking {
  font-size: 12px;
  text-align: right;
  opacity: 0.85;
}
.booking strong {
  font-size: 14px;
}
.booking span,
.u {
  margin-left: 3px;
}
.alert {
  margin: 8px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgb(232 115 95 / 18%);
  color: #ffb3a4;
  font-size: 13px;
}
.filters {
  display: flex;
  gap: 6px;
  margin-top: 12px;
}
.filters button {
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
}
button[aria-pressed='true'],
button.primary {
  background: #f2c48d;
  color: #2b2420;
}
.thr {
  margin-left: auto;
  align-self: center;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  opacity: 0.85;
}
.thr b {
  padding: 2px 8px;
  border-radius: 6px;
  background: rgb(255 255 255 / 8%);
}
.list {
  flex: 1 1 auto;
  min-height: 0;
  margin: 8px -8px 0 0;
  padding-right: 8px;
  overflow-y: auto;
}
.thead,
.row {
  display: grid;
  grid-template-columns: 78px 52px 88px 56px 66px 1fr 1fr;
  column-gap: 8px;
  align-items: center;
}
.stats-cells {
  display: contents;
}
.thead {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  background: #2b2420;
  font-size: 11px;
  line-height: 1.2;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.75;
}
.r {
  text-align: right;
}
.group {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 0 3px;
}
.group h3 {
  margin: 0;
  font-size: 15px;
}
.sum {
  font-size: 12px;
  opacity: 0.8;
}
.row {
  padding: 5px 0;
  border-top: 1px solid var(--line);
  font-size: 13px;
}
.row small {
  display: block;
  font-size: 11px;
  opacity: 0.75;
}
.tag {
  display: inline-block;
  padding: 2px 9px;
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.tag.washed {
  border-color: var(--green);
  background: var(--green);
  color: #1f2d14;
}
.qv {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.qv b {
  font-size: 14px;
}
.bar {
  position: relative;
  height: 5px;
  border-radius: 3px;
  background: rgb(255 255 255 / 15%);
}
.bar i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 3px;
  background: #f2c48d;
}
.bar s {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: #f5ece0;
  opacity: 0.85;
}
.under .bar i {
  background: var(--red);
}
.under .qv b,
.under .hold {
  color: #ffb3a4;
}
.soon .hold,
.wait {
  color: #f2c48d;
}
.ok {
  color: var(--green);
}
.ok,
.wait {
  font-weight: 700;
}
.lab,
.u {
  display: none;
}
.dash {
  opacity: 0.45;
}
.empty {
  margin: 18px 0 8px;
  padding: 22px 16px;
  border: 1px dashed rgb(255 255 255 / 25%);
  border-radius: 10px;
  text-align: center;
}
.empty strong {
  display: block;
  margin-bottom: 4px;
  font-size: 16px;
}
.empty span {
  font-size: 13px;
  opacity: 0.85;
}
footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  font-size: 12px;
}
footer p {
  flex: 1;
  margin: 0;
  opacity: 0.85;
}
footer button {
  height: 44px;
  padding: 0 16px;
  white-space: nowrap;
}
/* Below 1280 px the table does not fit: the panel sits beside the left column and each row is a card. */
@media (max-width: 1279px) {
  .storage-panel {
    top: 134px;
    width: calc(100vw - 348px);
    max-height: calc(100vh - 134px - 16px - 82px - 12px);
  }
  .thead {
    display: none;
  }
  .row {
    grid-template-columns: auto 1fr auto;
    grid-template-areas: 'state q units' 'stats stats stats';
    gap: 8px 12px;
    padding: 10px 0;
  }
  .c-state {
    grid-area: state;
  }
  .c-q {
    grid-area: q;
  }
  .c-units {
    grid-area: units;
    font-size: 14px;
  }
  .u {
    display: inline;
  }
  .stats-cells {
    grid-area: stats;
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 0.95fr) minmax(0, 1.35fr) minmax(0, 1.15fr);
    gap: 6px;
  }
  .stats-cells > div {
    padding: 6px 8px;
    border-radius: 8px;
    background: rgb(255 255 255 / 5%);
    text-align: left;
    white-space: nowrap;
  }
  .lab {
    display: block;
    margin-bottom: 1px;
    font-size: 11px;
    opacity: 0.7;
  }
  .c-ready.none {
    display: none;
  }
}
/* Up to 480 px the panel is a sheet over the full width and covers the toolbar. */
@media (max-width: 480px) {
  .storage-panel {
    inset: 134px 16px 16px;
    width: auto;
    max-height: none;
    padding: 14px 16px;
  }
  .title {
    font-size: 18px;
  }
  .capacity {
    grid-template-columns: 1fr;
  }
  .booking {
    text-align: left;
  }
  .stats-cells {
    grid-template-columns: repeat(3, 1fr);
  }
  .stats-cells > div {
    padding: 6px;
  }
  .c-ready {
    grid-column: 1 / -1;
  }
  .filters button {
    padding: 0 12px;
  }
  footer p {
    display: none;
  }
  footer button {
    flex: 1;
  }
}
</style>
