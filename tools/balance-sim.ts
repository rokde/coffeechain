import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { Balance } from '../config/balance.schema'
import { balance } from '../src/sim/balance'
import { dispatch, type Command } from '../src/sim/commands'
import { isFree, quoteParcels } from '../src/sim/farm/parcels'
import { growth, quotePlant } from '../src/sim/farm/plants'
import type { Variety } from '../src/sim/farm/yield'
import { bankSellPrice } from '../src/sim/market/market'
import { capital } from '../src/sim/progression/capital'
import { createState, type GameState } from '../src/sim/state'
import { storageUsed } from '../src/sim/storage/storage'
import { step } from '../src/sim/time/time'

export interface BotResult {
  seed: number
  // Capital in CC at the end of each game day. Index 0 is day 1.
  curve: number[]
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

export function runBot(seed: number, days: number): BotResult {
  const cfg = balance()
  let state = createState(seed)
  let parcelSpend = 0
  let totalSpend = 0
  let minMoney = state.money
  const curve: number[] = []

  const act = (command: Command) => {
    const before = state.money
    state = dispatch(state, command)
    const spent = Math.max(0, before - state.money)
    totalSpend += spent
    if (command.type === 'CreateParcels') parcelSpend += spent
    minMoney = Math.min(minMoney, state.money)
  }
  const varietyOf = (index: number): Variety =>
    at(state, index).zone === cfg.varieties.arabicaStandard.zone ? 'arabicaStandard' : 'robusta'
  const owned = () => Object.keys(state.farm.parcels).map(Number)
  const ripe = (index: number) => {
    const plant = state.farm.plants[index]
    return plant !== undefined && growth(plant, state.time.hour, cfg).progress >= 1
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
    // Harvest and sell until no unit fits. The storage limits each harvest.
    for (;;) {
      const list = owned().filter(ripe)
      if (list.length === 0) break
      act({ type: 'Harvest', parcels: list.map((i) => at(state, i)) })
      if (storageUsed(state.storage) === 0) break
      for (const v of new Set(state.storage.batches.map((b) => b.variety))) {
        const units = state.storage.batches
          .filter((b) => b.variety === v)
          .reduce((sum, b) => sum + b.units, 0)
        act({ type: 'Sell', variety: v, units })
      }
    }

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

    for (let h = 0; h < cfg.time.ticksPerGameDay; h++) state = step(state)
    minMoney = Math.min(minMoney, state.money)
    curve.push(capital(state) / 100)
  }
  return { seed, curve, parcels: owned().length, minMoney, parcelSpend, totalSpend }
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

export function renderReport(results: BotResult[], cfg: Balance): string {
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

  return [
    '# Balance-Report (Bot-Simulation)',
    '',
    'Erzeugt mit `npm run balance-sim`. Der Bot spielt die Simulation ohne Grafik. Jeden Spieltag erntet er alle reifen Parzellen, verkauft das ganze Lager an die Bank, pflanzt auf leeren Parzellen (Arabica Standard im Hochland, sonst Robusta), düngt und kauft neue Parzellen. Neue Parzellen kauft er in fester Reihenfolge (bester Boden zuerst), solange das Geld für Saatgut und Dünger aller Parzellen reicht.',
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
    '## Empfehlung zu PRD §12 Punkt 1',
    '',
    recommendation(results, cfg, s2k.median),
    '',
  ].join('\n')
}

function main() {
  const cfg = balance()
  const { days, seeds } = cfg.balanceSim
  const results = Array.from({ length: seeds }, (_, i) => runBot(i + 1, days))
  const report = renderReport(results, cfg)
  writeFileSync(new URL('../docs/balance-report.md', import.meta.url), report)
  const [, p2, p3] = cfg.progression.phases
  for (const t of [p2!.fromCapital, p3!.fromCapital]) {
    console.log(
      `Median Tag bis ${fmt(t)} CC: ${day(median(results.map((r) => daysTo(r.curve, t))))}`,
    )
  }
  console.log('Report: docs/balance-report.md')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
