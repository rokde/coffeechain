import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { pickTool, useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { dispatch } from '../sim/commands'
import { quoteCare } from '../sim/farm/care'
import { isBuildable, quoteParcels } from '../sim/farm/parcels'
import { quotePlant } from '../sim/farm/plants'
import type { GameState } from '../sim/state'
import { createSelected, farmSelected } from './farmAction'
import FarmTool from './FarmTool.vue'
import { formatMoney } from './money'
import ParcelTool from './ParcelTool.vue'
import { plantSelected } from './plantAction'
import PlantTool from './PlantTool.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// Marks 2 free, 2 owned empty and 2 owned planted lowland parcels with the select tool, then picks the tool.
function setup(tool: string, money: number) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const lands = state.world.parcels
    .filter((p) => p.zone === 'tiefland' && isBuildable(state.world, p.x, p.y))
    .slice(0, 6)
    .map(({ x, y }) => ({ x, y }))
  const [free, empty, young] = [lands.slice(0, 2), lands.slice(2, 4), lands.slice(4, 6)]
  const owned = dispatch(
    { ...state, money: 100000 },
    { type: 'CreateParcels', parcels: [...empty, ...young] },
  )
  game.replace({
    ...dispatch(owned, { type: 'Plant', variety: 'robusta', parcels: young }),
    money,
  })
  const selection = useSelectionStore(pinia)
  selection.parcels = lands
  pickTool(selection, game.state as GameState, tool)
  const spy = vi.spyOn(game, 'dispatch')
  return { pinia, game, selection, free, empty, young, spy }
}

const html = (panel: Component, pinia: ReturnType<typeof createPinia>) =>
  renderToString(createSSRApp(panel).use(pinia))
const button = (text: string, id: string) => text.match(new RegExp(`<button[^>]*${id}[^>]*>`))![0]

describe('selection first, right panels (S40c)', () => {
  it('AC-3: PlantTool shows count 2 and the quotePlant total, and confirm plants both', async () => {
    const { pinia, game, selection, empty, spy } = setup('plant', 50000)
    const text = await html(PlantTool, pinia)
    const total = quotePlant(game.state as GameState, 'robusta', 2)
    expect(text).toMatch(/plant-tool-count"[^>]*>2</)
    expect(text).toMatch(new RegExp(`plant-tool-total"[^>]*>${formatMoney(total)}<`))
    expect(button(text, 'plant-tool-plant')).not.toContain('disabled')
    plantSelected()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ type: 'Plant', variety: 'robusta', parcels: empty })
    expect(selection.parcels).toEqual([])
    expect(selection.tool).toBe('plant')
  })

  it('AC-3: ParcelTool shows count 2 and the quoteParcels total, and confirm buys both', async () => {
    const { pinia, game, selection, free, spy } = setup('parcel', 50000)
    const text = await html(ParcelTool, pinia)
    const total = quoteParcels(game.state as GameState, free)
    expect(text).toMatch(/parcel-tool-count"[^>]*>2</)
    expect(text).toMatch(new RegExp(`parcel-tool-total"[^>]*>${formatMoney(total)}<`))
    createSelected()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ type: 'CreateParcels', parcels: free })
    expect(selection.parcels).toEqual([])
    expect(selection.tool).toBe('parcel')
  })

  it('AC-3: FarmTool counts only the marks that are still valid, and confirm sends only them', async () => {
    const { pinia, game, selection, young, spy } = setup('fertilize', 50000)
    expect(selection.parcels).toEqual(young)
    // The game runs on: one plant gets fertilizer after the tool click.
    game.replace(dispatch(game.state as GameState, { type: 'Fertilize', parcels: [young[0]!] }))
    spy.mockClear()
    const text = await html(FarmTool, pinia)
    const rest = [young[1]!]
    expect(text).toMatch(/farm-tool-count"[^>]*>1</)
    const total = quoteCare(game.state as GameState, { type: 'Fertilize', parcels: rest })
    expect(text).toMatch(new RegExp(`farm-tool-total"[^>]*>${formatMoney(total)}<`))
    farmSelected('fertilize')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ type: 'Fertilize', parcels: rest })
    expect(selection.parcels).toEqual([])
    expect(selection.tool).toBe('fertilize')
  })

  it.each([
    [PlantTool, 'plant', 'plant-tool-plant', 'plant-tool-short'],
    [ParcelTool, 'parcel', 'parcel-tool-create', 'parcel-tool-short'],
    [FarmTool, 'fertilize', 'farm-tool-apply', 'farm-tool-short'],
  ] as const)(
    'AC-4: %#: the confirm button is disabled with "Nicht genug CC." when money is short',
    async (panel, tool, id, short) => {
      const { pinia } = setup(tool, 1)
      const text = await html(panel, pinia)
      expect(button(text, id)).toContain('disabled')
      expect(text).toContain(`data-testid="${short}"`)
      expect(text).toContain('Nicht genug CC.')
    },
  )
})
