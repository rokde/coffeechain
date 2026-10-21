import { balance } from '../balance'
import { cycleTimeEventFactor } from '../events/effects'
import { activeEvents, dailyEvents } from '../events/schedule'
import { ripeHour } from '../farm/plants'
import { dailyOrders } from '../market/orders'
import type { GameState } from '../state'
import { dailyUpkeep } from '../storage/daily'

export interface TimeState {
  // Game hours since the start. One step adds one hour.
  hour: number
  speed: number
}

export interface SetSpeed {
  type: 'SetSpeed'
  speed: number
}

export function step(state: GameState): GameState {
  const hour = state.time.hour + 1
  const next = { ...delayGrowth(state), time: { ...state.time, hour } }
  return hour % balance().time.ticksPerGameDay === 0
    ? dailyOrders(dailyEvents(dailyUpkeep(next)))
    : next
}

// A plant that is not ripe grows 1 / f game hours in this hour, where f is its cycle time factor.
function delayGrowth(state: GameState): GameState {
  const { hour } = state.time
  const day = clock(hour).day
  if (!activeEvents(state, day).some((e) => e.type === 'monsoon')) return state
  const cfg = balance()
  const plants = { ...state.farm.plants }
  for (const [key, plant] of Object.entries(plants)) {
    const index = Number(key)
    if (hour >= ripeHour(plant, cfg)) continue
    const f = cycleTimeEventFactor(state, index, day)
    if (f === 1) continue
    plants[index] = { ...plant, growthDelayHours: (plant.growthDelayHours ?? 0) + 1 - 1 / f }
  }
  return { ...state, farm: { ...state.farm, plants } }
}

export function clock(hour: number): { day: number; hourOfDay: number } {
  const ticksPerDay = balance().time.ticksPerGameDay
  return { day: Math.floor(hour / ticksPerDay) + 1, hourOfDay: hour % ticksPerDay }
}

export function setSpeed(state: GameState, command: SetSpeed): GameState {
  if (!balance().time.speeds.includes(command.speed)) {
    throw new Error(`Invalid speed: ${command.speed}`)
  }
  return { ...state, time: { ...state.time, speed: command.speed } }
}
