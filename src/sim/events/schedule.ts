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

// "research" is permanent, so the scheduler skips it (S51).
const TIMED: EventType[] = ['frost', 'monsoon', 'boom', 'crisis', 'pests']

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
  }
  return { ...state, events }
}
