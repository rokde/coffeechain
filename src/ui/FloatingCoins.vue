<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { coinStart, useCoinsStore, type Coin } from '../app/coins'
import { formatMoney } from './money'

const store = useCoinsStore()
const text = (c: Coin) => `${c.amount < 0 ? '−' : '+'}${formatMoney(Math.abs(c.amount))}`

// A click on a HUD button also sends pointerdown, so the coin starts at the clicked button.
function track(event: PointerEvent) {
  store.pointer = coinStart(
    { x: event.clientX, y: event.clientY },
    { width: innerWidth, height: innerHeight },
  )
}
const options = { capture: true, passive: true }
onMounted(() => {
  addEventListener('pointerdown', track, options)
  addEventListener('pointermove', track, options)
})
onUnmounted(() => {
  removeEventListener('pointerdown', track, options)
  removeEventListener('pointermove', track, options)
})
</script>

<template>
  <div class="floating-coins">
    <div
      v-for="c in store.coins"
      :key="c.id"
      class="coin"
      :class="{ income: c.amount > 0 }"
      :style="{ left: `${c.at.x}px`, top: `${c.at.y}px` }"
      aria-hidden="true"
      data-testid="floating-coin"
    >
      <span>{{ text(c) }}</span>
    </div>
  </div>
</template>

<style scoped>
.floating-coins {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
/* A zero-size anchor at the start point. The rise (RISE_PX) and life time (LIFE_MS) are in coins.ts. */
.coin {
  position: absolute;
  animation: coin-rise 800ms ease-out forwards;
}
/* Centered on the anchor and at most COIN_W × COIN_H, so coinStart keeps it in the viewport. */
.coin span {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 120px;
  height: 24px;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  color: #fff;
  text-shadow: 0 1px 2px rgb(0 0 0 / 80%);
}
.coin span::before {
  content: '';
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffe58a, #d9a51c);
  box-shadow: 0 0 0 1px #8a6510;
}
.income span {
  color: #7bc96f;
}
@keyframes coin-rise {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-40px);
    opacity: 0;
  }
}
@keyframes coin-fade {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .coin {
    animation-name: coin-fade;
  }
}
</style>
