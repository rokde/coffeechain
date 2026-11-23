import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import type { Balance } from '../config/balance.schema'
import { balance } from '../src/sim/balance'
import { dispatch, type Command } from '../src/sim/commands'
import { isFree, quoteParcels } from '../src/sim/farm/parcels'
import { growth, quotePlant } from '../src/sim/farm/plants'
import type { Variety } from '../src/sim/farm/yield'
import { bankBuyPrice, bankSellPrice, marketPrice, type Sell } from '../src/sim/market/market'
import { deliverableUnits, type Order } from '../src/sim/market/orders'
import { capital } from '../src/sim/progression/capital'
import { createState, type GameState } from '../src/sim/state'
import { storageCapacity } from '../src/sim/storage/capacity'
import { monthlyStorageCost } from '../src/sim/storage/overview'
import { ageMonths, storageUsed, type Batch } from '../src/sim/storage/storage'
import { step } from '../src/sim/time/time'

// How the bot sells its stock (#50).
// bank-now: sells every harvest to the bank right away.
// hold: holds stock while the bank price is low and waiting pays more than the storage costs.
// orders: delivers every open order it can meet and sells the rest to the bank.
export const STRATEGIES = ['bank-now', 'hold', 'orders'] as const
export type Strategy = (typeof STRATEGIES)[number]

// Bot parameters, not game balance: they stay out of config/balance.json.
export interface HoldParams {
  // Sells a variety when the mean bank price of the sale is at least this share of its bank price
  // at an untouched market (reference price × bankBuyFactor).
  minPriceFactor: number
  // Sells the oldest units down to this share of the storage capacity.
  maxStockShare: number
  // Sells batches that have been in storage for this many full months.
  maxAgeMonths: number
}

export interface OrdersParams {
  // Keeps at most this share of the storage capacity back for open orders.
  reserveShare: number
}

export interface BotParams {
  hold: HoldParams
  orders: OrdersParams
}

export const BOT_PARAMS: BotParams = {
  hold: { minPriceFactor: 0.9, maxStockShare: 0.8, maxAgeMonths: 6 },
  orders: { reserveShare: 0.5 },
}

export interface Channel {
  units: number
  // Hundredths of CC.
  income: number
}

export interface BotResult {
  seed: number
  strategy: Strategy
  bank: Channel
  orders: Channel
  // Orders posted during the run and orders the bot delivered.
  ordersSeen: number
  ordersDelivered: number
  // Hundredths of CC booked at the month turns.
  storageCost: number
  // Quality points lost in storage, summed over all units (units × points).
  qualityLoss: number
  // Capital in CC at the end of each game day. Index 0 is day 1.
  curve: number[]
  // Robusta supply factor (market price / reference price) at the end of each game day.
  supply: number[]
  // Robusta seed demand factor (seed price / seed cost) at the end of each game day.
  demand: number[]
  parcels: number
  // Lowest balance in hundredths of CC after any action or day.
  minMoney: number
  // Hundredths of CC.
  parcelSpend: number
  totalSpend: number
}

// First game day (1-based) with capital at or above the threshold.
export function daysTo(curve: number[], threshold: number): number | null {
  const i = curve.findIndex((c) => c >= threshold)
  return i < 0 ? null : i + 1
}

const at = (state: GameState, index: number) => state.world.parcels[index]!

const isRaw = (b: Batch) => !b.washed

// Sales of all raw stock except the kept units, one Sell per variety in storage order.
// keep[i] is the number of units of batch i that stay in storage.
export function sellAllBut(state: GameState, keep: number[] = []): Sell[] {
  const batches = state.storage.batches
  const kept = (i: number) => keep[i] ?? 0
  const sells: Sell[] = []
  for (const variety of new Set(batches.filter(isRaw).map((b) => b.variety))) {
    const rows = batches
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => isRaw(b) && b.variety === variety)
    if (rows.every(({ i }) => kept(i) === 0)) {
      const units = rows.reduce((sum, { b }) => sum + b.units, 0)
      sells.push({ type: 'Sell', variety, units })
      continue
    }
    // Some units stay: sell per quality and storage day. Batches with the same key are alike.
    const free = new Map<string, Sell>()
    for (const { b, i } of rows) {
      const key = `${b.quality}:${b.storedDay}`
      const sell = free.get(key) ?? {
        type: 'Sell',
        variety,
        units: 0,
        quality: b.quality,
        storedDay: b.storedDay,
      }
      free.set(key, { ...sell, units: sell.units + b.units - kept(i) })
    }
    sells.push(...[...free.values()].filter((s) => s.units > 0))
  }
  return sells
}

// The open order with the best price that the stock can meet today, or undefined.
export function nextDelivery(state: GameState): Order | undefined {
  return [...state.orders.open]
    .sort((a, b) => b.price - a.price || a.id - b.id)
    .find((o) => o.deadlineDay >= state.time.day && deliverableUnits(state, o) >= o.units)
}

// Units per batch the orders strategy keeps for open orders it cannot meet yet. The earliest
// deadline goes first. An order gets units only if all of them fit into the rest of the reserve.
// Like DeliverOrder it picks the lowest qualifying quality first, the oldest batch within a quality.
export function reserveForOrders(state: GameState, p: OrdersParams, cfg = balance()): number[] {
  const batches = state.storage.batches
  const keep = batches.map(() => 0)
  let budget = Math.floor(storageCapacity(state, cfg) * p.reserveShare)
  const orders = [...state.orders.open].sort(
    (a, b) => a.deadlineDay - b.deadlineDay || b.price - a.price || a.id - b.id,
  )
  for (const order of orders) {
    if (order.units > budget) continue
    const picks = batches
      .map((_, i) => i)
      .filter((i) => {
        const b = batches[i]!
        return isRaw(b) && b.variety === order.variety && b.quality >= order.minQuality
      })
      .sort(
        (a, b) =>
          batches[a]!.quality - batches[b]!.quality ||
          batches[a]!.storedDay - batches[b]!.storedDay,
      )
    let rest = order.units
    for (const i of picks) {
      const take = Math.min(rest, batches[i]!.units - keep[i]!)
      keep[i]! += take
      rest -= take
    }
    budget -= order.units - rest
  }
  return keep
}

// Bank price of a sale as a share of the bank price at an untouched market.
export function bankFactor(state: GameState, variety: Variety, units: number, cfg = balance()) {
  const base = cfg.varieties[variety].referencePrice * cfg.market.bankBuyFactor
  return bankBuyPrice(state, variety, units) / base
}

// Whether waiting one month raises the bank price of these units by more than their storage cost,
// if the bot sold nothing else of the variety in that month.
export function waitingPays(state: GameState, variety: Variety, units: number, cfg = balance()) {
  const later = marketPrice(
    state.market.volumes,
    { kind: 'coffee', variety },
    state.time.day + cfg.time.daysPerMonth,
    cfg,
    units,
  )
  const gain = later * cfg.market.bankBuyFactor - bankBuyPrice(state, variety, units)
  return gain > cfg.storage.costPerUnitPerMonth
}

// Sales of the hold strategy today. A variety sells in full when its price reaches
// minPriceFactor or waiting does not pay. Otherwise only batches of maxAgeMonths and more sell,
// and the oldest units above maxStockShare of the capacity.
export function holdSales(state: GameState, p: HoldParams, cfg = balance()): Sell[] {
  const batches = state.storage.batches.filter(isRaw)
  const day = state.time.day
  const units = (v: Variety) =>
    batches.filter((b) => b.variety === v).reduce((sum, b) => sum + b.units, 0)
  const varieties = [...new Set(batches.map((b) => b.variety))]
  const all = new Set(
    varieties.filter(
      (v) =>
        bankFactor(state, v, units(v), cfg) >= p.minPriceFactor ||
        !waitingPays(state, v, units(v), cfg),
    ),
  )
  const limit = Math.floor(storageCapacity(state, cfg) * p.maxStockShare)
  let stock = storageUsed(state.storage)
  const sale = new Map<Variety, number>()
  // Batches are in harvest order, the oldest first, as Sell takes them.
  for (const b of batches) {
    const take =
      all.has(b.variety) || ageMonths(b, day, cfg) >= p.maxAgeMonths
        ? b.units
        : Math.min(b.units, Math.max(0, stock - limit))
    if (take === 0) continue
    sale.set(b.variety, (sale.get(b.variety) ?? 0) + take)
    stock -= take
  }
  return [...sale].map(([variety, units]) => ({ type: 'Sell', variety, units }))
}

export function runBot(
  seed: number,
  days: number,
  strategy: Strategy = 'bank-now',
  params: BotParams = BOT_PARAMS,
): BotResult {
  const cfg = balance()
  let state = createState(seed)
  let parcelSpend = 0
  let totalSpend = 0
  let minMoney = state.money
  const curve: number[] = []
  const supply: number[] = []
  const demand: number[] = []
  const bank: Channel = { units: 0, income: 0 }
  const orders: Channel = { units: 0, income: 0 }
  const seen = new Set<number>()
  let ordersDelivered = 0
  let storageCost = 0
  let qualityLoss = 0

  const act = (command: Command) => {
    const before = state.money
    const order =
      command.type === 'DeliverOrder'
        ? state.orders.open.find((o) => o.id === command.id)
        : undefined
    state = dispatch(state, command)
    const spent = Math.max(0, before - state.money)
    totalSpend += spent
    if (command.type === 'CreateParcels') parcelSpend += spent
    if (command.type === 'Sell') {
      bank.units += command.units
      bank.income += state.money - before
    }
    if (order) {
      orders.units += order.units
      orders.income += state.money - before
      ordersDelivered++
    }
    minMoney = Math.min(minMoney, state.money)
  }
  const deliver = () => {
    for (let o = nextDelivery(state); o; o = nextDelivery(state))
      act({ type: 'DeliverOrder', id: o.id })
  }
  // Sales that free storage for a harvest: all stock except what the strategy keeps for orders.
  const freeSales = () =>
    sellAllBut(state, strategy === 'orders' ? reserveForOrders(state, params.orders, cfg) : [])
  const varietyOf = (index: number): Variety =>
    at(state, index).zone === cfg.varieties.arabicaStandard.zone ? 'arabicaStandard' : 'robusta'
  const owned = () => Object.keys(state.farm.parcels).map(Number)
  const ripe = (index: number) => {
    const plant = state.farm.plants[index]
    return plant !== undefined && growth(plant, state.time.day, cfg).progress >= 1
  }
  // Seed and fertilizer for one cycle on each listed parcel, in hundredths of CC.
  const reserve = (indices: number[]) =>
    indices.reduce((sum, i) => {
      const v = varietyOf(i)
      return (
        sum + Math.round((bankSellPrice(state, v) + cfg.varieties[v].careCost.fertilizer) * 100)
      )
    }, 0)

  // Unowned parcels never change their soil, so the order stays valid for the whole run.
  // Only zones where a plantable variety matches: other zones cost more and give less.
  const zones = new Set<string>([cfg.varieties.robusta.zone, cfg.varieties.arabicaStandard.zone])
  const candidates = state.world.parcels
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => zones.has(p.zone) && isFree(state, p.x, p.y))
    .sort((a, b) => b.p.soilQuality - a.p.soilQuality || a.index - b.index)
    .map(({ index }) => index)
  let next = 0

  for (let day = 1; day <= days; day++) {
    for (const o of state.orders.open) seen.add(o.id)
    if (strategy === 'orders') deliver()
    // Harvest until no unit fits. The storage limits each harvest, so the bot sells to make room:
    // bank-now everything after each harvest, the others only while ripe plants are left.
    for (;;) {
      const list = owned().filter(ripe)
      if (list.length === 0) break
      act({ type: 'Harvest', parcels: list.map((i) => at(state, i)) })
      if (strategy === 'bank-now') {
        if (storageUsed(state.storage) === 0) break
        sellAllBut(state).forEach(act)
        continue
      }
      if (strategy === 'orders') deliver()
      if (!owned().some(ripe)) break
      const sells = freeSales()
      if (sells.length === 0) break
      sells.forEach(act)
    }
    if (strategy === 'hold') holdSales(state, params.hold, cfg).forEach(act)
    if (strategy === 'orders') freeSales().forEach(act)

    for (const variety of ['robusta', 'arabicaStandard'] as const) {
      let list = owned().filter((i) => !(i in state.farm.plants) && varietyOf(i) === variety)
      while (list.length > 0 && quotePlant(state, variety, list.length) > state.money) {
        list = list.slice(0, -1)
      }
      if (list.length > 0) act({ type: 'Plant', variety, parcels: list.map((i) => at(state, i)) })
    }

    const fertilize: number[] = []
    let cost = 0
    for (const i of owned()) {
      const plant = state.farm.plants[i]
      if (!plant || plant.fertilized || ripe(i)) continue
      const c = Math.round(cfg.varieties[plant.variety].careCost.fertilizer * 100)
      if (cost + c > state.money) break
      cost += c
      fertilize.push(i)
    }
    if (fertilize.length > 0)
      act({ type: 'Fertilize', parcels: fertilize.map((i) => at(state, i)) })

    while (next < candidates.length) {
      const index = candidates[next]!
      const p = at(state, index)
      const price = quoteParcels(state, [p])
      if (state.money - price < reserve([...owned(), index])) break
      act({ type: 'CreateParcels', parcels: [{ x: p.x, y: p.y }] })
      next++
    }

    // Storage cost and quality loss of the month turn that this step may book.
    const points = () => state.storage.batches.reduce((sum, b) => sum + b.units * b.quality, 0)
    const before = points()
    if ((state.time.day + 1) % cfg.time.daysPerMonth === 0)
      storageCost += monthlyStorageCost(state.storage, cfg)
    state = step(state)
    qualityLoss += before - points()
    minMoney = Math.min(minMoney, state.money)
    curve.push(capital(state) / 100)
    const price = (kind: 'coffee' | 'seed') =>
      marketPrice(state.market.volumes, { kind, variety: 'robusta' }, state.time.day, cfg)
    supply.push(price('coffee') / cfg.varieties.robusta.referencePrice)
    demand.push(price('seed') / cfg.varieties.robusta.seedCost)
  }
  for (const o of state.orders.open) seen.add(o.id)
  return {
    seed,
    strategy,
    bank,
    orders,
    ordersSeen: seen.size,
    ordersDelivered,
    storageCost,
    qualityLoss,
    curve,
    supply,
    demand,
    parcels: owned().length,
    minMoney,
    parcelSpend,
    totalSpend,
  }
}

// Share of the days, from the first day the factor leaves 1, on which the factor is within 5 % of
// its distance to the end of its range (#18). 0 if the factor never leaves 1.
export function pinnedShare(factors: number[], end: number): number {
  const first = factors.findIndex((f) => f !== 1)
  if (first < 0) return 0
  const days = factors.slice(first)
  const near = Math.abs(end - 1) * 0.05
  return days.filter((f) => Math.abs(f - end) <= near).length / days.length
}

// Median of the values. null counts as "never", so it sorts last.
function median(values: (number | null)[]): number | null {
  const sorted = values.map((v) => v ?? Infinity).sort((a, b) => a - b)
  const mid = sorted.length / 2
  const m = sorted.length % 2 ? sorted[Math.floor(mid)]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  return Number.isFinite(m) ? m : null
}

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
// A median of an even count can end in .5.
const day = (d: number | null) =>
  d === null ? 'nicht erreicht' : fmt(d, Number.isInteger(d) ? 0 : 1)

function recommendation(results: BotResult[], cfg: Balance, median2k: number | null): string {
  const target = cfg.balanceSim.phase1TargetDays
  if (median2k !== null && median2k <= target) {
    return `Der Median bis 2.000 CC (Tag ${day(median2k)}) liegt im Ziel von ${target} Spieltagen. Es ist keine Änderung nötig.`
  }
  const factor =
    median2k === null
      ? `mindestens ${fmt(cfg.balanceSim.days / target, 1)}`
      : fmt(median2k / target, 1)
  const parcels = results.reduce((sum, r) => sum + r.parcelSpend, 0)
  const total = results.reduce((sum, r) => sum + r.totalSpend, 0)
  const share = total > 0 ? parcels / total : 0
  const lever = share > 0.5 ? 'günstigere Parzellen' : 'höhere Erträge pro Parzelle'
  return [
    `Der Median bis 2.000 CC (Tag ${day(median2k)}) liegt über dem Ziel von ${target} Spieltagen (GDD: 4 Spielwochen).`,
    `Phase 1 muss um den Faktor ${factor} schneller werden.`,
    `Parzellen sind ${fmt(share * 100)} % der Ausgaben des Bots (Saatgut und Dünger: ${fmt((1 - share) * 100)} %).`,
    `Empfehlung: **${lever}**. Alternative: **niedrigere Phasengrenzen**.`,
    'Robert entscheidet. Diese Simulation ändert keinen Wert in `config/balance.json`.',
  ].join('\n')
}

const STRATEGY_TEXT: Record<Strategy, string> = {
  'bank-now': 'verkauft jede Ernte sofort an die Bank (der Bot oben).',
  hold: 'verkauft eine Sorte ganz, wenn der Bankpreis des Verkaufs mindestens {minPriceFactor} des Bankpreises bei unberührtem Markt erreicht oder wenn ein Monat Warten weniger Preis bringt, als er an Lagerkosten kostet. Sonst verkauft sie nur Partien ab {maxAgeMonths} Monaten im Lager und die ältesten Einheiten über {maxStockShare} der Lagerkapazität. Stehen reife Parzellen bei vollem Lager, verkauft sie das Lager, um zu ernten.',
  orders:
    'liefert jeden offenen Auftrag, den das Lager erfüllen kann (der beste Preis zuerst), und verkauft den Rest an die Bank. Für Aufträge, die sie noch nicht erfüllen kann, hält sie passende Einheiten zurück, höchstens {reserveShare} der Lagerkapazität, die früheste Frist zuerst.',
}

function strategySection(runs: BotResult[], cfg: Balance, params: BotParams): string[] {
  const row = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`
  const code = (s: string) => `\`${s}\``
  const cc = (hundredths: number) => fmt(hundredths / 100)
  const pct = (share: number) => `${fmt(share * 100)} %`
  const t2 = cfg.progression.phases[1]!.fromCapital
  const days = Math.max(...runs.map((r) => r.curve.length))
  const strategies = STRATEGIES.filter((s) => runs.some((r) => r.strategy === s))
  const of = (s: Strategy) => runs.filter((r) => r.strategy === s)
  const med = (s: Strategy, value: (r: BotResult) => number | null) => median(of(s).map(value))
  const sum = (s: Strategy, value: (r: BotResult) => number) =>
    of(s).reduce((total, r) => total + value(r), 0)
  const sold = (r: BotResult) => r.bank.units + r.orders.units
  const income = (r: BotResult) => r.bank.income + r.orders.income
  // Pooled over all seeds, in CC per unit.
  const perUnit = (
    s: Strategy,
    money: (r: BotResult) => number,
    units: (r: BotResult) => number,
  ) => {
    const n = sum(s, units)
    return n > 0 ? fmt(sum(s, money) / n / 100, 3) : '–'
  }
  const text = (s: Strategy) =>
    STRATEGY_TEXT[s]
      .replace('{minPriceFactor}', pct(params.hold.minPriceFactor))
      .replace('{maxStockShare}', pct(params.hold.maxStockShare))
      .replace('{maxAgeMonths}', fmt(params.hold.maxAgeMonths))
      .replace('{reserveShare}', pct(params.orders.reserveShare))
  const final = (s: Strategy) => med(s, (r) => r.curve.at(-1)!)!
  const versus = (s: Strategy) => {
    if (s === 'bank-now' || !strategies.includes('bank-now')) return '–'
    const delta = final(s) - final('bank-now')
    const sign = delta >= 0 ? '+' : '−'
    return `${sign}${fmt(Math.abs(delta))} (${sign}${fmt((Math.abs(delta) / final('bank-now')) * 100, 1)} %)`
  }

  return [
    '## Verkaufsstrategien (#50)',
    '',
    `Alle Strategien spielen dieselben Seeds und dieselben ${days} Spieltage. Sie unterscheiden sich nur im Verkauf; Ernten, Pflanzen, Düngen und Parzellenkauf folgen denselben Regeln. Die Schwellen sind Bot-Parameter und stehen nicht in ${code('config/balance.json')}.`,
    '',
    ...strategies.map((s) => `- **${code(s)}** ${text(s)}`),
    '',
    'CC-Beträge sind Mediane der Seeds. Ø Preise sind über alle Seeds gepoolt: Einnahmen des Kanals geteilt durch seine verkauften Einheiten. Qualitätsverlust: Qualitätspunkte, die das Lager an den Monatswechseln abzieht, summiert über alle Einheiten.',
    '',
    '### Einnahmen je Kanal',
    '',
    row([
      'Strategie',
      'Bank (CC)',
      'Aufträge (CC)',
      'Anteil Aufträge',
      'Ø Preis Bank (CC/Einheit)',
      'Ø Preis Aufträge (CC/Einheit)',
      'Ø Preis gesamt (CC/Einheit)',
    ]),
    row(['---', '---', '---', '---', '---', '---', '---']),
    ...strategies.map((s) =>
      row([
        code(s),
        cc(med(s, (r) => r.bank.income)!),
        cc(med(s, (r) => r.orders.income)!),
        `${fmt((sum(s, (r) => r.orders.income) / Math.max(1, sum(s, income))) * 100, 1)} %`,
        perUnit(
          s,
          (r) => r.bank.income,
          (r) => r.bank.units,
        ),
        perUnit(
          s,
          (r) => r.orders.income,
          (r) => r.orders.units,
        ),
        perUnit(s, income, sold),
      ]),
    ),
    '',
    '### Kosten des Lagerns und Ergebnis',
    '',
    row([
      'Strategie',
      'Lagerkosten (CC)',
      'Qualitätsverlust (Punkte × Einheiten)',
      'Ø Verlust je verkaufter Einheit (Punkte)',
      'Aufträge geliefert / angeboten',
      `Tag bis ${fmt(t2)} CC`,
      `Kapital Tag ${days} (CC)`,
      `gegenüber ${code('bank-now')} (CC)`,
    ]),
    row(['---', '---', '---', '---', '---', '---', '---', '---']),
    ...strategies.map((s) =>
      row([
        code(s),
        cc(med(s, (r) => r.storageCost)!),
        fmt(med(s, (r) => r.qualityLoss)!),
        fmt(sum(s, (r) => r.qualityLoss) / Math.max(1, sum(s, sold)), 3),
        `${fmt(sum(s, (r) => r.ordersDelivered))} / ${fmt(sum(s, (r) => r.ordersSeen))}`,
        day(med(s, (r) => daysTo(r.curve, t2))),
        fmt(final(s)),
        versus(s),
      ]),
    ),
    '',
  ]
}

// The sections up to the market reaction show bank-now, today's bot. The strategy section
// compares all strategies in the runs.
export function renderReport(runs: BotResult[], cfg: Balance, params = BOT_PARAMS): string {
  const results = runs.filter((r) => r.strategy === 'bank-now')
  const [, p2, p3] = cfg.progression.phases
  const t2 = p2!.fromCapital
  const t3 = p3!.fromCapital
  const days = Math.max(...results.map((r) => r.curve.length))
  const to2k = results.map((r) => daysTo(r.curve, t2))
  const to10k = results.map((r) => daysTo(r.curve, t3))
  const finals = results.map((r) => r.curve.at(-1)!)
  const parcels = results.map((r) => r.parcels)
  const stats = (values: (number | null)[]) => {
    const known = values.filter((v): v is number => v !== null)
    return {
      median: median(values),
      min: known.length ? Math.min(...known) : null,
      max: known.length === values.length ? Math.max(...known) : null,
    }
  }
  const row = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`
  const s2k = stats(to2k)
  const s10k = stats(to10k)
  const sCap = stats(finals)
  const sPar = stats(parcels)

  const [minSupply] = cfg.market.supplyFactorRange
  const [, maxDemand] = cfg.market.demandFactorRange
  const pct = (share: number) => `${fmt(share * 100)} %`
  const factor = (values: number[]) => fmt(median(values) ?? 1, 3)
  const market = results.map((r) => ({
    seed: r.seed,
    supplyPinned: pinnedShare(r.supply, minSupply!),
    supply: factor(r.supply),
    demandPinned: pinnedShare(r.demand, maxDemand!),
    demand: factor(r.demand),
  }))

  return [
    '# Balance-Report (Bot-Simulation)',
    '',
    'Erzeugt mit `npm run balance-sim`. Der Bot spielt die Simulation ohne Grafik. Bis zum Abschnitt „Verkaufsstrategien“ zeigt der Bericht die Strategie `bank-now`: Jeden Spieltag erntet er alle reifen Parzellen, verkauft das ganze Lager an die Bank, pflanzt auf leeren Parzellen (Arabica Standard im Hochland, sonst Robusta), düngt und kauft neue Parzellen. Neue Parzellen kauft er in fester Reihenfolge (bester Boden zuerst), solange das Geld für Saatgut und Dünger aller Parzellen reicht.',
    '',
    'Kapital nach PRD §10: Kontostand + Lager zum Bank-Ankaufspreis + bezahlte Parzellen und Gebäude.',
    '',
    'Jede Buchung bewegt ganze CC (S57): Kosten runden auf, Einnahmen runden ab, einmal je Befehl und Lagerkosten einmal je Spieltag.',
    '',
    '## Parameter',
    '',
    row(['Parameter', 'Wert']),
    row(['---', '---']),
    row(['Spieltage', days]),
    row(['Seeds', `${results.length} (${results.map((r) => r.seed).join(', ')})`]),
    row(['Startkapital', `${fmt(cfg.economy.startCapital)} CC`]),
    row(['Phase 2 ab', `${fmt(t2)} CC`]),
    row(['Phase 3 ab', `${fmt(t3)} CC`]),
    row(['Ziel Phase 1', `${cfg.balanceSim.phase1TargetDays} Spieltage`]),
    '',
    '## Ergebnis je Seed',
    '',
    row([
      'Seed',
      `Tag bis ${fmt(t2)} CC`,
      `Tag bis ${fmt(t3)} CC`,
      `Kapital Tag ${days} (CC)`,
      'Parzellen',
    ]),
    row(['---', '---', '---', '---', '---']),
    ...results.map((r, i) =>
      row([r.seed, day(to2k[i]!), day(to10k[i]!), fmt(finals[i]!), r.parcels]),
    ),
    '',
    row([
      '',
      `Tag bis ${fmt(t2)} CC`,
      `Tag bis ${fmt(t3)} CC`,
      `Kapital Tag ${days} (CC)`,
      'Parzellen',
    ]),
    row(['---', '---', '---', '---', '---']),
    row(['Median', day(s2k.median), day(s10k.median), fmt(sCap.median ?? 0), day(sPar.median)]),
    row(['Min', day(s2k.min), day(s10k.min), fmt(sCap.min ?? 0), fmt(sPar.min ?? 0)]),
    row(['Max', day(s2k.max), day(s10k.max), fmt(sCap.max ?? 0), fmt(sPar.max ?? 0)]),
    '',
    '## Kapitalkurve (CC)',
    '',
    row(['Tag', 'Median', 'Min', 'Max']),
    row(['---', '---', '---', '---']),
    ...Array.from({ length: Math.floor(days / 10) }, (_, k) => {
      const d = (k + 1) * 10
      const s = stats(results.map((r) => r.curve[d - 1] ?? null))
      return row([d, fmt(s.median ?? 0), fmt(s.min ?? 0), fmt(s.max ?? 0)])
    }),
    '',
    '## Marktreaktion Robusta (#18)',
    '',
    `Angebotsfaktor des Rohkaffees (Bereich ab ${fmt(minSupply!, 2)}) und Nachfragefaktor des Saatguts (bis ${fmt(maxDemand!, 2)}) am Ende jedes Spieltags. „Am Ende“: Anteil der Tage ab dem ersten Handel, an denen der Faktor höchstens 5 % seines Wegs vom Ende des Bereichs entfernt ist. Halbwertszeit der Menge: ${fmt(cfg.market.volumeHalfLifeDays)} Tage.`,
    '',
    row(['Seed', 'Angebot am Ende', 'Angebot Median', 'Nachfrage am Ende', 'Nachfrage Median']),
    row(['---', '---', '---', '---', '---']),
    ...market.map((r) =>
      row([r.seed, pct(r.supplyPinned), r.supply, pct(r.demandPinned), r.demand]),
    ),
    row([
      'Median',
      pct(median(market.map((r) => r.supplyPinned)) ?? 0),
      factor(results.flatMap((r) => r.supply)),
      pct(median(market.map((r) => r.demandPinned)) ?? 0),
      factor(results.flatMap((r) => r.demand)),
    ]),
    '',
    ...strategySection(runs, cfg, params),
    '## Empfehlung zu PRD §12 Punkt 1',
    '',
    recommendation(results, cfg, s2k.median),
    '',
  ].join('\n')
}

// --strategy hold or --strategy hold,orders; none means all strategies.
export function parseStrategies(args: string[]): Strategy[] {
  const { values } = parseArgs({ args, options: { strategy: { type: 'string', multiple: true } } })
  const names = (values.strategy ?? []).flatMap((v) => v.split(','))
  for (const name of names) {
    if (!(STRATEGIES as readonly string[]).includes(name))
      throw new Error(`Unknown strategy: ${name} (${STRATEGIES.join(', ')})`)
  }
  return names.length === 0 ? [...STRATEGIES] : STRATEGIES.filter((s) => names.includes(s))
}

// npm run balance-sim: all strategies, writes docs/balance-report.md.
// npm run balance-sim -- --strategy hold: only that strategy, prints a summary.
function main() {
  const cfg = balance()
  const { days, seeds } = cfg.balanceSim
  const strategies = parseStrategies(process.argv.slice(2))
  const runs = strategies.flatMap((s) =>
    Array.from({ length: seeds }, (_, i) => runBot(i + 1, days, s)),
  )
  for (const s of strategies) {
    const of = runs.filter((r) => r.strategy === s)
    const med = (value: (r: BotResult) => number) => fmt((median(of.map(value)) ?? 0) / 100)
    console.log(
      `${s}: Median Bank ${med((r) => r.bank.income)} CC, Aufträge ${med((r) => r.orders.income)} CC, ` +
        `Lagerkosten ${med((r) => r.storageCost)} CC, Kapital Tag ${days} ${med((r) => r.curve.at(-1)! * 100)} CC`,
    )
  }
  if (strategies.length < STRATEGIES.length) return
  writeFileSync(new URL('../docs/balance-report.md', import.meta.url), renderReport(runs, cfg))
  const bankNow = runs.filter((r) => r.strategy === 'bank-now')
  const [, p2, p3] = cfg.progression.phases
  for (const t of [p2!.fromCapital, p3!.fromCapital]) {
    console.log(
      `Median Tag bis ${fmt(t)} CC: ${day(median(bankNow.map((r) => daysTo(r.curve, t))))}`,
    )
  }
  console.log('Report: docs/balance-report.md')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
