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
import { plantSelected } from './plantAction'
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

  it('AC-3: shows Robusta and Arabica Standard only, Robusta is the default', async () => {
    const html = await render(50000)
    expect(html).toContain('Robusta')
    expect(html).toContain('Arabica Standard')
    expect(html).not.toContain('Arabica Premium')
    expect(html).not.toContain('Specialty')
    expect(html).toContain('data-testid="plant-tool-variety-robusta" aria-pressed="true"')
    expect(useSelectionStore(createPinia()).variety).toBe('robusta')
  })

  // The 2 seeds cost the price at the mid volume of 1 unit, so the total is a little above 2 × seedCost.
  it('AC-3: the total for 2 parcels is 4,01 CC for Robusta and 8,01 CC for Arabica Standard', async () => {
    expect(await render(50000, 'robusta')).toMatch(/plant-tool-total"[^>]*>4,01 CC</)
    expect(await render(50000, 'arabicaStandard')).toMatch(/plant-tool-total"[^>]*>8,01 CC</)
  })

  it('AC-4: disables "Pflanzen" when no parcel is selected', async () => {
    const { pinia, selection } = setup(50000)
    selection.parcels = []
    const html = await renderToString(createSSRApp(PlantTool).use(pinia))
    expect(plantButton(html)).toContain('disabled')
    expect(html).not.toContain('plant-tool-short')
  })

  it('AC-4: disables "Pflanzen" when the total is more than the balance', async () => {
    const html = await render(400)
    expect(plantButton(html)).toContain('disabled')
    expect(html).toContain('Nicht genug CC.')
  })

  it('AC-4: enables "Pflanzen" when the balance is equal to the total', async () => {
    const html = await render(401)
    expect(plantButton(html)).not.toContain('disabled')
    expect(html).not.toContain('plant-tool-short')
  })

  it('AC-5: plants the chosen variety, takes the seed cost and clears the selection', () => {
    const { game, selection, parcels } = setup(50000, 'arabicaStandard')
    plantSelected()
    const { size } = game.state.world
    for (const { x, y } of parcels)
      expect(game.state.farm.plants[y * size + x]?.variety).toBe('arabicaStandard')
    expect(game.state.money).toBe(50000 - 801)
    expect(selection.parcels).toEqual([])
  })
})
