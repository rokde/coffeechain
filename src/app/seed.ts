// Reads ?seed=<n>, an integer from 0 to 2^32 − 1, or null without a valid value.
export function seedParam(search: string): number | null {
  const text = new URLSearchParams(search).get('seed')
  if (text !== null && /^\d{1,10}$/.test(text) && Number(text) <= 0xffffffff) return Number(text)
  return null
}

// The seed from ?seed=, or a random seed.
export function pickSeed(search: string): number {
  return seedParam(search) ?? crypto.getRandomValues(new Uint32Array(1))[0]!
}
