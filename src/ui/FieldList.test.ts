import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { focusField } from '../app/fieldFocus'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { useViewStore } from '../app/view'
import { balance } from '../sim/balance'
import type { PlantState } from '../sim/farm/plants'
import type { GameState } from '../sim/state'
import FieldList from './FieldList.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

const cared = { fertilized: true, irrigated: true }
const day = balance().time.ticksPerGameDay
const late = (balance().varieties.robusta.cycleDays + balance().farm.overripe.graceDays + 1) * day

// Field A: 2 ripe robusta parcels. B: 1 robusta without care. C: 3 arabica at 45 %. D: no plant.
function setup(plants?: Record<number, PlantState>) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const hour = 3 * day
  game.replace({
    ...state,
    time: { ...state.time, hour },
    farm: {
      parcels: { 0: 0, 1: 0, 5: 1, 10: 2, 11: 2, 12: 2, 20: 3 },
      fields: ['A', 'B', 'C', 'D'].map((name, id) => ({ id, name })),
      nextFieldId: 4,
      plants: plants ?? {
        0: { variety: 'robusta', plantedHour: 0, ...cared },
        1: { variety: 'robusta', plantedHour: 0, ...cared },
        5: { variety: 'robusta', plantedHour: hour - 30 },
        10: { variety: 'arabicaStandard', plantedHour: hour - 54, ...cared },
        11: { variety: 'arabicaStandard', plantedHour: hour - 54, ...cared },
        12: { variety: 'arabicaStandard', plantedHour: hour - 54, ...cared },
      },
    },
  })
  return pinia
}

const html = (pinia: ReturnType<typeof createPinia>) =>
  renderToString(createSSRApp(FieldList).use(pinia))
const rows = (h: string) => h.split('data-testid="field-row"').slice(1)
const text = (s: string) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

describe('FieldList (S59)', () => {
  it('AC-2: shows one row per planted field with name, state or stage, parcels, variety and bar', async () => {
    const list = rows(await html(setup()))
    expect(list).toHaveLength(3)
    expect(text(list[0]!)).toContain('Feld A Erntereif 2 Parzellen · Robusta')
    expect(text(list[1]!)).toContain('Feld B Braucht Pflege 1 Parzelle · Robusta')
    // 54 of 120 hours give 45 %, the stage Wachstum.
    expect(text(list[2]!)).toContain('Feld C Wachstum · 45 % 3 Parzellen · Arabica Standard')
    expect(list[2]).not.toContain('field-state')
    expect(list[0]).toMatch(/role="progressbar"[^>]*aria-valuenow="100"/)
    expect(list[2]).toMatch(/role="progressbar"[^>]*aria-valuenow="45"/)
  })

  it('AC-2: shows Überreif for an overripe field', async () => {
    const pinia = setup({ 0: { variety: 'robusta', plantedHour: 0 } })
    const game = useGameStore(pinia)
    game.replace({ ...(game.state as GameState), time: { ...game.state.time, hour: late } })
    const list = rows(await html(pinia))
    expect(list).toHaveLength(1)
    expect(list[0]).toMatch(/data-testid="field-state"[^>]*>Überreif</)
  })

  it('round 2: rows that need action come first, overripe, ripe, care, then the others', async () => {
    const hour = 3 * day
    const names = async (plants: Record<number, PlantState>) =>
      rows(await html(setup(plants))).map((r) => text(r).match(/Feld (\w)/)![1])
    // A grows, B needs care, C is ripe, D is overripe.
    expect(
      await names({
        0: { variety: 'robusta', plantedHour: hour - 10, ...cared },
        5: { variety: 'robusta', plantedHour: hour - 10 },
        10: { variety: 'robusta', plantedHour: 0, ...cared },
        20: { variety: 'robusta', plantedHour: hour - late, ...cared },
      }),
    ).toEqual(['D', 'C', 'B', 'A'])
    // Rows with the same state keep the field order.
    expect(
      await names({
        0: { variety: 'robusta', plantedHour: 0, ...cared },
        5: { variety: 'robusta', plantedHour: hour - 10, ...cared },
        10: { variety: 'robusta', plantedHour: 0, ...cared },
        20: { variety: 'robusta', plantedHour: hour - 10, ...cared },
      }),
    ).toEqual(['A', 'C', 'B', 'D'])
  })

  it('AC-2: shows the empty line with no planted field', async () => {
    const h = await html(setup({}))
    expect(h).toContain('data-testid="field-list-empty"')
    expect(h).toContain('Noch kein Feld bepflanzt.')
    expect(rows(h)).toHaveLength(0)
  })

  it('AC-3: the clicked row is the current row', async () => {
    const pinia = setup()
    expect(await html(pinia)).not.toContain('aria-current')
    const game = useGameStore(pinia)
    focusField(game.state as GameState, 2, useSelectionStore(pinia), useViewStore(pinia))
    const list = rows(await html(pinia))
    expect(list.map((r) => r.includes('aria-current="true"'))).toEqual([false, false, true])
  })
})
