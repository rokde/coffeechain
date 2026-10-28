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
      const cycle = cfg.varieties.robusta.cycleDays
      const start = createState(seed)
      const index = start.world.parcels.findIndex((p) => p.zone === 'tiefland')
      expect(index).toBeGreaterThanOrEqual(0)
      const { x, y } = start.world.parcels[index]!
      let state: GameState = {
        ...start,
        farm: { ...start.farm, parcels: { [index]: 0 }, fields: [{ id: 0, name: 'A' }] },
      }
      const plantDay = 153
      let ripeAt: number | undefined
      for (let day = 0; day < 400; day++) {
        if (state.time.day === plantDay)
          state = dispatch(state, { type: 'Plant', variety: 'robusta', parcels: [{ x, y }] })
        const plant = state.farm.plants[index]
        if (plant && ripeAt === undefined && growth(plant, state.time.day).progress >= 1)
          ripeAt = state.time.day
        state = step(state)
      }
      expect(ripeAt).toBe(plantDay + cycle)
      expect(state).not.toHaveProperty('events')
      expect(state).not.toHaveProperty('research')
      for (const plant of Object.values(state.farm.plants))
        expect(plant).not.toHaveProperty('growthDelayHours')
    },
  )

  it('AC-2 (#27): Robusta planted on day 0 is not ripe on day 89 and is ripe on day 90', () => {
    const start = createState(42)
    const index = start.world.parcels.findIndex((p) => p.zone === 'tiefland')
    const { x, y } = start.world.parcels[index]!
    let state: GameState = dispatch(
      {
        ...start,
        farm: { ...start.farm, parcels: { [index]: 0 }, fields: [{ id: 0, name: 'A' }] },
      },
      { type: 'Plant', variety: 'robusta', parcels: [{ x, y }] },
    )
    for (let i = 0; i < 89; i++) state = step(state)
    expect(state.time.day).toBe(89)
    expect(growth(state.farm.plants[index]!, state.time.day).progress).toBeLessThan(1)
    state = step(state)
    expect(growth(state.farm.plants[index]!, state.time.day).progress).toBe(1)
  })
})
