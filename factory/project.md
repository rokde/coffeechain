# Project context

Every factory agent reads this file first. Only the orchestrator writes it: it
fills it in on `/factory:init`, re-checks it at the start of each job, and
refreshes it after each merge.

## Repo
- Base: `main`, or the local target branch when it already contains the base
  (local merges not pushed yet). Every job's worktree starts there. No `origin`
  remote yet: worktrees start from local `main`.
- Merge target: `main` (local, not pushed)
- Language / stack: planned (per `CLAUDE.md`, `PRD.md` §3): TypeScript (strict), Three.js, Vue 3 + Pinia (HUD), Vite, Tauri 2, Vitest, Playwright, `simplex-noise`. No code or manifest yet (no `package.json`); milestone M0 creates it.
- Install: `none yet` (planned: `npm install`). Run it once in each new worktree.
- Test command: `none yet` (planned: `npm test` = Vitest; `npm run screenshot` = Playwright screenshots to `docs/progress/`)
- Lint / format: `none yet` (planned: `npm run lint`, `npm run typecheck`; ESLint + Prettier)

## Sources
- GitHub issues: none (no `origin` remote; `gh` is logged in as `rokde`)
- Jira: none

## Conventions
- Product spec: `PRD.md` (scope, architecture, milestones M0–M5 in §13). Game values: `docs/gdd.md` (authoritative for mechanics/balancing; file not in repo yet).
- Work milestone by milestone (`PRD.md` §13); each milestone ends with green tests, `npm run build` without errors, and a screenshot `docs/progress/<milestone>.png`.
- Simulation first, test-driven, in `src/sim/`. `src/sim/` never imports from `render/`, `ui/`, `app/` and uses no DOM, Three.js or Vue.
- Player actions only via commands in `src/sim/commands.ts`. Randomness only via seedable PRNG `src/sim/rng.ts`, never `Math.random()` in `sim/`.
- Balancing numbers live in `config/balance.json`, never in code. Missing GDD value: placeholder in `config/balance.json` marked `TODO_GDD`, noted in `docs/open-questions.md`.
- After scene/HUD changes: `npm run screenshot` and compare with `docs/mockups/`.
- Code, identifiers and commits in English. Game texts in German in `src/ui/i18n/de.json`.
- Commit messages: no history yet beyond "Initial commit"; use short imperative English subjects.

## Factory rules
- Product code never goes into `factory/` or `.claude/`.
- One job = one branch `factory/<job-id>` in its own worktree
  `.claude/worktrees/factory-<job-id>`, created from the base ref.
- Smallest complete change. A known limit gets a `shortcut: <limit>, <when to upgrade>` comment.
