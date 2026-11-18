import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import type { Variety } from '../farm/yield'
import { roundCost, roundIncome } from '../money'
import { isRunning } from '../processing/process'
import type { GameState } from '../state'
import type { Batch } from '../storage/storage'

// The bank buys raw and washed coffee and sells seed.
export interface Good {
  kind: 'coffee' | 'washed' | 'seed'
  variety: Variety
}

export type GoodKind = Good['kind']

// Traded units of one good as of its last trade day. The volume halves every
// market.volumeHalfLifeDays. Each sale (coffee) or purchase (seed) adds its units after the decay
// to the trade day.
export interface Volume {
  units: number
  day: number
  // Volume on the last day of each month before the month of day, oldest first, for the price
  // history. At most historyMonths − 1 entries; the last one is the month just before.
  monthEnds: number[]
}

export type Volumes = Partial<Record<GoodKind, Partial<Record<Variety, Volume>>>>

export interface MarketState {
  volumes: Volumes
  seeds: Partial<Record<Variety, number>>
}

export interface Sell {
  type: 'Sell'
  variety: Variety
  units: number
  washed?: true
  // Both set: sells only the batches of this quality and storage day (one storage panel row).
  quality?: number
  storedDay?: number
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
  if (good.kind === 'seed') return variety.seedCost
  const washed = good.kind === 'washed' ? cfg.processing.washed.valueMultiplier : 1
  return variety.referencePrice * washed
}

const decay = (v: Volume, day: number, cfg: Balance) =>
  v.units * 2 ** (-Math.max(0, day - v.day) / cfg.market.volumeHalfLifeDays)

// The volume moved forward to day: pure decay, with the month ends it passes.
function advance(v: Volume | undefined, day: number, cfg: Balance): Volume {
  if (!v) return { units: 0, day, monthEnds: [] }
  const perMonth = cfg.time.daysPerMonth
  const from = Math.floor(v.day / perMonth)
  const to = Math.floor(day / perMonth)
  const passed = Array.from(
    { length: Math.max(0, Math.min(to - from, cfg.market.historyMonths)) },
    (_, i) => decay(v, (to - i) * perMonth - 1, cfg),
  ).reverse()
  const monthEnds = [...v.monthEnds, ...passed].slice(-(cfg.market.historyMonths - 1))
  return { units: decay(v, day, cfg), day: Math.max(v.day, day), monthEnds }
}

// Volume of a good on a day, after the decay since its last trade.
export function volumeOn(volumes: Volumes, good: Good, day: number, cfg = balance()): number {
  const v = volumes[good.kind]?.[good.variety]
  return v ? decay(v, day, cfg) : 0
}

// Mean of 1 − 2^(−u / half) over the volumes u from `from` to `from + units`.
// With units 0 it is the value at `from`. The exact mean makes one trade cost the same
// as two trades of half the units.
function saturation(from: number, units: number, half: number): number {
  const start = 2 ** (-from / half)
  if (units === 0) return 1 - start
  // ∫ 2^(−u / half) du = half / ln 2 × (2^(−from / half) − 2^(−to / half))
  const k = Math.LN2 / half
  return 1 + (start * Math.expm1(-k * units)) / (k * units)
}

// Market price of a good at a volume. With units, it is the mean price per unit of a trade of
// that size: the trade adds to the volume as it goes. The factor approaches the far end of its
// range but never reaches it: supply goes down, demand up.
export function priceAt(good: Good, volume: number, cfg = balance(), units = 0): number {
  const m = cfg.market
  const factor =
    good.kind !== 'seed'
      ? 1 - (1 - m.supplyFactorRange[0]!) * saturation(volume, units, m.supplyUnitsForHalfFactor)
      : 1 + (m.demandFactorRange[1]! - 1) * saturation(volume, units, m.demandUnitsForHalfFactor)
  const ref = reference(good, cfg)
  return clamp(ref * factor, [m.priceFloor * ref, m.priceCeiling * ref])
}

// Market price of a good on a game day, from the decayed volume of that day.
export const marketPrice = (
  volumes: Volumes,
  good: Good,
  day: number,
  cfg = balance(),
  units = 0,
): number => priceAt(good, volumeOn(volumes, good, day, cfg), cfg, units)

// Price in CC per unit that the bank pays for raw (or washed) coffee today.
// With units, it is the mean price per unit of a sale of that size.
export function bankBuyPrice(
  state: GameState,
  variety: Variety,
  units = 0,
  washed = false,
): number {
  const cfg = balance()
  const day = state.time.day
  const good: Good = { kind: washed ? 'washed' : 'coffee', variety }
  return marketPrice(state.market.volumes, good, day, cfg, units) * cfg.market.bankBuyFactor
}

// Whole-CC income of a sale, in hundredths of CC. The sell command and the HUD both use it.
export const sellIncome = (state: GameState, variety: Variety, units: number, washed = false) =>
  roundIncome(Math.round(units * bankBuyPrice(state, variety, units, washed) * 100))

// Price in CC per unit that the bank asks for seed today.
// With units, it is the mean price per unit of a purchase of that size.
export function bankSellPrice(state: GameState, variety: Variety, units = 0): number {
  const day = state.time.day
  return marketPrice(state.market.volumes, { kind: 'seed', variety }, day, balance(), units)
}

// Market prices of the last historyMonths months, from the oldest month to the current month.
// A past month gives the price of its last day. The current month gives the price of today.
// A month before the first trade gives the neutral price.
export function priceHistory(state: GameState, good: Good): number[] {
  const cfg = balance()
  const today = state.time.day
  const v = state.market.volumes[good.kind]?.[good.variety]
  const { monthEnds, units } = advance(v, today, cfg)
  const past = cfg.market.historyMonths - 1
  const volumes = [...Array<number>(past - monthEnds.length).fill(0), ...monthEnds, units]
  return volumes.map((volume) => priceAt(good, volume, cfg))
}

function checkTrade(command: Sell | Buy, cfg: Balance) {
  if (!Object.hasOwn(cfg.varieties, command.variety))
    throw new Error(`Unknown variety: ${command.variety}`)
  if (!Number.isInteger(command.units) || command.units <= 0) {
    throw new Error(`Units must be a positive integer: ${command.units}`)
  }
}

// Decays the volume of the good to today and adds the trade.
function record(volumes: Volumes, good: Good, units: number, day: number, cfg: Balance): Volumes {
  const v = advance(volumes[good.kind]?.[good.variety], day, cfg)
  return {
    ...volumes,
    [good.kind]: { ...volumes[good.kind], [good.variety]: { ...v, units: v.units + units } },
  }
}

export function sell(state: GameState, command: Sell): GameState {
  const cfg = balance()
  checkTrade(command, cfg)
  const { variety, units } = command
  const washed = command.washed === true
  // A washed sale takes only ready washed batches. A raw sale takes only raw batches.
  const sellable = (b: Batch) =>
    b.variety === variety &&
    (washed ? b.washed === true && !isRunning(b, state.time.day) : !b.washed) &&
    (command.quality === undefined || b.quality === command.quality) &&
    (command.storedDay === undefined || b.storedDay === command.storedDay)
  const stored = state.storage.batches.filter(sellable).reduce((sum, b) => sum + b.units, 0)
  if (units > stored) throw new Error(`Not enough ${variety} in storage: ${stored} < ${units}`)

  const income = sellIncome(state, variety, units, washed)
  // Batches are in harvest order, so the first batches are the oldest.
  let rest = units
  const batches = state.storage.batches
    .map((b) => {
      if (!sellable(b) || rest === 0) return b
      const take = Math.min(rest, b.units)
      rest -= take
      return { ...b, units: b.units - take }
    })
    .filter((b) => b.units > 0)

  const day = state.time.day
  const volumes = record(
    state.market.volumes,
    { kind: washed ? 'washed' : 'coffee', variety },
    units,
    day,
    cfg,
  )
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
  const cost = roundCost(Math.round(units * bankSellPrice(state, variety, units) * 100))
  if (cost > state.money)
    throw new Error(`Not enough money: cost ${cost / 100} CC, balance ${state.money / 100} CC`)

  const day = state.time.day
  const volumes = record(state.market.volumes, { kind: 'seed', variety }, units, day, cfg)
  const seeds = { ...state.market.seeds, [variety]: (state.market.seeds[variety] ?? 0) + units }
  return { ...state, money: state.money - cost, market: { ...state.market, volumes, seeds } }
}
