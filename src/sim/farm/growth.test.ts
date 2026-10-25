import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import { step } from '../time/time'
import { growth } from './plants'

describe('growth without events (#8)', () => {
  it.each([1, 2, 3, 42, 1234])(
    'AC-3: seed %i: Robusta on Tiefland is ripe after exactly cycleDays game days',
    (seed) => {
      const cfg = balance()
      const perDay = cfg.time.ticksPerGameDay
      const cycle = cfg.varieties.robusta.cycleDays * perDay
      const start = createState(seed)
      const index = start.world.parcels.findIndex((p) => p.zone === 'tiefland')
      expect(index).toBeGreaterThanOrEqual(0)
      const { x, y } = start.world.parcels[index]!
      let state: GameState = {
        ...start,
        farm: { ...start.farm, parcels: { [index]: 0 }, fields: [{ id: 0, name: 'A' }] },
      }
      const plantHour = 5 * perDay + 3
      let ripeAt: number | undefined
      for (let hour = 0; hour < 60 * perDay; hour++) {
        if (state.time.hour === plantHour)
          state = dispatch(state, { type: 'Plant', variety: 'robusta', parcels: [{ x, y }] })
        const plant = state.farm.plants[index]
        if (plant && ripeAt === undefined && growth(plant, state.time.hour).progress >= 1)
          ripeAt = state.time.hour
        state = step(state)
      }
      expect(ripeAt).toBe(plantHour + cycle)
      expect(state).not.toHaveProperty('events')
      expect(state).not.toHaveProperty('research')
      for (const plant of Object.values(state.farm.plants))
        expect(plant).not.toHaveProperty('growthDelayHours')
    },
  )
})
