# CLAUDE.md – CoffeeChain 3D

## Kontext
3D-Aufbausimulation (Kaffeefarm) als Mac-App. Scope und Mechanik stehen in `PRD.md`, der Hintergrund im GDD (`docs/gdd.md`), alle Zahlen in `config/balance.json`. Lies `PRD.md` vor jedem Meilenstein; das GDD bei Fragen zur Mechanik. Das GDD beschreibt ein größeres Multiplayer-Browserspiel: Was davon gilt, legt `PRD.md` fest.

## Stack
TypeScript (strict), Three.js, Vue 3 + Pinia (HUD), Vite, Tauri 2, Vitest, Playwright.

## Arbeitsweise
- Arbeite meilensteinweise nach `PRD.md` Abschnitt 13. Beginne keinen neuen Meilenstein, bevor die Akzeptanzkriterien des aktuellen erfüllt sind.
- Lies jede Datei vor einer Änderung neu ein, auch wenn du glaubst, ihren Inhalt zu kennen.
- Simulation zuerst testgetrieben in `src/sim/`, danach Rendering und UI.
- `src/sim/` importiert nie aus `render/`, `ui/` oder `app/` und nutzt kein DOM, kein Three.js, kein Vue.
- Spieleraktionen nur über Commands in `src/sim/commands.ts`.
- Zufall nur über den seedbaren PRNG aus `src/sim/rng.ts`, nie `Math.random()` in `sim/`.
- Zahlen für Balancing gehören in `config/balance.json`, nie in den Code. Jeder Wert dort hat die Form `{"v": …, "src": …}`; das zod-Schema entpackt `v`.
- Werte mit `src: "GDD …"` änderst du nicht eigenmächtig. Nach M4 stoppst du und wartest auf Roberts Balancing-Entscheidung.

## Wenn etwas fehlt
- Fehlt ein Wert: in `config/balance.json` mit `src: "NEU"` anlegen, in `docs/open-questions.md` eintragen, weitermachen.
- Ist eine Anforderung unklar oder widersprüchlich: nicht raten. Frage stellen und den Rest des Meilensteins weiterbauen, soweit möglich.

## Visuelle Prüfung
Nach Änderungen an Szene oder HUD: `npm run screenshot` (Playwright gegen den Vite-Dev-Server) ausführen, Screenshot ansehen und mit `docs/mockups/` vergleichen.

## Befehle
- `npm run dev` – Vite im Browser
- `npm run tauri dev` – als Mac-App
- `npm test` – Vitest
- `npm run screenshot` – Playwright-Screenshots nach `docs/progress/`
- `npm run build` / `npm run tauri build`
- `npm run lint`, `npm run typecheck`

(Die Skripte legst du in M0 an.)

## Sprache
Code, Bezeichner und Commits auf Englisch. Spieltexte auf Deutsch in `src/ui/i18n/de.json`.
