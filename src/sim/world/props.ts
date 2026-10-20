import type { Balance } from '../../../config/balance.schema'
import type { Parcel, World } from './types'

export type Place = { x: number; y: number }

export type WorldProps = {
  hut: Place
  market: Place
  // Ordered from the hut to the market, both ends included.
  path: Place[]
  trees: Place[]
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

export function placeProps(world: World, balance: Balance): WorldProps {
  const { size, parcels, start } = world
  const at = (x: number, y: number): Parcel | undefined =>
    x >= 0 && x < size && y >= 0 && y < size ? parcels[y * size + x] : undefined
  const neighbours = (p: Parcel) =>
    STEPS.map(([dx, dy]) => at(p.x + dx, p.y + dy)).filter((n) => n !== undefined)
  const land = (p: Parcel) => p.zone !== 'wasser'
  const index = (p: Place) => p.y * size + p.x

  // Breadth-first search over land from the hut.
  const hut = at(start.x, start.y)!
  const dist = new Map<Parcel, number>([[hut, 0]])
  const prev = new Map<Parcel, Parcel>()
  const queue = [hut]
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!
    for (const n of neighbours(p)) {
      if (land(n) && !dist.has(n)) {
        dist.set(n, dist.get(p)! + 1)
        prev.set(n, p)
        queue.push(n)
      }
    }
  }

  // Row-major scan with a strict "less than" keeps the lowest index on ties.
  let market: Parcel | undefined
  for (const p of parcels) {
    const d = dist.get(p)
    if (d === undefined || p === hut || !neighbours(p).some((n) => n.zone === 'wasser')) continue
    if (!market || d < dist.get(market)!) market = p
  }
  if (!market) throw new Error(`World ${world.seed} has no shore parcel next to the hut`)

  const path: Place[] = []
  for (let p: Parcel | undefined = market; p; p = prev.get(p)) path.unshift({ x: p.x, y: p.y })
  const onPath = new Set(path.map(index))

  const { startReach } = balance.world
  const trees = parcels
    .filter(
      (p) =>
        land(p) &&
        p.soilClass === 'karg' &&
        Math.max(Math.abs(p.x - start.x), Math.abs(p.y - start.y)) > startReach &&
        !onPath.has(index(p)),
    )
    .map((p) => ({ x: p.x, y: p.y }))

  return { hut: { x: hut.x, y: hut.y }, market: { x: market.x, y: market.y }, path, trees }
}
