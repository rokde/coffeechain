import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { isBuildable } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import { formatMoney } from './money'
import ParcelTool from './ParcelTool.vue'

vi.stubGlobal('location', { search: '?seed=42' })

// Renders the panel with one selected lowland parcel (cost 4800) and the given balance.
async function render(money: number) {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const { x, y } = state.world.parcels.find(
    (p) => p.zone === 'tiefland' && isBuildable(state.world, p.x, p.y),
  )!
  game.replace({ ...state, money })
  useSelectionStore(pinia).parcels = [{ x, y }]
  return renderToString(createSSRApp(ParcelTool).use(pinia))
}

const button = (html: string) => html.match(/<button[^>]*>/)![0]

describe('ParcelTool (S12)', () => {
  it('AC-5: disables "Anlegen" when the cost is more than the balance', async () => {
    expect(button(await render(4799))).toContain('disabled')
  })

  it('AC-5: enables "Anlegen" when the balance pays the cost', async () => {
    const html = await render(4800)
    expect(button(html)).not.toContain('disabled')
    expect(html).toContain('48 CC')
  })

  it('formats hundredths of CC with at most 2 decimals', () => {
    expect(formatMoney(50000)).toBe('500 CC')
    expect(formatMoney(123456789)).toBe('1.234.567,89 CC')
    expect(formatMoney(4850)).toBe('48,5 CC')
  })
})
