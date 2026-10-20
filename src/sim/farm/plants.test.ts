import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import { step } from '../time/time'
import type { Parcel, World } from '../world/types'
import { growth } from './plants'
import type { Variety } from './yield'

const size = 4

function testWorld(): World {
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const soil = { fertility: 50, waterRetention: 50, soilQuality: 0.5 }
      parcels.push({ x, y, height: 0.2, zone: 'tiefland', ...soil, soilClass: 'gut' })
    }
  }
  return { seed: 0, size, parcels, start: { x: 1, y: 1 } }
}

// Owns the parcels (0,0), (1,0) and (2,0) in field 0.
function testState(money = 50000): GameState {
  const state = createState(1)
  return {
    ...state,
    world: testWorld(),
    money,
    time: { ...state.time, hour: 5 },
    farm: { ...state.farm, parcels: { 0: 0, 1: 0, 2: 0 }, fields: [{ id: 0, name: 'A' }] },
  }
}

const plant = (state: GameState, variety: Variety, ...parcels: [number, number][]) =>
  dispatch(state, { type: 'Plant', variety, parcels: parcels.map(([x, y]) => ({ x, y })) })

describe('Plant', () => {
  it('AC-1: takes 2 CC per Robusta parcel and adds the plants', () => {
    const state = testState()
    const before = structuredClone(state)
    const next = plant(state, 'robusta', [0, 0], [1, 0])
    expect(next.money).toBe(50000 - 400)
    expect(next.farm.plants).toEqual({
      0: { variety: 'robusta', plantedHour: 5 },
      1: { variety: 'robusta', plantedHour: 5 },
    })
    expect(next.farm.parcels).toEqual(state.farm.parcels)
    expect(state).toEqual(before)
  })

  const planted = plant(testState(), 'robusta', [2, 0])
  it.each<[string, GameState, Variety, [number, number][]]>([
    [
      'a parcel that is not owned',
      testState(),
      'robusta',
      [
        [0, 0],
        [3, 3],
      ],
    ],
    [
      'a parcel outside the map',
      testState(),
      'robusta',
      [
        [0, 0],
        [4, 0],
      ],
    ],
    [
      'a parcel that already has a plant',
      planted,
      'robusta',
      [
        [0, 0],
        [2, 0],
      ],
    ],
    [
      'a duplicate parcel',
      testState(),
      'robusta',
      [
        [0, 0],
        [1, 0],
        [0, 0],
      ],
    ],
    ['a locked variety', testState(), 'arabicaPremium', [[0, 0]]],
    [
      'a total cost above the money',
      testState(399),
      'robusta',
      [
        [0, 0],
        [1, 0],
      ],
    ],
  ])('AC-2: rejects %s and changes nothing', (_, state, variety, parcels) => {
    const before = structuredClone(state)
    expect(() => plant(state, variety, ...parcels)).toThrow()
    expect(state).toEqual(before)
  })

  it('AC-2: accepts a total cost equal to the money', () => {
    expect(plant(testState(400), 'robusta', [0, 0], [1, 0]).money).toBe(0)
  })

  it('keeps the plants when more parcels are bought', () => {
    const state = plant(testState(), 'robusta', [0, 0])
    const next = dispatch(state, { type: 'CreateParcels', parcels: [{ x: 3, y: 0 }] })
    expect(next.farm.plants).toEqual(state.farm.plants)
  })
})

describe('growth with step', () => {
  it.each<[Variety, number]>([
    ['robusta', 72],
    ['arabicaStandard', 120],
  ])('AC-3: %s is ripe after exactly %i steps', (variety, steps) => {
    let state = plant({ ...testState(), time: { hour: 0, speed: 1 } }, variety, [0, 0])
    for (let i = 0; i < steps - 1; i++) state = step(state)
    expect(growth(state.farm.plants[0]!, state.time.hour).stage).not.toBe('reif')
    state = step(state)
    expect(growth(state.farm.plants[0]!, state.time.hour).stage).toBe('reif')
  })
})

describe('growth stages', () => {
  const robusta = { variety: 'robusta', plantedHour: 0 } as const

  it.each([
    [0, 'setzling'],
    [17, 'setzling'],
    [18, 'wachstum'],
    [43, 'wachstum'],
    [44, 'bluete'],
    [64, 'bluete'],
    [65, 'fruchtansatz'],
    [71, 'fruchtansatz'],
    [72, 'reif'],
    [1000, 'reif'],
  ])('AC-4: Robusta at hour %i is %s', (hour, stage) => {
    expect(growth(robusta, hour).stage).toBe(stage)
  })

  it('AC-4: progress stops at 1', () => {
    expect(growth(robusta, 36).progress).toBe(0.5)
    expect(growth(robusta, 72).progress).toBe(1)
    expect(growth(robusta, 1000).progress).toBe(1)
  })

  it('AC-4: counts from plantedHour', () => {
    expect(growth({ variety: 'robusta', plantedHour: 100 }, 118).stage).toBe('wachstum')
  })

  it('AC-4: moves the stage boundaries with the config', () => {
    const cfg = balance()
    const test = {
      ...cfg,
      farm: {
        ...cfg.farm,
        visualStages: { setzling: 0, wachstum: 0.5, bluete: 0.75, fruchtansatz: 0.95 },
      },
    }
    expect(growth(robusta, 18, test).stage).toBe('setzling')
    expect(growth(robusta, 36, test).stage).toBe('wachstum')
    expect(growth(robusta, 54, test).stage).toBe('bluete')
    expect(growth(robusta, 69, test).stage).toBe('fruchtansatz')
  })
})
