import { balance } from '../balance'
import { harvestSeed } from '../farm/harvest'
import type { Variety } from '../farm/yield'
import { mulberry32 } from '../rng'
import type { GameState } from '../state'
import { activeEvents } from './schedule'

// PRD §5: pests are a risk of the Tiefland zone.
const PEST_ZONE = 'tiefland'

function limit(factor: number): number {
  const max = balance().events.maxEffect
  return Math.min(1 + max, Math.max(1 - max, factor))
}

// Product of the yield effects of the active events and research breakthroughs on one parcel, within ±events.maxEffect.
export function yieldEventFactor(state: GameState, parcelIndex: number, day: number): number {
  const cfg = balance()
  const types = cfg.events.types
  const zone = state.world.parcels[parcelIndex]!.zone
  const research = state.research.filter((start) => start <= day).length
  let factor = 1 + types.research.yieldBonus * research
  for (const e of activeEvents(state, day)) {
    if (e.type === 'frost') factor *= 1 + (types.frost.yield[zone] ?? 0)
    if (e.type === 'pests' && zone === PEST_ZONE) {
      const [min, max] = types.pests.yieldAffected
      const random = mulberry32(harvestSeed(state.world.seed, e.startDay, parcelIndex))
      const loss = min + random() * (max - min)
      const protect = state.farm.plants[parcelIndex]?.pestProtected
      factor *= 1 + (protect ? loss * (1 - cfg.farm.pestControlLossReduction) : loss)
    }
  }
  return limit(factor)
}

// Product of the effects of the active events on the bank price of one coffee variety, within ±events.maxEffect.
export function priceEventFactor(state: GameState, variety: Variety, day: number): number {
  const types = balance().events.types
  let factor = 1
  for (const e of activeEvents(state, day)) {
    if (e.type === 'frost' || e.type === 'monsoon')
      factor *= 1 + (types[e.type].price[variety] ?? 0)
    if (e.type === 'boom' || e.type === 'crisis') factor *= 1 + types[e.type].priceAll
  }
  return limit(factor)
}
