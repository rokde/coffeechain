// Reads a seed text, an integer from 0 to 2^32 − 1, or null without a valid value.
export function parseSeed(text: string | null): number | null {
  if (text !== null && /^\d{1,10}$/.test(text) && Number(text) <= 0xffffffff) return Number(text)
  return null
}

// Reads ?seed=<n>, or null without a valid value.
export const seedParam = (search: string) => parseSeed(new URLSearchParams(search).get('seed'))

// The seed from ?seed=, or a random seed.
export function pickSeed(search: string): number {
  return seedParam(search) ?? crypto.getRandomValues(new Uint32Array(1))[0]!
}
