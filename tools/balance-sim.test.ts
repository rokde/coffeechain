import { describe, expect, it } from 'vitest'
import { balance } from '../src/sim/balance'
import { daysTo, renderReport, runBot, type BotResult } from './balance-sim'

describe('runBot', () => {
  let first: BotResult | undefined
  const run = () => (first ??= runBot(1, 200))

  // 200 game days with events and research; parallel suite load
  it('gives one capital per day and grows the farm without debt', () => {
    const a = run()
    expect(a.curve).toHaveLength(200)
    expect(a.minMoney).toBeGreaterThanOrEqual(0)
    expect(a.parcels).toBeGreaterThan(1)
    expect(a.curve.at(-1)).toBeGreaterThan(balance().economy.startCapital)
  }, 20000)

  // 200 game days with events and research; parallel suite load
  it('repeats per seed', () => {
    expect(runBot(1, 200)).toEqual(run())
  }, 20000)
})

describe('daysTo', () => {
  it('finds a hit on day 1', () => expect(daysTo([2000, 1500], 2000)).toBe(1))
  it('finds a later hit', () => expect(daysTo([500, 1999, 2500, 1800], 2000)).toBe(3))
  it('gives null without a hit', () => expect(daysTo([500, 1999], 2000)).toBeNull())
})

// Capital rises by perDay each day from 500 CC.
const result = (seed: number, perDay: number, parcelSpend = 100, totalSpend = 300): BotResult => ({
  seed,
  curve: Array.from({ length: 30 }, (_, i) => 500 + perDay * (i + 1)),
  parcels: seed + 1,
  minMoney: 0,
  parcelSpend,
  totalSpend,
})
const cfgWith = (phase1TargetDays: number) => {
  const cfg = balance()
  return { ...cfg, balanceSim: { ...cfg.balanceSim, phase1TargetDays } }
}
const section = (md: string) => md.split('## Empfehlung zu PRD §12 Punkt 1')[1]!

describe('renderReport', () => {
  // Seed 1 gets to 2,000 CC on day 15, seed 2 on day 30, seed 3 never. Nobody gets to 10,000 CC.
  const results = [result(1, 100), result(2, 50), result(3, 10)]
  const md = renderReport(results, cfgWith(28))

  it('lists the parameters, one row per seed, the medians and the curve', () => {
    expect(md).toContain('| Spieltage | 30 |')
    expect(md).toContain('| Seeds | 3 (1, 2, 3) |')
    expect(md).toContain('| Ziel Phase 1 | 28 Spieltage |')
    expect(md).toContain('| 1 | 15 | nicht erreicht | 3.500 | 2 |')
    expect(md).toContain('| 2 | 30 | nicht erreicht | 2.000 | 3 |')
    expect(md).toContain('| 3 | nicht erreicht | nicht erreicht | 800 | 4 |')
    expect(md).toContain('| Median | 30 | nicht erreicht | 2.000 | 3 |')
    expect(md).toContain('| 10 | 1.000 | 600 | 1.500 |')
    expect(md).toContain('| 20 | 1.500 | 700 | 2.500 |')
    expect(md).toContain('| 30 | 2.000 | 800 | 3.500 |')
    expect(md).not.toContain('| 40 |')
    expect(md).toContain('## Empfehlung zu PRD §12 Punkt 1')
  })

  it('needs no change when the median is at or below the target', () => {
    const text = section(renderReport(results, cfgWith(30)))
    expect(text).toContain('keine Änderung nötig')
    expect(text).not.toContain('günstigere Parzellen')
  })

  it('recommends cheaper parcels when parcels are more than half of the spending', () => {
    const text = section(
      renderReport(
        results.map((r) => ({ ...r, parcelSpend: 200 })),
        cfgWith(10),
      ),
    )
    expect(text).toContain('Faktor 3,0')
    expect(text).toContain('**günstigere Parzellen**')
    expect(text).toContain('**niedrigere Phasengrenzen**')
    expect(text).not.toContain('höhere Erträge pro Parzelle')
  })

  it('recommends higher yields when parcels are at most half of the spending', () => {
    const text = section(renderReport(results, cfgWith(10)))
    expect(text).toContain('Faktor 3,0')
    expect(text).toContain('**höhere Erträge pro Parzelle**')
    expect(text).toContain('**niedrigere Phasengrenzen**')
    expect(text).not.toContain('günstigere Parzellen')
  })
})
