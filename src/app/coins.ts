import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useBookingsStore, type BookingReason } from './bookings'

// UI timing, not balancing, so these stay out of config/balance.json.
export const RISE_PX = 40
export const LIFE_MS = 800
export const THROTTLE_MS = 250
export const MAX_COINS = 4
// The largest coin box. FloatingCoins.vue centers the box on the start point.
export const COIN_W = 120
export const COIN_H = 24

export interface Point {
  x: number
  y: number
}

export interface Coin {
  id: number
  reason: BookingReason
  // cents, negative for a cost
  amount: number
  at: Point
  // performance.now() of the first booking
  start: number
}

// A booking adds to a coin of its reason that started less than THROTTLE_MS ago. Else it makes a new coin.
export function addCoin(
  coins: readonly Coin[],
  booking: { reason: BookingReason; amount: number },
  at: Point | null,
  now: number,
  id: number,
): readonly Coin[] {
  if (booking.reason === 'tick' || !at) return coins
  const live = coins.filter((c) => now - c.start <= LIFE_MS)
  const open = live.find((c) => c.reason === booking.reason && now - c.start < THROTTLE_MS)
  if (open) return live.map((c) => (c === open ? { ...c, amount: c.amount + booking.amount } : c))
  return [...live, { id, reason: booking.reason, amount: booking.amount, at, start: now }].slice(
    -MAX_COINS,
  )
}

// Clamps the pointer, so the coin box stays in the viewport at the start and after the rise.
export function coinStart(pointer: Point, viewport: { width: number; height: number }): Point {
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
  return {
    x: clamp(pointer.x, COIN_W / 2, viewport.width - COIN_W / 2),
    y: clamp(pointer.y, RISE_PX + COIN_H / 2, viewport.height - COIN_H / 2),
  }
}

export const useCoinsStore = defineStore('coins', () => {
  const coins = ref<readonly Coin[]>([])
  // The start point of the next coin: the last pointer position after coinStart. null before the first pointer event.
  const pointer = ref<Point | null>(null)
  let nextId = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  // One timer that runs when the oldest coin ends. It stops when no coin is left.
  function schedule() {
    clearTimeout(timer)
    if (!coins.value.length) return
    const end = Math.min(...coins.value.map((c) => c.start)) + LIFE_MS
    timer = setTimeout(refresh, end - performance.now() + 10)
  }

  function refresh() {
    const now = performance.now()
    coins.value = coins.value.filter((c) => now - c.start <= LIFE_MS)
    schedule()
  }

  useBookingsStore().$onAction(({ name, args }) => {
    if (name !== 'book') return
    const [reason, amount] = args as [BookingReason, number]
    const next = addCoin(coins.value, { reason, amount }, pointer.value, performance.now(), nextId)
    if (next === coins.value) return
    nextId++
    coins.value = next
    schedule()
  })

  return { coins, pointer }
})
