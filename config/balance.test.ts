import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import raw from './balance.json'
import { loadBalance } from './balance.schema'

// Collects the path of each {v, src} leaf and its src value.
function leaves(node: unknown, path: string[] = []): { path: string; src: unknown }[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return [{ path: path.join('.'), src: undefined }]
  }
  if ('v' in node) return [{ path: path.join('.'), src: (node as { src?: unknown }).src }]
  return Object.entries(node).flatMap(([key, child]) =>
    key === '_format' ? [] : leaves(child, [...path, key]),
  )
}

// Joins the non-test .ts and .vue files under src/ and tools/.
function sources(): string {
  return ['../src/', '../tools/']
    .flatMap((dir) => {
      const root = new URL(dir, import.meta.url)
      return readdirSync(root, { recursive: true, encoding: 'utf8' })
        .filter((f) => /\.(ts|vue)$/.test(f) && !f.endsWith('.test.ts'))
        .map((f) => readFileSync(new URL(f, root), 'utf8'))
    })
    .join('\n')
}

const unread = (keys: string[], code: string) =>
  keys.filter((key) => !new RegExp(`\\b${key}\\b`).test(code))

const copy = () => structuredClone(raw) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

describe('balance.json', () => {
  it('loads through the schema', () => {
    const balance = loadBalance(raw)
    expect(balance.time.daysPerMonth).toBe(30)
    expect(balance.varieties.robusta.careCost.fertilizer).toBe(1)
  })

  it('has a non-empty string src on every value', () => {
    const all = leaves(raw)
    expect(all.length).toBeGreaterThan(50)
    const bad = all.filter((l) => typeof l.src !== 'string' || l.src.trim() === '')
    expect(bad.map((l) => l.path)).toEqual([])
  })

  it('names the path of a value with the wrong type', () => {
    const cfg = copy()
    cfg.time.daysPerMonth.v = 'x'
    expect(() => loadBalance(cfg)).toThrow('time.daysPerMonth.v')
  })

  it('names the path of a missing src', () => {
    const cfg = copy()
    delete cfg.varieties.robusta.seedCost.src
    expect(() => loadBalance(cfg)).toThrow('varieties.robusta.seedCost.src')
  })

  it('marks the world generation values as NEU and lists them in docs/open-questions.md', () => {
    const doc = readFileSync(new URL('../docs/open-questions.md', import.meta.url), 'utf8')
    const paths = [
      'world.startReach',
      'world.maxAttempts',
      'world.zoneMinHeight',
      'world.falloffPower',
      'world.noiseScale',
      'soil.classMinQuality',
    ]
    const src = Object.fromEntries(leaves(raw).map((l) => [l.path, l.src]))
    for (const path of paths) {
      expect(src[path], path).toBe('NEU')
      expect(doc).toContain(`\`${path}\``)
    }
  })

  it('loads a copy with an unknown market key and strips it', () => {
    const cfg = copy()
    cfg.market.bankSellFactor = { v: 1.2, src: 'GDD 11.3' }
    expect(loadBalance(cfg).market).not.toHaveProperty('bankSellFactor')
  })

  it('has a reader in src/ or tools/ for every market value', () => {
    const code = sources()
    const keys = Object.keys(raw.market)
    expect(unread(keys, code)).toEqual([])
    expect(unread([...keys, 'bankSellFactor'], code)).toEqual(['bankSellFactor'])
  })

  it('AC-1 (#8): has no events key, and no source imports src/sim/events/', () => {
    expect(raw).not.toHaveProperty('events')
    expect(loadBalance(raw)).not.toHaveProperty('events')
    expect(existsSync(new URL('../src/sim/events/', import.meta.url))).toBe(false)
    expect(sources()).not.toMatch(/from '[./]*(sim\/)?events\//)
  })

  it('AC-3 (#8): has no pest control cost and no pest loss reduction', () => {
    for (const [name, variety] of Object.entries(loadBalance(raw).varieties))
      expect(variety.careCost, name).not.toHaveProperty('pestControl')
    expect(loadBalance(raw).farm).not.toHaveProperty('pestControlLossReduction')
    expect(JSON.stringify(raw)).not.toMatch(/pestControl/)
  })

  it('AC-2 (#27): changes the time values by factor 30 and removes the hour keys', () => {
    const src = Object.fromEntries(leaves(raw).map((l) => [l.path, l.src]))
    const cfg = loadBalance(raw)
    const changed: [string, unknown, unknown][] = [
      ['varieties.robusta.cycleDays', cfg.varieties.robusta.cycleDays, 90],
      ['varieties.arabicaStandard.cycleDays', cfg.varieties.arabicaStandard.cycleDays, 150],
      ['varieties.arabicaPremium.cycleDays', cfg.varieties.arabicaPremium.cycleDays, 300],
      ['varieties.specialty.cycleDays', cfg.varieties.specialty.cycleDays, 450],
      ['farm.overripe.graceDays', cfg.farm.overripe.graceDays, 60],
      ['farm.overripe.lossPerDay', cfg.farm.overripe.lossPerDay, 0.005],
      ['processing.washed.durationDays', cfg.processing.washed.durationDays, 30],
      ['market.volumeWindowDays', cfg.market.volumeWindowDays, 90],
      ['market.historyMonths', cfg.market.historyMonths, 12],
      ['orders.chancePerDay', cfg.orders.chancePerDay, 0.01],
      ['orders.deadlineDays', cfg.orders.deadlineDays, [150, 300]],
      ['progression.harvestProMessageDays', cfg.progression.harvestProMessageDays, 30],
      ['balanceSim.days', cfg.balanceSim.days, 6000],
      ['balanceSim.phase1TargetDays', cfg.balanceSim.phase1TargetDays, 840],
    ]
    for (const [path, value, expected] of changed) {
      expect(value, path).toEqual(expected)
      expect(src[path], path).toBe('Robert 2026-10-25 (#27, Faktor 30)')
    }
    // AC-4 (086): historyMonths replaces historyDays.
    expect(raw.market).not.toHaveProperty('historyDays')
    expect(cfg.market).not.toHaveProperty('historyDays')
    for (const key of ['ticksPerGameDay', 'realSecondsPerGameDay']) {
      expect(raw.time, key).not.toHaveProperty(key)
      expect(cfg.time, key).not.toHaveProperty(key)
    }
  })

  it('marks the calendar values as NEU and lists them in docs/open-questions.md', () => {
    const doc = readFileSync(new URL('../docs/open-questions.md', import.meta.url), 'utf8')
    const src = Object.fromEntries(leaves(raw).map((l) => [l.path, l.src]))
    for (const path of [
      'time.realSecondsPerMonth',
      'time.realSecondsPerWeek',
      'time.daysPerMonth',
      'time.monthsPerYear',
    ]) {
      expect(src[path], path).toBe('NEU')
      expect(doc).toContain(`\`${path}\``)
    }
  })
})
