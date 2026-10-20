# Product: CoffeeChain 3D

## Goal
Robert gets a singleplayer 3D coffee farm game for the Mac: he builds a farm on a seeded island, plants, cares, harvests and sells to the bank. This plan builds milestones M0 to M4 of `PRD.md` §13, so that the core loop is playable and a bot can measure the balance; M5 to M7 stay as "Later slices" for the dialog after the balancing decision.

## Scope
- In: M0 skeleton (Vite, TypeScript, Vue, Three.js, Tauri 2 shell, Vitest, Playwright, ESLint, Prettier, zod config).
- In: GitHub Actions for lint, typecheck, test, web build and Mac app build. Local `npm run tauri dev` and `npm run tauri build` also work.
- In: M1 world (seeded island, zones, soil, overlays, parcel picking, inspector), with hut, market, path decoration and trees from Kenney kits (CC0).
- In: M2 time, parcels, planting, visible growth stages.
- In: M3 care, yield formula, harvest, storage, overripe (can be switched off).
- In: M4 bank market, price history, `tools/balance-sim.ts`, `docs/balance-report.md`. After M4 the build stops for Robert's balancing decision.
- Later (planned below, not in the backlog yet): M5 save, load, autosave, tutorial; M6 build menu, processing, storage upgrades, phases, Premium and Specialty; M7 events, tooltips, shortcuts, 30-day run, performance pass.
- Out: multiplayer (a wish, not a plan; the deterministic sim with commands keeps the door open).
- Out: code-made buildings and trees (Feedback 1 asks for Kenney models already in M1).
- Out: code-made plants from Kenney (plants stay code-generated, PRD §11).
- Out: terrain chunks (one mesh for 48 × 48 parcels is fast enough; split when the world grows).
- Out: quality effect on price (PRD §12 point 4 is open).
- Out: all non-goals of `PRD.md` §1 and all items of `PRD.md` §14.

## Stack
- Node 24.22, npm 11.19, TypeScript strict, Vite, Vue 3 + Pinia (HUD), Three.js (scene).
- Tauri 2 for the Mac app. Rust comes from rustup in `~/.cargo/bin` (toolchain `stable-aarch64-apple-darwin`). No default toolchain is set: S2 runs `rustup default stable` once, then checks `npm run tauri dev` and `npm run tauri build` locally. CI builds the app on `macos-latest`.
- Vitest for `src/sim/` and `config/`; Playwright for screenshots into `docs/progress/`.
- Start: `npm run dev` (browser), `npm run tauri dev` (Mac app). Test: `npm test`. Also `npm run lint`, `npm run typecheck`, `npm run build`, `npm run screenshot`.

## Dependencies
- three: 3D scene and glTF loader (`three/examples/jsm`); the platform has only raw WebGL.
- vue, pinia: HUD overlay and its store; PRD decides it, and plain DOM code for many panels grows messy.
- zod: one schema gives types and a runtime check of `balance.json`.
- simplex-noise: seeded noise for height, zones and soil; hand-written noise is more code to test.
- @tauri-apps/cli, @tauri-apps/api: native Mac app shell.
- vite, @vitejs/plugin-vue, typescript, vue-tsc: build and typecheck.
- vitest: unit tests; @playwright/test: browser screenshots.
- eslint, typescript-eslint, eslint-plugin-vue, prettier: lint and format (PRD M0).
- tsx: runs `tools/balance-sim.ts` from npm without a build step.
- Kenney kits (CC0 assets, not npm packages): Nature Kit, Survival Kit, City Kit Suburban, Fantasy Town Kit. Only the used glTF files go into `assets/kenney/`, with `License.txt`.

## Architecture
- `config/balance.schema.ts` loads and unwraps `balance.json`; a bad config stops the start with a clear message.
- `src/sim/` is pure and deterministic: `state.ts` (JSON GameState), `commands.ts` (one dispatcher, one handler per command from the module folders), `rng.ts` (mulberry32), and `world/`, `time/`, `economy/`, `farm/`, `storage/`, `market/` (later `processing/`, `events/`, `save/`). Money is in hundredths of CC.
- `src/app/` owns the game loop (fixed tick = 1 game hour, from real time × speed), the Pinia store (a read-only snapshot of the state), and input. UI and render send commands only.
- `src/render/` owns the Three.js scene: `scene.ts`, `camera.ts`, `terrain.ts`, `models.ts` (Kenney glTF loader and cache), `props.ts`, `overlays.ts`, `picking.ts`, `plants.ts`.
- `src/ui/` owns the HUD: `Hud.vue` with slots for top bar, left panel, right panel and toolbar; one component per panel; texts in `i18n/de.json`.
- S1 creates all shared files (state, commands, store, HUD slots, toolbar registry, scene), so later slices mostly add new files and one line each in a registry.
- `tools/balance-sim.ts` runs the bot on `src/sim/` only, without graphics.
- `.github/workflows/ci.yml` runs lint, typecheck, test, build; a macOS job builds the Tauri app.

## Slices
1. S1 Walking skeleton: `npm run dev` shows a water plane, a rotatable orthographic camera and an empty HUD frame; `balance.json` loads through the zod schema, and a test checks that every value has a source; `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run screenshot` (writes `docs/progress/M0.png`) all work.
2. S2 Mac app shell and CI: `src-tauri/` with app name "CoffeeChain"; `rustup default stable` is set, and `npm run tauri dev` and `npm run tauri build` work locally; `.github/workflows/ci.yml` runs lint, typecheck, test and build on Ubuntu and builds the Mac app on `macos-latest`. Needs S1.
3. S3 World generation: `generateWorld(seed)` in `src/sim/world/` gives height, zones, fertility, water retention and soil class per parcel, exactly one volcano zone, the start guarantee, and the places of hut, market, path and trees; tests: same seed gives the same hash, and 200 random worlds pass the guarantee. Needs S1.
4. S4 Kenney models: the used models (hut, market stand, path pieces, trees, rocks) from the four Kenney kits are in `assets/kenney/` with the license file; `src/render/models.ts` loads and caches them, and a debug view shows each one. Needs S1.
5. S5 Terrain mesh: the island renders as one low-poly mesh with vertex colors per zone, and the top bar shows "Welt #<seed>". Needs S3.
6. S6 World props: the scene places the Kenney hut at the start, the market on the shore, path pieces between them and trees on poor parcels, at the places from S3. Needs S3, S4.
7. S7 Overlays: buttons switch a soil overlay (light = poor, dark = very good) and a zone overlay on and off. Needs S5.
8. S8 Parcel picking and inspector: a click selects a parcel and the right panel shows zone, soil class, matching variety and buildable state. Needs S5.
9. S9 Game time: the sim ticks one game hour per step; the top bar shows day and time and has pause, 1×, 2×, 4×; tests check ticks per day at each speed. Needs S1.
10. S10 Parcels and money: `CreateParcels` charges the cost by zone (first lowland parcel 48 CC, next 100 CC), removes trees, rejects steep or water parcels, and groups neighbours into named fields; the balance starts at 500 CC; tests cover the 48 and 100 CC rule. Needs S3.
11. S11 Planting and growth: `Plant` buys seed and starts a cycle; growth follows game time with the visual stages from config; test: Robusta is ripe after exactly 3 game days at 1× and at 4×. Needs S9, S10.
12. S12 Parcel tool: the toolbar "Parzelle" tool selects one or many parcels, shows the total cost, creates them, and marks owned parcels and field names on the terrain; the top bar shows CC. Needs S8, S10.
13. S13 Plant tool and plant meshes: the "Pflanzen" tool plants Robusta or Arabica Standard on selected parcels, and a code-made InstancedMesh shows each growth stage per variety. Needs S11, S12.
14. S14 Yield formula: pure `src/sim/farm/yield.ts` with table tests for all varieties and soil classes, including "Robusta, Gut, matching zone, no fertilizer, random 1.0 gives 20". Needs S1.
15. S15 Care commands: `Fertilize`, `Irrigate`, `ProtectPests` charge the care cost once per cycle and parcel before ripeness; fertilizer adds the yield bonus and fertility. Needs S11.
16. S16 Harvest and storage: `Harvest` uses the yield formula, lowers fertility, and stores up to capacity (the rest stays on the plant); daily storage cost and quality loss; fallow parcels recover fertility; tests cover the capacity limit. Needs S11, S14.
17. S17 Overripe: ripe plants keep full yield for the grace days, then lose the daily share; the config switch turns it off; tests cover both modes. Needs S16.
18. S18 Care and harvest tools: toolbar tools for fertilize, water, protect and harvest; the top bar shows storage use; the left panel shows messages such as "Feld A ist erntereif" and "Lager voll"; the inspector shows the yield forecast from `yield.ts` without random. Needs S13, S15, S16.
19. S19 Bank market: `src/sim/market/` computes prices from reference, spread, supply and demand factors (clamped to 50–150 %), keeps 14 days of history, and handles `Sell` and `Buy`; tests: the bank buys Robusta for 0.4 CC at a neutral market, sells seed at the config price, and prices stay in range over 1,000 days. Needs S16.
20. S20 Market panel: the "Markt" tool and a click on the market stand open the right panel with stock, sell and buy prices, sell buttons and a 14-day price line per good. Needs S6, S8, S19.
21. S21 Balance bot and report: `npm run balance-sim` runs `tools/balance-sim.ts` (plant, fertilize, harvest, sell, buy new parcels) for 200 days on 20 seeds and writes `docs/balance-report.md` with the capital curve, the days to 2,000 and 10,000 CC, and a recommendation on PRD §12 point 1; then the build stops for Robert. Needs S10, S15, S19.

## Later slices (M5 to M7, plan only, not in the backlog yet)
22. S22 Save format: `src/sim/save/` serializes the state with a version number and a migration list; test: save, load and 50 more days give the same state as 50 days without a break. Needs S21.
23. S23 Save to disk: two small Rust commands in `src-tauri/` write and read saves in `~/Library/Application Support/CoffeeChain/saves`; the browser build uses `localStorage`; the HUD has "Speichern" and "Laden". Needs S2, S22.
24. S24 Autosave: the game saves once per game day into one autosave slot. Needs S23.
25. S25 Tutorial checklist: the left panel shows the five steps "Erste Schritte" of PRD §10, and each step checks itself from the state. Needs S18, S20.
26. S26 Build command and menu: `Build` places a building on a free parcel and charges its cost; the "Bauen" tool lists the buildings. Needs S12.
27. S27 Storage upgrade: the storage building has upgrade stages that raise capacity. Needs S26.
28. S28 Processing: the "Aufbereitung" building and `Process` take up to 50 units per batch for 1 game day, cost 0.3 CC per unit and add 50 % value; test: 10 units of raw Arabica Standard become reference 1.5 CC per unit for 3 CC. Needs S19, S26.
29. S29 Capital and phases: capital = balance + stock at bank buy price + cost of parcels and buildings; the top bar shows the phase; unlocks gate varieties and buildings. Needs S19, S26.
30. S30 Premium and Specialty: the plant tool offers Arabica Premium in phase 2 and Specialty in phase 3, Specialty only on volcano parcels. Needs S13, S29.
31. S31 Harvest milestone: "Ernte-Profi" after 1,000 harvested units gives +5 % harvest quality for good. Needs S16.
32. S32 Event engine: a seeded scheduler starts events with at least 1 day of warning, at most 2 at the same time, none in the first 5 days, at most 7 days long; test over 1,000 days. Needs S9.
33. S33 Event effects: the six events of PRD §9 change yield, cycle time and prices, always within ±30 %; tests per event. Needs S19, S32.
34. S34 Event HUD: the top bar shows the active event, and the left panel shows warnings such as "Frost-Warnung ab morgen". Needs S18, S33.
35. S35 Tooltips and shortcuts: tooltips on toolbar and inspector values; keys for tools, pause and speed. Needs S18.
36. S36 Performance pass: 48 × 48 parcels and 2,000 plants run at 60 fps on Apple Silicon; a debug fps meter shows it. Needs S13.
37. S37 30-day run: a Playwright run plays day 1 to day 30 without errors and writes a screenshot series. Needs S25, S34.

## Open questions
- None that change the plan for S1 to S21. The GitHub repo `rokde/coffeechain` is needed only when CI must run; the workflow file comes in S2 and runs after the first push.
