import { balance } from '../balance'
import type { GameState } from '../state'
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

export function createParcels(state: GameState, command: CreateParcels): GameState {
  const { size, parcels } = state.world
  const { firstCost, baseCost, zoneMultiplier, maxSlope } = balance().parcels
  const owned = { ...state.farm.parcels }
  let fields = [...state.farm.fields]
  let nextFieldId = state.farm.nextFieldId
  let count = Object.keys(owned).length
  let cost = 0

  for (const { x, y } of command.parcels) {
    const inside = (x: number, y: number) =>
      Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size
    if (!inside(x, y)) throw new Error(`Parcel ${x},${y} is outside the map`)
    const index = y * size + x
    if (index in owned) throw new Error(`Parcel ${x},${y} is already owned or listed twice`)
    const parcel = parcels[index]!
    if (parcel.zone === 'wasser') throw new Error(`Parcel ${x},${y} is water`)
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]
      .filter(([nx, ny]) => inside(nx!, ny!))
      .map(([nx, ny]) => ny! * size + nx!)
    if (neighbours.some((n) => Math.abs(parcels[n]!.height - parcel.height) > maxSlope)) {
      throw new Error(`Parcel ${x},${y} is too steep`)
    }

    cost += Math.round((count === 0 ? firstCost : baseCost) * zoneMultiplier[parcel.zone] * 100)
    count++

    const touched = [...new Set(neighbours.filter((n) => n in owned).map((n) => owned[n]!))]
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

  if (cost > state.money) throw new Error(`Not enough money: cost ${cost}, balance ${state.money}`)
  return {
    ...state,
    money: state.money - cost,
    farm: { ...state.farm, parcels: owned, fields, nextFieldId },
  }
}
