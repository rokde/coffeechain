import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { canSelect, pickTool, useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { dispatch } from '../sim/commands'
import { isFree } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import BuildTool from './BuildTool.vue'
import { buildSelected } from './farmAction'
import Hud from './Hud.vue'
import { formatMoney } from './money'
import { tools } from './toolbar'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

type Pos = { x: number; y: number }

// Owns 2 empty and 1 planted lowland parcel, and 1 more with a Lager-Ausbau. Marks the given parcels.
function setup(
  marks: (lands: Record<'free' | 'empty' | 'empty2' | 'young', Pos>) => Pos[],
  money = 50000,
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const lands = state.world.parcels
    .filter((p) => p.zone === 'tiefland' && isFree(state, p.x, p.y))
    .slice(0, 5)
    .map(({ x, y }) => ({ x, y }))
  const [free, empty, empty2, young, store] = lands as [Pos, Pos, Pos, Pos, Pos]
  let next = dispatch(
    { ...state, money: 100000 },
    { type: 'CreateParcels', parcels: [empty, empty2, young, store] },
  )
  next = dispatch(next, { type: 'Plant', variety: 'robusta', parcels: [young] })
  next = dispatch(next, { type: 'Build', building: 'storage', parcel: store })
  game.replace({ ...next, money })
  const selection = useSelectionStore(pinia)
  const named = { free, empty, empty2, young }
  selection.parcels = marks(named)
  pickTool(selection, game.state as GameState, 'build')
  const spy = vi.spyOn(game, 'dispatch')
  return { pinia, game, selection, spy, ...named }
}

const html = (pinia: ReturnType<typeof createPinia>) => renderToString(createSSRApp(Hud).use(pinia))
const button = (text: string, kind: string) =>
  text.match(new RegExp(`<button[^>]*build-tool-build-${kind}[^>]*>`))![0]

describe('BuildTool (S44)', () => {
  it('AC-4: the toolbar has "Bauen" and the right panel shows the build tool', async () => {
    expect(tools.find((t) => t.id === 'build')!.label).toBe('Bauen')
    const { pinia } = setup((l) => [l.empty])
    const text = await html(pinia)
    expect(text).toContain('data-testid="build-tool"')
    expect(text).not.toContain('data-testid="parcel-inspector"')
  })

  it('AC-4: lists both buildings with cost; the locked row shows "ab Phase 2" and a disabled button', async () => {
    const { pinia } = setup((l) => [l.empty])
    const text = await html(pinia)
    const row = (kind: string, name: string, cents: number) =>
      new RegExp(`build-tool-${kind}"[^>]*>[\\s\\S]*?${name}[\\s\\S]*?>${formatMoney(cents)}<`)
    expect(text).toMatch(row('processing', 'Aufbereitung', 15000))
    expect(text).toMatch(row('storage', 'Lager-Ausbau', 40000))
    expect(text).toContain('ab Phase 2')
    expect(button(text, 'storage')).toContain('disabled')
    expect(button(text, 'processing')).not.toContain('disabled')
  })

  it('AC-4: "Bauen" builds the Aufbereitung on the first kept mark and lowers the money by 150 CC', async () => {
    const { pinia, game, selection, spy, empty, empty2 } = setup((l) => [
      l.young,
      l.empty,
      l.empty2,
    ])
    const before = game.state.money
    buildSelected('processing')
    expect(spy).toHaveBeenCalledWith({ type: 'Build', building: 'processing', parcel: empty })
    expect(selection.parcels).toEqual([empty2])
    expect(game.state.money).toBe(before - 15000)
    const text = await html(pinia)
    expect(text).toMatch(new RegExp(`data-testid="money"[^>]*>${formatMoney(before - 15000)}<`))
    expect(button(text, 'processing')).toContain('disabled')
    expect(canSelect(game.state as GameState, 'plant', empty)).toBe(false)
  })

  it('AC-4: the button is disabled with no kept mark or when the money is short', async () => {
    expect(button(await html(setup(() => []).pinia), 'processing')).toContain('disabled')
    const poor = await html(setup((l) => [l.empty], 14999).pinia)
    expect(button(poor, 'processing')).toContain('disabled')
    expect(poor).toContain('data-testid="build-tool-short"')
  })

  it('round 1: hides the cost of a built entry and names the first mark when there are several', async () => {
    const { pinia } = setup((l) => [l.empty, l.empty2])
    const several = await html(pinia)
    expect(several).toContain('data-testid="build-tool-first"')
    buildSelected('processing')
    const text = await html(pinia)
    expect(text).toMatch(/build-tool-processing"[^>]*>(?:(?!<\/li>)[\s\S])*Schon gebaut/)
    expect(text).not.toMatch(/build-tool-processing"[^>]*>(?:(?!<\/li>)[\s\S])*build-tool-cost/)
    expect(text).not.toContain('data-testid="build-tool-first"')
  })

  it('AC-5: marks on planted or not owned parcels are cleared with "Hier nicht möglich."', async () => {
    const { pinia, selection } = setup((l) => [l.young, l.free])
    expect(selection.parcels).toEqual([])
    const text = await renderToString(createSSRApp(BuildTool).use(pinia))
    expect(text).toContain('Hier nicht möglich.')
  })
})
