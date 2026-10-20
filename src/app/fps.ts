// Frames per second from the mean of the frame times in ms. Frame times of 0 (the first frame) do not count.
export function fpsFromFrames(frames: readonly number[]): number {
  const valid = frames.filter((ms) => ms > 0)
  if (valid.length === 0) return 0
  return Math.round((1000 * valid.length) / valid.reduce((sum, ms) => sum + ms, 0))
}
