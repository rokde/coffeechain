import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { firstSteps, useFirstStepsStore, type StepId } from '../app/firstSteps'
import { useGameStore } from '../app/store'
import { useViewStore } from '../app/view'
import { balance } from '../sim/balance'
import { dispatch } from '../sim/commands'
import { isBuildable } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import Hud from './Hud.vue'

vi.stubGlobal('location', { search: '?seed=42' })

const fresh = () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}
const parcels = (s: GameState) =>
  s.world.parcels
    .filter((p) => p.zone === 'tiefland' && isBuildable(s.world, p.x, p.y))
    .slice(0, 2)
    .map(({ x, y }) => ({ x, y }))
const doneIds = (state: GameState, overlay: 'none' | 'soil' = 'none') =>
  firstSteps(state, overlay)
    .steps.filter((s) => s.done)
    .map((s) => s.id)

// Builds each state with the real commands.
function states() {
  const game = useGameStore(fresh())
  const start = { ...(game.state as GameState), money: 100000 }
  const list = parcels(start)
  const owned = dispatch(start, { type: 'CreateParcels', parcels: list })
  const planted = dispatch(owned, { type: 'Plant', variety: 'robusta', parcels: list })
  const fertilized = dispatch(planted, { type: 'Fertilize', parcels: list })
  const hour =
    fertilized.time.hour + balance().varieties.robusta.cycleDays * balance().time.ticksPerGameDay
  const harvested = dispatch(
    { ...fertilized, time: { ...fertilized.time, hour } },
    { type: 'Harvest', parcels: list },
  )
  const sold = dispatch(harvested, { type: 'Sell', variety: 'robusta', units: 1 })
  return { start, owned, planted, fertilized, harvested, sold }
}

const html = (pinia: ReturnType<typeof createPinia>) => renderToString(createSSRApp(Hud).use(pinia))
const left = (h: string) => h.split('data-testid="hud-left-panel"')[1]!.split('</aside>')[0]!
const guides = (h: string) =>
  [...h.matchAll(/data-testid="([^"]+)"[^>]*data-guide="next"/g)].map((m) => m[1])

describe('FirstSteps (S25)', () => {
  it('AC-1: a new game shows the 5 steps, none done, and no message panel', async () => {
    const h = left(await html(fresh()))
    expect(h).toContain('data-testid="first-steps"')
    expect(h).toContain('Erste Schritte')
    expect(h).not.toContain('message-panel')
    const order = ['overlay', 'parcel', 'plant', 'fertilize', 'sell'].map((id) =>
      h.indexOf(`first-step-${id}"`),
    )
    expect(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1]!))).toBe(true)
    expect(h).not.toContain('data-done="true"')
  })

  it('AC-2: each step is done only for its condition', () => {
    const s = states()
    expect(doneIds(s.start)).toEqual([])
    expect(doneIds(s.start, 'soil')).toEqual(['overlay'])
    expect(doneIds(s.owned)).toEqual(['parcel'])
    expect(doneIds(s.planted)).toEqual(['parcel', 'plant'])
    expect(doneIds(s.fertilized)).toEqual(['parcel', 'plant', 'fertilize'])
    expect(doneIds(s.harvested)).toEqual(['parcel'])
    expect(doneIds(s.sold)).toEqual(['parcel', 'sell'])
  })

  it('AC-3: a done step stays done when its condition is false again', () => {
    const s = states()
    const game = useGameStore()
    const view = useViewStore()
    const store = useFirstStepsStore()
    view.toggle('soil')
    view.toggle('soil')
    game.replace(s.fertilized)
    game.replace(s.start)
    const done = store.current.steps.filter((x) => x.done).map((x) => x.id)
    expect(done).toEqual<StepId[]>(['overlay', 'parcel', 'plant', 'fertilize'])
  })

  it('AC-4: only the next target is highlighted, with its hint', async () => {
    const s = states()
    const pinia = fresh()
    const game = useGameStore(pinia)
    const view = useViewStore(pinia)
    useFirstStepsStore(pinia) // created outside SSR, so its watcher runs
    let h = await html(pinia)
    expect(guides(h)).toEqual(['overlay-soil'])
    expect(h).toContain('Boden-Overlay ein')
    view.toggle('soil')
    expect(guides(await html(pinia))).toEqual(['tool-parcel'])
    game.replace(s.owned)
    expect(guides(await html(pinia))).toEqual(['tool-plant'])
    game.replace(s.fertilized)
    expect(guides(await html(pinia))).toEqual([])
    game.replace({ ...s.fertilized, time: { ...s.fertilized.time, hour: s.harvested.time.hour } })
    h = await html(pinia)
    expect(guides(h)).toEqual(['tool-harvest'])
    expect(h).toContain('Ernten')
    game.replace(s.harvested)
    expect(guides(await html(pinia))).toEqual(['tool-market'])
    game.replace(s.sold)
    h = await html(pinia)
    expect(guides(h)).toEqual([])
    expect(h).not.toContain('first-steps-hint')
  })

  it('AC-5: the close button hides the list, and a new game shows it again', async () => {
    const pinia = fresh()
    const h0 = await html(pinia)
    expect(h0).toMatch(/<button[^>]*first-steps-close[^>]*aria-label="[^"]+"/)
    useFirstStepsStore(pinia).open = false
    const h = await html(pinia)
    expect(left(h)).toContain('message-panel')
    expect(h).not.toContain('first-steps"')
    expect(h).not.toContain('data-guide')
    expect(useFirstStepsStore(fresh()).open).toBe(true)
  })
})
