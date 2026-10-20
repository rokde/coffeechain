# Audit (end of M4)

What this repo does: CoffeeChain 3D is a single-player coffee-farm build simulation for the Mac (Tauri 2, Three.js, Vue 3). A deterministic simulation in `src/sim/` changes a plain-JSON `GameState` only through commands. One tick is one game hour. Money is stored in hundredths of CC (cents). The bank market sets prices from the trade volume. Assumed load: one local player in one process. The PRD names multiplayer as a possible future step. Thus I count each risk that a crafted command or a save file can trigger as a real risk.

Terms in this report:
- **Command**: a player action object that `dispatch` in `src/sim/commands.ts` applies to the state.
- **NEU value**: a balance value with `src: "NEU"`. The agent added it, and Robert must confirm it.
- **Purity rule**: the ESLint rule that keeps `src/sim/` free of DOM, Three.js, Vue, and `Math.random`.

Checks that I ran: `npm test` (323 tests in 39 files pass), `npm run typecheck` (clean), `npm run lint` (clean). I also ran probe scripts against the sim. They are in the session scratchpad and not in the repo.

Sim purity: clean. No file in `src/sim/` imports from `render/`, `ui/`, or `app/`. No file uses `Math.random`. All random values come from `src/sim/rng.ts`.

M4 acceptance criteria: each criterion has a test. The bank buys Robusta for 0.4 CC. Seed prices come from config. Prices stay in 50–150 % over 1,000 days. `docs/balance-report.md` exists. The M0–M3 criteria also have tests.

## Should fix

1. **`Plant` accepts any variety key, also inherited object keys** (`src/sim/farm/plants.ts:L30-31`)
   - What this is: `Plant` reads `cfg.varieties[command.variety]` and stops only if the result is falsy.
   - Problem: Send `{type: 'Plant', variety: 'constructor'}` on an owned parcel. The lookup finds `Object.prototype.constructor`, so the check passes. The result: the seed cost is 0 CC, `market.seeds.constructor` becomes `NaN` (`null` in JSON), and the growth progress is `NaN`. `Harvest` accepts this plant because `NaN < 1` is false (`harvest.ts:L36`). Then it writes `NaN` into storage. `Fertilize` fails with a `TypeError` (`care.ts:L71`). The UI cannot send this command. A save file (M5) or a network client can send it. `market.ts:L89` already uses `Object.hasOwn`, so the two checks do not agree.
   - Fix: Use `Object.hasOwn(cfg.varieties, command.variety)` in `plants.ts`. Add `'constructor'` and `'toString'` to the table of bad `Plant` commands in the tests.
   - If we skip it: One bad save file or one bad message puts `NaN` into money, storage, and market state. This damage stays in the save and you cannot easily see it.

2. **Sell and Buy use the price from before the trade for all units** (`src/sim/market/market.ts:L116`, `L142`)
   - What this is: The income is `units × bankBuyPrice(state) × 100`. The code reads the price one time, before it records the trade volume.
   - Problem: A sale of 300 Robusta in one command gives 120 CC. Three sales of 100 units give 108 CC. Thus a large sale gives more money than small sales, and the supply factor has almost no effect. A bot that sells in steps of 10 units reaches 2,000 CC on median day 78, not 75.5. Its median capital on day 200 is 10,725 CC, not 11,302 CC. Thus `docs/balance-report.md` shows a slightly too optimistic economy.
   - Fix: Calculate the price at the middle of the trade: add `units / 2` to the recorded volume before the price lookup. Add one test: one sale of N units gives the same income as two sales of N/2 (with a small tolerance). Then run `tools/balance-sim.ts` again before Robert makes the balance decision.
   - If we skip it: Robert makes the balance decision with numbers that are too high. Players find that one large sale is the best strategy.

3. **The harvest random roll uses the harvest hour as its seed** (`src/sim/farm/harvest.ts:L16-18`, `L52`)
   - What this is: `harvestSeed(seed, hour, index)` gives the random roll for the yield.
   - Problem: One Robusta plant on "gut" soil gives 18, 19, 20, or 21 units. The result depends on which of the 48 grace hours the player harvests in. With save/load (M5), or with a client that knows the world seed, the player can wait or reload until the hour gives 21.
   - Fix: Use `plant.plantedHour` and the parcel index for the seed, not the harvest hour. Then one plant always gives one result.
   - If we skip it: Players can get about 15 % more yield by save-scumming (save, reload, try again). In multiplayer, a client can calculate the best hour before the harvest.

4. **The player can buy and plant the hut, market, and path parcels** (`src/sim/farm/parcels.ts:L36-44`, `src/app/selection.ts:L33`)
   - What this is: `isBuildable` checks only slope and water. `canSelect` allows each unowned buildable parcel.
   - Problem: Select the hut parcel, buy it, and plant on it. The plant mesh and the hut then appear at the same parcel center. The test `parcels.test.ts:L223` checks only that the props stay. No specification permits this case.
   - Fix: Reject parcels that have a prop (hut, market, path) in `createParcels` and in `canSelect`. Add one test for each.
   - If we skip it: The player sees overlapping meshes and gets a confusing farm layout. Later the M6 buildings can also be placed on these parcels.

5. **The purity rule has gaps** (`eslint.config.js:L28-54`)
   - What this is: The rule blocks imports of three, vue, pinia, render, ui, and app, and it blocks `Math.random`.
   - Problem: `tsconfig` includes the `DOM` lib. Thus `globalThis.document`, `window`, `localStorage`, `performance.now()`, `crypto.getRandomValues()`, and `Date.now()` compile in `src/sim/`, and lint does not report them. Each of these breaks determinism or the rule "no DOM in sim". At this time no sim file uses them.
   - Fix: Add `no-restricted-globals` for `window`, `document`, `localStorage`, `crypto`, `performance`, and `requestAnimationFrame`. Add `Date.now` to `no-restricted-properties` for `src/sim/**`.
   - If we skip it: A later change can add a clock or a DOM call to the sim, and no check stops it. Replays and multiplayer sync then fail without a clear error.

6. **24 of 33 NEU values are not in `docs/open-questions.md`** (`config/balance.json`, `docs/open-questions.md`)
   - What this is: CLAUDE.md says: each new value gets `src: "NEU"` and an entry in open-questions.
   - Problem: Robert cannot review values that he does not know about. Examples: `market.supplyUnitsForMinFactor` (300), `market.demandUnitsForMaxFactor` (200), `storage.upgrades`, the soil fertility rates, and `offZoneYieldFactor`. The first two control the price range. This is the main M4 balance decision.
   - Fix: Add one line for each missing NEU key. Put the market factors first.
   - If we skip it: The M4 balance decision misses the values that matter most.

7. **The yield forecast copies the harvest yield logic** (`src/sim/farm/forecast.ts:L18-32` against `src/sim/farm/harvest.ts:L39-56`)
   - What this is: The two functions calculate the units from soil, variety, and overripe state in two places.
   - Problem: The M7 `eventFactor` (or any other change to the yield) must go into both files. If you change only one file, the inspector shows a wrong forecast. Today `forecast.test` AC-4 compares the two functions and finds the difference only for the cases in that test.
   - Fix: Move the units logic into one function, and call it from `harvest` and `forecast`. Result: about -15 lines.
   - If we skip it: The forecast and the real harvest can show different values, and the player cannot trust the inspector.

8. **The soil update rule and the parcel check are each written four times** (soil: `world/generate.ts:L56-57`, `farm/care.ts:L48-51`, `farm/harvest.ts:L57-60`, `storage/daily.ts:L20-23`; parcel check: `farm/parcels.ts:L66-70`, `farm/plants.ts:L37-42`, `farm/care.ts:L34-38`, `farm/harvest.ts:L29-33`)
   - What this is: Each place calculates `soil = (fertility + waterRetention) / 200` and `soilClassOf`. Each command does a bounds-and-owned check on the parcel index.
   - Problem: If you change the soil formula in one place only, a parcel can show one soil class after generation and a different soil class after a harvest. This is the "same rule in two places" bug type.
   - Fix: Add the helpers `withFertility(parcel, value)` and `ownedParcel(state, index)`. Result: about -25 lines.
   - If we skip it: The soil classes can drift after the next balance change.

## Nice to have

9. **The storage limit has no helper and no shortcut tag** (`src/sim/farm/harvest.ts:L26`): The code reads `cfg.storage.startCapacity` directly. `Hud.vue` and `MessagePanel.vue` read the same value and have a `shortcut:` tag. Add `storageCapacity(state)`, so that S27 (storage upgrades) changes one place.

10. **`storedUnits` is written three times** (`src/app/market.ts:L24-25`, `src/sim/market/market.ts:L111-113`, `tools/balance-sim.ts:L93-95`): Export one function from the sim and use it in all three places.

11. **The unlocked-variety filter and the variety type are duplicated** (`src/ui/plantAction.ts:L6-9`, `src/ui/MarketPanel.vue:L15-17`, `src/sim/world/inspect.ts:L5`): Use one `unlockedVarieties(state)` function. Replace `VarietyId` with the existing `Variety` type.

12. **The game speed is stored in `GameState`** (`src/sim/time/time.ts`): `SetSpeed` is a sim command. In multiplayer, one player's pause would pause the shared world. Speed is a view setting. Move it to an app store before M5 defines the save format.

13. **Money can become negative from the daily storage cost** (`src/sim/storage/daily.ts:L9`, `L27`): Start with 0 CC and 100 stored units. After 3 days, the money is -6 CC. No document defines this rule. Decide the rule (debt allowed, a floor at 0, or a forced sale) and record it in `docs/open-questions.md`.

I left out 4 smaller findings: the Tauri CSP is `null`, `bankSellFactor` has no use in v1, the hut parcel itself is sometimes too steep (the start guarantee still holds in 500 seeds), and `fertilizerPrice` has no use (it is already in open-questions).

## Shortcuts

- `src/sim/farm/plants.ts:32` and `src/ui/plantAction.ts:6`: all varieties are unlocked, and there is no unlock capital. Limit: there is no progression. Upgrade: S29 (M6).
- `src/ui/Hud.vue:30`, `src/ui/MessagePanel.vue:27`: fixed storage capacity. Limit: there are no storage upgrades. Upgrade: S27. Note: `src/sim/farm/harvest.ts:26` has the same limit but no tag (see #9).
- `src/app/loop.ts:1`: at most 24 ticks per frame. After a long gap (sleep, background tab) the game loses that time. Limit: no catch-up. Upgrade: M5.
- `src/render/props.ts:50`: one mesh clone for each tree (165–240 trees for seeds 1–5). Limit: draw calls increase with the tree count. Upgrade: instancing in S36 / the M7 performance target.
- `src/render/props.ts:61`: props on slopes have a flat base. Limit: some props float or sink. Upgrade: not named. `no-trigger`

Verdict: Healthy. There is no Must fix. Fix #1 before M5 loads save files. Then fix #2 and #6, and run `tools/balance-sim.ts` again before Robert makes the M4 balance decision.

Lean: -50 lines possible (#7, #8, #10, #11), -0 dependencies.

Not checked:
- Playwright e2e and screenshots (not run), and the visual comparison with `docs/mockups/`.
- The Tauri/Rust build, and the 60 fps target on real hardware.
- `src/render/` camera, picking, terrain, overlays, and fields (I read these only quickly).
- The UI component tests (I did not read them in detail).
- The GDD after §11.3.
- Float determinism across engines: `Math.hypot` and `**` in `src/sim/world/generate.ts` can give different results in JavaScriptCore (Tauri) and V8 (tests). This matters for multiplayer only.
