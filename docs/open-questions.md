# Open questions

Values in `config/balance.json` with `src: "NEU"` that the world generation (S3) and the parcels (S10) add. Each value is a start value. Robert must confirm or change it.

**Decision 2026-10-21 (Robert):** the game starts with the values in the tables below. They get tuned after play-testing in the balance sim and in real play.

| Value | Start value | Question |
|---|---|---|
| `time.realSecondsPerMonth` | 20 | How many real seconds at speed 1 does one month take while the time runs in months? One step is one day. |
| `time.realSecondsPerWeek` | 20 | How many real seconds at speed 1 does one week take while the time runs in weeks? |
| `time.daysPerMonth` | 30 | How many days does one month have? The calendar uses equal months (#27). |
| `time.monthsPerYear` | 12 | How many months does one year have? |
| `time.weeksFromPhase` | 2 | From which progression phase does the time run in weeks? Phase 2 starts at 2,000 CC capital. The switch only goes forward (#27). |
| `world.startReach` | 6 | How far (Chebyshev distance in parcels) from the start must the guaranteed parcels be? |
| `world.maxAttempts` | 50 | How many seeds does the generator try before it stops with an error? |
| `world.zoneMinHeight` | tiefland 0.1, hochland 0.4, hochlandKuehl 0.6 | Which height (0–1) starts each zone? Lower heights are water. |
| `world.falloffPower` | 2 | How fast does the island fall to the sea at the edge? A higher value gives more land. |
| `world.noiseScale` | height 0.08, fertility 0.12, waterRetention 0.1 | How large are the hills and soil patches? A lower value gives larger shapes. |
| ~~`world.volcanoSize`~~ | – | Dropped by #17: the game has no volcano zone (Robert 2026-10-25). |
| `parcels.maxSlope` | 0.15 | Which height difference (0–1) to one of the 4 neighbours makes a parcel too steep to buy? About 5 % of the land is steeper than 0.15. |
| `soil.classMinQuality` | mittel 0.35, gut 0.5, sehrGut 0.7 | Which `soilQuality` (0–1) starts each soil class? Lower values are `karg`. |
| `storage.harvestQuality` | 100 | Which quality does a new harvest batch get? v1 has no quality formula (PRD §12 point 4). |
| `storage.upgrades` | 250 units / 150 CC / phase 1, 600 units / 400 CC / phase 2 | Are the capacity, the cost and the phase of each Lager-Ausbau stage correct? The capacity is the total after the stage. |
| `progression.harvestProMessageDays` | 30 | How many days does the Ernte-Profi message stay in the message panel? #27 changed it from 1 game day to 30 days. |
| ~~`events.researchMaxCount`~~ | – | Dropped by #8: the game has no events (Robert 2026-10-25). |
| `progression.harvestProQualityBonus` | 0.05 | The bonus has no visible effect: `storage.harvestQuality` is 100 and the cap is 100. It needs a quality formula (PRD §12 point 4). |
| `processing.washed.durationDays` | 30 | How many days does one washed batch take? The washed units are ready 30 days after `Process`. #27 changed it from 1 game day. |
| `processing.washed.batchCapacity` | 50 | How many raw units can one washed batch take? The farm runs one batch at a time. |
| `processing.washed.buildCost` | 150 | How many CC does the "Aufbereitung" building cost? The value is based on GDD 11.6. |
| `orders.maxOpen` | 3 | How many buyer orders (S56) can be open at the same time? |
| `orders.chancePerDay` | 0.01 | What is the chance that a buyer posts a new order on a day? #27 changed it from 0.3 per game day. |
| `orders.units` | 20–60 | How many units does one order ask for? |
| `orders.minQuality` | 70–95 | Which minimum quality does an order ask for? Now each harvest starts at quality 100. |
| `orders.priceFactor` | 1.0–1.3 | Which factor on the reference price does an order pay? The bank pays 0.8. |
| `orders.deadlineDays` | 150–300 | How many days after the post day can the player deliver? #27 changed it from 5–10 game days. |

`soilQuality` is the mean of `fertility` and `waterRetention`, divided by 100. Both have the same weight.

## Other questions

- **Whole CC (decided 2026-10-21):** the balance and every booking are whole CC. Each booking (sale, purchase, care, build, order) rounds to whole CC. Unit prices may still show decimals. **S57 rule:** costs round up and income rounds down, once per booking (one command, or one month for the storage cost). A command for many parcels rounds once for the total. The sim keeps hundredths of CC as its unit, so `money` and `invested` are always a multiple of 100. The save migration 7 → 8 rounds `money` and `invested` of an old save down to whole CC. The HUD shows balances and totals as whole CC, rounded down.

- **Fertilizer cost (S15):** PRD §6 says that the game buys fertilizer "at the bank price". The PRD table gives a care cost for each variety. The `Fertilize` command uses `varieties.*.careCost.fertilizer` (1 / 2 / 4 / 6 CC). **Decided 2026-10-25:** the game uses `careCost.fertilizer`. The unused bank fertilizer price is gone from `config/balance.json` (issue #24).
- ~~**Monsoon cycle time (S51):** GDD 11.8 gives the monsoon a cycle time of +50 % in the Tiefland (`events.types.monsoon.cycleTime`). PRD §9 says that each event effect stays between −30 % and +30 %. Which rule wins: +50 % (GDD) or a cap at +30 % (PRD)? **Decided 2026-10-21: PRD wins, the monsoon cycle time is capped at +30 % (`events.maxEffect`).** S51c applies it.~~ Dropped by #8: the game has no events (Robert 2026-10-25).
- ~~**Research stacking (S51b):** PRD §9 gives the research breakthrough "~alle 6 Spielwochen" and "dauerhaft". Thus it can occur more than once. Each breakthrough adds +10 % yield (`events.types.research.yieldBonus`). Should breakthroughs stack, each +10 %, up to the ±30 % cap (`events.maxEffect`)? Or should the game give one breakthrough only? A permanent +30 % cancels each positive timed event through the cap. The default now is one (`events.researchMaxCount` = 1). The code works for n breakthroughs. The scheduler always stops at `maxEffect`.~~ Dropped by #8: the game has no events (Robert 2026-10-25).
- **Phase drop (S47):** PRD §10 gives the phases from the capital. It does not say what occurs when the capital falls below a threshold again. Now the game calculates the phase live, so the phase can drop. Unlocked varieties and buildings then lock again. Should a phase stay after the player reaches it once? **2026-10-21: keep the defaults for now (one breakthrough, live phase) and check in play-testing.**
