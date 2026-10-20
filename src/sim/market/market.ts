import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import { priceEventFactor } from '../events/effects'
import type { Variety } from '../farm/yield'
import type { GameState } from '../state'
import { clock } from '../time/time'

// The bank buys raw coffee and sells seed.
export interface Good {
  kind: 'coffee' | 'seed'
  variety: Variety
}

// Units sold (coffee) or bought (seed) by the player on one game day.
export interface Volume extends Good {
  day: number
  units: number
}

export interface MarketState {
  volumes: Volume[]
  seeds: Partial<Record<Variety, number>>
}

export interface Sell {
  type: 'Sell'
  variety: Variety
  units: number
}

export interface Buy {
  type: 'Buy'
  variety: Variety
  units: number
}

const clamp = (value: number, [min, max]: readonly number[]) =>
  Math.min(max!, Math.max(min!, value))

function reference(good: Good, cfg: Balance): number {
  const variety = cfg.varieties[good.variety]
  return good.kind === 'coffee' ? variety.referencePrice : variety.seedCost
}

// Market price of a good on a game day, from the volumes in the window that ends on that day.
// extra adds units to the volume of that day, for example half of a trade.
// eventFactor comes from priceEventFactor (coffee only).
export function marketPrice(
  market: MarketState,
  good: Good,
  day: number,
  cfg = balance(),
  extra = 0,
  eventFactor = 1,
): number {
  const m = cfg.market
  const units = market.volumes
    .filter((v) => v.kind === good.kind && v.variety === good.variety)
    .filter((v) => v.day <= day && v.day > day - m.volumeWindowDays)
    .reduce((sum, v) => sum + v.units, extra)
  // The factor moves linearly from 1.0 to the far end of its range: supply goes down, demand up.
  const factor =
    good.kind === 'coffee'
      ? clamp(
          1 - (1 - m.supplyFactorRange[0]) * Math.min(1, units / m.supplyUnitsForMinFactor),
          m.supplyFactorRange,
        )
      : clamp(
          1 + (m.demandFactorRange[1] - 1) * Math.min(1, units / m.demandUnitsForMaxFactor),
          m.demandFactorRange,
        )
  const ref = reference(good, cfg)
  return clamp(ref * eventFactor * factor, [m.priceFloor * ref, m.priceCeiling * ref])
}

// Price in CC per unit that the bank pays for raw coffee today.
// With units, it is the price for each unit of a sale of that size, at the mid volume of the sale.
export function bankBuyPrice(state: GameState, variety: Variety, units = 0): number {
  const cfg = balance()
  const day = clock(state.time.hour).day
  const good: Good = { kind: 'coffee', variety }
  const event = priceEventFactor(state, variety, day)
  return marketPrice(state.market, good, day, cfg, units / 2, event) * cfg.market.bankBuyFactor
}

// Price in CC per unit that the bank asks for seed today.
// With units, it is the price for each unit of a purchase of that size, at the mid volume of the purchase.
export function bankSellPrice(state: GameState, variety: Variety, units = 0): number {
  const day = clock(state.time.hour).day
  return marketPrice(state.market, { kind: 'seed', variety }, day, balance(), units / 2)
}

// Market prices of the last historyDays game days, from the oldest day to today.
export function priceHistory(state: GameState, good: Good): number[] {
  const cfg = balance()
  const today = clock(state.time.hour).day
  const days = cfg.market.historyDays
  return Array.from({ length: days }, (_, i) => {
    const day = today - days + 1 + i
    // shortcut: ended events leave state.events, so older days show no event factor.
    // Store a factor per day when the chart must show past events.
    const event = good.kind === 'coffee' ? priceEventFactor(state, good.variety, day) : 1
    return marketPrice(state.market, good, day, cfg, 0, event)
  })
}

function checkTrade(command: Sell | Buy, cfg: Balance) {
  if (!Object.hasOwn(cfg.varieties, command.variety))
    throw new Error(`Unknown variety: ${command.variety}`)
  if (!Number.isInteger(command.units) || command.units <= 0) {
    throw new Error(`Units must be a positive integer: ${command.units}`)
  }
}

// Adds the trade to today's volume and drops volumes that no price in the history needs.
function record(market: MarketState, good: Good, units: number, day: number, cfg: Balance) {
  const keep = cfg.market.historyDays + cfg.market.volumeWindowDays
  const volumes = market.volumes.filter((v) => v.day > day - keep)
  const same = (v: Volume) => v.kind === good.kind && v.variety === good.variety && v.day === day
  const i = volumes.findIndex(same)
  if (i < 0) volumes.push({ ...good, day, units })
  else volumes[i] = { ...volumes[i]!, units: volumes[i]!.units + units }
  return volumes
}

export function sell(state: GameState, command: Sell): GameState {
  const cfg = balance()
  checkTrade(command, cfg)
  const { variety, units } = command
  const stored = state.storage.batches
    .filter((b) => b.variety === variety)
    .reduce((sum, b) => sum + b.units, 0)
  if (units > stored) throw new Error(`Not enough ${variety} in storage: ${stored} < ${units}`)

  const income = Math.round(units * bankBuyPrice(state, variety, units) * 100)
  // Batches are in harvest order, so the first batches are the oldest.
  let rest = units
  const batches = state.storage.batches
    .map((b) => {
      if (b.variety !== variety || rest === 0) return b
      const take = Math.min(rest, b.units)
      rest -= take
      return { ...b, units: b.units - take }
    })
    .filter((b) => b.units > 0)

  const day = clock(state.time.hour).day
  const volumes = record(state.market, { kind: 'coffee', variety }, units, day, cfg)
  return {
    ...state,
    money: state.money + income,
    storage: { ...state.storage, batches },
    market: { ...state.market, volumes },
  }
}

export function buy(state: GameState, command: Buy): GameState {
  const cfg = balance()
  checkTrade(command, cfg)
  const { variety, units } = command
  const cost = Math.round(units * bankSellPrice(state, variety, units) * 100)
  if (cost > state.money)
    throw new Error(`Not enough money: cost ${cost / 100} CC, balance ${state.money / 100} CC`)

  const day = clock(state.time.hour).day
  const volumes = record(state.market, { kind: 'seed', variety }, units, day, cfg)
  const seeds = { ...state.market.seeds, [variety]: (state.market.seeds[variety] ?? 0) + units }
  return { ...state, money: state.money - cost, market: { volumes, seeds } }
}
