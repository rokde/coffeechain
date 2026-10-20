import { balance } from '../balance'
import type { GameState } from '../state'
import type { World, Zone } from '../world/types'
import type { PlantState } from './plants'

export interface FarmState {
  // Parcel index (y * size + x) → field id.
  parcels: Record<number, number>
  fields: { id: number; name: string }[]
  nextFieldId: number
  // Parcel index → plant on it.
  plants: Record<number, PlantState>
}

export interface CreateParcels {
  type: 'CreateParcels'
  parcels: { x: number; y: number }[]
}

// 0 → "A", 25 → "Z", 26 → "AA".
const fieldName = (id: number): string =>
  (id >= 26 ? fieldName(Math.floor(id / 26) - 1) : '') + String.fromCharCode(65 + (id % 26))

// Indices of the 4-neighbours of (x, y) inside the map.
const neighbours = (size: number, x: number, y: number): number[] =>
  [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ]
    .filter(([nx, ny]) => nx! >= 0 && ny! >= 0 && nx! < size && ny! < size)
    .map(([nx, ny]) => ny! * size + nx!)

// The terrain rule only: not water, and no 4-neighbour height step above parcels.maxSlope.
export function isBuildable(world: World, x: number, y: number): boolean {
  const { size, parcels } = world
  const parcel = parcels[y * size + x]!
  const { maxSlope } = balance().parcels
  return (
    parcel.zone !== 'wasser' &&
    neighbours(size, x, y).every((n) => Math.abs(parcels[n]!.height - parcel.height) <= maxSlope)
  )
}

// Cost in hundredths of CC. It does not validate the list.
// The caller must give only buildable parcels that the farm does not own, each one time.
export function quoteParcels(state: GameState, list: { x: number; y: number }[]): number {
  const { size, parcels } = state.world
  const { firstCost, baseCost, zoneMultiplier } = balance().parcels
  const owned = Object.keys(state.farm.parcels).length
  return list.reduce((cost, { x, y }, i) => {
    // Buildable parcels are never water, so the zone is a land zone.
    const zone = parcels[y * size + x]!.zone as Exclude<Zone, 'wasser'>
    return cost + Math.round((owned + i === 0 ? firstCost : baseCost) * zoneMultiplier[zone] * 100)
  }, 0)
}

export function createParcels(state: GameState, command: CreateParcels): GameState {
  const { size } = state.world
  const owned = { ...state.farm.parcels }
  let fields = [...state.farm.fields]
  let nextFieldId = state.farm.nextFieldId

  for (const { x, y } of command.parcels) {
    const inside =
      Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size
    if (!inside) throw new Error(`Parcel ${x},${y} is outside the map`)
    const index = y * size + x
    if (index in owned) throw new Error(`Parcel ${x},${y} is already owned or listed twice`)
    if (!isBuildable(state.world, x, y)) {
      throw new Error(`Parcel ${x},${y} is water or too steep`)
    }

    const touched = [
      ...new Set(
        neighbours(size, x, y)
          .filter((n) => n in owned)
          .map((n) => owned[n]!),
      ),
    ]
    let id: number
    if (touched.length === 0) {
      id = nextFieldId++
      fields.push({ id, name: fieldName(id) })
    } else {
      id = Math.min(...touched)
      for (const key of Object.keys(owned)) {
        if (touched.includes(owned[+key]!)) owned[+key] = id
      }
      fields = fields.filter((f) => f.id === id || !touched.includes(f.id))
    }
    owned[index] = id
  }

  const cost = quoteParcels(state, command.parcels)
  if (cost > state.money) throw new Error(`Not enough money: cost ${cost}, balance ${state.money}`)
  return {
    ...state,
    money: state.money - cost,
    props: {
      ...state.props,
      trees: state.props.trees.filter(
        (t) => !command.parcels.some((p) => p.x === t.x && p.y === t.y),
      ),
    },
    farm: { ...state.farm, parcels: owned, fields, nextFieldId },
  }
}
