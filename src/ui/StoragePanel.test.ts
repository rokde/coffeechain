import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useGameStore } from '../app/store'
import type { GameState } from '../sim/state'
import type { Batch } from '../sim/storage/storage'
import StoragePanel from './StoragePanel.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// Day 71: 12. März, Jahr 1.
function render(batches: Batch[]) {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  game.replace({ ...state, time: { ...state.time, day: 71 }, storage: { batches } })
  return renderToString(createSSRApp(StoragePanel).use(pinia))
}

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

describe('StoragePanel (#9)', () => {
  it('AC-1: shows an empty storage', async () => {
    const html = await render([])
    expect(html).toContain('data-testid="storage-empty"')
    expect(text(html)).toContain('0 von 100 Einheiten belegt')
  })

  it('AC-2: shows one row per variety, state and quality with shelf life and cost', async () => {
    const html = await render([
      { variety: 'robusta', units: 40, quality: 82, storedDay: 71 },
      { variety: 'robusta', units: 10, quality: 69, storedDay: 0 },
      {
        variety: 'arabicaStandard',
        units: 20,
        quality: 81,
        storedDay: 0,
        washed: true,
        readyDay: 65,
      },
      {
        variety: 'arabicaStandard',
        units: 30,
        quality: 79,
        storedDay: 0,
        washed: true,
        readyDay: 87,
      },
    ])
    const rows = html.split('data-testid="storage-row"').slice(1).map(text)
    expect(rows).toHaveLength(4)
    expect(rows[0]).toContain('roh 0 Mon. alt 40')
    expect(rows[0]).toContain('Q 82')
    expect(rows[0]).toContain('0,80 CC')
    // 1 point per month for 6 months, then 2: 12 points above Q 70 last 9 month turns.
    expect(rows[0]).toContain('bis Dezember')
    expect(rows[0]).toContain('noch 9 Mon.')
    expect(rows[1]).toContain('roh 2 Mon. alt 10')
    expect(rows[1]).toContain('unter Q 70')
    expect(rows[2]).toContain('✓ verkaufbar')
    expect(rows[2]).toContain('seit 6. März')
    expect(rows[3]).toContain('28. März')
    expect(rows[3]).toContain('in 16 Tagen')
    // Each row sells on its own. A washed batch that is not ready cannot be sold yet.
    const sell = (row: string) =>
      html
        .split('data-testid="storage-row"')
        [row === 'last' ? 4 : 1]!.match(/<button[^>]*data-testid="storage-sell"[^>]*>/)![0]
    expect(sell('first')).not.toContain('disabled')
    expect(sell('first')).toContain('40 Einh. für')
    expect(sell('last')).toContain('disabled')
    const booking = text(html.split('data-testid="storage-booking"')[1]!)
    expect(booking).toContain('Nächster Monatswechsel: 1. April')
    // 100 units cost exactly 2 CC, so the booking needs no rounding note.
    expect(booking).toContain('Lagerkosten: 2 CC')
    expect(booking).not.toContain('aufgerundet')
  })

  it('AC-3: warns when the storage is full', async () => {
    const html = await render([{ variety: 'robusta', units: 100, quality: 80, storedDay: 0 }])
    expect(html).toContain('data-testid="storage-full"')
  })
})
