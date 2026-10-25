# Kalenderzeit: neue Werte (#27)

Entscheidung Robert, 2026-10-25. Quelle: Issue #27 und die Klärung im Factory-Import.

**Faktor 30:** Ein alter Spieltag wird ein Monat (30 Kalendertage). Raten pro Tag
gelten künftig pro Monat, Dauern in Tagen werden ×30. Geänderte Werte bekommen in
`config/balance.json` die Quelle `src: "Robert 2026-10-25 (#27, Faktor 30)"`, neue
Werte `src: "NEU"`.

Alle Werte sind Startwerte. Sie werden mit `npm run balance-sim` (Spalte **Sim**) und
im echten Spiel (Spalte **Spiel**) geprüft. Status: `offen`, `ok`, `ändern` (mit
Notiz).

## Zeitbasis

| Wert | Alt | Neu | Sim | Spiel | Notiz |
|---|---|---|---|---|---|
| Sim-Schritt (`time.ticksPerGameDay`) | 24 (1 Tick = 1 Stunde) | entfällt, 1 Schritt = 1 Kalendertag | offen | – | |
| Kalender | – | 12 Monate × 30 Tage = 360 Tage, Start 1. Januar, Jahr 1 | offen | offen | |
| Stufe „Monate“ (ersetzt `time.realSecondsPerGameDay` 240) | 1 Tag = 240 s | 1 Monat = 20 s bei 1× (1 Tag ≈ 0,67 s) | – | offen | |
| Stufe „Wochen“ | – | 1 Woche = 20 s bei 1× (1 Monat ≈ 86 s, 1 Jahr ≈ 17 min) | – | offen | |
| Umschaltung Monate → Wochen | – | ab Phase 2 (2.000 CC), nur vorwärts | offen | offen | |
| `time.speeds` | 0, 1, 2, 4, 8, 16 | bleibt, wirkt zusätzlich zur Stufe | – | offen | |
| `time.daysPerWeek` | 7 | 7 (bleibt) | – | – | |

Echtzeit-Folge: Ein alter Spieltag (240 s) wird ein Monat. In der Monatsstufe
dauert er 20 s (12× schneller als heute), in der Wochenstufe ≈ 86 s (≈ 2,8×
schneller).

## Farm

| Wert | Alt | Neu (Kalendertage) | Lesart | Sim | Spiel | Notiz |
|---|---|---|---|---|---|---|
| `varieties.robusta.cycleDays` | 3 | 90 | 3 Monate, bei 1× ≈ 60 s | offen | offen | Zwischenstand bis #6 |
| `varieties.arabicaStandard.cycleDays` | 5 | 150 | 5 Monate, ≈ 100 s | offen | offen | Zwischenstand bis #6 |
| `varieties.arabicaPremium.cycleDays` | 10 | 300 | 10 Monate; in Phase 2 (Wochen) ≈ 14 min | offen | offen | Zwischenstand bis #6 |
| `varieties.specialty.cycleDays` | 15 | 450 | 15 Monate; in Phase 3 (Wochen) ≈ 21 min | offen | offen | Zwischenstand bis #6 |
| `farm.overripe.graceDays` | 2 | 60 | 2 Monate | offen | offen | |
| `farm.overripe.lossPerDay` | 0,15 | 0,005 | 15 % pro Monat | offen | offen | |
| `soil.fertilityRecoveryPerFallowDay` | 0,5 | 0,5 pro Monat, am Monatswechsel | monatlich gebucht | offen | – | |
| `processing.washed.durationDays` | 1 | 30 | 1 Monat | offen | offen | |
| `progression.harvestProMessageDays` | 1 | 30 | 1 Monat | – | offen | |

## Lager

| Wert | Alt | Neu | Lesart | Sim | Spiel | Notiz |
|---|---|---|---|---|---|---|
| `storage.costPerUnitPerDay` | 0,02 pro Tag | 0,02 pro Monat, am Monatswechsel | 1 CC je angefangene 50 Einheiten pro Monat (Regel „nur ganze CC“) | offen | offen | |
| `storage.qualityLossPerDayRaw` | 1 pro Tag | 1 pro Monat, am Monatswechsel | | offen | offen | |

## Markt und Aufträge

| Wert | Alt | Neu | Lesart | Sim | Spiel | Notiz |
|---|---|---|---|---|---|---|
| `market.volumeWindowDays` | 3 | 90 | 3 Monate | offen | offen | |
| `market.historyDays` | 14 Tage | 12 Monate, 1 Punkt pro Monat, Achse Jan–Dez | | – | offen | |
| `orders.chancePerDay` | 0,3 | 0,01 | 0,3 pro Monat | offen | offen | |
| `orders.deadlineDays` | 5–10 | 150–300 | 5–10 Monate | offen | offen | |

## Events

| Wert | Alt | Neu | Lesart | Sim | Spiel | Notiz |
|---|---|---|---|---|---|---|
| `events.maxDurationDays` | 7 | 210 | 7 Monate | offen | – | |
| `events.warningDays` | 1 | 30 | 1 Monat | offen | offen | |
| `events.graceDaysAtStart` | 5 | 150 | 5 Monate | offen | – | |
| Frost: `durationDays` / `everyDays` | 3–5 / 14 | 90–150 / 420 | | offen | offen | |
| Monsun: `durationDays` / `everyDays` | 5–7 / 21 | 150–210 / 630 | | offen | offen | |
| Boom: `durationDays` / `everyDays` | 3 / 14 | 90 / 420 | | offen | offen | |
| Krise: `durationDays` / `everyDays` | 3 / 21 | 90 / 630 | | offen | offen | |
| Schädlinge: `durationDays` / `everyDays` | 2–4 / 28 | 60–120 / 840 | | offen | offen | |
| Forschung: `everyDays` | 42 | 1.260 | 3,5 Jahre | offen | – | |

## Speichern, Anzeige, Balance-Bot

| Wert | Alt | Neu | Sim | Spiel | Notiz |
|---|---|---|---|---|---|
| Autosave | 1× pro Tag | 1× pro Monat | – | offen | |
| Topbar | „Tag 12, 14:00“ | „12. März, Jahr 2“ + Einheit „Monate“/„Wochen“ | – | offen | |
| UI-Dauern (Toasts, Münzen) | Echtzeit | bleibt Echtzeit | – | offen | |
| `balanceSim.days` | 200 | 6.000 (200 Monate ≈ 16,7 Jahre) | offen | – | |
| `balanceSim.phase1TargetDays` | 28 (PRD 12) | 840 (28 Monate) | offen | – | |

## Prüfplan

**Simulation** (`npm run balance-sim`, Ergebnis in `docs/balance-report.md`):
1. Median der Tage bis 2.000 CC nahe 840 Tagen (28 Monate)?
2. Wie lange dauert Phase 1 in Echtzeit bei 1× (Monatsstufe, 20 s pro Monat)? Ziel: schneller Einstieg.
3. Bleibt das Lager pro Monat bezahlbar, und lohnt sich der Lager-Ausbau noch?
4. Wie viele Aufträge pro Jahr, und schafft der Bot sie in der Frist?
5. Events: wie viele pro Jahr, wie lange aktiv, nie mehr als 2 gleichzeitig?

**Echtes Spiel** (`npm run tauri dev`, danach `npm run run30` angepasst):
1. Erste Ernte: Robusta nach ≈ 60 s bei 1×. Fühlt sich das gut an?
2. Überreife: 2 Monate ≈ 40 s bei 1×, bei 16× ≈ 2,5 s. Bemerkt man das rechtzeitig (#12)?
3. Umschaltung auf Wochen bei 2.000 CC: Meldung sichtbar? Bleibt Zeit, den Markt zu beobachten?
4. Lesbarkeit von Datum und Einheit in der Topbar bei 1440, 800 und 390 px.
5. Event-Warnung 1 Monat: genug Zeit zu reagieren, in beiden Stufen?
6. Autosave 1× pro Monat: bei 16× in der Monatsstufe alle 1,25 s. Ruckelt oder stört das?
