import { balance } from '../balance'
import { harvestSeed } from '../farm/harvest'
import type { Variety } from '../farm/yield'
import { roundIncome } from '../money'
import { mulberry32 } from '../rng'
import type { GameState } from '../state'
import type { Batch } from '../storage/storage'
import { clock } from '../time/time'

// An NPC buyer order. The UI gives the buyer a name from the id.
export interface Order {
  id: number
  variety: Variety
  units: number
  minQuality: number
  // Hundredths of CC per unit.
  price: number
  // The last game day on which the player can deliver.
  deadlineDay: number
}

export interface OrdersState {
  open: Order[]
  nextId: number
}

export interface DeliverOrder {
  type: 'DeliverOrder'
  id: number
}

// Harvest seeds use indexes >= 0.
export const ORDERS_STREAM = -2

// Orders take raw coffee only. Washed coffee sells to the bank.
const qualifies = (order: Order) => (b: Batch) =>
  b.variety === order.variety && !b.washed && b.quality >= order.minQuality

export const deliverableUnits = (state: GameState, order: Order): number =>
  state.storage.batches.filter(qualifies(order)).reduce((sum, b) => sum + b.units, 0)

// Runs once per game day: drops expired orders and may post one new order.
export function dailyOrders(state: GameState): GameState {
  const cfg = balance()
  const o = cfg.orders
  const day = clock(state.time.hour).day
  const open = state.orders.open.filter((order) => order.deadlineDay >= day)
  let nextId = state.orders.nextId
  const random = mulberry32(harvestSeed(state.world.seed, day, ORDERS_STREAM))
  const int = ([min, max]: readonly number[]) => min! + Math.floor(random() * (max! - min! + 1))
  if (open.length < o.maxOpen && random() < o.chancePerDay) {
    const varieties = (Object.keys(cfg.varieties) as Variety[]).filter(
      (v) => cfg.varieties[v].unlockCapital === 0,
    )
    const variety = varieties[Math.floor(random() * varieties.length)]!
    const units = int(o.units)
    const minQuality = int(o.minQuality)
    const [lo, hi] = o.priceFactor
    const priceFactor = lo + random() * (hi - lo)
    const price = Math.round(cfg.varieties[variety].referencePrice * priceFactor * 100)
    const deadlineDay = day + int(o.deadlineDays)
    open.push({ id: nextId++, variety, units, minQuality, price, deadlineDay })
  }
  return { ...state, orders: { open, nextId } }
}

export function deliverOrder(state: GameState, command: DeliverOrder): GameState {
  const order = state.orders.open.find((o) => o.id === command.id)
  if (!order) throw new Error(`No open order: ${command.id}`)
  if (clock(state.time.hour).day > order.deadlineDay) {
    throw new Error(`Order ${order.id} is past its deadline day ${order.deadlineDay}`)
  }
  const stock = deliverableUnits(state, order)
  if (stock < order.units) throw new Error(`Not enough units for order: ${stock} < ${order.units}`)

  // Batches are in harvest order, so the first batches are the oldest.
  const take = qualifies(order)
  let rest = order.units
  const batches = state.storage.batches
    .map((b) => {
      if (!take(b) || rest === 0) return b
      const units = Math.min(rest, b.units)
      rest -= units
      return { ...b, units: b.units - units }
    })
    .filter((b) => b.units > 0)

  return {
    ...state,
    money: state.money + roundIncome(order.units * order.price),
    storage: { ...state.storage, batches },
    orders: { ...state.orders, open: state.orders.open.filter((o) => o !== order) },
  }
}
