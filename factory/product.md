# Product: CoffeeChain 3D

## Goal
Robert gets a singleplayer 3D coffee farm game for the Mac: build a farm on a seeded island, plant, care, harvest, and sell to the bank. This plan builds milestones M0 to M4 of `PRD.md` §13, so that the core loop is playable and the bot can measure the balance.

## Scope
- In: M0 skeleton (Vite, TypeScript, Vue, Three.js, Tauri 2 shell, Vitest, Playwright, ESLint, Prettier, zod config).
- In: GitHub Actions for test, lint, typecheck, web build and Mac app build.
- In: M1 world (seeded island, zones, soil, overlays, parcel picking, inspector).
- In: M2 time, parcels, planting, visible growth stages.
- In: M3 care, yield formula, harvest, storage, overripe (can be switched off).
- In: M4 bank market, price history, `tools/balance-sim.ts`, `docs/balance-report.md`. After M4 the factory stops for Robert's balancing decision.
- Out: M5 save, load, autosave, tutorial checklist (next planning round, refine in dialog).
- Out: M6 processing, build menu, storage upgrades, phases and unlocks of Premium and Specialty (next planning round).
- Out: M7 events, tooltips, shortcuts, 30-day run, performance pass (next planning round).
- Out: multiplayer (a wish, not a plan; the deterministic sim with commands keeps the door open).
- Out: Kenney models (download and license work; low-poly code primitives give the same style for now).
- Out: terrain chunks (one mesh for 48 × 48 parcels is fast enough; split when the world grows).
- Out: quality effect on price (PRD §12 point 4 is open).
- Out: all non-goals of `PRD.md` §1.

## Stack
- Node 24.22, npm 11.19, TypeScript strict, Vite, Vue 3 + Pinia (HUD), Three.js (scene).
- Tauri 2 for the Mac app. Rust is not installed on this Mac: local work uses `npm run dev`; CI builds the app on `macos-latest`.
- Vitest for `src/sim/` and `config/`; Playwright for screenshots into `docs/progress/`.
- Start: `npm run dev` (browser), `npm run tauri dev` (Mac app). Test: `npm test`. Also `npm run lint`, `npm run typecheck`, `npm run build`, `npm run screenshot`.

## Dependencies
- three: 3D scene; the platform has only raw WebGL.
- vue, pinia: HUD overlay and its store; PRD decides it, and plain DOM code for many panels grows messy.
- zod: one schema gives types and a runtime check of `balance.json`.
- simplex-noise: seeded noise for height, zones and soil; hand-written noise is more code to test.
- @tauri-apps/cli, @tauri-apps/api: native Mac app shell.
- vite, @vitejs/plugin-vue, typescript, vue-tsc: build and typecheck.
- vitest: unit tests; @playwright/test: browser screenshots.
- eslint, typescript-eslint, eslint-plugin-vue, prettier: lint and format (PRD M0).
- tsx: runs `tools/balance-sim.ts` from npm without a build step.

## Architecture
- `config/balance.schema.ts` loads and unwraps `balance.json`; a bad config stops the start with a clear message.
- `src/sim/` is pure and deterministic: `state.ts` (JSON GameState), `commands.ts` (one dispatcher, one handler per command from the module folders), `rng.ts` (mulberry32), and `world/`, `time/`, `economy/`, `farm/`, `storage/`, `market/`. Money is in hundredths of CC.
- `src/app/` owns the game loop (fixed tick = 1 game hour, from real time × speed), the Pinia store (a read-only snapshot of the state), and input. UI and render send commands only.
- `src/render/` owns the Three.js scene: `scene.ts`, `camera.ts`, `terrain.ts`, `props.ts`, `overlays.ts`, `picking.ts`, `plants.ts`.
- `src/ui/` owns the HUD: `Hud.vue` with slots for top bar, left panel, right panel and toolbar; one component per panel; texts in `i18n/de.json`.
- S1 creates all shared files (state, commands, store, HUD slots, toolbar registry, scene), so later slices mostly add new files and one line each in a registry.
- `tools/balance-sim.ts` runs the bot on `src/sim/` only, without graphics.
- `.github/workflows/ci.yml` runs lint, typecheck, test, build; a macOS job builds the Tauri app.

## Slices
1. S1 Walking skeleton: `npm run dev` shows a water plane, a rotatable orthographic camera and an empty HUD frame; `balance.json` loads through the zod schema, and a test checks that every value has a source; `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run screenshot` (writes `docs/progress/M0.png`) all work.
2. S2 Mac app shell and CI: `src-tauri/` with app name "CoffeeChain" and `npm run tauri dev` / `tauri build`; `.github/workflows/ci.yml` runs lint, typecheck, test and build on Ubuntu and builds the Mac app on `macos-latest`. Needs S1.
3. S3 World generation: `generateWorld(seed)` in `src/sim/world/` gives height, zones, fertility, water retention and soil class per parcel, exactly one volcano zone, and the start guarantee; tests: same seed gives the same hash, and 200 random worlds pass the guarantee. Needs S1.
4. S4 Terrain mesh: the island renders as one low-poly mesh with vertex colors per zone, and the top bar shows "Welt #<seed>". Needs S3.
5. S5 World props: hut at the start, market on the shore, a path between them, and trees on poor parcels, made from code primitives. Needs S3.
6. S6 Overlays: buttons switch a soil overlay (light = poor, dark = very good) and a zone overlay on and off. Needs S4.
7. S7 Parcel picking and inspector: a click selects a parcel and the right panel shows zone, soil class, matching variety and buildable state. Needs S4.
8. S8 Game time: the sim ticks one game hour per step; the top bar shows day and time and has pause, 1×, 2×, 4×; tests check ticks per day at each speed. Needs S1.
9. S9 Parcels and money: `CreateParcels` charges the cost by zone (first lowland parcel 48 CC, next 100 CC), removes trees, rejects steep or water parcels, and groups neighbours into named fields; the balance starts at 500 CC; tests cover the 48 and 100 CC rule. Needs S3.
10. S10 Planting and growth: `Plant` buys seed and starts a cycle; growth follows game time with the visual stages from config; test: Robusta is ripe after exactly 3 game days at 1× and at 4×. Needs S8, S9.
11. S11 Parcel tool: the toolbar "Parzelle" tool selects one or many parcels, shows the total cost, creates them, and marks owned parcels and field names on the terrain; the top bar shows CC. Needs S7, S9.
12. S12 Plant tool and plant meshes: the "Pflanzen" tool plants Robusta or Arabica Standard on selected parcels, and an InstancedMesh shows each growth stage per variety. Needs S10, S11.
13. S13 Yield formula: pure `src/sim/farm/yield.ts` with table tests for all varieties and soil classes, including "Robusta, Gut, matching zone, no fertilizer, random 1.0 gives 20". Needs S1.
14. S14 Care commands: `Fertilize`, `Irrigate`, `ProtectPests` charge the care cost once per cycle and parcel before ripeness; fertilizer adds the yield bonus and fertility. Needs S10.
15. S15 Harvest and storage: `Harvest` uses the yield formula, lowers fertility, and stores up to capacity (the rest stays on the plant); daily storage cost and quality loss; fallow parcels recover fertility; tests cover the capacity limit. Needs S10, S13.
16. S16 Overripe: ripe plants keep full yield for the grace days, then lose the daily share; the config switch turns it off; tests cover both modes. Needs S15.
17. S17 Care and harvest tools: toolbar tools for fertilize, water, protect and harvest; the top bar shows storage use; the left panel shows messages such as "Feld A ist erntereif" and "Lager voll"; the inspector shows the yield forecast from `yield.ts` without random. Needs S12, S14, S15.
18. S18 Bank market: `src/sim/market/` computes prices from reference, spread, supply and demand factors (clamped to 50–150 %), keeps 14 days of history, and handles `Sell` and `Buy`; tests: the bank buys Robusta for 0.4 CC at a neutral market, sells seed at the config price, and prices stay in range over 1,000 days. Needs S15.
19. S19 Market panel: the "Markt" tool and a click on the market stand open the right panel with stock, sell and buy prices, sell buttons and a 14-day price line per good. Needs S7, S18.
20. S20 Balance bot and report: `npm run balance-sim` runs `tools/balance-sim.ts` (plant, fertilize, harvest, sell, buy new parcels) for 200 days on 20 seeds and writes `docs/balance-report.md` with the capital curve, the days to 2,000 and 10,000 CC, and a recommendation on PRD §12 point 1; then the factory stops for Robert. Needs S9, S14, S18.

## Open questions
- Rust is not installed (`rustc` not found). Shall the factory install it with rustup, or is a Tauri build in CI enough for now? The plan assumes CI only; then `npm run tauri dev` is not checked locally.
- The GitHub repo `rokde/coffeechain` is not needed until CI must run. The workflow file comes in S2; it runs after the first push.
- Kenney models are Out for now (code primitives instead). Do you want them already in M1, or later?
