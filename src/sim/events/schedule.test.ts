import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { createState, type GameState } from '../state'
import { step } from '../time/time'
import { activeEvents, warnedEvents, type EventType, type GameEvent } from './schedule'

const DAYS = 1000
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)
const cfg = balance().events

// Index i holds the events at the start of day i + 1 (after the daily run).
function history(seed: number): { state: GameState; events: GameEvent[] }[] {
  let state = createState(seed)
  const days = [{ state, events: state.events }]
  for (let d = 1; d < DAYS; d++) {
    for (let h = 0; h < balance().time.ticksPerGameDay; h++) state = step(state)
    days.push({ state, events: state.events })
  }
  return days
}

const runs = new Map(SEEDS.map((seed) => [seed, history(seed)]))

describe('event engine', () => {
  it('AC-1: starts with an empty list', () => {
    expect(createState(7).events).toEqual([])
  })

  it('AC-1: repeats the history for the same seed and differs for another seed', () => {
    const a = history(3).map((d) => d.events)
    expect(history(3).map((d) => d.events)).toEqual(a)
    expect(runs.get(4)!.map((d) => d.events)).not.toEqual(a)
  })

  it('AC-2: warns in time and keeps the grace days free', () => {
    for (const days of runs.values()) {
      days.forEach(({ events }, i) => {
        const day = i + 1
        for (const e of events) {
          expect(e.startDay - e.announcedDay).toBeGreaterThanOrEqual(cfg.warningDays)
          expect(e.announcedDay).toBeLessThanOrEqual(day)
        }
        if (day <= cfg.graceDaysAtStart) expect(activeEvents(days[i]!.state)).toEqual([])
      })
      for (const e of new Set(days.flatMap((d) => d.events))) {
        const seen = days.findIndex((d) => d.events.includes(e)) + 1
        expect(seen).toBe(e.announcedDay)
      }
    }
  })

  it('AC-3: respects the limit and keeps types unique', () => {
    for (const days of runs.values()) {
      for (const { state, events } of days) {
        expect(activeEvents(state).length).toBeLessThanOrEqual(cfg.maxConcurrent)
        expect(events.length).toBeLessThanOrEqual(cfg.maxConcurrent)
        expect(new Set(events.map((e) => e.type)).size).toBe(events.length)
      }
    }
  })

  it('AC-4: keeps the duration in range and removes ended events', () => {
    const types = cfg.types
    for (const days of runs.values()) {
      for (const e of new Set(days.flatMap((d) => d.events))) {
        const [min, max] = types[e.type as EventType].durationDays
        const length = e.endDay - e.startDay
        expect(length).toBeGreaterThanOrEqual(min)
        expect(length).toBeLessThanOrEqual(Math.min(max, cfg.maxDurationDays))
      }
      days.forEach(({ events }, i) => {
        expect(events.some((e) => e.endDay <= i + 1)).toBe(false)
      })
    }
  })

  it('AC-5: starts every timed type at least once', () => {
    const started = new Set(runs.get(1)!.flatMap((d) => d.events.map((e) => e.type)))
    expect([...started].sort()).toEqual(['boom', 'crisis', 'frost', 'monsoon', 'pests'])
  })

  it('splits warned and active events', () => {
    const state = {
      ...createState(1),
      time: { hour: balance().time.ticksPerGameDay * 8, speed: 1 },
    }
    const warned = { type: 'frost', announcedDay: 9, startDay: 10, endDay: 13 } as const
    const active = { type: 'boom', announcedDay: 5, startDay: 8, endDay: 11 } as const
    const s = { ...state, events: [warned, active] }
    expect(warnedEvents(s)).toEqual([warned])
    expect(activeEvents(s)).toEqual([active])
  })
})
