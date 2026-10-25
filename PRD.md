# PRD: CoffeeChain 3D

**Status:** Entwurf v0.2 · 20.10.2026 (GDD-Werte eingearbeitet)
**Owner:** Robert
**Umsetzung:** Claude Code

---

## 1. Worum es geht

CoffeeChain 3D ist eine Aufbausimulation in 3D für den Mac. Man startet auf einer zufällig erzeugten Insel und baut eine Kaffeefarm auf. Der Boden ist unterschiedlich gut und die Insel hat verschiedene Lagen (Tiefland, Hochland, Vulkanboden). Beides bestimmt, welche Sorte wo gut wächst und wie viel man erntet. Die Ernte verkauft man auf dem Markt und kauft dort Saatgut, Dünger und Ausbauten.

Das Spiel basiert auf dem Browser-Konzept **CoffeeChain** (GDD in `docs/gdd.md`). CoffeeChain 3D übernimmt daraus den **Farmer-Pfad** (GDD Kap. 5), die **Bank** als Handelspartner (GDD 3.4, 11.3), das **Balancing** (GDD 11) und die **Events** (GDD 11.8). Neu gegenüber dem GDD sind die 3D-Welt, die Bodenqualität pro Parzelle und die Weltgenerierung.

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
- Realwelt-Daten per API (GDD 2.2): Events werden im Spiel zufällig erzeugt
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
| Zufall | Eigener seedbarer PRNG (z. B. mulberry32) | Reproduzierbare Welten, Events und Tests |
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
    events/       # Zufallsevents nach GDD 11.8
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
2. Spieleraktionen laufen nur über Commands (`CreateParcels`, `Plant`, `Fertilize`, `Irrigate`, `ProtectPests`, `Harvest`, `Process`, `Sell`, `Buy`, `Build`). UI und Render ändern den State nie direkt.
3. Die Simulation tickt in festen Schritten: **1 Tick = 1 Spielstunde**. Rendering läuft unabhängig mit `requestAnimationFrame`.
4. `GameState` ist reines JSON, ohne Klasseninstanzen und ohne Zyklen.
5. Geldbeträge werden intern als ganze Zahlen in **Hundertstel CC** gespeichert, damit keine Rundungsfehler entstehen (das GDD rechnet mit 0,4 oder 0,3 CC).

---

## 4. Spielzeit und Währung

- **Währung:** CoffeeCoins, angezeigt als „CC“ mit bis zu einer Nachkommastelle (GDD 8.1).
- **Abweichung vom GDD:** 1 Spieltag = **4 Minuten** bei 1× (GDD 11.1: 4 echte Stunden). Grund: Singleplayer ohne Idle-Betrieb. Wert in `time.realSecondsPerGameDay`.
- Geschwindigkeiten: Pause, 1×, 2×, 4×.
- Alle Zyklen werden in Spieltagen aus dem GDD übernommen. Beispiel: Robusta braucht 3 Spieltage, also 12 Minuten bei 1×.
- **Abweichung vom GDD:** Die Zeit läuft nur, solange das Spiel offen ist. Der Offline-Fortschritt aus GDD 2.1 entfällt.
- Eine Spielwoche hat 7 Spieltage (GDD 11.1). Sie dient nur der Anzeige und dem Event-Takt.

---

## 5. Welt

### Generierung
- Eingabe: Seed, angezeigt als „Welt #48213“. Neues Spiel = zufälliger Seed, optional manuell eingebbar.
- Insel aus einem Raster quadratischer **Parzellen** (Startgröße 48 × 48, konfigurierbar), Form über Noise mit radialer Abschwächung, Wasser außenherum.
- Höhe über Noise. Sehr steile Parzellen sind nicht bebaubar.

### Lagen (aus GDD 5.3 abgeleitet)
Das GDD hat vier Regionen. In CoffeeChain 3D liegen sie als Zonen auf derselben Insel:

| Lage | Entstehung in der Welt | Passende Sorte | Risiko (Event) | Landpreis |
|---|---|---|---|---|
| Tiefland | niedrige Höhe, Küstennähe | Robusta | Schädlinge, Monsun | niedrig |
| Hochland (gemäßigt) | mittlere Höhe | Arabica Standard | Frost | mittel |
| Hochland (kühl-trocken) | große Höhe | Arabica Premium | Frost, Dürre | hoch |
| Vulkanboden | 1 kleine, zusammenhängende Zone pro Welt, meist abseits vom Start | Spezialität | Vulkan-Event (nach v1) | sehr hoch |

- Der Spieler startet im Tiefland. Hochland ist von dort aus erreichbar, der Vulkanboden liegt weiter weg.
- **NEU:** Pflanzt man eine Sorte außerhalb ihrer passenden Lage, sinkt der Ertrag (Startwert: ×0,6, `world.offZoneYieldFactor`). Spezialität wächst nur auf Vulkanboden.

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
  - Startwerte (`parcels.firstCost`, `parcels.baseCost`, `parcels.zoneMultiplier`): Tiefland 15 CC für die erste Parzelle, danach Grundpreis 25 CC je Parzelle (Robert 2026-10-20, vorher 48 und 100 CC); Hochland ×1,5, kühles Hochland ×2, Vulkanboden ×4. Die Multiplikatoren sind `NEU`.
  - Ab der zweiten Parzelle hängt der Preis von der Bodengüte ab (Faktor 0,5–1,5, `parcels.qualityFactor`). Die Güte mischt die eigene Bodenqualität zur Hälfte mit dem Mittel der vier Nachbarn (`parcels.neighborWeight`), höchstens `parcels.worseGap` über der eigenen. So kosten Nachbarn ähnlich viel, eine deutlich schlechtere Parzelle bleibt billig.
- Der Anbau läuft in **Zyklen** wie im GDD (5.4): pflanzen → wachsen → ernten. Nach der Ernte ist die Parzelle leer und wird neu bepflanzt (Saatgut kostet erneut).

### Sorten (GDD 5.2, 11.1, 11.2)

| Sorte | Zyklus | Saatgut | Ertrag pro Parzelle | Referenzwert/Einheit |
|---|---|---|---|---|
| Robusta | 3 Spieltage | 2 CC | 20 Einheiten | 0,5 CC |
| Arabica Standard | 5 Spieltage | 4 CC | 15 Einheiten | 1 CC |
| Arabica Premium | 10 Spieltage | 8 CC | 8 Einheiten | 3 CC |
| Spezialität | 15 Spieltage | 15 CC | 4 Einheiten | 10 CC |

- Zu Beginn sind Robusta und Arabica Standard freigeschaltet. Arabica Premium ab 2.000 CC Kapital, Spezialität ab 10.000 CC (Übergänge Phase 1 → 2 → 3 aus GDD 12.1).
- Mengen werden in **Einheiten** geführt (wie im GDD), nicht in kg.

### Pflege während des Wachstums (GDD 5.4, 11.2)

| Maßnahme | Kosten pro Parzelle und Zyklus (R / AS / AP / S) | Wirkung |
|---|---|---|
| Dünger | 1 / 2 / 4 / 6 CC | Ertrag steigt (Startwert: +25 %, `NEU`) und `fertility` wird teilweise aufgefüllt |
| Bewässerung | 1 / 2 / 3 / 5 CC | Ertragsverlust bei Dürre-Event wird halbiert (`NEU`) |
| Schädlingsschutz | 1 / 2 / 3 / 5 CC | Ertragsverlust bei Schädlings-Event wird halbiert (`NEU`) |

Jede Maßnahme kann einmal pro Zyklus und Parzelle angewendet werden, solange die Pflanze noch nicht reif ist. Den Dünger bezahlt der Spieler mit den Pflegekosten der Sorte, ein eigenes Dünger-Lager gibt es in v1 nicht.

### Wachstum und Darstellung
Sichtbare Phasen innerhalb eines Zyklus: **Setzling (0–25 %) → Wachstum (25–60 %) → Blüte (60–90 %) → Fruchtansatz (90–100 %) → Reif**. Die Prozentgrenzen stehen in `farm.visualStages`. Sie sind nur Optik und ändern nichts an der Zykluslänge.

### Ertrag
```
menge = basisErtrag(sorte)
      × soil.yieldFactor[bodenklasse]
      × (lagePasst ? 1 : world.offZoneYieldFactor)
      × (gedüngt ? 1 + farm.fertilizerYieldBonus : 1)
      × eventFaktor        // Produkt aller aktiven Ernte-Events, min. 0,7 (GDD 11.8: max. -30 %)
      × zufall             // seedbar, Startwert 0,9–1,1 (GDD 5.4: „Zufall“)
```
- Ergebnis auf ganze Einheiten abgerundet.
- **Qualität** (GDD 5.4: Sorte + Pflege + Zufall + Events) wird als Wert 0–100 pro Charge berechnet und angezeigt. Die Bank zahlt unabhängig von der Qualität. Einen Preiseffekt hat sie über Aufträge virtueller Käufer (Mindestqualität, Aufpreis über der Bank, siehe Abschnitt 12, Punkt 4).
- `sim/farm/yield.ts` ist eine reine Funktion mit Tabellentests.

### Überreife (NEU, im Entwurf)
- Reife Pflanzen bleiben 2 Spieltage bei voller Menge, danach verlieren sie pro Spieltag 15 % der Menge (`farm.overripe.*`).
- Erzeugt Erntedruck. Muss von Robert bestätigt werden, bis dahin abschaltbar (`farm.overripe.enabled`).

---

## 7. Lager und Aufbereitung

### Lager (GDD 5.5, 6.5)
- Kapazität in Einheiten, Start: 100 Einheiten (`NEU`). Ausbaustufen über das Bauen-Menü.
- Lagerkosten pro Einheit und Spieltag (Startwert: 0,02 CC, `NEU`).
- Qualitätsverlust über die Zeit: Rohkaffee langsam (Startwert: −1 Qualitätspunkt pro Spieltag, `NEU`).
- Ernte über Kapazität: Die Ernte wird nur so weit eingefahren, wie Platz ist. Der Rest bleibt an der Pflanze (und kann überreif werden). Der Spieler bekommt eine Meldung.

### Aufbereitung (GDD 5.4 Phase 4, 11.2)
- Ersetzt den „Trockenplatz“ aus den Mockups. Im GDD heißt das **Washing/Natural** und ist dort bereits definiert.
- Gebäude „Aufbereitung“ muss gebaut werden. Kosten: Startwert 150 CC (`NEU`, angelehnt an GDD 11.6 „Aufbereitung + Einkauf ~150 CC“).
- Kosten 0,3 CC pro Einheit, Wert danach +50 % (GDD 11.2).
- Dauer: 1 Spieltag pro Charge (`NEU`), Kapazität 50 Einheiten pro Charge (`NEU`).

---

## 8. Markt (die Bank)

**Abweichung vom GDD:** Im Singleplayer gibt es keine Mitspieler. Der Markt besteht in v1 nur aus der **Bank** (GDD 3.4). Sofortmarkt-Angebote von Spielern und die Kaffeebörse entfallen.

- Ein Markt in der Welt („Markt Santa Rosa“), erreichbar über das HUD oder per Klick auf die Stände.
- **Die Bank kauft:** Rohkaffee aller Sorten, aufbereiteten Kaffee.
- **Die Bank verkauft:** nur Saatgut. Saatgut wird auch direkt beim Pflanzen gekauft, der Markt ist dann nur ein Weg mehr. Dünger bezahlt der Spieler mit der Pflegemaßnahme, Ausbauten baut er.
- **Referenzpreise und Spread (GDD 11.3):** Die Bank kauft für 80 % des Marktpreises und verkauft Saatgut zum Marktpreis.
- **Preisbildung pro Ware (GDD 3.4, 11.3):**
  ```
  preis = referenz × eventFaktor × angebotsFaktor × nachfrageFaktor
  angebotsFaktor  0,7–1,1   sinkt mit der Menge, die der Spieler in den letzten 3 Spieltagen verkauft hat
  nachfrageFaktor 0,9–1,3   steigt mit der Menge, die der Spieler in den letzten 3 Spieltagen gekauft hat
  Ergebnis immer zwischen 50 % und 150 % des Referenzpreises
  ```
  Wie stark die Faktoren auf Mengen reagieren und wie schnell sie zurückkehren, ist `NEU` (`market.*`).
- Keine Transaktionsgebühren bei der Bank (GDD 3.7).
- Preisverlauf der letzten 14 Spieltage pro Ware, im Markt-Panel als Linie.
- Keine Öffnungszeiten.

---

## 9. Events (GDD 11.8)

Übernommen werden die Events, die den Farmer-Pfad betreffen:

| Event | Wirkung | Dauer | Häufigkeit |
|---|---|---|---|
| Frost-Warnung | Hochland-Ernte −30 %, Arabica-Preise +20 % | 3–5 Spieltage | ~alle 2 Spielwochen |
| Monsun-Saison | Tiefland-Zyklen +50 % Zeit, Robusta-Preis +15 % | 5–7 Spieltage | ~alle 3 Spielwochen |
| Marktboom | Alle Verkaufspreise +15 % | 3 Spieltage | ~alle 2 Spielwochen |
| Marktkrise | Alle Verkaufspreise −15 % | 3 Spieltage | ~alle 3 Spielwochen |
| Schädlingsplage | Betroffene Parzellen −20 bis −30 % Ertrag | 2–4 Spieltage | ~alle 4 Spielwochen |
| Forschungsdurchbruch | Neue Saatgut-Variante, +10 % Ertrag | dauerhaft | ~alle 6 Spielwochen |

- **Abweichung vom GDD:** Schädlingsplage maximal −30 % statt −50 %, damit die Event-Regel „maximal −30 %“ aus demselben Abschnitt eingehalten wird.
- Regeln aus GDD 11.8: Effekte zwischen −30 % und +30 %, maximal 7 Spieltage, mindestens 1 Spieltag Vorwarnung, höchstens 2 Events gleichzeitig.
- Events werden mit dem seedbaren PRNG erzeugt.
- Kein Event in den ersten 5 Spieltagen (`NEU`), damit der Einstieg ruhig bleibt.

---

## 10. Progression

- **Startkapital: 500 CC** (GDD 11.6).
- Phasen nach GDD 12.1, gemessen am **Kapital** = Kontostand + Lagerwert zum Bank-Ankaufspreis + Anlagekosten aller Parzellen und Gebäude. Das GDD definiert „Kapital“ nicht. Die Anlagekosten zählen mit, damit Reinvestieren den Aufstieg nicht bremst (Quelle: `PRD`).

| Phase | Kapital | Freischaltung |
|---|---|---|
| 1: Einstieg | 500 → 2.000 CC | Robusta, Arabica Standard, Aufbereitung |
| 2: Wachstum | 2.000 → 10.000 CC | Arabica Premium, Lager-Ausbau Stufe 2 |
| 3: Spezialisierung | ab 10.000 CC | Spezialität (Vulkanboden) |

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

### HUD (Vue)
Aufbau wie in den Mockups:
- **Topbar:** Spielname, Welt-Seed, Tag und Uhrzeit, aktives Event, Geschwindigkeit, CC, Lagerstand.
- **Links:** Tutorial-Checkliste bzw. Feldübersicht, darunter Meldungen (z. B. „Feld A ist erntereif“, „Frost-Warnung ab morgen“).
- **Rechts:** Kontextpanel, entweder Parzellen-Inspektor (Lage, Boden, passende Sorte, Ertragsprognose, Aktion) oder Markt.
- **Unten:** Werkzeugleiste: Auswählen, Parzelle, Pflanzen, Düngen, Wässern, Schutz, Ernten, Bauen, Markt.
- Die Ertragsprognose im Inspektor nutzt dieselbe Funktion wie die Simulation (`yield.ts`, ohne Zufall).
- Sprache: Deutsch, Texte in `src/ui/i18n/de.json`.

### Performance-Ziel
60 fps auf einem Mac mit Apple Silicon (M1 oder neuer) bei 48 × 48 Parzellen und 2.000 Pflanzen.

---

## 12. Offene Entscheidungen

| # | Frage | Vorschlag | Status |
|---|---|---|---|
| 1 | **Das Farmer-Balancing aus dem GDD ist allein zu langsam.** Robusta bringt pro Parzelle 20 × 0,4 CC = 8 CC an die Bank, minus 2 CC Saatgut, also 6 CC je 3 Spieltage. Mit dem Startkapital lassen sich 5 Parzellen anlegen, das ergibt 10 CC pro Spieltag. Grobe Rechnung ohne Dünger, Events und Lagerkosten: Wer danach nur spart, braucht rund 195 Spieltage bis 2.000 CC (ca. 13 Stunden Spielzeit). Wer alles sofort in neue Parzellen steckt, braucht rund 72 Spieltage (ca. 5 Stunden), wenn man die Parzellen zum Kapital zählt. Das GDD sieht für Phase 1 aber nur 4 Spielwochen vor, also 28 Spieltage. Außerdem ist das GDD hier nicht einheitlich (11.10: „~8 CC/Tag“, aber „~175 CC/Woche“). | Erst in M4 mit der Bot-Simulation messen. Danach eine von drei Stellschrauben drehen: günstigere Parzellen (z. B. 20 CC flach), höhere Erträge pro Parzelle oder niedrigere Phasengrenzen. | offen, blockiert nicht |
| 2 | Überreife übernehmen? | Ja, 2 Spieltage, dann −15 % pro Tag | offen |
| 3 | 1 Spieltag = 4 Minuten? | Ja | offen |
| 4 | Soll die Qualität einer Charge den Verkaufspreis beeinflussen? | Ja, ab v1.1: Preis × (0,8 + 0,4 × Qualität/100) | entschieden 2026-10-21: über Aufträge virtueller Käufer mit Mindestqualität und Aufpreis; die Bank bleibt ohne Qualitätsfaktor |
| 5 | Alle mit `NEU` markierten Startwerte (Bodenfaktoren, Lagerkosten, Zonen-Multiplikatoren, Düngerbonus …) | Nach M4-Bot-Simulation gemeinsam prüfen | offen |
| 6 | Name der Mac-App | „CoffeeChain“ | offen |
| 7 | Event-Effekte über ±30 % im GDD (Monsun-Zykluszeit +50 %) | PRD-Grenze ±30 % gilt | entschieden 2026-10-21 |
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
- ✅ Test: Jede von 200 zufälligen Welten erfüllt die Startgarantie und hat genau eine Vulkanzone.

### M2: Zeit, Parzellen und Anbau
- Spielzeit mit Pause, 1×, 2×, 4×.
- Parzellen anlegen (Einzel- und Mehrfachauswahl), Kosten nach Lage, Felder benennen.
- Pflanzen von Robusta und Arabica Standard, sichtbare Wachstumsphasen.
- ✅ Test: Robusta ist nach exakt 3 Spieltagen reif, bei 1× und bei 4×.
- ✅ Test: Die erste Tiefland-Parzelle kostet 15 CC, jede weitere 25 CC × Bodenfaktor (S21d).

### M3: Pflege, Ernte und Lager
- Düngen, Wässern, Schädlingsschutz, Ernten, Ertragsformel, Bodenverbrauch.
- Lager mit Kapazität, Lagerkosten, Qualitätsverlust, Überreife (abschaltbar).
- ✅ Test: Robusta auf „Gut“, passende Lage, ohne Dünger, Zufall fixiert auf 1,0 → genau 20 Einheiten.
- ✅ Test: Tabellentests der Ertragsformel für alle Sorten und Bodenklassen.
- ✅ Test: Ernte über Lagerkapazität lagert nur bis zur Grenze ein, der Rest bleibt an der Pflanze.

### M4: Markt und Balancing-Messung
- Bank mit Ankauf und Verkauf, Preisformel, Preisverlauf.
- `tools/balance-sim.ts`: ein Bot spielt ohne Grafik über 200 Spieltage (pflanzen, düngen, ernten, verkaufen, reinvestieren in neue Parzellen) auf 20 verschiedenen Seeds.
- ✅ Test: Die Bank kauft Robusta bei neutralem Markt für 0,4 CC und verkauft Saatgut zum Wert aus `balance.json`.
- ✅ Test: Preise bleiben über 1.000 simulierte Tage immer zwischen 50 % und 150 % der Referenz.
- ✅ Ergebnis: `docs/balance-report.md` mit Kapitalkurve, Spieltag beim Erreichen von 2.000 und 10.000 CC und einer Empfehlung zu Abschnitt 12, Punkt 1. **Hier stoppt Claude Code und wartet auf Roberts Entscheidung, bevor Werte geändert werden.**

### M5: Speichern und Tutorial
- Spielstände speichern und laden über Tauri (`~/Library/Application Support/CoffeeChain/saves`), mit Versionsnummer und Migrationen.
- Autosave jeden Spieltag.
- Tutorial-Checkliste aus Abschnitt 10.
- ✅ Test: Speichern → Laden → 50 Tage weiterspielen ergibt denselben State wie ohne Unterbrechung.

### M6: Aufbereitung, Bauen und Progression
- Bauen-Menü: Aufbereitung, Lager-Ausbau.
- Aufbereitung mit Kosten, Dauer und Wertsteigerung nach Abschnitt 7.
- Phasen und Freischaltungen nach Abschnitt 10, Arabica Premium und Spezialität.
- ✅ Test: 10 Einheiten Arabica Standard roh (Referenz 1,0 CC) werden aufbereitet zu Referenzwert 1,5 CC je Einheit, Kosten 3 CC.

### M7: Events und Feinschliff
- Events nach Abschnitt 9 mit Vorwarnung im HUD.
- Meldungen, Tooltips, Tastenkürzel.
- ✅ Test: Über 1.000 simulierte Tage sind nie mehr als 2 Events gleichzeitig aktiv, und kein Effekt liegt außerhalb von ±30 %.
- ✅ Spielbarer Durchlauf von Tag 1 bis Tag 30 ohne Fehler, als Screenshot-Serie.
- ✅ Performance-Ziel aus Abschnitt 11 erreicht.

---

## 14. Später (nach v1)

- Rösterei (GDD 5.4, 11.2: +150 %, 0,8 CC pro Einheit)
- Personal: Feldarbeiter und Agrar-Spezialist (GDD 5.5, 11.7)
- Versicherung (GDD 5.6)
- Vulkan-Event, Dürre als eigenes Event
- Café- und Händler-Pfad
- Englische Lokalisierung, Steam-Release, Windows-Build

---

## 15. Definition of Done (für jeden Pull Request)

- Typecheck, Lint und Tests grün.
- Neue Spiellogik in `sim/` hat Unit-Tests.
- Keine Zahlen im Code, die ins Balancing gehören.
- Sichtbare Änderungen mit Screenshot im PR-Text.
- Neue `NEU`-Werte sind in `docs/open-questions.md` eingetragen.
