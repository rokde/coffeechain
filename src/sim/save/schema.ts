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
  pendingUnits: num.optional(),
  overripeFactor: num.optional(),
})

// Shape check of a loaded state. The output type must stay assignable to GameState.
export const gameStateSchema = z.object({
  time: z.object({ hour: int, speed: num }),
  world: z
    .object({ seed: int, size: int, parcels: z.array(parcel), start: place })
    .refine((w) => w.parcels.length === w.size * w.size, 'Parcel count does not match size'),
  props: z.object({
    hut: place,
    market: place,
    // The path mesh needs two places at least.
    path: z.array(place).min(2),
    trees: z.array(place),
  }),
  money: num,
  invested: num,
  farm: z.object({
    parcels: z.record(z.string(), int),
    fields: z.array(z.object({ id: int, name: z.string() })),
    nextFieldId: int,
    plants: z.record(z.string(), plant),
  }),
  buildings: z.record(z.string(), z.object({ kind: z.enum(['processing', 'storage']) })),
  storage: z.object({
    batches: z.array(
      z
        .object({
          variety,
          units: num,
          quality: num,
          washed: z.literal(true).optional(),
          readyHour: num.optional(),
        })
        .refine((b) => b.readyHour === undefined || b.washed === true, 'readyHour needs washed'),
    ),
  }),
  market: z.object({
    volumes: z.array(
      z.object({ kind: z.enum(['coffee', 'washed', 'seed']), variety, day: int, units: num }),
    ),
    seeds: z.partialRecord(z.string(), num),
  }),
  orders: z.object({
    open: z.array(
      z.object({
        id: int.nonnegative(),
        variety,
        units: int.positive(),
        minQuality: int,
        price: int.nonnegative(),
        deadlineDay: int,
      }),
    ),
    nextId: int.nonnegative(),
  }),
  milestones: z.object({ harvested: num, harvestProHour: num.optional() }),
}) satisfies z.ZodType<GameState>
