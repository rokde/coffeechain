import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import { dispatch } from '../sim/commands'
import { forecastYield } from '../sim/farm/forecast'
import { isBuildable, isFree, quoteParcels } from '../sim/farm/parcels'
import { fieldStatus } from '../sim/farm/status'
import type { GameState } from '../sim/state'
import { careParcel } from './farmAction'
import Hud from './Hud.vue'
import de from './i18n/de.json'
import { formatMoney } from './money'
import ParcelInspector from './ParcelInspector.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// Plants Robusta on one owned lowland parcel. With planted false, the parcel stays empty.
async function render(planted: boolean) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const { x, y } = state.world.parcels.find(
    (p) => p.zone === 'tiefland' && isBuildable(state.world, p.x, p.y),
  )!
  const parcels = [{ x, y }]
  const owned = dispatch({ ...state, money: 100000 }, { type: 'CreateParcels', parcels })
  game.replace(planted ? dispatch(owned, { type: 'Plant', variety: 'robusta', parcels }) : owned)
  useSelectionStore(pinia).parcel = { x, y }
  const html = await renderToString(createSSRApp(ParcelInspector).use(pinia))
  return { html, forecast: forecastYield(game.state as GameState, x, y) }
}

describe('ParcelInspector yield forecast', () => {
  it('AC-1: shows no yield row for a parcel without a plant', async () => {
    const { html, forecast } = await render(false)
    expect(forecast).toBeNull()
    expect(html).toContain('data-testid="parcel-inspector"')
    expect(html).not.toContain('inspector-yield')
  })

  it('AC-5: shows the forecast in German for a parcel with a plant', async () => {
    const { html, forecast } = await render(true)
    expect(forecast).toBeGreaterThan(0)
    const text = de.inspector.yieldUnits.replace('{n}', String(forecast))
    expect(html).toContain(de.inspector.yield)
    expect(html).toMatch(new RegExp(`data-testid="inspector-yield"[^>]*>${text}<`))
  })
})

// Owns one lowland parcel with Robusta, applies the change and selects the parcel.
function setupStatus(change: (s: GameState, parcels: { x: number; y: number }[]) => GameState) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const { x, y } = state.world.parcels.find(
    (p) => p.zone === 'tiefland' && isBuildable(state.world, p.x, p.y),
  )!
  const parcels = [{ x, y }]
  const owned = dispatch({ ...state, money: 100000 }, { type: 'CreateParcels', parcels })
  const planted = dispatch(owned, { type: 'Plant', variety: 'robusta', parcels })
  game.replace(change(planted, parcels))
  useSelectionStore(pinia).parcel = { x, y }
  return { pinia, game, parcel: { x, y } }
}

const text = (html: string, id: string) =>
  [...html.matchAll(new RegExp(`data-testid="${id}"[^>]*>([^<]*)<`, 'g'))].map((m) => m[1]!.trim())
const buttons = (html: string) => html.match(/<button[^>]*inspector-care-action[^>]*>/g) ?? []
const ripeDays = balance().varieties.robusta.cycleDays
const irrigationCost = Math.round(balance().varieties.robusta.careCost.irrigation * 100)

describe('ParcelInspector field status (S21e)', () => {
  it('AC-3: shows stage, growth, days, cares, hints and the open care buttons', async () => {
    const { pinia, game, parcel } = setupStatus((s, parcels) => {
      const irrigated = dispatch(s, { type: 'Irrigate', parcels })
      return { ...irrigated, time: { ...irrigated.time, day: irrigated.time.day + 30 } }
    })
    const status = fieldStatus(game.state as GameState, parcel.x, parcel.y)!
    expect(status.daysToRipe).toBeGreaterThan(1)
    const html = await renderToString(createSSRApp(ParcelInspector).use(pinia))
    expect(text(html, 'inspector-stage')).toEqual([de.inspector.stages[status.stage]])
    expect(text(html, 'inspector-growth')).toEqual([`${status.percent} %`])
    expect(text(html, 'inspector-days')).toEqual([`Reif in ${status.daysToRipe} Tagen`])
    expect(html).toContain('Pflege')
    expect(text(html, 'inspector-care')).toEqual(['gewässert'])
    expect(text(html, 'inspector-care-hint')).toEqual(['Düngen möglich'])
    expect(text(html, 'inspector-care-action')).toEqual(['Düngen'])
    expect(buttons(html).every((b) => !b.includes('disabled'))).toBe(true)
    expect(buttons(html).every((b) => !b.includes('title='))).toBe(true)
    expect(html).toMatch(/<dt[^>]*>Fortschritt<\/dt>/)
  })

  it('AC-3: shows no status rows for an empty parcel', async () => {
    const { pinia } = setupStatus((s) => ({ ...s, farm: { ...s.farm, plants: {} } }))
    const html = await renderToString(createSSRApp(ParcelInspector).use(pinia))
    expect(html).toContain('data-testid="parcel-inspector"')
    for (const id of ['stage', 'growth', 'days', 'care', 'care-hint', 'care-action'])
      expect(html).not.toContain(`inspector-${id}"`)
  })

  it('AC-4: careParcel irrigates the parcel and takes the irrigation cost', () => {
    const { game, parcel } = setupStatus((s) => s)
    const money = game.state.money
    careParcel('Irrigate', parcel)
    expect(game.state.farm.plants[parcel.y * game.state.world.size + parcel.x]?.irrigated).toBe(
      true,
    )
    expect(game.state.money).toBe(money - irrigationCost)
  })

  it('AC-4: the "Wässern" button is disabled when the money is less than the cost', async () => {
    const { pinia } = setupStatus((s) => ({ ...s, money: irrigationCost - 1 }))
    const html = await renderToString(createSSRApp(ParcelInspector).use(pinia))
    const irrigate = buttons(html).find(
      (b, i) => text(html, 'inspector-care-action')[i] === 'Wässern',
    )
    expect(irrigate).toContain('disabled')
    expect(irrigate).toContain(`title="Zu wenig Geld: kostet ${formatMoney(irrigationCost)}"`)
  })

  it('AC-4: careParcel on a ripe plant does not throw and keeps the money', () => {
    const { game, parcel } = setupStatus((s) => ({
      ...s,
      time: { ...s.time, day: s.time.day + ripeDays },
    }))
    const before = game.state
    expect(() => careParcel('Irrigate', parcel)).not.toThrow()
    expect(game.state.money).toBe(before.money)
    expect(game.state).toStrictEqual(before)
  })
})

describe('ParcelInspector price (S21d)', () => {
  // Selects the first parcel that matches, with no parcel owned.
  async function show(match: (state: GameState, x: number, y: number) => boolean) {
    const pinia = createPinia()
    setActivePinia(pinia)
    const state = useGameStore(pinia).state as GameState
    const { x, y } = state.world.parcels.find((p) => match(state, p.x, p.y))!
    useSelectionStore(pinia).parcel = { x, y }
    const html = await renderToString(createSSRApp(ParcelInspector).use(pinia))
    return { html, state, x, y }
  }

  it('AC-5: shows the price of a free parcel that the farm does not own', async () => {
    const { html, state, x, y } = await show(isFree)
    const price = formatMoney(quoteParcels(state, [{ x, y }]))
    expect(html).toContain(de.inspector.price)
    expect(html).toMatch(new RegExp(`data-testid="inspector-price"[^>]*>${price}<`))
  })

  it('S53 AC-4: the price label has a tooltip', async () => {
    const { html } = await show(isFree)
    expect(html).toMatch(
      new RegExp(`<dt title="${de.inspector.tips.price}"[^>]*>${de.inspector.price}<`),
    )
  })

  it('AC-5: shows no price for a parcel that is not free', async () => {
    const { html } = await show((s, x, y) => !isFree(s, x, y))
    expect(html).not.toContain('inspector-price')
  })

  it('AC-5: shows no price for an owned parcel', async () => {
    for (const planted of [false, true]) {
      expect((await render(planted)).html).not.toContain('inspector-price')
    }
  })
})

describe('ParcelInspector tooltips (S53)', () => {
  it('AC-4: each label of a planted, owned parcel has a tooltip from inspector.tips', async () => {
    const { html } = await render(true)
    const dts = [...html.matchAll(/<dt([^>]*)>([^<]*)</g)]
    expect(dts.length).toBeGreaterThanOrEqual(8)
    const tips = de.inspector.tips
    const keys = Object.keys(tips) as (keyof typeof tips)[]
    for (const [, attrs, label] of dts) {
      const key = keys.find((k) => de.inspector[k] === label)!
      expect(tips[key]).toBeTruthy()
      expect(attrs).toContain(` title="${tips[key]}"`)
    }
  })
})

describe('ParcelInspector empty state (U1)', () => {
  it('AC-1: the right panel shows the hint and no inspector without a selected parcel', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const selection = useSelectionStore(pinia)
    selection.tool = 'select'
    selection.parcel = null
    const html = await renderToString(createSSRApp({ render: () => h(Hud) }).use(pinia))
    const panel = html.split('data-testid="hud-right-panel"')[1]!.split('</aside>')[0]!
    expect(panel).toMatch(/data-testid="inspector-empty"[^>]*>Wähle eine Parzelle\.</)
    expect(panel).not.toContain('parcel-inspector')
  })

  it('AC-2: a selected parcel shows the inspector and no hint', async () => {
    const { html } = await render(false)
    expect(html).toContain('data-testid="parcel-inspector"')
    expect(html).not.toContain('inspector-empty')
  })
})
