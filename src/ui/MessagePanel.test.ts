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

const day = balance().time.ticksPerGameDay
const ripeHour = balance().varieties.robusta.cycleDays * day
const lateHour = ripeHour + (balance().farm.overripe.graceDays + 1) * day
// The plant has all cares, so an unripe plant gives no "braucht Pflege" message.
const cared = { fertilized: true, irrigated: true, pestProtected: true }
const robusta: PlantState = { variety: 'robusta', plantedHour: 0, ...cared }

// Field A has a plant on parcel 0, field B on parcel 5. The B plant is planted at hourB.
function render(
  hour: number,
  hourB?: number,
  used = 0,
  plantA = robusta,
  milestones: GameState['milestones'] = { harvested: 0 },
) {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  const plants: Record<number, PlantState> = { 0: plantA }
  if (hourB !== undefined) plants[5] = { ...robusta, plantedHour: hourB }
  game.replace({
    ...state,
    time: { ...state.time, hour },
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
  it('AC-1: a new game shows the panel in the left panel with the empty text', async () => {
    const pinia = createPinia()
    useFirstStepsStore(pinia).open = false
    const html = await renderToString(createSSRApp(Hud).use(pinia))
    const left = html.split('data-testid="hud-left-panel"')[1]!.split('</aside>')[0]!
    expect(left).toContain('data-testid="message-panel"')
    expect(left).toContain('Keine Meldungen')
    expect(items(left)).toEqual([])
  })

  it('AC-2: a ripe plant with overripeFactor 1 gives "Feld A ist erntereif"', async () => {
    expect(growth(robusta, ripeHour).stage).toBe('reif')
    expect(overripeFactor(robusta, ripeHour)).toBe(1)
    const html = await render(ripeHour)
    expect(items(html)).toEqual(['Feld A ist erntereif'])
    expect(html).not.toContain('Keine Meldungen')
  })

  it('AC-3: an overripe plant gives "Feld A ist überreif" and no "erntereif"', async () => {
    expect(overripeFactor(robusta, lateHour)).toBeLessThan(1)
    const html = await render(lateHour)
    expect(items(html)).toEqual(['Feld A ist überreif'])
    expect(html).not.toContain('erntereif')
  })

  it('AC-4: an unripe field gets no message', async () => {
    expect(items(await render(0))).toEqual([])
    expect(growth({ ...robusta, plantedHour: ripeHour }, ripeHour).stage).not.toBe('reif')
    expect(items(await render(ripeHour, ripeHour))).toEqual(['Feld A ist erntereif'])
  })

  it('AC-5: shows "Lager voll" only when storageUsed reaches startCapacity', async () => {
    const capacity = balance().storage.startCapacity
    expect(items(await render(0, undefined, capacity))).toEqual(['Lager voll'])
    expect(await render(0, undefined, capacity - 1)).not.toContain('Lager voll')
  })

  it('AC-5 (S21e): an unripe plant that misses a care gives "Feld A braucht Pflege"', async () => {
    const bare: PlantState = { variety: 'robusta', plantedHour: 0 }
    expect(items(await render(0, undefined, 0, bare))).toEqual(['Feld A braucht Pflege'])
    const twoCares = { ...bare, fertilized: true, irrigated: true }
    expect(items(await render(0, undefined, 0, twoCares))).toEqual(['Feld A braucht Pflege'])
    expect(items(await render(0))).toEqual([])
    expect(items(await render(ripeHour, undefined, 0, bare))).toEqual(['Feld A ist erntereif'])
  })

  it('AC-4 (S49): shows the Ernte-Profi message for one game day', async () => {
    const m = { harvested: 1000, harvestProHour: 10 }
    const text = 'Meilenstein Ernte-Profi erreicht: +5 % Erntequalität'
    expect(items(await render(10, undefined, 0, robusta, m))).toEqual([text])
    expect(items(await render(10 + day - 1, undefined, 0, robusta, m))).toEqual([text])
    expect(items(await render(10 + day, undefined, 0, robusta, m))).toEqual([])
    expect(items(await render(10))).toEqual([])
  })
})
