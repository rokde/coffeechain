// Reads ?seed=<n>, an integer from 0 to 2^32 − 1. Without a valid value, it picks a random seed.
export function pickSeed(search: string): number {
  const text = new URLSearchParams(search).get('seed')
  if (text !== null && /^\d{1,10}$/.test(text) && Number(text) <= 0xffffffff) return Number(text)
  return crypto.getRandomValues(new Uint32Array(1))[0]!
}
