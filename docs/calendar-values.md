# Kalenderzeit: neue Werte (#27)

Entscheidung Robert, 2026-10-25. Quelle: Issue #27 und die Klärung im Factory-Import. Läuft nach #8 (Events raus) und #17 (Vulkan raus).

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
| Sim-Schritt (`time.ticksPerGameDay`) | 24 (1 Tick = 1 Stunde) | entfällt, 1 Schritt = 1 Kalendertag | ok | – | Bot läuft 6.000 Schritte. Ein zweiter Lauf gibt denselben Report. |
| Kalender | – | 12 Monate × 30 Tage = 360 Tage, Start 1. Januar, Jahr 1 | ok | offen | 6.000 Tage (≈ 16,7 Jahre) laufen ohne Fehler durch. |
| Stufe „Monate“ (ersetzt `time.realSecondsPerGameDay` 240) | 1 Tag = 240 s | 1 Monat = 20 s bei 1× (1 Tag ≈ 0,67 s) | – | offen | |
| Stufe „Wochen“ | – | 1 Woche = 20 s bei 1× (1 Monat ≈ 86 s, 1 Jahr ≈ 17 min) | – | offen | |
| Umschaltung Monate → Wochen | – | ab Phase 2 (2.000 CC), nur vorwärts | ok | offen | Bot erreicht Phase 2 im Median an Tag 1.188 (Jahr 4). Das sind ≈ 13 min bei 1× in der Monatsstufe. |
| `time.weeksFromPhase` | – | 2 (`NEU`) | ok | offen | Der Wert für die Umschaltung in der Zeile oben. |
| `time.speeds` | 0, 1, 2, 4, 8, 16 | bleibt, wirkt zusätzlich zur Stufe | – | offen | |
| `time.daysPerWeek` | 7 | 7 (bleibt) | – | – | |

Echtzeit-Folge: Ein alter Spieltag (240 s) wird ein Monat. In der Monatsstufe
dauert er 20 s (12× schneller als heute), in der Wochenstufe ≈ 86 s (≈ 2,8×
schneller).

## Farm

| Wert | Alt | Neu (Kalendertage) | Lesart | Sim | Spiel | Notiz |
|---|---|---|---|---|---|---|
| `varieties.robusta.cycleDays` | 3 | 90 | 3 Monate, bei 1× ≈ 60 s | ok | offen | Bot pflanzt Robusta im Tiefland. Zwischenstand bis #6 |
| `varieties.arabicaStandard.cycleDays` | 5 | 150 | 5 Monate, ≈ 100 s | ok | offen | Bot pflanzt Arabica Standard im Hochland. Zwischenstand bis #6 |
| `varieties.arabicaPremium.cycleDays` | 10 | 300 | 10 Monate; in Phase 2 (Wochen) ≈ 14 min | – | offen | Bot pflanzt die Sorte nicht. Zwischenstand bis #6 |
| `varieties.specialty.cycleDays` | 15 | 450 | 15 Monate; in Phase 3 (Wochen) ≈ 21 min | – | offen | Bot pflanzt die Sorte nicht. Zwischenstand bis #6; wächst ab #17 auf kühlem Hochland |
| `farm.overripe.graceDays` | 2 | 60 | 2 Monate | – | offen | Bot erntet jeden Tag, seine Pflanzen werden nie überreif. |
| `farm.overripe.lossPerDay` | 0,15 | 0,005 | 15 % pro Monat | – | offen | Wie `graceDays`: im Bot nie überreif. |
| `soil.fertilityRecoveryPerFallowDay` | 0,5 | 0,5 pro Monat, am Monatswechsel | monatlich gebucht | – | – | Bot pflanzt am Erntetag neu, die Parzellen liegen kaum brach. |
| `processing.washed.durationDays` | 1 | 30 | 1 Monat | – | offen | Bot bereitet nicht auf. |
| `progression.harvestProMessageDays` | 1 | 30 | 1 Monat | – | offen | |

## Lager

| Wert | Alt | Neu | Lesart | Sim | Spiel | Notiz |
|---|---|---|---|---|---|---|
| `storage.costPerUnitPerDay` | 0,02 pro Tag | 0,02 pro Monat, am Monatswechsel | 1 CC je angefangene 50 Einheiten pro Monat (Regel „nur ganze CC“) | – | offen | Bot verkauft vor jedem Monatswechsel das ganze Lager. Er zahlt keine Lagerkosten. |
| `storage.qualityLossPerDayRaw` | 1 pro Tag | 1 pro Monat, am Monatswechsel | | – | offen | Wie Lagerkosten: Das Lager des Bots ist am Monatswechsel leer. |

## Markt und Aufträge

| Wert | Alt | Neu | Lesart | Sim | Spiel | Notiz |
|---|---|---|---|---|---|---|
| `market.volumeWindowDays` | 3 | 90 | 3 Monate | ok | offen | Bot verkauft jeden Tag an die Bank, das Fenster senkt seinen Preis mit. Der Report hat keinen eigenen Messwert dafür. |
| `market.historyMonths` | 14 Tage | 12 Monate, 1 Punkt pro Monat | rollend: die letzten 12 Monate bis heute, Beschriftung nur an den Enden (z. B. „Mai“ … „Apr“) | – | offen | Alter Name: `historyDays`. Offen für Robert: feste Achse Jan–Dez statt rollend? |
| `orders.chancePerDay` | 0,3 | 0,01 | 0,3 pro Monat | – | offen | Bot nimmt keine Aufträge an. |
| `orders.deadlineDays` | 5–10 | 150–300 | 5–10 Monate | – | offen | Bot nimmt keine Aufträge an. |

## Events

Entfällt (#8): Events und Schädlingsschutz werden mit #8 vollständig entfernt (Robert 2026-10-25). Kommen Events später zurück, hängen Frost und Monsun an Kalendermonaten (Saisons) statt an Zufallsintervallen.

## Speichern, Anzeige, Balance-Bot

| Wert | Alt | Neu | Sim | Spiel | Notiz |
|---|---|---|---|---|---|
| Autosave | 1× pro Tag | 1× pro Monat | – | offen | |
| Topbar | „Tag 12, 14:00“ | „12. März, Jahr 2“ + Einheit „Monate“/„Wochen“ | – | offen | |
| UI-Dauern (Toasts, Münzen) | Echtzeit | bleibt Echtzeit | – | offen | |
| `balanceSim.days` | 200 | 6.000 (200 Monate ≈ 16,7 Jahre) | ok | – | Median bis 10.000 CC an Tag 2.733,5. Der Lauf deckt Phase 1 und 2 ganz ab. |
| `balanceSim.phase1TargetDays` | 28 (PRD 12) | 840 (28 Monate) | ändern | – | Median bis 2.000 CC an Tag 1.188 (39,6 Monate), Faktor 1,4 über dem Ziel. Der Report empfiehlt höhere Erträge oder niedrigere Phasengrenzen. Robert entscheidet nach M4. |

## Prüfplan

**Simulation** (`npm run balance-sim`, Ergebnis in `docs/balance-report.md`):
1. Median der Tage bis 2.000 CC nahe 840 Tagen (28 Monate)?
2. Wie lange dauert Phase 1 in Echtzeit bei 1× (Monatsstufe, 20 s pro Monat)? Ziel: schneller Einstieg.
3. Bleibt das Lager pro Monat bezahlbar, und lohnt sich der Lager-Ausbau noch?
4. Wie viele Aufträge pro Jahr, und schafft der Bot sie in der Frist?

**Ergebnis Bot-Lauf 2026-10-25** (`docs/balance-report.md`, 20 Seeds, 6.000 Tage):
1. Median bis 2.000 CC: Tag 1.188 (39,6 Monate). Das Ziel von 840 Tagen ist nicht erreicht (Faktor 1,4). Vor #27 war es Tag 42 von 28 Spieltagen (Faktor 1,5).
2. Phase 1 dauert im Median ≈ 13 min bei 1× (39,6 Monate × 20 s). Phase 2 bis 10.000 CC (Tag 2.733,5) dauert danach in der Wochenstufe ≈ 74 min bei 1×.
3. Nicht gemessen: Der Bot verkauft das ganze Lager vor jedem Monatswechsel und baut das Lager nicht aus.
4. Nicht gemessen: Der Bot nimmt keine Aufträge an.

Der Report nutzt noch alte Bezeichnungen: „Spieltage“, „Tag 6000“, „Jeden Spieltag erntet er“ und „Ziel von 840 Spieltagen (GDD: 4 Spielwochen)“. Gemeint sind Kalendertage. Das Ziel ist 28 Monate. Der Generator `tools/balance-sim.ts` bleibt in diesem Job unverändert.

**Echtes Spiel** (`npm run tauri dev`, danach `npm run run30` angepasst):
1. Erste Ernte: Robusta nach ≈ 60 s bei 1×. Fühlt sich das gut an?
2. Überreife: 2 Monate ≈ 40 s bei 1×, bei 16× ≈ 2,5 s. Bemerkt man das rechtzeitig (#12)?
3. Umschaltung auf Wochen bei 2.000 CC: Meldung sichtbar? Bleibt Zeit, den Markt zu beobachten?
4. Lesbarkeit von Datum und Einheit in der Topbar bei 1440, 800 und 390 px.
5. Autosave 1× pro Monat: bei 16× in der Monatsstufe alle 1,25 s. Ruckelt oder stört das?
