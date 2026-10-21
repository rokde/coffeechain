import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useGameStore } from '../app/store'
import { dispatch } from '../sim/commands'
import { isFree } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import BuildTool from './BuildTool.vue'
import Hud from './Hud.vue'
import MessagePanel from './MessagePanel.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// A new game with the given number of Lager-Ausbau buildings and units in storage.
function setup(stages: number, used = 0) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const lands = state.world.parcels
    .filter((p) => p.zone === 'tiefland' && isFree(state, p.x, p.y))
    .slice(0, stages)
    .map(({ x, y }) => ({ x, y }))
  let next = { ...state, money: 1_000_000 }
  if (stages) next = dispatch(next, { type: 'CreateParcels', parcels: lands })
  for (const parcel of lands) next = dispatch(next, { type: 'Build', building: 'storage', parcel })
  game.replace({
    ...next,
    money: state.money,
    storage: { batches: used ? [{ variety: 'robusta', units: used, quality: 100 }] : [] },
  })
  return pinia
}

const render = async (pinia: ReturnType<typeof createPinia>) => {
  const html = await renderToString(createSSRApp(Hud).use(pinia))
  const chip = html.match(/data-testid="storage" title="([^"]*)"/)![1]
  const panel = await renderToString(createSSRApp(MessagePanel).use(pinia))
  const messages = [...panel.matchAll(/data-testid="message"[^>]*>([^<]*)</g)].map((m) => m[1])
  return { chip, messages }
}

const capacityLine = async (pinia: ReturnType<typeof createPinia>) => {
  const html = await renderToString(createSSRApp(BuildTool).use(pinia))
  return html.match(/data-testid="build-tool-capacity"[^>]*>\s*([^<]*?)\s*</)?.[1]
}

describe('Storage upgrade (S45)', () => {
  it('AC-4: the chip and "Lager voll" use the capacity of the stage', async () => {
    const full = await render(setup(1, 250))
    expect(full.chip).toBe('Lager 250 / 250')
    expect(full.messages).toContain('Lager voll')
    const half = await render(setup(1, 100))
    expect(half.chip).toBe('Lager 100 / 250')
    expect(half.messages).not.toContain('Lager voll')
  })

  it('AC-4: the Lager-Ausbau row shows the capacity of the next stage', async () => {
    expect(await capacityLine(setup(0))).toBe('Platz für 250 Einheiten')
    expect(await capacityLine(setup(1))).toBe('Platz für 600 Einheiten')
    expect(await capacityLine(setup(2))).toBeUndefined()
  })
})
