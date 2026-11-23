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
| ~~`storage.harvestQuality`~~ | – | Answered by #21: the quality formula in `farm.quality` replaces the constant. |
| `farm.quality.base` | 70 for all varieties | Which quality points does a harvest start with? Deviates from GDD 5.2 (quality per variety): the quality is measured against the variety, like SCA for Arabica and Q Robusta for Robusta, and the variety's value is in its reference price. Derivation in #21. |
| `farm.quality.soilBonus` | karg −10, mittel −3, gut +2, sehrGut +5 | How many quality points does each soil class add? |
| `farm.quality.offZonePenalty` | 10 | How many quality points does a variety lose outside its zone? |
| `farm.quality.fertilizerBonus` | 3 | How many quality points does fertilizing add? Fertilizer mainly raises the yield. |
| `farm.quality.irrigationBonus` | 5 | How many quality points does irrigation add? Irrigation has no yield effect in v1, so this is its only effect. |
| `farm.quality.randomRange` | −5 to +5 | How many quality points does chance add or take (seeded, GDD 5.4 "Zufall")? |
| `farm.quality.overripePenalty` | 40 | How many quality points does a fully overripe harvest lose? The loss is this value × (1 − overripe factor), so one month past the grace period costs 6 points. |
| `storage.upgrades` | 250 units / 150 CC / phase 1, 600 units / 400 CC / phase 2 | Are the capacity, the cost and the phase of each Lager-Ausbau stage correct? The capacity is the total after the stage. |
| `storage.shelfLifeMinQuality` | 70 | Down to which quality does stored coffee count as keeping ("Haltbar bis" in the storage panel, #9)? Alternatives: the minimum quality of a matching order, or "quality in 3 months" instead of a date. |
| `storage.qualityLossByAge` | 1 per month up to 6 months, 2 from 6 months, 3 from 12 months | How many quality points does stored coffee (raw and washed) lose per month, by the age of the batch? Robert 2026-11-07 in #34: the loss grows with the age, "not radical". Real green coffee loses about 0.5 points per month in jute and keeps its score for up to a year in airtight bags (research in #21). The higher value makes long storage a decision. |
| `progression.harvestProMessageDays` | 30 | How many days does the Ernte-Profi message stay in the message panel? #27 changed it from 1 game day to 30 days. |
| ~~`events.researchMaxCount`~~ | – | Dropped by #8: the game has no events (Robert 2026-10-25). |
| `progression.harvestProQualityBonus` | 0.05 | Raises the batch quality by 5 % from the harvest after the milestone, capped at 100. Since #21 it has a visible effect. |
| `processing.washed.durationDays` | 30 | How many days does one washed batch take? The washed units are ready 30 days after `Process`. #27 changed it from 1 game day. |
| `processing.washed.batchCapacity` | 50 | How many raw units can one washed batch take? The farm runs one batch at a time. |
| `processing.washed.buildCost` | 150 | How many CC does the "Aufbereitung" building cost? The value is based on GDD 11.6. |
| `market.volumeHalfLifeDays` | 30 | After how many days does a trade count only half for the price (#18)? Each sale (coffee) or purchase (seed) adds its units to a volume per good, and the volume halves every 30 days. It replaces the hard 90-day window (`market.volumeWindowDays`). 62 days would give the same volume as the old window at a steady sales rate. The value belongs to decision 2 of epic #25 (holding back stock): a shorter half-life makes waiting for a better price pay off sooner. |
| `market.supplyUnitsForHalfFactor` | 1500 | At which volume of coffee is half of the supply range used, i.e. factor 0.85 (#18)? The factor follows 1 − 0.3 × (1 − 2^(−volume / 1500)) and never reaches 0.7. With 1500 the bot is within 5 % of the minimum on 40 % of the days (median over 20 seeds, 6,000 days; `docs/balance-report.md`), with 300 it was 70 %. A larger farm still pushes the price close to the minimum until the virtual buyers of #19 add their own demand. The value is per good, so washed coffee and each variety have their own volume. |
| `market.demandUnitsForHalfFactor` | 200 | At which volume of seed purchases is half of the demand range used, i.e. factor 1.15 (#18)? The factor follows 1 + 0.3 × (1 − 2^(−volume / 200)) and never reaches 1.3. The bot never comes within 5 % of the maximum; its median seed factor is 1.18. |
| `orders.maxOpen` | 3 | How many buyer orders (S56) can be open at the same time? |
| `orders.chancePerDay` | 0.01 | What is the chance that a buyer posts a new order on a day? #27 changed it from 0.3 per game day. |
| `orders.units` | 20–60 | How many units does one order ask for? |
| `orders.minQuality` | 70–95 | Which minimum quality does an order ask for? Since #21 every variety reaches 72 on Gut soil without care, 80 with both cares and at most 88 (92 with Ernte-Profi). Orders above 88 are rare luck until #22 revisits them. |
| `orders.priceFactor` | 1.0–1.3 | Which factor on the reference price does an order pay? The bank pays 0.8. |
| `orders.deadlineDays` | 150–300 | How many days after the post day can the player deliver? #27 changed it from 5–10 game days. |

`soilQuality` is the mean of `fertility` and `waterRetention`, divided by 100. Both have the same weight.

## Other questions

- **Whole CC (decided 2026-10-21):** the balance and every booking are whole CC. Each booking (sale, purchase, care, build, order) rounds to whole CC. Unit prices may still show decimals. **S57 rule:** costs round up and income rounds down, once per booking (one command, or one month for the storage cost). A command for many parcels rounds once for the total. The sim keeps hundredths of CC as its unit, so `money` and `invested` are always a multiple of 100. The save migration 7 → 8 rounds `money` and `invested` of an old save down to whole CC. The HUD shows balances and totals as whole CC, rounded down.

- ~~**Fertilizer cost (S15):** PRD §6 said that the game buys fertilizer "at the bank price". The PRD table gives a care cost for each variety. The `Fertilize` command uses `varieties.*.careCost.fertilizer` (1 / 2 / 4 / 6 CC). **Decided 2026-10-25:** the game uses `careCost.fertilizer`. The unused bank fertilizer price is gone from `config/balance.json` (issue #24).~~ Closed: PRD §6 and §8 now say that the player pays fertilizer with the care cost and that the bank sells only seed (Robert 2026-10-25, #8, #24).
- ~~**Monsoon cycle time (S51):** GDD 11.8 gives the monsoon a cycle time of +50 % in the Tiefland (`events.types.monsoon.cycleTime`). PRD §9 says that each event effect stays between −30 % and +30 %. Which rule wins: +50 % (GDD) or a cap at +30 % (PRD)? **Decided 2026-10-21: PRD wins, the monsoon cycle time is capped at +30 % (`events.maxEffect`).** S51c applies it.~~ Dropped by #8: the game has no events (Robert 2026-10-25).
- ~~**Research stacking (S51b):** PRD §9 gives the research breakthrough "~alle 6 Spielwochen" and "dauerhaft". Thus it can occur more than once. Each breakthrough adds +10 % yield (`events.types.research.yieldBonus`). Should breakthroughs stack, each +10 %, up to the ±30 % cap (`events.maxEffect`)? Or should the game give one breakthrough only? A permanent +30 % cancels each positive timed event through the cap. The default now is one (`events.researchMaxCount` = 1). The code works for n breakthroughs. The scheduler always stops at `maxEffect`.~~ Dropped by #8: the game has no events (Robert 2026-10-25).
- **Phase drop (S47):** PRD §10 gives the phases from the capital. It does not say what occurs when the capital falls below a threshold again. Now the game calculates the phase live, so the phase can drop. Unlocked varieties and buildings then lock again. Should a phase stay after the player reaches it once? **2026-10-21: keep the live phase for now and check in play-testing.** The research breakthrough is gone with the events (#8). The switch to the weeks stage (`time.weeksFromPhase`) does not drop with the phase (#27).

## Market panel (#48): working defaults

The mockup in `docs/mockups/market-panel/` is approved (Robert 2026-11-23, PR #54). Its README lists ten questions. Robert approved without answering them, so the build follows the defaults below until he says otherwise (Bastian 2026-11-23). A default that he changes costs a small rework, not a redesign.

**Display only, or what the sim does today. Build like this:**

| Nr. | Question | Default |
|---|---|---|
| 1 | Tabs or one long panel? | Three tabs: Bank, Aufträge, Saatgut. Approved with the mockup. |
| 3 | Which batches does the bank take? | The oldest first, as `sell` does today. The ticket shows the batches of the chosen amount. The ticket has no choice of the order. |
| 4 | Which batches go into an order, and are there partial deliveries? | The lowest qualifying quality first and no partial delivery, as `DeliverOrder` does today. |
| 6 | Buyer profile | One line of profile text on the order card. No buyer view until #23. |
| 8 | Chart scale | Fixed at 50–150 % of the reference (#20), also while the curve stays between 70 and 100 % before #19. |
| 9 | Decimals | Three in the ticket (average price, price after the trade), two in the list and the chart. |
| 10 | Preselected amount | "Alles", like the button today. |

**Built with a neutral value, so the game rule stays as it is:**

- **Bank minimum quality (question 2, #38):** `market.bankMinQuality` starts at 0 with `src: "NEU"`. The panel shows unsellable stock as soon as the value is above 0, and "Alles" skips it. With 0 the bank buys every batch, as PRD §6 says. Robert switches the rule on by setting the value; the mockup assumes 40.
- **Order price (question 5):** the order card compares the price and the income with the bank. The price rule stays `orders.priceFactor` until #22 changes it.

**Waiting for Robert, not built:**

- **Saving seed (question 7, #26):** the ratio of raw coffee to seed (mockup: 4 : 1), the minimum quality (mockup: 75), the quality of bought seed (mockup: 70), and whether seed counts towards the storage capacity. With 4 : 1 own seed is cheaper and better than bought seed. #26 also depends on #6. Until then the Saatgut tab only buys seed.
- **Role of orders (decision 3 of epic #25):** size, frequency and the target share of the income. This is the sim part of #22, not the order cards.
- **Dumping unsellable coffee and its cost (#38):** belongs to the storage panel and is not part of the mockup.
