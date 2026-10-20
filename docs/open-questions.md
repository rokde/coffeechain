# Open questions

Values in `config/balance.json` with `src: "NEU"` that the world generation (S3) and the parcels (S10) add. Each value is a start value. Robert must confirm or change it.

| Value | Start value | Question |
|---|---|---|
| `world.startReach` | 6 | How far (Chebyshev distance in parcels) from the start must the guaranteed parcels be? |
| `world.maxAttempts` | 50 | How many seeds does the generator try before it stops with an error? |
| `world.zoneMinHeight` | tiefland 0.1, hochland 0.4, hochlandKuehl 0.6 | Which height (0–1) starts each zone? Lower heights are water. |
| `world.falloffPower` | 2 | How fast does the island fall to the sea at the edge? A higher value gives more land. |
| `world.noiseScale` | height 0.08, fertility 0.12, waterRetention 0.1 | How large are the hills and soil patches? A lower value gives larger shapes. |
| `world.volcanoSize` | 12 | How many parcels has the volcano zone? |
| `parcels.maxSlope` | 0.15 | Which height difference (0–1) to one of the 4 neighbours makes a parcel too steep to buy? About 5 % of the land is steeper than 0.15. |
| `soil.classMinQuality` | mittel 0.35, gut 0.5, sehrGut 0.7 | Which `soilQuality` (0–1) starts each soil class? Lower values are `karg`. |

`soilQuality` is the mean of `fertility` and `waterRetention`, divided by 100. Both have the same weight.
