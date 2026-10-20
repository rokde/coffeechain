import { z } from 'zod'

// Each balance value is stored as {v, src}. The schema checks both and keeps only v.
const val = <T extends z.ZodType>(schema: T) =>
  z.object({ v: schema, src: z.string().min(1) }).transform((o) => (o as { v: z.output<T> }).v)

const num = z.number()
const int = z.number().int()
const range = z.tuple([num, num])
const zone = z.enum(['tiefland', 'hochland', 'hochlandKuehl', 'vulkan'])
const numMap = z.record(z.string(), num)

const variety = z.object({
  zone: val(zone),
  cycleDays: val(int),
  seedCost: val(num),
  baseYield: val(num),
  referencePrice: val(num),
  careCost: val(z.object({ fertilizer: num, irrigation: num, pestControl: num })),
  unlockCapital: val(num),
})

const timedEvent = z.object({ durationDays: range, everyDays: int })

export const balanceSchema = z.object({
  time: z.object({
    realSecondsPerGameDay: val(num),
    ticksPerGameDay: val(int),
    speeds: val(z.array(num)),
    daysPerWeek: val(int),
  }),
  economy: z.object({ startCapital: val(num) }),
  world: z.object({
    size: val(int),
    offZoneYieldFactor: val(num),
    startGuaranteeParcels: val(int),
    startReach: val(int),
    maxAttempts: val(int),
    zoneMinHeight: val(z.object({ tiefland: num, hochland: num, hochlandKuehl: num })),
    falloffPower: val(num),
    noiseScale: val(z.object({ height: num, fertility: num, waterRetention: num })),
    volcanoSize: val(int),
  }),
  soil: z.object({
    yieldFactor: val(z.object({ karg: num, mittel: num, gut: num, sehrGut: num })),
    fertilityLossPerHarvest: val(num),
    fertilityGainPerFertilize: val(num),
    fertilityRecoveryPerFallowDay: val(num),
    classMinQuality: val(z.object({ mittel: num, gut: num, sehrGut: num })),
  }),
  parcels: z.object({
    firstCost: val(num),
    baseCost: val(num),
    zoneMultiplier: val(z.record(zone, num)),
    maxSlope: val(num),
    neighborWeight: val(num),
    worseGap: val(num),
    qualityFactor: val(range),
  }),
  varieties: z.object({
    robusta: variety,
    arabicaStandard: variety,
    arabicaPremium: variety,
    specialty: variety,
  }),
  farm: z.object({
    fertilizerYieldBonus: val(num),
    irrigationDroughtLossReduction: val(num),
    pestControlLossReduction: val(num),
    yieldRandomRange: val(range),
    visualStages: val(z.object({ setzling: num, wachstum: num, bluete: num, fruchtansatz: num })),
    overripe: z.object({
      enabled: val(z.boolean()),
      graceDays: val(num),
      lossPerDay: val(num),
    }),
  }),
  storage: z.object({
    startCapacity: val(num),
    harvestQuality: val(num),
    upgrades: val(z.array(z.object({ capacity: num, cost: num, requiresPhase: int }))),
    costPerUnitPerDay: val(num),
    qualityLossPerDayRaw: val(num),
  }),
  processing: z.object({
    washed: z.object({
      buildCost: val(num),
      costPerUnit: val(num),
      valueMultiplier: val(num),
      durationDays: val(num),
      batchCapacity: val(int),
    }),
  }),
  market: z.object({
    bankBuyFactor: val(num),
    bankSellFactor: val(num),
    fertilizerPrice: val(num),
    supplyFactorRange: val(range),
    demandFactorRange: val(range),
    priceFloor: val(num),
    priceCeiling: val(num),
    volumeWindowDays: val(int),
    supplyUnitsForMinFactor: val(num),
    demandUnitsForMaxFactor: val(num),
    historyDays: val(int),
  }),
  events: z.object({
    maxConcurrent: val(int),
    maxEffect: val(num),
    maxDurationDays: val(int),
    warningDays: val(int),
    graceDaysAtStart: val(int),
    researchMaxCount: val(int),
    types: val(
      z.object({
        frost: timedEvent.extend({ yield: numMap, price: numMap }),
        monsoon: timedEvent.extend({ cycleTime: numMap, price: numMap }),
        boom: timedEvent.extend({ priceAll: num }),
        crisis: timedEvent.extend({ priceAll: num }),
        pests: timedEvent.extend({ yieldAffected: range }),
        research: z.object({ yieldBonus: num, permanent: z.boolean(), everyDays: int }),
      }),
    ),
  }),
  progression: z.object({
    phases: val(z.array(z.object({ id: int, fromCapital: num }))),
    harvestProUnits: val(int),
    harvestProQualityBonus: val(num),
    harvestProMessageDays: val(num),
  }),
  balanceSim: z.object({
    days: val(int),
    seeds: val(int),
    phase1TargetDays: val(num),
  }),
})

export type Balance = z.infer<typeof balanceSchema>

export function loadBalance(raw: unknown): Balance {
  const result = balanceSchema.safeParse(raw)
  if (!result.success) throw new Error(z.prettifyError(result.error))
  return result.data
}
