import { balance } from '../balance'
import type { Variety } from '../farm/yield'
import type { GameState } from '../state'
import type { Batch } from '../storage/storage'

export interface Process {
  type: 'Process'
  variety: Variety
  units: number
}

// A washed batch runs until its ready hour. After that hour, the bank buys it.
export const isRunning = (batch: Batch, hour: number) =>
  batch.readyHour !== undefined && hour < batch.readyHour

// Ready hour of the running washed batch of a variety, or undefined.
export const runningUntil = (state: GameState, variety: Variety) =>
  state.storage.batches.find((b) => b.variety === variety && isRunning(b, state.time.hour))
    ?.readyHour

// Washes raw units of one variety. The washed batches keep the quality of the raw batches.
export function process(state: GameState, command: Process): GameState {
  const cfg = balance()
  const { washed } = cfg.processing
  const { variety, units } = command
  if (!Object.values(state.buildings).some((b) => b.kind === 'processing'))
    throw new Error('The farm has no processing building')
  if (!Number.isInteger(units) || units <= 0)
    throw new Error(`Units must be a positive integer: ${units}`)
  if (units > washed.batchCapacity)
    throw new Error(`Units exceed the batch capacity: ${units} > ${washed.batchCapacity}`)
  if (state.storage.batches.some((b) => isRunning(b, state.time.hour)))
    throw new Error('A washed batch is still running')
  const raw = state.storage.batches.filter((b) => b.variety === variety && !b.washed)
  const stock = raw.reduce((sum, b) => sum + b.units, 0)
  if (units > stock) throw new Error(`Not enough raw ${variety} in storage: ${stock} < ${units}`)
  const cost = Math.round(units * washed.costPerUnit * 100)
  if (cost > state.money)
    throw new Error(`Not enough money: cost ${cost / 100} CC, balance ${state.money / 100} CC`)

  const readyHour = state.time.hour + washed.durationDays * cfg.time.ticksPerGameDay
  // Batches are in harvest order, so the first batches are the oldest.
  let rest = units
  const made: Batch[] = []
  const batches = state.storage.batches
    .map((b) => {
      if (b.variety !== variety || b.washed || rest === 0) return b
      const take = Math.min(rest, b.units)
      rest -= take
      made.push({ variety, units: take, quality: b.quality, washed: true, readyHour })
      return { ...b, units: b.units - take }
    })
    .filter((b) => b.units > 0)
  return {
    ...state,
    money: state.money - cost,
    storage: { ...state.storage, batches: [...batches, ...made] },
  }
}
