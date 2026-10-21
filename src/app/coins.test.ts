import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { isFree, quoteParcels } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import {
  addCoin,
  COIN_H,
  COIN_W,
  coinStart,
  LIFE_MS,
  MAX_COINS,
  RISE_PX,
  THROTTLE_MS,
  useCoinsStore,
  type Coin,
} from './coins'
import { useGameStore } from './store'

vi.stubGlobal('location', { search: '?seed=42' })

const at = { x: 100, y: 200 }

describe('addCoin (AC-1)', () => {
  it('uses the UI timing of the spec', () => {
    expect([RISE_PX, LIFE_MS, THROTTLE_MS, MAX_COINS]).toEqual([40, 800, 250, 4])
  })

  it('a tick booking or no pointer position gives no change', () => {
    const coins = addCoin([], { reason: 'parcel', amount: -100 }, at, 0, 0)
    expect(addCoin(coins, { reason: 'tick', amount: -50 }, at, 10, 1)).toBe(coins)
    expect(addCoin(coins, { reason: 'plant', amount: -50 }, null, 10, 1)).toBe(coins)
  })

  it('a booking of the same reason within 250 ms adds to that coin', () => {
    let coins = addCoin([], { reason: 'parcel', amount: -100 }, at, 0, 0)
    coins = addCoin(coins, { reason: 'parcel', amount: -200 }, { x: 300, y: 300 }, 249, 1)
    expect(coins).toEqual<Coin[]>([{ id: 0, reason: 'parcel', amount: -300, at, start: 0 }])
  })

  it('a booking after 250 ms or with a different reason makes a new coin', () => {
    let coins = addCoin([], { reason: 'parcel', amount: -100 }, at, 0, 0)
    coins = addCoin(coins, { reason: 'plant', amount: -10 }, at, 100, 1)
    coins = addCoin(coins, { reason: 'parcel', amount: -200 }, at, 250, 2)
    expect(coins.map((c) => [c.reason, c.amount, c.start])).toEqual([
      ['parcel', -100, 0],
      ['plant', -10, 100],
      ['parcel', -200, 250],
    ])
  })

  it('drops coins older than 800 ms', () => {
    let coins = addCoin([], { reason: 'parcel', amount: -100 }, at, 0, 0)
    coins = addCoin(coins, { reason: 'plant', amount: -10 }, at, 800, 1)
    expect(coins.map((c) => c.id)).toEqual([0, 1])
    coins = addCoin(coins, { reason: 'sell', amount: 10 }, at, 801, 2)
    expect(coins.map((c) => c.id)).toEqual([1, 2])
  })

  it('a fifth coin pushes out the oldest', () => {
    let coins: readonly Coin[] = []
    const reasons = ['parcel', 'plant', 'fertilize', 'irrigate', 'sell'] as const
    reasons.forEach((reason, i) => (coins = addCoin(coins, { reason, amount: -1 }, at, i, i)))
    expect(coins.map((c) => c.reason)).toEqual(reasons.slice(1))
  })
})

describe('coinStart (AC-2)', () => {
  const viewport = { width: 800, height: 600 }
  const inside = (p: { x: number; y: number }) =>
    p.x - COIN_W / 2 >= 0 &&
    p.x + COIN_W / 2 <= viewport.width &&
    p.y - RISE_PX - COIN_H / 2 >= 0 &&
    p.y + COIN_H / 2 <= viewport.height

  it('keeps a pointer 60 px or more from each edge', () => {
    for (const p of [
      { x: 60, y: 60 },
      { x: 740, y: 540 },
      { x: 400, y: 300 },
    ])
      expect(coinStart(p, viewport)).toEqual(p)
  })

  it('clamps a pointer near an edge, so the coin box stays inside at the start and after the rise', () => {
    for (const p of [
      { x: 2, y: 2 },
      { x: 798, y: 598 },
      { x: 2, y: 598 },
      { x: 798, y: 2 },
    ]) {
      const start = coinStart(p, viewport)
      expect(start).not.toEqual(p)
      expect(inside(start), JSON.stringify(start)).toBe(true)
    }
  })
})

describe('coins store (AC-3)', () => {
  function setup() {
    const pinia = createPinia()
    const coins = useCoinsStore(pinia)
    return { game: useGameStore(pinia), coins }
  }
  const buyParcel = (game: ReturnType<typeof useGameStore>) => {
    const state = game.state as GameState
    const p = state.world.parcels.find((q) => q.zone === 'tiefland' && isFree(state, q.x, q.y))!
    const cost = quoteParcels(state, [p])
    game.dispatch({ type: 'CreateParcels', parcels: [{ x: p.x, y: p.y }] })
    return cost
  }

  it('a command that costs money makes one coin at the pointer, and it goes after 800 ms', () => {
    vi.useFakeTimers()
    try {
      const { game, coins } = setup()
      coins.pointer = { x: 300, y: 200 }
      const cost = buyParcel(game)
      expect(coins.coins.map((c) => [c.reason, c.amount, c.at])).toEqual([
        ['parcel', -cost, { x: 300, y: 200 }],
      ])
      vi.advanceTimersByTime(LIFE_MS + 20)
      expect(coins.coins).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('a tick with less money makes no coin', () => {
    const { game, coins } = setup()
    coins.pointer = { x: 300, y: 200 }
    const state = game.state as GameState
    game.replace({ ...state, money: state.money - 250 })
    expect(coins.coins).toEqual([])
  })

  it('no pointer position makes no coin', () => {
    const { game, coins } = setup()
    buyParcel(game)
    expect(coins.coins).toEqual([])
  })
})
