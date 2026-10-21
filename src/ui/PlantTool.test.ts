import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { isBuildable } from '../sim/farm/parcels'
import type { Variety } from '../sim/farm/yield'
import { dispatch } from '../sim/commands'
import type { GameState } from '../sim/state'
import Hud from './Hud.vue'
import PlantTool from './PlantTool.vue'
import { plantSelected, plantVarieties } from './plantAction'
import { tools } from './toolbar'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// Owns 2 lowland parcels, selects them for the plant tool and sets the balance.
function setup(money: number, variety: Variety = 'robusta') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const parcels = state.world.parcels
    .filter((p) => p.zone === 'tiefland' && isBuildable(state.world, p.x, p.y))
    .slice(0, 2)
    .map(({ x, y }) => ({ x, y }))
  game.replace({
    ...dispatch({ ...state, money: 100000 }, { type: 'CreateParcels', parcels }),
    money,
  })
  const selection = useSelectionStore(pinia)
  selection.tool = 'plant'
  selection.variety = variety
  for (const p of parcels) selection.toggle(game.state as GameState, p)
  return { pinia, game, selection, parcels }
}

const render = (money: number, variety?: Variety) =>
  renderToString(createSSRApp(PlantTool).use(setup(money, variety).pinia))
const plantButton = (html: string) => html.match(/<button[^>]*plant-tool-plant[^>]*>/)![0]

describe('PlantTool (S13)', () => {
  it('AC-1: the toolbar has "Pflanzen" after "Parzelle"', () => {
    const ids = tools.map((t) => t.id)
    expect(ids.indexOf('plant')).toBe(ids.indexOf('parcel') + 1)
    expect(tools.find((t) => t.id === 'plant')!.label).toBe('Pflanzen')
  })

  it('AC-1: the right panel shows the plant tool and not the inspector', async () => {
    const { pinia, selection } = setup(50000)
    selection.parcel = { x: 0, y: 0 }
    const html = await renderToString(createSSRApp(Hud).use(pinia))
    expect(html).toContain('data-testid="plant-tool"')
    expect(html).not.toContain('data-testid="parcel-inspector"')
    expect(html).not.toContain('data-testid="parcel-tool"')
  })

  it('AC-3: shows 4 varieties, Robusta is the default', async () => {
    const html = await render(50000)
    for (const v of plantVarieties) expect(html).toContain(`plant-tool-variety-${v}`)
    expect(plantVarieties).toHaveLength(4)
    expect(html).toContain('data-testid="plant-tool-variety-robusta" aria-pressed="true"')
    expect(useSelectionStore(createPinia()).variety).toBe('robusta')
  })

  // The 2 seeds cost the price at the mid volume of 1 unit, so the total is a little above 2 × seedCost.
  // S57: the total rounds up to whole CC.
  it('AC-3: the total for 2 parcels is 5 CC for Robusta and 9 CC for Arabica Standard', async () => {
    expect(await render(50000, 'robusta')).toMatch(/plant-tool-total"[^>]*>5 CC</)
    expect(await render(50000, 'arabicaStandard')).toMatch(/plant-tool-total"[^>]*>9 CC</)
  })

  it('S40: keeps the varieties and hides the count, total and button when no parcel is selected', async () => {
    const { pinia, selection } = setup(50000)
    selection.parcels = []
    selection.note = 'invalid'
    const html = await renderToString(createSSRApp(PlantTool).use(pinia))
    expect(html).toContain('plant-tool-variety-arabicaStandard')
    for (const id of [
      'plant-tool-count',
      'plant-tool-total',
      'plant-tool-plant',
      'plant-tool-short',
    ])
      expect(html).not.toContain(id)
    expect(html).toMatch(/data-testid="tool-note"[^>]*>Hier nicht möglich.</)
  })

  it('AC-4: disables "Pflanzen" when the total is more than the balance', async () => {
    const html = await render(499)
    expect(plantButton(html)).toContain('disabled')
    expect(html).toContain('Nicht genug CC.')
  })

  it('AC-4: enables "Pflanzen" when the balance is equal to the total', async () => {
    const html = await render(500)
    expect(plantButton(html)).not.toContain('disabled')
    expect(html).not.toContain('plant-tool-short')
  })

  it('AC-5: plants the chosen variety, takes the seed cost and clears the selection', () => {
    const { game, selection, parcels } = setup(50000, 'arabicaStandard')
    plantSelected()
    const { size } = game.state.world
    for (const { x, y } of parcels)
      expect(game.state.farm.plants[y * size + x]?.variety).toBe('arabicaStandard')
    expect(game.state.money).toBe(50000 - 900)
    expect(selection.parcels).toEqual([])
  })
})

describe('PlantTool locked varieties (S48)', () => {
  const button = (html: string, v: string) =>
    html.match(new RegExp(`<button[^>]*plant-tool-variety-${v}"[^>]*>[\\s\\S]*?</button>`))![0]

  // A new game with the balance set so that capital is money: no stock, nothing invested.
  async function renderNew(money: number) {
    const pinia = createPinia()
    setActivePinia(pinia)
    const game = useGameStore(pinia)
    game.replace({ ...(game.state as GameState), money })
    useSelectionStore(pinia).tool = 'plant'
    return renderToString(createSSRApp(PlantTool).use(pinia))
  }

  it('AC-3: in a new game Arabica Premium and Spezialität are disabled with their condition', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const html = await renderToString(createSSRApp(PlantTool).use(pinia))
    for (const v of ['robusta', 'arabicaStandard']) {
      expect(button(html, v)).not.toContain('disabled')
      expect(button(html, v)).not.toContain('plant-tool-locked')
    }
    const premium = button(html, 'arabicaPremium')
    expect(premium).toContain('disabled')
    expect(premium).toContain('Arabica Premium')
    expect(premium).toMatch(/plant-tool-locked-arabicaPremium[^>]*>[^<]*Phase 2[^<]*2\.000 CC</)
    const specialty = button(html, 'specialty')
    expect(specialty).toContain('disabled')
    expect(specialty).toContain('Spezialität')
    expect(specialty).toMatch(/plant-tool-locked-specialty[^>]*>[^<]*Phase 3[^<]*10\.000 CC</)
  })

  it('AC-3: at 2.000 CC capital Arabica Premium is enabled and Spezialität stays disabled', async () => {
    const html = await renderNew(200000)
    expect(button(html, 'arabicaPremium')).not.toContain('disabled')
    expect(html).not.toContain('plant-tool-locked-arabicaPremium')
    expect(button(html, 'specialty')).toContain('disabled')
    expect(html).toContain('plant-tool-locked-specialty')
  })

  it('UX: Spezialität says "nur auf Vulkanboden", locked or not', async () => {
    for (const money of [0, 1000000]) {
      const specialty = button(await renderNew(money), 'specialty')
      expect(specialty).toMatch(/plant-tool-zone-specialty[^>]*>\s*nur auf Vulkanboden\s*</)
      expect(specialty.includes('plant-tool-locked-specialty')).toBe(money === 0)
    }
    expect(button(await renderNew(0), 'robusta')).not.toContain('Vulkanboden')
  })

  it('AC-4: with Specialty the count and the plant action use only the volcano parcels', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const game = useGameStore(pinia)
    const state = game.state as GameState
    const free = (zone: string) =>
      state.world.parcels
        .filter((p) => p.zone === zone && isBuildable(state.world, p.x, p.y))
        .map(({ x, y }) => ({ x, y }))
    const volcano = free('vulkan').slice(0, 2)
    const parcels = [...volcano, free('tiefland')[0]!]
    expect(volcano).toHaveLength(2)
    game.replace(dispatch({ ...state, money: 2000000 }, { type: 'CreateParcels', parcels }))
    const selection = useSelectionStore(pinia)
    selection.tool = 'plant'
    selection.variety = 'specialty'
    for (const p of parcels) selection.toggle(game.state as GameState, p)
    expect(selection.parcels).toHaveLength(3)
    const html = await renderToString(createSSRApp(PlantTool).use(pinia))
    expect(html).toMatch(/plant-tool-count"[^>]*>2</)
    plantSelected()
    const { size } = game.state.world
    expect(Object.values(game.state.farm.plants).map((p) => p.variety)).toEqual([
      'specialty',
      'specialty',
    ])
    for (const { x, y } of volcano) expect(game.state.farm.plants[y * size + x]).toBeDefined()
  })
})
