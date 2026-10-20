import { Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { generateWorld } from '../sim/world/generate'
import { createOutlines, parcelAt } from './picking'
import { createTerrain } from './terrain'

describe('parcelAt', () => {
  it('AC-1: maps points inside a quad to its parcel', () => {
    // size 4: parcel (0, 0) spans x and z from -2 to -1.
    expect(parcelAt({ x: -2, z: -2 }, 4)).toEqual({ x: 0, y: 0 })
    expect(parcelAt({ x: -1.01, z: -1.99 }, 4)).toEqual({ x: 0, y: 0 })
    expect(parcelAt({ x: 0.5, z: -0.5 }, 4)).toEqual({ x: 2, y: 1 })
    expect(parcelAt({ x: 1.99, z: 1.99 }, 4)).toEqual({ x: 3, y: 3 })
  })

  it('AC-1: gives null outside the grid', () => {
    for (const [x, z] of [
      [-2.01, 0],
      [0, -2.01],
      [2, 0],
      [0, 2],
      [100, 100],
    ] as const) {
      expect(parcelAt({ x, z }, 4)).toBeNull()
    }
  })

  it('AC-1: a raycast down on the terrain above a parcel centre gives that parcel', () => {
    const world = generateWorld(42, balance())
    const n = world.size
    const terrain = createTerrain(world)
    const raycaster = new Raycaster()
    const down = new Vector3(0, -1, 0)
    let checked = 0
    for (const { x, y } of world.parcels) {
      // Every 5th parcel keeps the test fast and covers all zones and rows.
      if ((y * n + x) % 5 !== 0) continue
      raycaster.set(new Vector3(x + 0.5 - n / 2, 100, y + 0.5 - n / 2), down)
      const hit = raycaster.intersectObject(terrain)[0]!
      expect(parcelAt(hit.point, n)).toEqual({ x, y })
      checked++
    }
    expect(checked).toBeGreaterThan(400)
  })
})

describe('createOutlines (S12)', () => {
  it('draws 4 edges per parcel and nothing for an empty list', () => {
    const world = generateWorld(42, balance())
    const { line, show } = createOutlines(createTerrain(world), world.size)
    show([
      { x: 20, y: 20 },
      { x: 21, y: 20 },
    ])
    expect(line.geometry.getAttribute('position').count).toBe(16)
    show([])
    expect(line.geometry.getAttribute('position').count).toBe(0)
  })
})
