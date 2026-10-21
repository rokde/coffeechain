import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Command } from '../sim/commands'

// UI timing, not balancing, so these stay out of config/balance.json.
export const HOLD_MS = 1000
export const FADE_MS = 400
export const MAX_TOASTS = 3

export type BookingReason =
  | 'parcel'
  | 'plant'
  | 'fertilize'
  | 'irrigate'
  | 'protect'
  | 'harvest'
  | 'sell'
  | 'buy'
  | 'build'
  | 'process'
  | 'order'
  | 'tick'

// A new command type without an entry here fails the typecheck.
export const reasons: Record<Command['type'], BookingReason | null> = {
  SetSpeed: null,
  CreateParcels: 'parcel',
  Plant: 'plant',
  Fertilize: 'fertilize',
  Irrigate: 'irrigate',
  ProtectPests: 'protect',
  Harvest: 'harvest',
  Sell: 'sell',
  Buy: 'buy',
  Build: 'build',
  Process: 'process',
  DeliverOrder: 'order',
}

export interface Toast {
  id: number
  reason: BookingReason
  // cents, negative for a cost
  amount: number
  // performance.now() of the last booking
  last: number
}

export function toastPhase(toast: Toast, now: number): 'shown' | 'fading' | 'gone' {
  const age = now - toast.last
  if (age <= HOLD_MS) return 'shown'
  return age <= HOLD_MS + FADE_MS ? 'fading' : 'gone'
}

// A booking adds to the toast of its reason while that toast is in its hold time. Else it makes a new toast.
// Ticks never merge: at high speed each day would keep the storage cost toast alive for ever.
export function merge(
  toasts: readonly Toast[],
  reason: BookingReason,
  amount: number,
  now: number,
  id: number,
): Toast[] {
  const live = toasts.filter((t) => toastPhase(t, now) !== 'gone')
  const open =
    reason !== 'tick' && live.find((t) => t.reason === reason && toastPhase(t, now) === 'shown')
  if (open)
    return live.map((t) => (t === open ? { ...t, amount: t.amount + amount, last: now } : t))
  return [...live, { id, reason, amount, last: now }].slice(-MAX_TOASTS)
}

export const useBookingsStore = defineStore('bookings', () => {
  const toasts = ref<Toast[]>([])
  const now = ref(0)
  let nextId = 0

  let timer: ReturnType<typeof setTimeout> | undefined

  // One timer that runs at the next phase change of a toast. It stops when no toast is left.
  function schedule() {
    clearTimeout(timer)
    if (!toasts.value.length) return
    const next = Math.min(
      ...toasts.value.map((t) =>
        toastPhase(t, now.value) === 'shown' ? t.last + HOLD_MS : t.last + HOLD_MS + FADE_MS,
      ),
    )
    // The margin makes sure that the phase has changed when the timer runs.
    timer = setTimeout(refresh, next - now.value + 10)
  }

  function refresh() {
    now.value = performance.now()
    toasts.value = toasts.value.filter((t) => toastPhase(t, now.value) !== 'gone')
    schedule()
  }

  function book(reason: BookingReason, amount: number) {
    now.value = performance.now()
    toasts.value = merge(toasts.value, reason, amount, now.value, nextId++)
    schedule()
  }

  return { toasts, now, book }
})
