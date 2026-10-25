import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import { dailyOrders } from '../market/orders'
import { phase } from '../progression/capital'
import type { GameState } from '../state'
import { monthlyUpkeep } from '../storage/daily'

// The time scale: how much calendar time one real interval shows. It never changes what a step does.
export type TimeStage = 'months' | 'weeks'

export interface TimeState {
  // Calendar days since the start. Day 0 is 1 January, year 1. One step adds one day.
  day: number
  speed: number
  stage: TimeStage
  // The day of the switch to weeks. The stage never goes back to months.
  weeksFromDay?: number
}

export interface SetSpeed {
  type: 'SetSpeed'
  speed: number
}

export interface CalendarDate {
  // All three start at 1.
  dayOfMonth: number
  month: number
  year: number
}

export function step(state: GameState): GameState {
  const day = state.time.day + 1
  const weeks = state.time.stage === 'months' && phase(state) >= balance().time.weeksFromPhase
  const time = weeks
    ? { ...state.time, day, stage: 'weeks' as const, weeksFromDay: day }
    : { ...state.time, day }
  const next = { ...state, time }
  return dailyOrders(day % balance().time.daysPerMonth === 0 ? monthlyUpkeep(next) : next)
}

export function calendar(day: number, cfg: Balance = balance()): CalendarDate {
  const { daysPerMonth, monthsPerYear } = cfg.time
  const month = Math.floor(day / daysPerMonth)
  return {
    dayOfMonth: (day % daysPerMonth) + 1,
    month: (month % monthsPerYear) + 1,
    year: Math.floor(month / monthsPerYear) + 1,
  }
}

// Months since the start. The month changes when this number grows.
export const monthIndex = (day: number, cfg: Balance = balance()) =>
  Math.floor(day / cfg.time.daysPerMonth)

// Real milliseconds of one step at speed 1.
export function msPerStep(stage: TimeStage, cfg: Balance = balance()): number {
  const t = cfg.time
  return stage === 'months'
    ? (t.realSecondsPerMonth * 1000) / t.daysPerMonth
    : (t.realSecondsPerWeek * 1000) / t.daysPerWeek
}

export function setSpeed(state: GameState, command: SetSpeed): GameState {
  if (!balance().time.speeds.includes(command.speed)) {
    throw new Error(`Invalid speed: ${command.speed}`)
  }
  return { ...state, time: { ...state.time, speed: command.speed } }
}
