# Backlog

`/factory:next` runs the first unchecked item. The orchestrator checks it off and
appends the job id. Add one feature per line, phrased as an outcome. Put the
ticket in front when there is one (`PROJ-123`, `#42`, or a URL). Every commit for
that feature then references it. `/factory:import github <query>` or
`/factory:import jira <jql>` adds open tickets here.

Example: `- [ ] PROJ-1 a hello CLI command that greets a name passed as an argument`


- [x] S1 Walking skeleton: `npm run dev` shows a water plane, a rotatable orthographic camera and an empty HUD frame; `balance.json` loads through the zod schema, and a test checks that every value has a source; `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run screenshot` (writes `docs/progress/M0.png`) all work. → 001-walking-skeleton
- [x] S2 Mac app shell and CI: `src-tauri/` with app name "CoffeeChain"; `rustup default stable` is set, and `npm run tauri dev` and `npm run tauri build` work locally; `.github/workflows/ci.yml` runs lint, typecheck, test and build on Ubuntu and builds the Mac app on `macos-latest`. Needs S1. → 002-mac-app-ci
- [x] S3 World generation: `generateWorld(seed)` in `src/sim/world/` gives height, zones, fertility, water retention and soil class per parcel, exactly one volcano zone, the start guarantee, and the places of hut, market, path and trees; tests: same seed gives the same hash, and 200 random worlds pass the guarantee. Needs S1. → 003-world-generation
- [x] S3b World prop places: `src/sim/world/props.ts` adds the market place on a shore parcel next to water, a path of 4-connected land parcels from the hut to the market, and tree places on `karg` land parcels outside the start guarantee area. Tests check this for 200 seeds. Needs 003-world-generation. → 008-world-props
- [x] S4 Kenney models: the used models (hut, market stand, path pieces, trees, rocks) from the four Kenney kits are in `assets/kenney/` with the license file; `src/render/models.ts` loads and caches them, and a debug view shows each one. Needs S1. → 004-kenney-models
- [x] S5 Terrain mesh: the island renders as one low-poly mesh with vertex colors per zone, and the top bar shows "Welt #<seed>". This job adds the `world` field to `GameState` (from `generateWorld`). Needs S3. → 007-terrain-mesh
- [x] S6 World props: the scene places the Kenney hut at the start, the market on the shore, path pieces between them and trees on poor parcels, at the places from S3. Needs S3, S3b, S4. → 010-scene-objects
- [x] S6b Props in the scene: `main.ts` adds the S6 props group (`createProps`) to the scene; `terrain.ts` imports `HEIGHT_SCALE` and `cornerY` from `src/render/surface.ts` so the height formula lives in one place; check the Kenney path tile base rotation by eye; a Playwright test writes `docs/progress/S6.png`. Needs 010-scene-objects, 007-terrain-mesh. → 014-props-in-scene
- [x] S7 Overlays: buttons switch a soil overlay (light = poor, dark = very good) and a zone overlay on and off. Needs S5. → 011-overlays
- [x] S8 Parcel picking and inspector: a click selects a parcel and the right panel shows zone, soil class, matching variety and buildable state. Needs S5. → 012-parcel-inspector
- [x] S9 Game time: the sim ticks one game hour per step; the top bar shows day and time and has pause, 1×, 2×, 4×; tests check ticks per day at each speed. Needs S1. → 005-game-time
- [x] S10 Parcels and money: `CreateParcels` charges the cost by zone (first lowland parcel 48 CC, next 100 CC), removes trees, rejects steep or water parcels, and groups neighbours into named fields; the balance starts at 500 CC; tests cover the 48 and 100 CC rule. Uses `state.world`; S5 adds that field, so if S5 is not merged yet, add it the same way. Needs S3. → 009-parcels-plantations
- [x] S10b Props in state and tree removal: add the S3b props (`placeProps`) to `GameState` at `createState(seed)`; `CreateParcels` removes trees on bought parcels; test that a bought tree parcel has no tree afterwards. Needs 009-parcels-plantations, 008-world-props. → 015-props-state-trees
- [ ] S10c Render props from state: `src/render/props.ts` draws the props from `GameState.props` instead of calling `placeProps`, so a bought tree disappears from the scene after `CreateParcels`. Needs 015-props-state-trees, 014-props-in-scene.
- [x] S11 Planting and growth: `Plant` buys seed and starts a cycle; growth follows game time with the visual stages from config; test: Robusta is ripe after exactly 3 game days at 1× and at 4×. Needs S9, S10. → 013-planting-growth
- [x] S12 Parcel tool: the toolbar "Parzelle" tool selects one or many parcels, shows the total cost, creates them, and marks owned parcels and field names on the terrain; the top bar shows CC. Needs S8, S10. → 017-parcel-tool
- [ ] S12b Owned parcel marks: new `src/render/fields.ts` marks owned parcels on the terrain and shows "Feld <name>" labels per field; trees on owned parcels disappear via S10c (render props from state), not here. Needs 017-parcel-tool.
- [ ] S13 Plant tool and plant meshes: the "Pflanzen" tool plants Robusta or Arabica Standard on selected parcels, and a code-made InstancedMesh shows each growth stage per variety. Needs S11, S12.
- [x] S14 Yield formula: pure `src/sim/farm/yield.ts` with table tests for all varieties and soil classes, including "Robusta, Gut, matching zone, no fertilizer, random 1.0 gives 20". Needs S1. → 006-yield-formula
- [x] S15 Care commands: `Fertilize`, `Irrigate`, `ProtectPests` charge the care cost once per cycle and parcel before ripeness; fertilizer adds the yield bonus and fertility. Needs S11. → 016-care-commands
- [x] S16 Harvest and storage: `Harvest` uses the yield formula, lowers fertility, and stores up to capacity (the rest stays on the plant); daily storage cost and quality loss; fallow parcels recover fertility; tests cover the capacity limit. Needs S11, S14. → 018-harvest-storage
- [ ] S17 Overripe: ripe plants keep full yield for the grace days, then lose the daily share; the config switch turns it off; tests cover both modes. Needs S16.
- [ ] S18 Care and harvest tools: toolbar tools for fertilize, water, protect and harvest; the top bar shows storage use; the left panel shows messages such as "Feld A ist erntereif" and "Lager voll"; the inspector shows the yield forecast from `yield.ts` without random. Needs S13, S15, S16.
- [ ] S19 Bank market: `src/sim/market/` computes prices from reference, spread, supply and demand factors (clamped to 50–150 %), keeps 14 days of history, and handles `Sell` and `Buy`; tests: the bank buys Robusta for 0.4 CC at a neutral market, sells seed at the config price, and prices stay in range over 1,000 days. Needs S16.
- [ ] S20 Market panel: the "Markt" tool and a click on the market stand open the right panel with stock, sell and buy prices, sell buttons and a 14-day price line per good. Needs S6, S8, S19.
- [ ] S21 Balance bot and report: `npm run balance-sim` runs `tools/balance-sim.ts` (plant, fertilize, harvest, sell, buy new parcels) for 200 days on 20 seeds and writes `docs/balance-report.md` with the capital curve, the days to 2,000 and 10,000 CC, and a recommendation on PRD §12 point 1; then the build stops for Robert. Needs S10, S15, S19.
