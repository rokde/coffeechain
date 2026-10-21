import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { isFree, quoteParcels } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import { FADE_MS, HOLD_MS, merge, toastPhase, useBookingsStore, type Toast } from './bookings'
import { useGameStore } from './store'

vi.stubGlobal('location', { search: '?seed=42' })

function setup() {
  const pinia = createPinia()
  return { game: useGameStore(pinia), bookings: useBookingsStore(pinia) }
}

describe('bookings from the game store', () => {
  it('books the money change of a command with its reason', () => {
    const { game, bookings } = setup()
    const state = game.state as GameState
    const p = state.world.parcels.find((q) => q.zone === 'tiefland' && isFree(state, q.x, q.y))!
    const cost = quoteParcels(state, [p])
    game.dispatch({ type: 'CreateParcels', parcels: [{ x: p.x, y: p.y }] })
    expect(bookings.toasts.map((t) => [t.reason, t.amount])).toEqual([['parcel', -cost]])
  })

  it('books a sale as income', () => {
    const { game, bookings } = setup()
    const state = game.state as GameState
    game.replace({
      ...state,
      storage: { ...state.storage, batches: [{ variety: 'robusta', units: 10, quality: 1 }] },
    })
    bookings.toasts = []
    const before = game.state.money
    game.dispatch({ type: 'Sell', variety: 'robusta', units: 10 })
    expect(bookings.toasts).toHaveLength(1)
    expect(bookings.toasts[0]!.reason).toBe('sell')
    expect(bookings.toasts[0]!.amount).toBe(game.state.money - before)
    expect(bookings.toasts[0]!.amount).toBeGreaterThan(0)
  })

  it('books nothing for a speed change', () => {
    const { game, bookings } = setup()
    game.dispatch({ type: 'SetSpeed', speed: 4 })
    expect(bookings.toasts).toEqual([])
  })

  it('books a tick with less money as storage cost', () => {
    const { game, bookings } = setup()
    const state = game.state as GameState
    game.replace({ ...state, money: state.money - 250 })
    expect(bookings.toasts.map((t) => [t.reason, t.amount])).toEqual([['tick', -250]])
  })
})

describe('merge', () => {
  it('sums bookings of one reason within the hold time', () => {
    let toasts: Toast[] = []
    let id = 0
    const book = (reason: Toast['reason'], amount: number, now: number) =>
      (toasts = merge(toasts, reason, amount, now, id++))
    book('parcel', -4000, 0)
    book('parcel', -4000, 500)
    book('plant', -1000, 600)
    book('parcel', -4000, 1400)
    expect(toasts.map((t) => [t.reason, t.amount])).toEqual([
      ['parcel', -12000],
      ['plant', -1000],
    ])
    // More than 1000 ms after the last parcel booking, so a new toast. The plant toast is gone.
    book('parcel', -4000, 2500)
    expect(toasts.map((t) => [t.reason, t.amount])).toEqual([
      ['parcel', -12000],
      ['parcel', -4000],
    ])
  })

  it('a 4th toast removes the oldest one', () => {
    let toasts: Toast[] = []
    toasts = merge(toasts, 'parcel', -4000, 0, 0)
    toasts = merge(toasts, 'plant', -1000, 10, 1)
    toasts = merge(toasts, 'fertilize', -200, 20, 2)
    toasts = merge(toasts, 'sell', 500, 30, 3)
    expect(toasts.map((t) => t.reason)).toEqual(['plant', 'fertilize', 'sell'])
  })

  it('drops toasts that are gone', () => {
    const toasts = merge([], 'parcel', -4000, 0, 0)
    expect(merge(toasts, 'plant', -100, 1401, 1).map((t) => t.reason)).toEqual(['plant'])
  })
})

describe('toastPhase', () => {
  it('shows a toast for 1000 ms, fades it until 1400 ms and then removes it', () => {
    const toast: Toast = { id: 0, reason: 'parcel', amount: -4000, last: 500 }
    expect([HOLD_MS, FADE_MS]).toEqual([1000, 400])
    expect(toastPhase(toast, 500)).toBe('shown')
    expect(toastPhase(toast, 1500)).toBe('shown')
    expect(toastPhase(toast, 1501)).toBe('fading')
    expect(toastPhase(toast, 1900)).toBe('fading')
    expect(toastPhase(toast, 1901)).toBe('gone')
  })

  it('a booking in the hold time starts the hold time again', () => {
    const toasts = merge(merge([], 'parcel', -4000, 0, 0), 'parcel', -4000, 900, 1)
    expect(toastPhase(toasts[0]!, 1800)).toBe('shown')
  })

  it('the store removes the toast after the fade', () => {
    vi.useFakeTimers()
    try {
      const { bookings } = setup()
      bookings.book('parcel', -4000)
      vi.advanceTimersByTime(HOLD_MS + 20)
      expect(toastPhase(bookings.toasts[0]!, bookings.now)).toBe('fading')
      vi.advanceTimersByTime(FADE_MS)
      expect(bookings.toasts).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})
