import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useFirstStepsStore } from '../app/firstSteps'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import { overripeFactor } from '../sim/farm/overripe'
import { growth, type PlantState } from '../sim/farm/plants'
import type { GameState } from '../sim/state'
import Hud from './Hud.vue'
import MessagePanel from './MessagePanel.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

const ripeDay = balance().varieties.robusta.cycleDays
const lateDay = ripeDay + balance().farm.overripe.graceDays + 1
const messageDays = balance().progression.harvestProMessageDays
// The plant has all cares.
const cared = { fertilized: true, irrigated: true }
const robusta: PlantState = { variety: 'robusta', plantedDay: 0, ...cared }

// Field A has a plant on parcel 0, field B on parcel 5. The B plant is planted at dayB.
function render(
  day: number,
  dayB?: number,
  used = 0,
  plantA = robusta,
  milestones: GameState['milestones'] = { harvested: 0 },
  weeksFromDay?: number,
) {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const plants: Record<number, PlantState> = { 0: plantA }
  if (dayB !== undefined) plants[5] = { ...robusta, plantedDay: dayB }
  game.replace({
    ...state,
    time: { ...state.time, day, weeksFromDay },
    milestones,
    farm: {
      parcels: { 0: 0, 5: 1 },
      fields: [
        { id: 0, name: 'A' },
        { id: 1, name: 'B' },
      ],
      nextFieldId: 2,
      plants,
    },
    storage: { batches: used ? [{ variety: 'robusta', units: used, quality: 1 }] : [] },
  })
  return renderToString(createSSRApp(MessagePanel).use(pinia))
}

const items = (html: string) =>
  [...html.matchAll(/data-testid="message"[^>]*>([^<]*)</g)].map((m) => m[1])

describe('MessagePanel (S18b)', () => {
  it('AC-4 (S59): with no message the panel is not in the DOM, with one message it is', async () => {
    const pinia = createPinia()
    useFirstStepsStore(pinia).open = false
    const html = await renderToString(createSSRApp(Hud).use(pinia))
    const left = html.split('data-testid="hud-left-panel"')[1]!.split('</aside>')[0]!
    expect(left).toContain('data-testid="field-list"')
    expect(left).not.toContain('message-panel')
    expect(left).not.toContain('Keine Meldungen')
    const full = await render(0, undefined, balance().storage.startCapacity)
    expect(full).toContain('data-testid="message-panel"')
    expect(items(full)).toHaveLength(1)
  })

  it('round 1 (S59): ripe, overripe and uncared fields give no message', async () => {
    expect(growth(robusta, ripeDay).stage).toBe('reif')
    expect(overripeFactor(robusta, lateDay)).toBeLessThan(1)
    const bare: PlantState = { variety: 'robusta', plantedDay: 0 }
    expect(items(await render(ripeDay))).toEqual([])
    expect(items(await render(lateDay))).toEqual([])
    expect(items(await render(0, undefined, 0, bare))).toEqual([])
    expect(await render(ripeDay, 0, 0, bare)).not.toContain('message-panel')
  })

  it('AC-5: shows "Lager voll" only when storageUsed reaches startCapacity', async () => {
    const capacity = balance().storage.startCapacity
    expect(items(await render(0, undefined, capacity))).toEqual(['Lager voll'])
    expect(await render(0, undefined, capacity - 1)).not.toContain('Lager voll')
  })

  it('AC-4 (S49): shows the Ernte-Profi message for harvestProMessageDays days', async () => {
    const m = { harvested: 1000, harvestProDay: 10 }
    const text = 'Meilenstein Ernte-Profi erreicht: +5 % Erntequalität'
    expect(items(await render(10, undefined, 0, robusta, m))).toEqual([text])
    expect(items(await render(10 + messageDays - 1, undefined, 0, robusta, m))).toEqual([text])
    expect(items(await render(10 + messageDays, undefined, 0, robusta, m))).toEqual([])
    expect(items(await render(10))).toEqual([])
  })

  it('AC-3 (085): shows the weeks message for harvestProMessageDays days from the switch', async () => {
    const text = 'Ab jetzt läuft die Zeit in Wochen'
    const m = { harvested: 0 }
    expect(items(await render(400, undefined, 0, robusta, m, 400))).toEqual([text])
    const last = 400 + messageDays - 1
    expect(items(await render(last, undefined, 0, robusta, m, 400))).toEqual([text])
    expect(items(await render(400 + messageDays, undefined, 0, robusta, m, 400))).toEqual([])
    expect(items(await render(400))).toEqual([])
  })
})
