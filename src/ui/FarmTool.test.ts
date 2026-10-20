import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useSelectionStore, type FarmTool } from '../app/selection'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import { dispatch } from '../sim/commands'
import { isBuildable } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import { storageUsed } from '../sim/storage/storage'
import { farmSelected } from './farmAction'
import FarmToolPanel from './FarmTool.vue'
import Hud from './Hud.vue'
import { tools } from './toolbar'

vi.stubGlobal('location', { search: '?seed=42' })

// Owns 2 lowland parcels with Robusta, selects them for the tool and sets the balance.
// With ripe, the plants are ripe. used fills the storage before the harvest.
function setup(tool: FarmTool, money: number, ripe = false, used = 0) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const parcels = state.world.parcels
    .filter((p) => p.zone === 'tiefland' && isBuildable(state.world, p.x, p.y))
    .slice(0, 2)
    .map(({ x, y }) => ({ x, y }))
  const owned = dispatch({ ...state, money: 100000 }, { type: 'CreateParcels', parcels })
  const planted = dispatch(owned, { type: 'Plant', variety: 'robusta', parcels })
  const { cycleDays } = balance().varieties.robusta
  const hour = planted.time.hour + (ripe ? cycleDays * balance().time.ticksPerGameDay : 0)
  const batches = used ? [{ variety: 'robusta' as const, units: used, quality: 100 }] : []
  game.replace({ ...planted, money, time: { ...planted.time, hour }, storage: { batches } })
  const selection = useSelectionStore(pinia)
  selection.tool = tool
  for (const p of parcels) selection.toggle(game.state as GameState, p)
  return { pinia, game, selection, parcels }
}

const render = (tool: FarmTool, money: number) =>
  renderToString(createSSRApp(FarmToolPanel).use(setup(tool, money).pinia))
const applyButton = (html: string) => html.match(/<button[^>]*farm-tool-apply[^>]*>/)![0]
const careTools = [
  ['fertilize', 'Fertilize', 'fertilized'],
  ['irrigate', 'Irrigate', 'irrigated'],
  ['protect', 'ProtectPests', 'pestProtected'],
] as const

describe('FarmTool (S18a)', () => {
  it('AC-1: the toolbar has "Düngen", "Wässern", "Schutz", "Ernten" after "Pflanzen"', () => {
    const ids = tools.map((t) => t.id)
    const at = ids.indexOf('plant') + 1
    expect(ids.slice(at, at + 4)).toEqual(['fertilize', 'irrigate', 'protect', 'harvest'])
    expect(tools.slice(at, at + 4).map((t) => t.label)).toEqual([
      'Düngen',
      'Wässern',
      'Schutz',
      'Ernten',
    ])
  })

  it.each(['fertilize', 'irrigate', 'protect', 'harvest'] as const)(
    'AC-1: with %s, the right panel shows the farm tool and not the inspector',
    async (tool) => {
      const { pinia, selection } = setup(tool, 50000)
      selection.parcel = { x: 0, y: 0 }
      const html = await renderToString(createSSRApp(Hud).use(pinia))
      expect(html).toContain('data-testid="farm-tool"')
      expect(html).not.toContain('data-testid="parcel-inspector"')
    },
  )

  it.each(careTools)('AC-3: %s shows a total of 2 CC for 2 Robusta plants', async (tool) => {
    const html = await render(tool, 50000)
    expect(html).toMatch(/farm-tool-count"[^>]*>2</)
    expect(html).toMatch(/farm-tool-total"[^>]*>2 CC</)
    expect(applyButton(html)).not.toContain('disabled')
  })

  it('S40: hides the count, total and button when no parcel is selected', async () => {
    const { pinia, selection } = setup('fertilize', 50000)
    selection.parcels = []
    const html = await renderToString(createSSRApp(FarmToolPanel).use(pinia))
    for (const id of ['farm-tool-count', 'farm-tool-total', 'farm-tool-apply', 'farm-tool-short'])
      expect(html).not.toContain(id)
    expect(html).toContain('Klicke Parzellen')
  })

  it.each([
    ['invalid', 'Hier nicht möglich.'],
    ['money', 'Nicht genug CC.'],
  ] as const)('S40 AC-5: the note %s shows "%s"', async (note, text) => {
    const { pinia, selection } = setup('fertilize', 50000)
    selection.note = note
    const html = await renderToString(createSSRApp(FarmToolPanel).use(pinia))
    expect(html).toMatch(new RegExp(`data-testid="tool-note"[^>]*>${text}<`))
    selection.note = null
    expect(await renderToString(createSSRApp(FarmToolPanel).use(pinia))).not.toContain('tool-note')
  })

  it('AC-3: disables the button with "Nicht genug CC." when the total is more than the balance', async () => {
    const html = await render('fertilize', 199)
    expect(applyButton(html)).toContain('disabled')
    expect(html).toContain('Nicht genug CC.')
    expect(applyButton(await render('fertilize', 200))).not.toContain('disabled')
  })

  it.each(careTools)(
    'AC-3: %s sends %s, takes the total, sets %s and clears the selection',
    (tool, _, flag) => {
      const { game, selection, parcels } = setup(tool, 50000)
      farmSelected(tool)
      const { size } = game.state.world
      for (const { x, y } of parcels) expect(game.state.farm.plants[y * size + x]![flag]).toBe(true)
      expect(game.state.money).toBe(50000 - 200)
      expect(selection.parcels).toEqual([])
    },
  )

  it('AC-4: the harvest tool shows no total and sends Harvest', async () => {
    const { pinia, game, selection, parcels } = setup('harvest', 0, true)
    expect(selection.parcels).toEqual(parcels)
    const html = await renderToString(createSSRApp(FarmToolPanel).use(pinia))
    expect(html).not.toContain('farm-tool-total')
    expect(applyButton(html)).not.toContain('disabled')
    farmSelected('harvest')
    expect(storageUsed(game.state.storage as GameState['storage'])).toBeGreaterThan(0)
    const { size } = game.state.world
    for (const { x, y } of parcels) expect(game.state.farm.plants[y * size + x]).toBeUndefined()
    expect(selection.parcels).toEqual([])
  })

  it('AC-4: with a full storage, the plants keep pendingUnits', () => {
    const capacity = balance().storage.startCapacity
    const { game, selection, parcels } = setup('harvest', 0, true, capacity)
    farmSelected('harvest')
    const { size } = game.state.world
    for (const { x, y } of parcels)
      expect(game.state.farm.plants[y * size + x]!.pendingUnits).toBeGreaterThan(0)
    expect(selection.parcels).toEqual([])
  })

  it('AC-5: the top bar shows "Lager 0 / 100" in a new game and the value after a harvest', async () => {
    const pinia = createPinia()
    expect(await renderToString(createSSRApp(Hud).use(pinia))).toMatch(
      /data-testid="storage"[^>]*>Lager 0 \/ 100</,
    )
    const { pinia: after, game } = setup('harvest', 0, true)
    farmSelected('harvest')
    const used = storageUsed(game.state.storage as GameState['storage'])
    expect(await renderToString(createSSRApp(Hud).use(after))).toMatch(
      new RegExp(`data-testid="storage"[^>]*>Lager ${used} / 100<`),
    )
  })

  it('Round 1: drops parcels that turned ripe after the selection and does not throw', async () => {
    const { pinia, game, selection } = setup('fertilize', 50000)
    const { cycleDays } = balance().varieties.robusta
    const state = game.state as GameState
    const hour = state.time.hour + cycleDays * balance().time.ticksPerGameDay
    game.replace({ ...state, time: { ...state.time, hour } })
    const html = await renderToString(createSSRApp(FarmToolPanel).use(pinia))
    expect(html).toMatch(/farm-tool-count"[^>]*>0</)
    expect(html).toMatch(/farm-tool-total"[^>]*>0 CC</)
    expect(applyButton(html)).toContain('disabled')
    expect(() => farmSelected('fertilize')).not.toThrow()
    expect(game.state.money).toBe(50000)
    expect(selection.parcels).toEqual([])
  })

  it('Round 1: sends the command only for the parcels that are still valid', () => {
    const { game, selection, parcels } = setup('fertilize', 50000)
    const [cared, open] = parcels
    game.replace(dispatch(game.state as GameState, { type: 'Fertilize', parcels: [cared!] }))
    expect(() => farmSelected('fertilize')).not.toThrow()
    const { size } = game.state.world
    expect(game.state.farm.plants[open!.y * size + open!.x]!.fertilized).toBe(true)
    expect(game.state.money).toBe(50000 - 200)
    expect(selection.parcels).toEqual([])
  })
})
