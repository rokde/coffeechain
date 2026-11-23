<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { balance } from '../../sim/balance'
import de from '../i18n/de.json'
import { chartY, SCALE } from './priceChart'
import { formatChange, formatPrice } from './sellTicket'

const props = defineProps<{
  // Prices in CC per unit, one per month, oldest first. The last one is today.
  history: number[]
  // Price at 100 % of the scale.
  reference: number
  // Price right after the trade, or null without a trade.
  after: number | null
  // Day of today, for the month names.
  day: number
}>()

const t = de.marketPanel.chart
const cfg = balance()

// The chart draws in screen pixels, so the text keeps its size. The one-column ticket below
// 1280 px gets a flatter chart, so the amount and the preview stay in view.
const width = ref(288)
const tall = ref(true)
const box = ref<HTMLElement>()
let observer: ResizeObserver | undefined
let query: MediaQueryList | undefined
const onQuery = () => (tall.value = !query!.matches)
onMounted(() => {
  if (typeof ResizeObserver === 'function' && box.value) {
    // The next frame takes the new width: a taller chart can show the scrollbar and change the
    // width again, and a change inside the callback would loop.
    observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0)
      if (w > 0 && w !== width.value) requestAnimationFrame(() => (width.value = w))
    })
    observer.observe(box.value)
  }
  if (typeof matchMedia === 'function') {
    query = matchMedia('(max-width: 1279px)')
    onQuery()
    query.addEventListener('change', onQuery)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  query?.removeEventListener('change', onQuery)
})

const L = 56
const R = 78
const T = 12
const B = 22
const pct = (price: number) => Math.round((price / props.reference) * 100)
// Short name of month i of the history. The last one is the month of today.
const monthAt = (i: number) => {
  const n = cfg.time.monthsPerYear
  const month = Math.floor(props.day / cfg.time.daysPerMonth) - (props.history.length - 1 - i)
  return de.time.monthsShort[((month % n) + n) % n]!
}

const c = computed(() => {
  const w = width.value
  const h = tall.value ? 216 : 132
  const right = w - R
  const ph = h - T - B
  const last = props.history.length - 1
  const x = (i: number) => L + (i * (right - L)) / last
  const y = (price: number) => chartY(price, props.reference, T, ph)
  const now = props.history[last]!
  const after = props.after !== null && Math.abs(props.after - now) > 1e-9 ? props.after : null
  const up = after !== null && after > now
  const ty = y(now)
  // The labels of today and after sit beside the last point, "danach" in the trade direction.
  const todayLabel = up ? ty + 18 : ty - 8
  return {
    w,
    h,
    right,
    bottom: T + ph,
    grid: [SCALE.max, 1, SCALE.min].map((f) => ({
      f,
      y: y(props.reference * f),
      label: formatPrice(props.reference * f).replace(/\s*CC$/, ''),
    })),
    points: props.history.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' '),
    months: props.history.map((p, i) => ({
      x: x(i),
      y: y(p),
      title: t.point
        .replace('{month}', monthAt(i))
        .replace('{price}', formatPrice(p))
        .replace('{percent}', String(pct(p))),
    })),
    ticks: [2, 5, 8, last]
      .filter((i) => i <= last)
      .map((i) => ({ x: x(i), label: monthAt(i), end: i === last })),
    today: { x: x(last), y: ty, ly: todayLabel, label: formatPrice(now) },
    after:
      after === null
        ? null
        : {
            x: x(last) + 9,
            y: y(after),
            ly: up ? todayLabel - 32 : todayLabel + 34,
            cls: up ? 'up' : 'down',
            label: formatChange(after / now - 1),
          },
    lx: x(last) + 16,
    aria:
      t.label
        .replace('{months}', String(props.history.length))
        .replace('{price}', formatPrice(now))
        .replace('{percent}', String(pct(now)))
        .replace('{reference}', formatPrice(props.reference)) +
      (after === null ? '' : ' ' + t.labelAfter.replace('{after}', formatPrice(after))),
  }
})

// Hover: a crosshair on the nearest month with its value.
const hover = ref<number | null>(null)
function onMove(event: PointerEvent) {
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
  const px = ((event.clientX - rect.left) / rect.width) * c.value.w
  const last = props.history.length - 1
  const i = Math.round(((px - L) / (c.value.right - L)) * last)
  hover.value = i < 0 || i > last ? null : i
}
const TIP = 160
const tip = computed(() => {
  if (hover.value === null) return null
  const m = c.value.months[hover.value]!
  return { ...m, bx: Math.min(Math.max(m.x - TIP / 2, 0), c.value.w - TIP) }
})
</script>

<template>
  <div ref="box" class="price-chart" data-testid="price-chart">
    <svg
      :viewBox="`0 0 ${c.w} ${c.h}`"
      role="img"
      :aria-label="c.aria"
      @pointermove="onMove"
      @pointerleave="hover = null"
    >
      <g v-for="g in c.grid" :key="g.f">
        <line
          :x1="L"
          :x2="c.right"
          :y1="g.y"
          :y2="g.y"
          :class="g.f === 1 ? 'ref' : 'grid'"
          :data-testid="g.f === 1 ? 'chart-reference' : 'chart-grid'"
        />
        <text :x="L - 8" :y="g.y + (g.f === 1 ? -1 : 4)" text-anchor="end" class="axis">
          {{ g.label }}
        </text>
        <text v-if="g.f === 1" :x="L - 8" :y="g.y + 11" text-anchor="end" class="axis small">
          {{ t.reference }}
        </text>
      </g>
      <polyline :points="c.points" class="line" data-testid="chart-line" />
      <circle
        v-for="(m, i) in c.months.slice(0, -1)"
        :key="i"
        :cx="m.x"
        :cy="m.y"
        r="6"
        class="hit"
      >
        <title>{{ m.title }}</title>
      </circle>
      <template v-if="c.after">
        <line :x1="c.after.x" :x2="c.after.x" :y1="c.today.y" :y2="c.after.y" class="move" />
        <circle :cx="c.after.x" :cy="c.after.y" r="3.5" class="after" data-testid="chart-after" />
      </template>
      <circle :cx="c.today.x" :cy="c.today.y" r="5" class="today" data-testid="chart-today" />
      <text :x="c.lx" :y="c.today.ly - 13" class="axis">{{ t.today }}</text>
      <text :x="c.lx" :y="c.today.ly" class="value" data-testid="chart-today-label">
        {{ c.today.label }}
      </text>
      <template v-if="c.after">
        <text :x="c.lx" :y="c.after.ly - 13" class="axis">{{ t.after }}</text>
        <text
          :x="c.lx"
          :y="c.after.ly"
          class="value"
          :class="c.after.cls"
          data-testid="chart-after-label"
        >
          {{ c.after.label }}
        </text>
      </template>
      <text
        v-for="tick in c.ticks"
        :key="tick.x"
        :x="tick.x"
        :y="c.h - 6"
        :text-anchor="tick.end ? 'end' : 'middle'"
        class="axis"
      >
        {{ tick.label }}
      </text>
      <g v-if="tip" class="tip" aria-hidden="true">
        <line :x1="tip.x" :x2="tip.x" :y1="T" :y2="c.bottom" class="cross" />
        <circle :cx="tip.x" :cy="tip.y" r="4" class="today" />
        <rect :x="tip.bx" y="0" :width="TIP" height="20" rx="4" />
        <text :x="tip.bx + TIP / 2" y="14" text-anchor="middle">{{ tip.title }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.price-chart {
  min-width: 0;
}
svg {
  display: block;
  width: 100%;
  height: auto;
  touch-action: pan-y;
}
.grid {
  stroke: rgb(255 255 255 / 14%);
}
.ref {
  stroke: rgb(255 255 255 / 55%);
  stroke-dasharray: 4 4;
}
.axis {
  font-size: 11px;
  fill: var(--fg-2);
}
.small {
  font-size: 10px;
}
.line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.hit {
  fill: transparent;
}
.move {
  stroke: var(--hud-fg);
  stroke-width: 1.5;
}
.after {
  fill: var(--on-accent);
  stroke: var(--hud-fg);
  stroke-width: 1.5;
}
.today {
  fill: var(--accent);
  stroke: var(--on-accent);
  stroke-width: 2;
}
.value {
  font-size: 13px;
  font-weight: 700;
  fill: var(--hud-fg);
}
.value.down {
  fill: var(--red-fg);
}
.value.up {
  fill: var(--green);
}
.cross {
  stroke: rgb(255 255 255 / 40%);
}
.tip rect {
  fill: var(--on-accent);
  stroke: rgb(255 255 255 / 20%);
}
.tip text {
  font-size: 11px;
  fill: var(--hud-fg);
}
</style>
