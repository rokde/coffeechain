import { balance } from '../balance'
import { harvestSeed } from '../farm/harvest'
import { mulberry32 } from '../rng'
import type { GameState } from '../state'
import { clock } from '../time/time'

export type EventType = 'frost' | 'monsoon' | 'boom' | 'crisis' | 'pests'

export interface GameEvent {
  type: EventType
  announcedDay: number
  startDay: number
  // The first day on which the event is gone.
  endDay: number
}

// "research" is permanent, so it goes into state.research and not into state.events.
const TIMED: EventType[] = ['frost', 'monsoon', 'boom', 'crisis', 'pests']

// Harvest seeds use parcel indexes >= 0, so -1 gives the research roll its own stream.
const RESEARCH_STREAM = -1

export const activeEvents = (state: GameState, day = clock(state.time.hour).day): GameEvent[] =>
  state.events.filter((e) => e.startDay <= day && day < e.endDay)

export const warnedEvents = (state: GameState, day = clock(state.time.hour).day): GameEvent[] =>
  state.events.filter((e) => day < e.startDay)

// Runs once per game day: drops ended events and may announce new ones.
export function dailyEvents(state: GameState): GameState {
  const cfg = balance().events
  const day = clock(state.time.hour).day
  const events = state.events.filter((e) => day < e.endDay)
  const startDay = day + cfg.warningDays
  let research = state.research
  if (startDay > cfg.graceDaysAtStart) {
    const random = mulberry32(harvestSeed(state.world.seed, day, 0))
    for (const type of TIMED) {
      const roll = random()
      const { durationDays, everyDays } = cfg.types[type]
      const [min, max] = durationDays
      const length = Math.min(min + Math.floor(random() * (max - min + 1)), cfg.maxDurationDays)
      if (events.length >= cfg.maxConcurrent || events.some((e) => e.type === type)) continue
      if (roll < 1 / everyDays) {
        events.push({ type, announcedDay: day, startDay, endDay: startDay + length })
      }
    }
    const { yieldBonus, everyDays } = cfg.types.research
    const roll = mulberry32(harvestSeed(state.world.seed, day, RESEARCH_STREAM))()
    const n = research.length + 1
    // The epsilon keeps 3 × 0.1 within a maxEffect of 0.3.
    const room = n <= cfg.researchMaxCount && yieldBonus * n <= cfg.maxEffect + 1e-9
    if (room && roll < 1 / everyDays) research = [...research, startDay]
  }
  return { ...state, events, research }
}
