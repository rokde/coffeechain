import { z } from 'zod'
import { balance } from '../balance'
import type { Variety } from '../farm/yield'
import type { GameState } from '../state'

const num = z.number()
const int = z.number().int()
const place = z.object({ x: int, y: int })
const variety = z.custom<Variety>(
  (v) => typeof v === 'string' && Object.hasOwn(balance().varieties, v),
  'Unknown variety',
)

const parcel = z.object({
  x: int,
  y: int,
  height: num,
  zone: z.enum(['wasser', 'tiefland', 'hochland', 'hochlandKuehl', 'vulkan']),
  fertility: num,
  waterRetention: num,
  soilQuality: num,
  soilClass: z.enum(['karg', 'mittel', 'gut', 'sehrGut']),
})

const plant = z.object({
  variety,
  plantedHour: num,
  fertilized: z.boolean().optional(),
  irrigated: z.boolean().optional(),
  pestProtected: z.boolean().optional(),
  pendingUnits: num.optional(),
  overripeFactor: num.optional(),
})

// Shape check of a loaded state. The output type must stay assignable to GameState.
export const gameStateSchema = z.object({
  time: z.object({ hour: int, speed: num }),
  world: z.object({ seed: int, size: int, parcels: z.array(parcel), start: place }),
  props: z.object({
    hut: place,
    market: place,
    path: z.array(place),
    trees: z.array(place),
  }),
  money: num,
  farm: z.object({
    parcels: z.record(z.string(), int),
    fields: z.array(z.object({ id: int, name: z.string() })),
    nextFieldId: int,
    plants: z.record(z.string(), plant),
  }),
  storage: z.object({ batches: z.array(z.object({ variety, units: num, quality: num })) }),
  market: z.object({
    volumes: z.array(z.object({ kind: z.enum(['coffee', 'seed']), variety, day: int, units: num })),
    seeds: z.partialRecord(z.string(), num),
  }),
}) satisfies z.ZodType<GameState>
