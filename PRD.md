# PRD: CoffeeChain 3D

**Status:** Entwurf v0.1 · 20.10.2026
**Owner:** Robert
**Umsetzung:** Claude Code

---

## 1. Worum es geht

CoffeeChain 3D ist eine Aufbausimulation in 3D für den Mac. Man startet auf einer zufällig erzeugten Insel und baut eine Kaffeefarm auf. Der Boden ist unterschiedlich gut, das bestimmt den Ertrag. Die Ernte bringt man zum Markt, verkauft sie und kauft dort Setzlinge, Dünger und Ausbauten.

Das Spiel basiert auf dem bestehenden Browser-Konzept **CoffeeChain**: Idle-Hybrid, Wirtschaftssimulation, GDD mit 13 Kapiteln. Aus dem GDD übernimmt CoffeeChain 3D den **Farming-Pfad** und das **Marktsystem**. Café und Handel/Verarbeitung kommen später (siehe Abschnitt 11).

### Ziele für v1
- Ein spielbarer Kreislauf: Boden wählen → Feld anlegen → pflanzen → pflegen → ernten → verkaufen → reinvestieren.
- Jede Welt ist anders (Seed), und die Bodenqualität erzwingt echte Standortentscheidungen.
- Läuft als native Mac-App, offline, Singleplayer.
- Die Wirtschaftswerte kommen aus dem GDD und stehen in einer Config-Datei, nicht im Code.

### Nicht-Ziele für v1
- Kein Multiplayer, kein Server, keine Accounts.
- Kein Café, keine Rösterei, kein Spielerhandel.
- Keine Monetarisierung.
- Keine handmodellierten High-End-Assets.

---

## 2. Quellen

| Quelle | Pfad im Repo | Rolle |
|---|---|---|
| Game Design Document (CoffeeChain) | `docs/gdd.md` | **Maßgeblich** für Preise, Formeln, Wachstumszeiten, Progression |
| Screen-Entwürfe Tag 1 und Tag 12 | `docs/mockups/*.png` | Layout und Stil des HUD |
| Dieses PRD | `PRD.md` | Scope, Architektur, Meilensteine, Akzeptanzkriterien |

**Regel:** Wo dieses PRD und das GDD sich widersprechen, gilt für Spielmechanik und Balancing das GDD, für Scope und Technik dieses PRD. Fehlt ein Wert im GDD, wird er in `config/balance.json` mit `"TODO_GDD"`-Kommentar als Platzhalter angelegt und in `docs/open-questions.md` notiert. Werte werden nicht erfunden, ohne sie dort zu markieren.

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
| Noise | `simplex-noise` | Terrain und Bodenqualität |
| Zufall | Eigener seedbarer PRNG (z. B. mulberry32) | Reproduzierbare Welten und Tests |
| Tests | Vitest (Logik), Playwright (Screenshot-Smoke-Tests) | Simulation testgetrieben, Visuals per Screenshot prüfbar |
| Assets | Low-Poly per Code; Gebäude und Deko aus Kenney-Paketen (CC0) | Kein Lizenzaufwand, einheitlicher Stil |

### Architektur

```
src/
  sim/            # Reine Spiellogik. Kein DOM, kein Three.js, kein Vue.
    world/        # Weltgenerierung, Tiles, Bodenwerte
    farm/         # Felder, Pflanzen, Wachstum, Dünger, Ernte
    market/       # Preise, Kauf, Verkauf
    economy/      # Geld, Lager, Transaktionen
    time/         # Spielzeit, Tick, Geschwindigkeit
    save/         # Serialisierung, Versionierung, Migration
    rng.ts
    state.ts      # GameState (rein serialisierbar)
    commands.ts   # Alle Spieleraktionen als Commands
  render/         # Three.js: Szene, Kamera, Meshes, Picking
  ui/             # Vue-Komponenten für das HUD
  app/            # Verdrahtung: Game Loop, Stores, Input
config/
  balance.json    # Alle Zahlen aus dem GDD
assets/kenney/    # Ausgewählte Kenney-Modelle (glTF)
docs/
src-tauri/
```

**Grundregeln**
1. `sim/` ist deterministisch: gleicher Seed + gleiche Commands = gleicher State. Das ist testbar und ermöglicht später Replays.
2. Spieleraktionen laufen nur über Commands (`PlantSeedlings`, `Fertilize`, `Harvest`, `Sell`, `Buy`, `CreateField`, `Build`). UI und Render ändern den State nie direkt.
3. Die Simulation tickt in festen Schritten (z. B. 1 Tick = 1 Spielstunde). Rendering läuft unabhängig mit `requestAnimationFrame` und interpoliert, wo nötig.
4. `GameState` ist reines JSON, ohne Klasseninstanzen und ohne Zyklen.
5. Alle Zahlen kommen aus `config/balance.json`, typisiert über ein Schema (zod oder ein eigener Validator).

---

## 4. Spielzeit

- **Entscheidung:** 1 Spieltag = **4 Minuten** bei 1×. Geschwindigkeiten: Pause, 1×, 2×, 4×.
  - Das GDD sieht 1 Spieltag = 4 echte Stunden vor. Das passt zum Idle-Browserspiel, ist im Singleplayer auf dem Desktop aber zu langsam. Der Faktor steht in `balance.json` (`time.realSecondsPerGameDay`).
- Wachstumszeiten aus dem GDD werden in Spieltagen übernommen. Ist das GDD in Echtzeit formuliert, gilt: GDD-Stunden ÷ 4 = Spieltage.
- Die Zeit läuft nur, solange das Spiel offen ist. Die Catch-up-Mechanik des GDD (Fortschritt seit dem letzten Login nachrechnen) entfällt für v1.

---

## 5. Welt

### Generierung
- Eingabe: Seed (Zahl, angezeigt als „Welt #48213“). Neues Spiel = zufälliger Seed, optional manuell eingebbar.
- Insel aus einem Raster aus quadratischen Tiles (Startgröße 48 × 48, konfigurierbar), Form über Noise und radiale Abschwächung, Wasser außenherum.
- Höhe: leichte Hügel über Noise, Tiles bleiben begehbar und bebaubar. Steile Tiles (Hangneigung über Schwellwert) sind nicht bebaubar.
- Pro Tile werden erzeugt:
  - `fertility` (Nährstoffe, 0–100)
  - `waterRetention` (0–100)
  - `ph` (z. B. 4,5–7,5)
  - `altitude` (für Qualität, falls das GDD Höhenlage nutzt)
  - abgeleitet: `soilQuality` 0–1 und eine Klasse **Karg / Mittel / Gut / Sehr gut**
- Platziert werden: Startgelände mit Hütte, ein Markt am Ufer, ein Weg zwischen beiden, Bäume auf ungünstigen Tiles.
- **Garantie:** Jede Welt hat in Reichweite des Starts mindestens ein zusammenhängendes Gebiet von 6 Tiles mit „Gut“ oder besser. Sonst wird neu generiert (Test dafür).

### Bodenqualität im Spiel
- Overlay umschaltbar: Tiles werden nach Klasse eingefärbt (hell = karg, dunkel = sehr gut; Farben aus den Mockups).
- Dünger erhöht `fertility` temporär. Ernten senkt `fertility`. Brache erholt den Boden langsam. Die Raten kommen aus dem GDD.

---

## 6. Farm

### Felder
- Ein Feld ist eine Gruppe benachbarter, bebaubarer Tiles mit Namen (Feld A, B, …).
- Anlegen kostet Geld pro Tile und entfernt Bäume (Kosten aus GDD).
- Pro Tile 4 Pflanzplätze (konfigurierbar).

### Pflanzen
Wachstumsphasen: **Setzling → Wachstum → Blüte → Reif → Überreif**.
- Dauer jeder Phase in Spieltagen aus dem GDD.
- Wachstum hängt ab von Bodenqualität, Wasser und Dünger.
- Kaffee braucht real 3–4 Jahre bis zur ersten Ernte. Im Spiel ist das stark verkürzt. Nach der ersten Ernte trägt die Pflanze erneut, mit eigenem Zyklus laut GDD.

### Ertrag
- `ertrag = basisErtrag × f(soilQuality) × f(dünger) × f(wasser) × reifeFaktor`
- Die genaue Formel steht im GDD. Ist sie dort anders, gilt das GDD. Die Funktion liegt in `sim/farm/yield.ts`, ist rein und vollständig getestet.

### Überreife (neue Mechanik, im Entwurf)
- Reife Kirschen bleiben eine festgelegte Zeit bei voller Qualität (Vorschlag: 2 Spieltage), danach sinken Qualität und Preis schrittweise.
- Erzeugt Erntedruck. **Status:** vorgeschlagen, muss von Robert bestätigt werden (siehe Abschnitt 12). Bis dahin über `balance.json` abschaltbar (`farm.overripe.enabled`).

### Aktionen
Feld anlegen, pflanzen, düngen, wässern, ernten. Jede Aktion ist ein Command mit Kosten und Validierung (genug Geld, genug Ware, Tile gültig).

---

## 7. Lager und Verarbeitung

- **Lager:** begrenzte Kapazität in kg, Start klein, ausbaubar.
- **Trockenplatz (neue Mechanik, im Entwurf):** Frische Kirschen trocknen in X Spieltagen zu Rohkaffee. Das Gewichtsverhältnis und die Preise kommen aus dem GDD. Trocknen bringt mehr Geld pro kg Ausgangsware, kostet aber Zeit und Platz.
  - **Status:** vorgeschlagen, abschaltbar über `processing.drying.enabled`.

---

## 8. Markt

- Ein Markt („Markt Santa Rosa“), erreichbar über das HUD oder per Klick auf die Stände.
- **Verkaufen:** Kaffeekirschen frisch, Rohkaffee getrocknet.
- **Einkaufen:** Setzlinge, Dünger (Sorten laut GDD), Schattenbaum-Setzlinge, Ausbauten.
- **Preise:** Basispreis aus dem GDD plus Schwankung.
  - Saison-Komponente (z. B. höher außerhalb der Erntezeit).
  - Zufalls-Komponente als seedbarer Random Walk mit Rückführung zum Mittelwert.
  - Angebots-Komponente: großer Verkauf des Spielers drückt den Preis kurzfristig.
  - Das GDD beschreibt einen zweistufigen Marktplatz. Für v1 wird nur die Stufe übernommen, die zum Singleplayer passt; die zweite wird in `open-questions.md` dokumentiert.
- Preisverlauf der letzten N Tage wird gespeichert und im Markt-Panel als Linie angezeigt.
- Öffnungszeiten (z. B. bis 18:00) laut GDD, sonst weglassen.

---

## 9. Progression

- Startkapital und Starthof aus dem GDD.
- Das GDD hat vier Phasen vom Einsteiger bis zum Endgame. Für v1 werden **Phase 1 und 2** umgesetzt, soweit sie den Farming-Pfad betreffen.
- Tutorial als Checkliste „Erste Schritte“ (siehe Mockup Tag 1):
  1. Parzellen mit gutem Boden finden (Overlay einschalten, Tile auswählen)
  2. Feld anlegen
  3. Setzlinge pflanzen
  4. Auf dem Markt Dünger kaufen
  5. Erste Ernte verkaufen

---

## 10. Darstellung und Bedienung

### Kamera
- Isometrisch wirkende Perspektive (Orthografische Kamera, ca. 45° gedreht, ca. 35° geneigt).
- Steuerung: Ziehen mit rechter Maustaste oder WASD zum Verschieben, Mausrad zum Zoomen, Q/E zum Drehen in 90°-Schritten.

### Stil
- Low Poly, flache Farben, kein Texturrauschen. Vorbild: die Mockups.
- Terrain als ein zusammenhängendes Mesh pro Chunk mit Vertex-Farben, keine Einzelmeshes pro Tile.
- Kaffeepflanzen werden per Code erzeugt, eine Variante pro Wachstumsphase, gerendert mit `InstancedMesh`.
- Gebäude und Deko: Kenney (Nature Kit, Survival Kit, City Kit Suburban, Fantasy Town Kit). Nur benötigte Modelle ins Repo, Lizenzdatei dazu.

### HUD (Vue)
Aufbau wie in den Mockups:
- **Topbar:** Spielname, Welt-Seed, Tag und Uhrzeit, Jahreszeit/Wetter, Geschwindigkeit, Geld, Lagerstand.
- **Links:** Tutorial-Checkliste bzw. Feldübersicht, darunter Meldungen (z. B. „Feld A ist erntereif“).
- **Rechts:** Kontextpanel, entweder Tile-Inspektor (Bodenwerte, Ertragsprognose, Aktion) oder Markt.
- **Unten:** Werkzeugleiste: Auswählen, Feld, Pflanzen, Düngen, Wässern, Ernten, Bauen, Markt.
- Sprache: Deutsch, Texte in `src/ui/i18n/de.json`, damit Englisch später leicht dazukommt.

### Performance-Ziel
- 60 fps auf einem Mac mit Apple Silicon (M1 oder neuer) bei 48 × 48 Tiles und 2.000 Pflanzen.

---

## 11. Später (nicht v1)

- Café-Pfad und Handel/Verarbeitung aus dem GDD
- Mehrere Märkte, Transportwege
- Arbeiter und Automatisierung
- Wetterereignisse (Dürre, Starkregen), Schädlinge
- Englische Lokalisierung
- Steam-Release, Windows-Build

---

## 12. Offene Entscheidungen

| # | Frage | Vorschlag | Status |
|---|---|---|---|
| 1 | Überreife-Mechanik übernehmen? | Ja, 2 Spieltage bei voller Qualität | offen |
| 2 | Trockenplatz übernehmen? | Ja, als erste Verarbeitungsstufe | offen |
| 3 | 1 Spieltag = 4 Minuten? | Ja | offen |
| 4 | Welche Stufe des zweistufigen Marktes aus dem GDD gilt im Singleplayer? | Klären, sobald `docs/gdd.md` vorliegt | offen |
| 5 | Name der Mac-App | „CoffeeChain“ | offen |

---

## 13. Meilensteine und Akzeptanzkriterien

Jeder Meilenstein endet mit: grünen Tests, `npm run build` ohne Fehler, Screenshot im Ordner `docs/progress/<meilenstein>.png`.

### M0: Grundgerüst
- Vite + TypeScript + Vue + Three.js + Tauri 2 eingerichtet, startet als Mac-App.
- Vitest und Playwright laufen, ESLint und Prettier sind konfiguriert.
- `config/balance.json` mit Schema-Validierung; ungültige Config bricht den Start mit klarer Fehlermeldung ab.
- ✅ Leere Szene mit Wasserfläche, drehbarer Kamera und leerem HUD-Rahmen.

### M1: Welt
- Seedbare Weltgenerierung inklusive Bodenwerten und Klassen.
- Terrain-Mesh mit Vertex-Farben, Bäume, Hütte, Markt, Weg.
- Boden-Overlay umschaltbar, Tile-Auswahl per Klick mit Inspektor-Panel.
- ✅ Test: gleicher Seed erzeugt identische Welt (Hash-Vergleich).
- ✅ Test: Jede von 200 zufälligen Welten erfüllt die Startgarantie aus Abschnitt 5.

### M2: Zeit und Felder
- Spielzeit mit Pause, 1×, 2×, 4×; Tag und Uhrzeit im HUD.
- Feld anlegen (Mehrfachauswahl zusammenhängender Tiles), Kosten werden abgebucht.
- Pflanzen, Wachstumsphasen, sichtbare Modelle je Phase.
- ✅ Test: Wachstumsdauer entspricht `balance.json` bei 1× und 4× (gleiche Spieltage).

### M3: Ernte und Lager
- Düngen, Wässern, Ernten, Ertragsformel, Bodenverbrauch.
- Lager mit Kapazität, Überreife (abschaltbar).
- ✅ Test: Ertragsformel mit Tabellentests für alle Bodenklassen.
- ✅ Test: Lager läuft nicht über; Ernte über Kapazität wird abgelehnt oder geht teilweise verloren (Verhalten laut GDD).

### M4: Markt
- Verkaufen und Einkaufen, Preisbildung mit Saison, Zufall und Angebotsdruck.
- Preisverlauf im Markt-Panel.
- ✅ Test: Preise bleiben über 1.000 simulierte Tage in den Grenzen laut `balance.json`.
- ✅ Test: Komplettlauf per Bot (pflanzen → ernten → verkaufen in Schleife) über 100 Spieltage endet mit mehr Geld als zu Beginn, auf mittlerem Boden. Die erwartete Spanne kommt aus dem GDD.

### M5: Speichern und Tutorial
- Spielstände speichern und laden über Tauri (`~/Library/Application Support/CoffeeChain/saves`), mit Versionsnummer und Migrationen.
- Autosave jeden Spieltag.
- Tutorial-Checkliste aus Abschnitt 9.
- ✅ Test: Speichern → Laden → 50 Tage weiterspielen ergibt denselben State wie ohne Unterbrechung.

### M6: Trockenplatz und Feinschliff
- Trockenplatz (abschaltbar), Bauen-Menü für Lager-Ausbau und Trockenplatz.
- Meldungen, Tooltips, Tastenkürzel.
- ✅ Spielbarer Durchlauf von Tag 1 bis Tag 30 ohne Fehler, aufgenommen als Screenshot-Serie.
- ✅ Performance-Ziel aus Abschnitt 10 erreicht.

---

## 14. Definition of Done (für jeden Pull Request)

- Typecheck, Lint und Tests grün.
- Neue Spiellogik in `sim/` hat Unit-Tests.
- Keine Zahlen im Code, die ins Balancing gehören.
- Sichtbare Änderungen mit Screenshot im PR-Text.
- `docs/open-questions.md` ist aktualisiert, falls ein Wert aus dem GDD fehlte.
