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
  // The epsilon keeps float errors of a fraction like 20000 / 7 from losing a step on its boundary.
  const ticks = Math.floor(total / msPerTick + 1e-9)
  if (ticks > MAX_TICKS_PER_FRAME) return { ticks: MAX_TICKS_PER_FRAME, carryMs: 0 }
  return { ticks, carryMs: total - ticks * msPerTick }
}
