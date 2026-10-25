# PRD: CoffeeChain 3D

**Status:** Entwurf v0.2 · 20.10.2026 (GDD-Werte eingearbeitet)
**Owner:** Robert
**Umsetzung:** Claude Code

---

## 1. Worum es geht

CoffeeChain 3D ist eine Aufbausimulation in 3D für den Mac. Man startet auf einer zufällig erzeugten Insel und baut eine Kaffeefarm auf. Der Boden ist unterschiedlich gut und die Insel hat verschiedene Lagen (Tiefland, Hochland, kühles Hochland). Beides bestimmt, welche Sorte wo gut wächst und wie viel man erntet. Die Ernte verkauft man auf dem Markt und kauft dort Saatgut, Dünger und Ausbauten.

Das Spiel basiert auf dem Browser-Konzept **CoffeeChain** (GDD in `docs/gdd.md`). CoffeeChain 3D übernimmt daraus den **Farmer-Pfad** (GDD Kap. 5), die **Bank** als Handelspartner (GDD 3.4, 11.3), und das **Balancing** (GDD 11). Die **Events** (GDD 11.8) entfallen vorerst (Robert 2026-10-25, #8). Neu gegenüber dem GDD sind die 3D-Welt, die Bodenqualität pro Parzelle und die Weltgenerierung.

### Ziele für v1
- Ein spielbarer Kreislauf: Lage und Boden wählen → Parzellen anlegen → Sorte pflanzen → pflegen → ernten → aufbereiten oder roh verkaufen → reinvestieren.
- Jede Welt ist anders (Seed). Lage und Bodenqualität erzwingen echte Standortentscheidungen.
- Läuft als native Mac-App, offline, Singleplayer.
- Alle Wirtschaftswerte stehen in `config/balance.json`, nicht im Code.

### Nicht-Ziele für v1
Aus dem GDD bewusst **nicht** übernommen:
- Café-Pfad (GDD Kap. 4) und Händler-Pfad (GDD Kap. 6)
- Kaffeebörse, Spielerhandel, Direkthandel, Exklusivverträge (GDD 3.3, 3.6), weil es keine anderen Spieler gibt
- Kooperationen, Rankings, KPI-Resets, Saisons (GDD Kap. 9, 10, 12.2)
- Graue Mechaniken (GDD Kap. 7)
- Monetarisierung und Werbeflächen (GDD Kap. 8)
- Personal (GDD 5.5, 11.7)
- Realwelt-Daten per API (GDD 2.2)
- Rösterei (GDD 5.4 Phase 4): kommt nach v1

---

## 2. Quellen

| Quelle | Pfad im Repo | Rolle |
|---|---|---|
| Game Design Document | `docs/gdd.md` | Spielmechanik und Ausgangswerte fürs Balancing |
| Balancing-Config | `config/balance.json` | Alle Zahlen, die der Code verwendet; mit Quellenangabe pro Wert |
| Screen-Entwürfe Tag 1 und Tag 12 | `docs/mockups/*.png` | Layout und Stil des HUD (Zahlen und „€“ dort sind Platzhalter, es gilt „CC“) |
| Dieses PRD | `PRD.md` | Scope, Architektur, Meilensteine, Akzeptanzkriterien |

**Regeln**
- Für Spielmechanik gilt das GDD, außer dieses PRD weicht ausdrücklich ab. Abweichungen sind hier mit **„Abweichung vom GDD“** markiert.
- Jeder Wert in `config/balance.json` hat eine Quelle: `GDD <Abschnitt>`, `PRD` (bewusste Abweichung) oder `NEU` (im GDD nicht vorhanden, Startwert zum Testen).
- Werte mit Quelle `NEU` werden in `docs/open-questions.md` geführt, bis Robert sie bestätigt.

---

## 3. Technische Entscheidungen

| Bereich | Entscheidung | Begründung |
|---|---|---|
| Sprache | TypeScript, `strict: true` | Robert kennt es, Claude Code ist stark darin |
| 3D | Three.js | Reiner Code, kein Editor nötig, gut testbar |
| UI / HUD | Vue 3 (Composition API) als Overlay über dem Canvas | Robert kennt Vue; HUD ist klassisches UI |
| State für UI | Pinia, liest nur aus dem Simulations-State | Klare Trennung von Simulation und Darstellung |
| Build | Vite | Standard, schnell |
| Desktop | Tauri 2 | Native Mac-App, klein, Dateizugriff für Spielstände |
| Noise | `simplex-noise` | Terrain, Lagen, Bodenqualität |
| Zufall | Eigener seedbarer PRNG (z. B. mulberry32) | Reproduzierbare Welten, Ernten und Tests |
| Config-Validierung | zod | Typen und Laufzeitprüfung aus einem Schema |
| Tests | Vitest (Logik), Playwright (Screenshot-Smoke-Tests) | Simulation testgetrieben, Visuals per Screenshot prüfbar |
| Assets | Low-Poly per Code; Gebäude und Deko aus Kenney-Paketen (CC0) | Kein Lizenzaufwand, einheitlicher Stil |

### Architektur

```
src/
  sim/            # Reine Spiellogik. Kein DOM, kein Three.js, kein Vue.
    world/        # Weltgenerierung, Parzellen, Lagen, Bodenwerte
    farm/         # Felder, Pflanzung, Wachstum, Pflege, Ernte, Ertrag
    processing/   # Aufbereitung (Washing/Natural)
    storage/      # Lager, Kapazität, Lagerkosten, Qualitätsverlust
    market/       # Bank: Preise, Ankauf, Verkauf, Preisverlauf
    economy/      # Kontostand, Transaktionen
    time/         # Spielzeit, Tick, Geschwindigkeit
    save/         # Serialisierung, Versionierung, Migration
    rng.ts
    state.ts      # GameState (rein serialisierbar)
    commands.ts   # Alle Spieleraktionen als Commands
  render/         # Three.js: Szene, Kamera, Meshes, Picking
  ui/             # Vue-Komponenten für das HUD
  app/            # Verdrahtung: Game Loop, Stores, Input
config/
  balance.json
  balance.schema.ts
assets/kenney/    # Ausgewählte Kenney-Modelle (glTF) + Lizenz
docs/
src-tauri/
tools/
  balance-sim.ts  # Bot-Simulation fürs Balancing (siehe M4)
```

**Grundregeln**
1. `sim/` ist deterministisch: gleicher Seed + gleiche Commands = gleicher State.
2. Spieleraktionen laufen nur über Commands (`CreateParcels`, `Plant`, `Fertilize`, `Irrigate`, `Harvest`, `Process`, `Sell`, `Buy`, `Build`). UI und Render ändern den State nie direkt.
3. Die Simulation läuft in festen Schritten: **1 Schritt = 1 Kalendertag**. Die Zeitstufe (§4) ändert nur, wie viele echte Sekunden ein Schritt dauert, nicht was er tut. Rendering läuft unabhängig mit `requestAnimationFrame`.
4. `GameState` ist reines JSON, ohne Klasseninstanzen und ohne Zyklen.
5. Geldbeträge werden intern als ganze Zahlen in **Hundertstel CC** gespeichert, damit keine Rundungsfehler entstehen (das GDD rechnet mit 0,4 oder 0,3 CC).

---

## 4. Spielzeit und Währung

- **Währung:** CoffeeCoins, angezeigt als „CC“ mit bis zu einer Nachkommastelle (GDD 8.1).
- **Kalender (Robert 2026-10-25, #27):** 12 Monate × 30 Tage, also 360 Tage pro Jahr (`time.monthsPerYear`, `time.daysPerMonth`). Das Spiel beginnt am 1. Januar, Jahr 1. Die Topbar zeigt Datum und Jahr, z. B. „12. März, Jahr 2“.
- **Abweichung vom GDD:** Die Zeit läuft in zwei Stufen statt in Spieltagen von 4 echten Stunden (GDD 11.1). Grund: Singleplayer ohne Idle-Betrieb, schneller Einstieg.
  - Stufe **„Monate“** ab Spielbeginn: 1 Monat dauert `time.realSecondsPerMonth` (20 s) bei 1×.
  - Stufe **„Wochen“**: 1 Woche dauert `time.realSecondsPerWeek` (20 s) bei 1×. So bleibt Zeit, den Markt zu beobachten.
  - Die Umschaltung auf Wochen kommt mit der Phase `time.weeksFromPhase` (Phase 2, 2.000 CC Kapital, §10). Sie geht nur vorwärts: Fällt das Kapital wieder unter die Grenze, bleibt die Stufe „Wochen“. Eine Meldung kündigt die Umschaltung an, und die aktuelle Einheit steht neben der Geschwindigkeit.
- Geschwindigkeiten aus `time.speeds`: Pause, 1×, 2×, 4×, 8×, 16×. Sie wirken zusätzlich zur Stufe.
- **Abweichung vom GDD:** Die Zeit läuft nur, solange das Spiel offen ist. Der Offline-Fortschritt aus GDD 2.1 entfällt.
- Eine Woche hat 7 Kalendertage (`time.daysPerWeek`, GDD 11.1). Die Stufe „Wochen“ rechnet damit die Dauer eines Tages aus.

---

## 5. Welt

### Generierung
- Eingabe: Seed (ganze Zahl von 0 bis 2^32 − 1), angezeigt als „Welt #48213“. Neues Spiel = zufälliger Seed, im Startbildschirm eingebbar oder neu würfelbar (Abschnitt 11). Gleicher Seed ergibt immer dieselbe Insel.
- Insel aus einem Raster quadratischer **Parzellen** (Startgröße 48 × 48, konfigurierbar), Form über Noise mit radialer Abschwächung, Wasser außenherum.
- Höhe über Noise. Sehr steile Parzellen sind nicht bebaubar.

### Lagen (aus GDD 5.3 abgeleitet)
Das GDD hat vier Regionen. In CoffeeChain 3D liegen drei Lagen als Zonen auf derselben Insel (Robert 2026-10-25, #17).

| Lage | Entstehung in der Welt | Passende Sorte | Landpreis |
|---|---|---|---|
| Tiefland | niedrige Höhe, Küstennähe | Robusta | niedrig |
| Hochland (gemäßigt) | mittlere Höhe | Arabica Standard | mittel |
| Hochland (kühl-trocken) | große Höhe | Arabica Premium, Spezialität | hoch |

- Der Spieler startet im Tiefland. Hochland ist von dort aus erreichbar.
- **NEU:** Pflanzt man eine Sorte außerhalb ihrer passenden Lage, sinkt der Ertrag (Startwert: ×0,6, `world.offZoneYieldFactor`). Das gilt für alle Sorten. Spezialität passt zu kühlem Hochland (Robert 2026-10-25, #17).

### Bodenqualität (NEU, nicht im GDD)
- Pro Parzelle: `fertility` (0–100), `waterRetention` (0–100), daraus `soilQuality` (0–1) und eine Klasse **Karg / Mittel / Gut / Sehr gut**.
- Ertragsfaktor je Klasse (Startwerte, `soil.yieldFactor`): Karg 0,6 · Mittel 0,85 · Gut 1,0 · Sehr gut 1,2. „Gut“ entspricht damit genau dem GDD-Ertrag.
- Jede Ernte senkt `fertility` leicht, Dünger stellt sie teilweise wieder her, Brache erholt den Boden langsam. Die Raten sind `NEU` und stehen in `soil.*`.
- **Startgarantie:** In Reichweite des Starts liegen mindestens 6 zusammenhängende Tiefland-Parzellen mit „Gut“ oder besser. Sonst wird neu generiert.
- Boden-Overlay umschaltbar: hell = karg, dunkel = sehr gut (Farben aus den Mockups). Zweites Overlay für Lagen.

### Platzierte Objekte
Hütte am Startpunkt, ein Markt am Ufer, ein Weg dazwischen, Bäume auf ungünstigen Parzellen.

---

## 6. Farm

### Parzellen und Felder
- **Abweichung vom GDD (Einheit):** Ein „Feld“ im GDD-Balancing entspricht in CoffeeChain 3D **einer Parzelle**. Alle Kosten und Erträge „pro Feld“ aus GDD 11.2 gelten pro Parzelle.
- Mehrere benachbarte Parzellen bilden ein benanntes Feld (Feld A, B, …). Das dient nur der Übersicht und gemeinsamen Aktionen.
- Parzelle anlegen kostet CC, abhängig vom Landpreis der Lage, und entfernt Bäume.
  - GDD-Anker (11.6): erstes Feld inkl. Robusta ca. 50 CC, zweites Feld 100 CC.
  - Startwerte (`parcels.firstCost`, `parcels.baseCost`, `parcels.zoneMultiplier`): Tiefland 15 CC für die erste Parzelle, danach Grundpreis 25 CC je Parzelle (Robert 2026-10-20, vorher 48 und 100 CC); Hochland ×1,5, kühles Hochland ×2. Die Multiplikatoren sind `NEU`.
  - Ab der zweiten Parzelle hängt der Preis von der Bodengüte ab (Faktor 0,5–1,5, `parcels.qualityFactor`). Die Güte mischt die eigene Bodenqualität zur Hälfte mit dem Mittel der vier Nachbarn (`parcels.neighborWeight`), höchstens `parcels.worseGap` über der eigenen. So kosten Nachbarn ähnlich viel, eine deutlich schlechtere Parzelle bleibt billig.
- Der Anbau läuft in **Zyklen** wie im GDD (5.4): pflanzen → wachsen → ernten. Nach der Ernte ist die Parzelle leer und wird neu bepflanzt (Saatgut kostet erneut).

### Sorten (GDD 5.2, 11.1, 11.2)

| Sorte | Zyklus | Saatgut | Ertrag pro Parzelle | Referenzwert/Einheit |
|---|---|---|---|---|
| Robusta | 3 Monate (90 Tage) | 2 CC | 20 Einheiten | 0,5 CC |
| Arabica Standard | 5 Monate (150 Tage) | 4 CC | 15 Einheiten | 1 CC |
| Arabica Premium | 10 Monate (300 Tage) | 8 CC | 8 Einheiten | 3 CC |
| Spezialität | 15 Monate (450 Tage) | 15 CC | 4 Einheiten | 10 CC |

- Die Zyklen sind Zwischenwerte bis #6 (mehrjährige Pflanzen).
- Zu Beginn sind Robusta und Arabica Standard freigeschaltet. Arabica Premium ab 2.000 CC Kapital, Spezialität ab 10.000 CC (Übergänge Phase 1 → 2 → 3 aus GDD 12.1).
- Mengen werden in **Einheiten** geführt (wie im GDD), nicht in kg.

### Pflege während des Wachstums (GDD 5.4, 11.2)

| Maßnahme | Kosten pro Parzelle und Zyklus (R / AS / AP / S) | Wirkung |
|---|---|---|
| Dünger | 1 / 2 / 4 / 6 CC | Ertrag steigt (Startwert: +25 %, `NEU`) und `fertility` wird teilweise aufgefüllt |
| Bewässerung | 1 / 2 / 3 / 5 CC | Kein Einfluss auf den Ertrag in v1 (die Events entfallen, #8) |

Jede Maßnahme kann einmal pro Zyklus und Parzelle angewendet werden, solange die Pflanze noch nicht reif ist. Den Dünger bezahlt der Spieler mit den Pflegekosten der Sorte, ein eigenes Dünger-Lager gibt es in v1 nicht.

### Wachstum und Darstellung
Sichtbare Phasen innerhalb eines Zyklus: **Setzling (0–25 %) → Wachstum (25–60 %) → Blüte (60–90 %) → Fruchtansatz (90–100 %) → Reif**. Die Prozentgrenzen stehen in `farm.visualStages`. Sie sind nur Optik und ändern nichts an der Zykluslänge.

### Ertrag
```
menge = basisErtrag(sorte)
      × soil.yieldFactor[bodenklasse]
      × (lagePasst ? 1 : world.offZoneYieldFactor)
      × (gedüngt ? 1 + farm.fertilizerYieldBonus : 1)
      × zufall             // seedbar, Startwert 0,9–1,1 (GDD 5.4: „Zufall“)
```
- Ergebnis auf ganze Einheiten abgerundet.
- **Qualität** (GDD 5.4: Sorte + Pflege + Zufall) wird als Wert 0–100 pro Charge berechnet und angezeigt. Die Bank zahlt unabhängig von der Qualität. Einen Preiseffekt hat sie über Aufträge virtueller Käufer (Mindestqualität, Aufpreis über der Bank, siehe Abschnitt 12, Punkt 4).
- `sim/farm/yield.ts` ist eine reine Funktion mit Tabellentests.

### Überreife (NEU, im Entwurf)
- Reife Pflanzen bleiben 2 Monate (60 Tage) bei voller Menge, danach verlieren sie 15 % der Menge pro Monat (`farm.overripe.lossPerDay` 0,005 pro Tag).
- Erzeugt Erntedruck. Muss von Robert bestätigt werden, bis dahin abschaltbar (`farm.overripe.enabled`).

---

## 7. Lager und Aufbereitung

### Lager (GDD 5.5, 6.5)
- Kapazität in Einheiten, Start: 100 Einheiten (`NEU`). Ausbaustufen über das Bauen-Menü.
- Lagerkosten pro Einheit und Monat, gebucht am Monatswechsel (Startwert: 0,02 CC, `NEU`).
- Qualitätsverlust über die Zeit: Rohkaffee langsam (Startwert: −1 Qualitätspunkt pro Monat, am Monatswechsel, `NEU`).
- Ernte über Kapazität: Die Ernte wird nur so weit eingefahren, wie Platz ist. Der Rest bleibt an der Pflanze (und kann überreif werden). Der Spieler bekommt eine Meldung.

### Aufbereitung (GDD 5.4 Phase 4, 11.2)
- Ersetzt den „Trockenplatz“ aus den Mockups. Im GDD heißt das **Washing/Natural** und ist dort bereits definiert.
- Gebäude „Aufbereitung“ muss gebaut werden. Kosten: Startwert 150 CC (`NEU`, angelehnt an GDD 11.6 „Aufbereitung + Einkauf ~150 CC“).
- Kosten 0,3 CC pro Einheit, Wert danach +50 % (GDD 11.2).
- Dauer: 1 Monat (30 Tage) pro Charge (`NEU`), Kapazität 50 Einheiten pro Charge (`NEU`).

---

## 8. Markt (die Bank)

**Abweichung vom GDD:** Im Singleplayer gibt es keine Mitspieler. Der Markt besteht in v1 nur aus der **Bank** (GDD 3.4). Sofortmarkt-Angebote von Spielern und die Kaffeebörse entfallen.

- Ein Markt in der Welt („Markt Santa Rosa“), erreichbar über das HUD oder per Klick auf die Stände.
- **Die Bank kauft:** Rohkaffee aller Sorten, aufbereiteten Kaffee.
- **Die Bank verkauft:** nur Saatgut. Saatgut wird auch direkt beim Pflanzen gekauft, der Markt ist dann nur ein Weg mehr. Dünger bezahlt der Spieler mit der Pflegemaßnahme, Ausbauten baut er.
- **Referenzpreise und Spread (GDD 11.3):** Die Bank kauft für 80 % des Marktpreises und verkauft Saatgut zum Marktpreis.
- **Preisbildung pro Ware (GDD 3.4, 11.3):**
  ```
  preis = referenz × angebotsFaktor × nachfrageFaktor
  angebotsFaktor  0,7–1,1   sinkt mit der Menge, die der Spieler in den letzten 3 Monaten (90 Tage, `market.volumeWindowDays`) verkauft hat
  nachfrageFaktor 0,9–1,3   steigt mit der Menge, die der Spieler in den letzten 3 Monaten gekauft hat
  Ergebnis immer zwischen 50 % und 150 % des Referenzpreises
  ```
  Wie stark die Faktoren auf Mengen reagieren und wie schnell sie zurückkehren, ist `NEU` (`market.*`).
- Keine Transaktionsgebühren bei der Bank (GDD 3.7).
- Preisverlauf der letzten 12 Monate (`market.historyMonths`) pro Ware, ein Punkt pro Monat, im Markt-Panel als Linie.
- Keine Öffnungszeiten.

---

## 9. Events (GDD 11.8)

Events entfallen vorerst (Robert 2026-10-25, #8). Das Spiel hat keine Zufallsevents (Frost, Monsun, Marktboom, Marktkrise, Schädlinge, Forschungsdurchbruch). Der Kernkreislauf soll zuerst stabil sein. Kommen Events zurück, brauchen sie ein klares Signal mit Erklärung, Restdauer und Wirkung.

Die alten Werte stehen in `docs/gdd.md` 11.8.

---

## 10. Progression

- **Startkapital: 500 CC** (GDD 11.6).
- Phasen nach GDD 12.1, gemessen am **Kapital** = Kontostand + Lagerwert zum Bank-Ankaufspreis + Anlagekosten aller Parzellen und Gebäude. Das GDD definiert „Kapital“ nicht. Die Anlagekosten zählen mit, damit Reinvestieren den Aufstieg nicht bremst (Quelle: `PRD`).

| Phase | Kapital | Freischaltung |
|---|---|---|
| 1: Einstieg | 500 → 2.000 CC | Robusta, Arabica Standard, Aufbereitung |
| 2: Wachstum | 2.000 → 10.000 CC | Arabica Premium, Lager-Ausbau Stufe 2 |
| 3: Spezialisierung | ab 10.000 CC | Spezialität |

- Meilensteine aus GDD 12.3, soweit für den Farmer relevant: „Ernte-Profi“ (1.000 Einheiten geerntet → +5 % Erntequalität dauerhaft).
- **Tutorial** als Checkliste „Erste Schritte“ (siehe Mockup Tag 1):
  1. Boden-Overlay einschalten und eine gute Tiefland-Parzelle wählen
  2. Erste Parzelle anlegen
  3. Robusta pflanzen
  4. Düngen
  5. Ernten und an die Bank verkaufen

---

## 11. Darstellung und Bedienung

### Kamera
- Isometrisch wirkende Perspektive (orthografische Kamera, ca. 45° gedreht, ca. 35° geneigt).
- Steuerung: Ziehen mit rechter Maustaste oder WASD zum Verschieben, Mausrad zum Zoomen, Q/E zum Drehen in 90°-Schritten.

### Stil
- Low Poly, flache Farben, keine Texturen. Vorbild: die Mockups.
- Terrain als ein zusammenhängendes Mesh pro Chunk mit Vertex-Farben, keine Einzelmeshes pro Parzelle.
- Kaffeepflanzen per Code erzeugt, eine Variante pro sichtbarer Phase und Sorte (Farbe/Größe), gerendert mit `InstancedMesh`.
- Gebäude und Deko: Kenney (Nature Kit, Survival Kit, City Kit Suburban, Fantasy Town Kit). Nur benötigte Modelle ins Repo, Lizenzdatei dazu.

### Startbildschirm (Issue #3, Entwurf A „Inselansicht“)
- Beim Start zeigt die App zuerst den Startbildschirm, nicht sofort die Welt. Vorlage: `docs/mockups/start-screen/startscreen-a-*.png` (ohne Vulkan).
- Hintergrund ist die echte Szene: die ganze Insel des Seeds bzw. des Spielstands, mittig im freien Bereich rechts vom Panel (schmal: über dem Panel), ohne Drehen und Zoomen. Links ein dunkelbraunes Panel im HUD-Stil.
- Ohne lesbaren Autosave: Seed-Feld, Knopf für einen neuen Zufalls-Seed und „Spiel starten“. Jede Seed-Änderung zeigt die Insel neu. „Spiel starten“ startet genau diese Welt. Einen unlesbaren Autosave überschreibt erst der Monats-Autosave.
- Mit Autosave: „Willkommen zurück“ mit Kalenderdatum, „Welt #<Seed>“ und CC des Autosaves. „Weiterspielen“ lädt ihn. „Neues Spiel“ fragt erst „Das laufende Spiel geht verloren“ und zeigt danach das Seed-Feld mit „Zurück zum Spielstand“. „Spiel starten“ schreibt dann die neue Welt sofort in den Autosave.
- „Neues Spiel“ im Spielstand-Dialog öffnet nach der Bestätigung den Startbildschirm mit dem Seed-Feld.
- `?seed=<n>` und `?debug=models` überspringen den Startbildschirm (e2e-Tests, Debug-Links). Ein „Laden“ im Spiel überspringt ihn auch.
- Später (eigener Job): Spielstandliste rechts mit Speicherzeit, Lageanteile und Hütten-Hinweis unter dem Seed-Feld.

### HUD (Vue)
Aufbau wie in den Mockups:
- **Topbar:** Spielname, Welt-Seed, Datum mit Jahr (z. B. „12. März, Jahr 2“) und Zeiteinheit („Monate“/„Wochen“), Geschwindigkeit, CC, Lagerstand.
- **Links:** Tutorial-Checkliste bzw. Feldübersicht, darunter Meldungen (z. B. „Feld A ist erntereif“, „Lager voll“).
- **Rechts:** Kontextpanel, entweder Parzellen-Inspektor (Lage, Boden, passende Sorte, Ertragsprognose, Aktion) oder Markt.
- **Unten:** Werkzeugleiste: Auswählen, Parzelle, Pflanzen, Düngen, Wässern, Ernten, Bauen, Markt.
- Die Ertragsprognose im Inspektor nutzt dieselbe Funktion wie die Simulation (`yield.ts`, ohne Zufall).
- Sprache: Deutsch, Texte in `src/ui/i18n/de.json`.

### Performance-Ziel
60 fps auf einem Mac mit Apple Silicon (M1 oder neuer) bei 48 × 48 Parzellen und 2.000 Pflanzen.

---

## 12. Offene Entscheidungen

| # | Frage | Vorschlag | Status |
|---|---|---|---|
| 1 | **Das Farmer-Balancing aus dem GDD ist allein zu langsam.** Robusta bringt pro Parzelle 20 × 0,4 CC = 8 CC an die Bank, minus 2 CC Saatgut, also 6 CC je 3 Spieltage. Mit dem Startkapital lassen sich 5 Parzellen anlegen, das ergibt 10 CC pro Spieltag. Grobe Rechnung ohne Dünger, Events und Lagerkosten: Wer danach nur spart, braucht rund 195 Spieltage bis 2.000 CC (ca. 13 Stunden Spielzeit). Wer alles sofort in neue Parzellen steckt, braucht rund 72 Spieltage (ca. 5 Stunden), wenn man die Parzellen zum Kapital zählt. Das GDD sieht für Phase 1 aber nur 4 Spielwochen vor, also 28 Spieltage. Außerdem ist das GDD hier nicht einheitlich (11.10: „~8 CC/Tag“, aber „~175 CC/Woche“). | Erst in M4 mit der Bot-Simulation messen. Danach eine von drei Stellschrauben drehen: günstigere Parzellen (z. B. 20 CC flach), höhere Erträge pro Parzelle oder niedrigere Phasengrenzen. | offen, blockiert nicht |
| 2 | Überreife übernehmen? | Ja, 2 Monate (60 Tage), dann −15 % pro Monat | offen |
| 3 | Wie lang dauern die Zeitstufen? | 1 Monat = 20 s und 1 Woche = 20 s bei 1× | Kalender entschieden 2026-10-25 (#27). Sekunden pro Stufe offen bis zum Play-Test |
| 4 | Soll die Qualität einer Charge den Verkaufspreis beeinflussen? | Ja, ab v1.1: Preis × (0,8 + 0,4 × Qualität/100) | entschieden 2026-10-21: über Aufträge virtueller Käufer mit Mindestqualität und Aufpreis; die Bank bleibt ohne Qualitätsfaktor |
| 5 | Alle mit `NEU` markierten Startwerte (Bodenfaktoren, Lagerkosten, Zonen-Multiplikatoren, Düngerbonus …) | Nach M4-Bot-Simulation gemeinsam prüfen | offen |
| 6 | Name der Mac-App | „CoffeeChain“ | offen |
| 7 | Event-Effekte über ±30 % im GDD (Monsun-Zykluszeit +50 %) | PRD-Grenze ±30 % gilt | entschieden 2026-10-21; entfällt mit den Events (Robert 2026-10-25, #8) |
| 8 | Kontostand mit Nachkommastellen? | Nein: CC sind immer ganze Zahlen; jede Buchung wird auf ganze CC gerundet | entschieden 2026-10-21 |

---

## 13. Meilensteine und Akzeptanzkriterien

Jeder Meilenstein endet mit: grünen Tests, `npm run build` ohne Fehler, Screenshot in `docs/progress/<meilenstein>.png`.

### M0: Grundgerüst
- Vite + TypeScript + Vue + Three.js + Tauri 2 eingerichtet, startet als Mac-App.
- Vitest und Playwright laufen, ESLint und Prettier konfiguriert.
- `config/balance.json` wird über das zod-Schema geladen; ungültige Config bricht den Start mit klarer Fehlermeldung ab.
- ✅ Leere Szene mit Wasserfläche, drehbarer Kamera und leerem HUD-Rahmen.
- ✅ Test: Die mitgelieferte `balance.json` ist gültig, und jeder Wert hat eine Quellenangabe.

### M1: Welt
- Seedbare Weltgenerierung mit Höhe, Lagen und Bodenwerten.
- Terrain-Mesh mit Vertex-Farben, Bäume, Hütte, Markt, Weg.
- Overlays für Boden und Lage, Parzellen-Auswahl per Klick mit Inspektor.
- ✅ Test: Gleicher Seed erzeugt identische Welt (Hash-Vergleich).
- ✅ Test: Jede von 200 zufälligen Welten erfüllt die Startgarantie und hat nur die Lagen Tiefland, Hochland und kühles Hochland.

### M2: Zeit, Parzellen und Anbau
- Spielzeit mit Pause, 1×, 2×, 4×.
- Parzellen anlegen (Einzel- und Mehrfachauswahl), Kosten nach Lage, Felder benennen.
- Pflanzen von Robusta und Arabica Standard, sichtbare Wachstumsphasen.
- ✅ Test: Robusta ist nach exakt 90 Kalendertagen reif, bei 1× und bei 4×.
- ✅ Test: Die erste Tiefland-Parzelle kostet 15 CC, jede weitere 25 CC × Bodenfaktor (S21d).

### M3: Pflege, Ernte und Lager
- Düngen, Wässern, Ernten, Ertragsformel, Bodenverbrauch.
- Lager mit Kapazität, Lagerkosten, Qualitätsverlust, Überreife (abschaltbar).
- ✅ Test: Robusta auf „Gut“, passende Lage, ohne Dünger, Zufall fixiert auf 1,0 → genau 20 Einheiten.
- ✅ Test: Tabellentests der Ertragsformel für alle Sorten und Bodenklassen.
- ✅ Test: Ernte über Lagerkapazität lagert nur bis zur Grenze ein, der Rest bleibt an der Pflanze.

### M4: Markt und Balancing-Messung
- Bank mit Ankauf und Verkauf, Preisformel, Preisverlauf.
- `tools/balance-sim.ts`: ein Bot spielt ohne Grafik über 6.000 Kalendertage (200 Monate, ca. 16,7 Jahre) (pflanzen, düngen, ernten, verkaufen, reinvestieren in neue Parzellen) auf 20 verschiedenen Seeds.
- ✅ Test: Die Bank kauft Robusta bei neutralem Markt für 0,4 CC und verkauft Saatgut zum Wert aus `balance.json`.
- ✅ Test: Preise bleiben über 1.000 simulierte Tage immer zwischen 50 % und 150 % der Referenz.
- ✅ Ergebnis: `docs/balance-report.md` mit Kapitalkurve, Kalendertag beim Erreichen von 2.000 und 10.000 CC und einer Empfehlung zu Abschnitt 12, Punkt 1. **Hier stoppt Claude Code und wartet auf Roberts Entscheidung, bevor Werte geändert werden.**

### M5: Speichern und Tutorial
- Spielstände speichern und laden über Tauri (`~/Library/Application Support/CoffeeChain/saves`), mit Versionsnummer und Migrationen.
- Autosave 1× pro Monat.
- Tutorial-Checkliste aus Abschnitt 10.
- ✅ Test: Speichern → Laden → 50 Tage weiterspielen ergibt denselben State wie ohne Unterbrechung.

### M6: Aufbereitung, Bauen und Progression
- Bauen-Menü: Aufbereitung, Lager-Ausbau.
- Aufbereitung mit Kosten, Dauer und Wertsteigerung nach Abschnitt 7.
- Phasen und Freischaltungen nach Abschnitt 10, Arabica Premium und Spezialität.
- ✅ Test: 10 Einheiten Arabica Standard roh (Referenz 1,0 CC) werden aufbereitet zu Referenzwert 1,5 CC je Einheit, Kosten 3 CC.

### M7: Feinschliff
- ~~Events nach Abschnitt 9 mit Vorwarnung im HUD.~~ Entfällt vorerst (Robert 2026-10-25, #8).
- Meldungen, Tooltips, Tastenkürzel.
- ~~Test: Über 1.000 simulierte Tage sind nie mehr als 2 Events gleichzeitig aktiv, und kein Effekt liegt außerhalb von ±30 %.~~ Entfällt mit den Events (#8).
- ✅ Spielbarer Durchlauf von Tag 1 bis Tag 30 ohne Fehler, als Screenshot-Serie.
- ✅ Performance-Ziel aus Abschnitt 11 erreicht.

---

## 14. Später (nach v1)

- Rösterei (GDD 5.4, 11.2: +150 %, 0,8 CC pro Einheit)
- Personal: Feldarbeiter und Agrar-Spezialist (GDD 5.5, 11.7)
- Versicherung (GDD 5.6)
- Dürre als eigenes Event
- Café- und Händler-Pfad
- Englische Lokalisierung, Steam-Release, Windows-Build

---

## 15. Definition of Done (für jeden Pull Request)

- Typecheck, Lint und Tests grün.
- Neue Spiellogik in `sim/` hat Unit-Tests.
- Keine Zahlen im Code, die ins Balancing gehören.
- Sichtbare Änderungen mit Screenshot im PR-Text.
- Neue `NEU`-Werte sind in `docs/open-questions.md` eingetragen.
