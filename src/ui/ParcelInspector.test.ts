import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { dispatch } from '../sim/commands'
import { forecastYield } from '../sim/farm/forecast'
import { isBuildable } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import de from './i18n/de.json'
import ParcelInspector from './ParcelInspector.vue'

vi.stubGlobal('location', { search: '?seed=42' })

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
