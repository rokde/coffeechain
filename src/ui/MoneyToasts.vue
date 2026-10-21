<script setup lang="ts">
import { toastPhase, useBookingsStore, type Toast } from '../app/bookings'
import de from './i18n/de.json'
import { formatMoney } from './money'

const bookings = useBookingsStore()
const text = (t: Toast) =>
  `${t.amount < 0 ? '−' : '+'}${formatMoney(Math.abs(t.amount))} ${de.bookings[t.reason]}`
</script>

<template>
  <div class="money-toasts" role="status" aria-live="polite" data-testid="money-toasts">
    <div
      v-for="t in bookings.toasts"
      :key="t.id"
      class="toast"
      :class="{ income: t.amount > 0, fading: toastPhase(t, bookings.now) === 'fading' }"
      data-testid="money-toast"
    >
      {{ text(t) }}
    </div>
  </div>
</template>

<style scoped>
/* 12 px above the toolbar. At 480 px or less the toolbar has two rows. */
.money-toasts {
  position: absolute;
  right: 16px;
  bottom: 110px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  pointer-events: none;
}
@media (max-width: 480px) {
  .money-toasts {
    bottom: 132px;
  }
}
.toast {
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--hud-bg);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  transition: opacity 400ms;
  animation: toast-in 200ms ease-out;
}
.income {
  color: #7bc96f;
}
.fading {
  opacity: 0;
}
@keyframes toast-in {
  from {
    transform: translateY(8px);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .toast {
    transition: none;
    animation: none;
  }
  /* No fade, so the toast stays until it goes away. */
  .fading {
    opacity: 1;
  }
}
</style>
