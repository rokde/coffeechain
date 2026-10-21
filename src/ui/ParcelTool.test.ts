import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { isBuildable, quoteParcels } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import { formatMoney } from './money'
import ParcelTool from './ParcelTool.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// Renders the panel with one selected lowland parcel and the balance cost + delta.
async function render(delta: number) {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const { x, y } = state.world.parcels.find(
    (p) => p.zone === 'tiefland' && isBuildable(state.world, p.x, p.y),
  )!
  const cost = quoteParcels(state, [{ x, y }])
  game.replace({ ...state, money: cost + delta })
  useSelectionStore(pinia).parcels = [{ x, y }]
  return { html: await renderToString(createSSRApp(ParcelTool).use(pinia)), cost }
}

const button = (html: string) => html.match(/<button[^>]*>/)![0]

describe('ParcelTool (S12)', () => {
  it('AC-5: disables "Anlegen" when the cost is more than the balance', async () => {
    const { html } = await render(-1)
    expect(button(html)).toContain('disabled')
    expect(html).toContain('data-testid="parcel-tool-short"')
    expect(html).toContain('Nicht genug CC.')
  })

  it('AC-5: enables "Anlegen" when the balance pays the cost', async () => {
    const { html, cost } = await render(0)
    expect(button(html)).not.toContain('disabled')
    expect(html).not.toContain('parcel-tool-short')
    expect(html).toContain(formatMoney(cost))
  })

  it('S40: a note shows in the panel, and a change of tool removes it', async () => {
    const pinia = createPinia()
    const selection = useSelectionStore(pinia)
    selection.tool = 'parcel'
    selection.note = 'money'
    const html = await renderToString(createSSRApp(ParcelTool).use(pinia))
    expect(html).toMatch(/data-testid="tool-note"[^>]*>Nicht genug CC.</)
    expect(html).not.toContain('parcel-tool-create')
    selection.tool = 'plant'
    expect(selection.note).toBeNull()
  })

  it('S57: formats hundredths of CC as whole CC, rounded down', () => {
    expect(formatMoney(50000)).toBe('500 CC')
    expect(formatMoney(123456789)).toBe('1.234.567 CC')
    expect(formatMoney(4850)).toBe('48 CC')
  })
})
