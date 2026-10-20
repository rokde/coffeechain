// shortcut: drops game time after long frame gaps (sleep, hidden tab); add catch-up with save/load (M5).
const MAX_TICKS_PER_FRAME = 24

export interface Advance {
  ticks: number
  carryMs: number
}

// Turns real elapsed time into due sim steps. carryMs is the scaled time not used yet.
export function advance(
  carryMs: number,
  elapsedMs: number,
  speed: number,
  msPerTick: number,
): Advance {
  const total = carryMs + elapsedMs * speed
  const ticks = Math.floor(total / msPerTick)
  if (ticks > MAX_TICKS_PER_FRAME) return { ticks: MAX_TICKS_PER_FRAME, carryMs: 0 }
  return { ticks, carryMs: total - ticks * msPerTick }
}
