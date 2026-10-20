# CoffeeChain – Game Design Document

*Von der Bohne bis zur Tasse – Dein Kaffee-Imperium*

Version 1.0 – Februar 2026
Status: Game Design Phase (Pre-Development)

> Quelle: Google Drive, „2026-02-15 CoffeeChain_GDD-2.docx“. Inhalt unverändert übernommen, nur als Markdown formatiert. Das GDD beschreibt das ursprüngliche Browserspiel. Was davon für CoffeeChain 3D gilt, regelt `PRD.md`.

---

## 1. Game Overview

### 1.1 Konzept

CoffeeChain ist ein browserbasiertes Wirtschaftssimulations- und Strategiespiel rund um die globale Kaffeeindustrie. Spieler bauen ihr eigenes Kaffee-Imperium auf – von der Plantage über den Handel bis zum Café. Das Spiel kombiniert Idle-Mechaniken mit aktiven strategischen Entscheidungen und einem spielerübergreifenden Marktplatz.

### 1.2 Vision Statement

„Baue dein Kaffee-Imperium – als Farmer, Händler, Café-Betreiber oder alles zusammen. Handele mit echten Spielern, reagiere auf reale Marktbewegungen und werde zur Legende der Kaffeewelt.“

### 1.3 Genre & Plattform

| Eigenschaft | Details |
|---|---|
| Genre | Wirtschaftssimulation / Tycoon / Idle-Hybrid |
| Plattform | Webbrowser (Desktop & Mobile) |
| Spielmodus | Einzelspieler mit Multiplayer-Marktplatz |
| Zeitmodell | Idle-Hybrid (läuft immer, Entscheidungen warten) |
| Simulationstiefe | Abstrakt+ (Mechanik first, Optik später) |
| Zielgruppe | Strategie- & Tycoon-Fans, Idle-Game-Spieler |

### 1.4 Kern-Spielprinzip

Spieler wählen frei zwischen drei Spielpfaden, die sie beliebig kombinieren können. Jeder Pfad repräsentiert eine Stufe der Kaffee-Wertschöpfungskette und bietet ein einzigartiges Spielgefühl:

- **Farmer** – Plantagen betreiben, Kaffee anbauen, Zyklen planen
- **Händler** – Einkaufen, veredeln, lagern, verkaufen – Timing ist alles
- **Café-Betreiber** – Cafés führen, Kunden bedienen, expandieren

Die vertikale Integration (alle Pfade kontrollieren) ist möglich, aber teuer und komplex. Spezialisierung ist effizienter, Kooperation mit anderen Spielern ist lukrativ.

### 1.5 Spielziele

- **Kurzfristig:** Wöchentliche KPI-Rankings (Umsatz, Gewinn, Qualität, etc.)
- **Langfristig:** Imperium aufbauen – Besitz (Gebäude, Plantagen, Ausrüstung) bleibt dauerhaft
- **Sozial:** Ruhm & Ehre in den Community-Statistiken, Kooperationen, Handelsbeziehungen

Jede Woche werden alle KPI-Rankings auf 0 zurückgesetzt. Der Besitz (Gebäude, Plantagen, Ausrüstung, Personal) bleibt dauerhaft erhalten. So hat jeder Spieler jede Woche die Chance, ganz oben zu stehen.

---

## 2. Zeitmodell & Idle-Mechanik

### 2.1 Idle-Hybrid-System

Das Spiel läuft in seiner eigenen Spielzeit – kontinuierlich, auch wenn der Spieler offline ist. Die Produktion arbeitet weiter, aber strategische Entscheidungen warten auf den Spieler.

**Was passiert offline (automatisch):**
- Kaffee wächst auf Plantagen (gemäß Anbauzyklus)
- Café verkauft Getränke an Kunden (gemäß Kapazität & Lagerbestand)
- Lagerkosten und Gehälter laufen weiter
- Laufende Verträge werden erfüllt

**Was auf den Spieler wartet (aktive Entscheidungen):**
- Ernte einfahren und entscheiden: verkaufen oder lagern?
- Marktangebote annehmen oder ablehnen
- Auf Events reagieren (Frost, Preisschwankungen)
- Personal einstellen, entlassen, schulen
- Expansion und Investitionen
- Preise im Café anpassen

### 2.2 Realwelt-Integration

Aktuelle Informationen aus der echten Welt beeinflussen das Spielgeschehen als Events:

| Realwelt-Ereignis | Spiel-Event | Auswirkung |
|---|---|---|
| Frost in Brasilien | Frostwarnungen! | Hochland-Ernte -30%, Arabica-Preis +20% |
| Rekordregen in Vietnam | Monsun-Saison | Tiefland-Ernte verzögert, Robusta-Preis steigt |
| Weltmarktpreis steigt | Marktboom | Alle Verkaufspreise +15% für 3 Spieltage |
| Neue Schädlingsresistenz entdeckt | Forschungsdurchbruch | Neues Saatgut verfügbar |

Events dienen als Flavor und strategische Impulse, sind aber nicht so extrem, dass sie Spieler unfair bestrafen. Sie verschieben Marktdynamiken und belohnen vorausschauende Spieler.

---

## 3. Der Marktplatz

### 3.1 Grundprinzip

Der Marktplatz ist das Herzstück von CoffeeChain. Hier treffen alle drei Spielpfade aufeinander. Spieler handeln untereinander – Farmer verkaufen an Händler und Cafés, Händler verkaufen an Cafés, und alle können am offenen Markt agieren.

Der Marktplatz besteht aus zwei Schichten: dem Sofortmarkt für den schnellen Einkauf von Standardware und der Kaffeebörse für den Handel mit Rohkaffee und Premium-Ware. Beide Schichten sind unter einem Dach vereint, bieten aber völlig unterschiedliche Spielerlebnisse.

### 3.2 Schicht 1: Der Sofortmarkt

Der Sofortmarkt funktioniert wie ein Supermarkt – einfach, schnell, unkompliziert. Spieler stellen Angebote ein (Ware + Preis + Menge), die für eine begrenzte Spielzeit sichtbar sind. Jeder kann sofort kaufen.

**Funktionsweise:**
- Spieler stellen Angebote ein (Ware + Preis + Menge)
- Angebote stehen für 12–24 Spielstunden, dann verfallen sie
- Jeder kann sofort kaufen – Sofortkauf-Prinzip
- Die Bank füllt Lücken: Wenn niemand eine Ware anbietet, springt die Bank ein

**Gehandelte Waren auf dem Sofortmarkt:**

| Ware | Typische Anbieter | Typische Käufer |
|---|---|---|
| Gerösteter Kaffee (Standard) | Händler, Farmer | Café-Betreiber |
| Zubehör (Milch, Sirup, Becher) | Bank | Café-Betreiber |
| Dünger, Saatgut | Bank | Farmer |
| Ausrüstung | Bank | Alle |
| Blend-Marken | Händler | Café-Betreiber |

### 3.3 Schicht 2: Die Kaffeebörse

Die Kaffeebörse funktioniert wie eine echte Warenbörse mit Orderbuch. Hier wird spekuliert, gehandelt und gepokert – das Spielfeld des Händlers.

**Funktionsweise:**
- Verkaufsorders: „Ich biete 500 Einheiten Arabica Premium zu je 12 CC“
- Kauforders: „Ich suche 200 Einheiten Robusta, zahle maximal 5 CC“
- Wenn sich Kauf- und Verkaufspreis überschneiden → automatisches Matching
- Orders stehen für eine wählbare Dauer (6 / 12 / 24 / 48 Spielstunden)
- Nicht gematchte Orders verfallen nach Ablauf

**Gehandelte Waren an der Kaffeebörse:**

| Ware | Typische Anbieter | Typische Käufer |
|---|---|---|
| Rohkaffee (alle Sorten & Qualitäten) | Farmer | Händler, (Cafés) |
| Gewaschener Kaffee | Farmer, Händler | Händler, Röster |
| Premium-Röstungen | Händler, (Farmer) | Café-Betreiber |
| Spezialitäten & Single Origin | Farmer, Händler | Café-Betreiber, Händler |

### 3.4 Die Bank – Marktmacher

Solange es nicht genügend aktive Spieler gibt, agiert „die Bank“ als Marktteilnehmer – vergleichbar mit dem Bankprinzip in Gesellschaftsspielen. Die Bank bietet Waren an und kauft Waren auf, damit der Markt immer funktioniert.

**Bank auf dem Sofortmarkt:**
- Bank bietet IMMER alle Standardwaren an (Zubehör, Dünger, Saatgut, Basis-Bohnen)
- Bank kauft auch Ware auf – Farmer kann immer an die Bank verkaufen
- Bank-Preise sind dynamisch, aber mit Ober- und Untergrenze

**Bank an der Kaffeebörse:**
- Bank hat permanente Kauf- und Verkaufsorders für alle Kaffeesorten
- Bank-Spread (Kauf-/Verkaufspreis-Differenz) ist IMMER schlechter als Spieler-Angebote
- Motiviert Spieler-zu-Spieler-Handel, aber niemand steht ohne Ware da

**Dynamische Bank-Preislogik:**
- Basis-Preis = Sortengrundwert × Realwelt-Event-Faktor
- Viele Spieler verkaufen → Bank-Kaufpreis sinkt (Angebot steigt)
- Wenige Spieler verkaufen → Bank-Kaufpreis steigt (Knappheit)
- Viele Spieler kaufen → Bank-Verkaufspreis steigt (Nachfrage)
- Obergrenze: Max. 150% des Basis-Preises (Neueinsteiger-Schutz)
- Untergrenze: Min. 50% des Basis-Preises (Farmer-Schutz)

### 3.5 Marktinformationen – Wer sieht was?

Die Informationsasymmetrie ist ein zentrales Designelement: Händler sehen mehr als andere Spieler. Das macht den Händler-Pfad strategisch attraktiv.

**Alle Spieler sehen:**
- Aktuelle Bank-Preise (Kauf und Verkauf)
- Eigene aktive Angebote und Orders
- Preishistorie / Charts (Durchschnittspreise der letzten Wochen)
- Ob ein Realwelt-Event aktiv ist und welchen Effekt es hat

**Nur Händler sehen zusätzlich:**
- Das Orderbuch der Kaffeebörse (alle Kauf-/Verkaufsorders mit Preis und Volumen)
- Handelsvolumen pro Sorte (wie viel wurde in den letzten X Spielstunden gehandelt)
- Preis-Trends mit Trendpfeilen und Volatilitätsanzeige
- Nachfrage-Indikatoren: z.B. „Cafés suchen gerade viel Arabica Premium“
- Lagerbestands-Übersicht des Marktes (wie viel Ware insgesamt angeboten wird)

### 3.6 Handelskanäle

Neben dem offenen Marktplatz gibt es spezialisierte Handelskanäle:

| Kanal | Beschreibung | Verfügbar für |
|---|---|---|
| Sofortmarkt | Angebote für alle sichtbar, Sofortkauf | Alle |
| Kaffeebörse | Orderbuch mit Kauf-/Verkaufsorders, Matching | Alle (Händler mit Datenvorteil) |
| Direkthandel | Privates Angebot an bestimmten Spieler | Alle |
| Exklusivverträge | Langfristige Liefervereinbarungen über mehrere Zyklen | Händler & Farmer |
| Genossenschafts-/Gilden-Markt | Interner Markt nur für Mitglieder | Koop-Mitglieder |
| Die Bank | Immer verfügbar, dynamische Preise, Sicherheitsnetz | Alle |

**Direkthandel im Detail:**
- Spieler A macht Spieler B ein privates Angebot – nur die beiden sehen es
- Gut für etablierte Handelsbeziehungen und diskrete Deals
- Kein Einfluss auf öffentliche Marktpreise

**Exklusivverträge im Detail:**
- Langfristige Vereinbarung: X Einheiten pro Erntezyklus zu Preis Y
- Läuft über mehrere Zyklen – bindend!
- Nichterfüllung führt zu Reputationsverlust
- Vorteil Farmer: Planungssicherheit und garantierte Abnahme
- Vorteil Händler: Gesicherte Ware, evtl. unter Marktpreis bei steigenden Preisen

### 3.7 Transaktionsgebühren

Jeder Handel hat Kosten. Das verhindert Spam-Handel und macht den Händler mit seinen Effizienz-Vorteilen wertvoller:

| Kanal | Gebühr | Wer zahlt |
|---|---|---|
| Sofortmarkt | 2% | Käufer |
| Kaffeebörse | 1% (je 0,5%) | Käufer + Verkäufer |
| Direkthandel | 0,5% | Käufer |
| Exklusivvertrag | Keine | Anreiz für langfristige Deals |
| Die Bank | Keine (aber schlechterer Spread) | Im Preis enthalten |

### 3.8 Handelbare Güter – Gesamtübersicht

| Gut | Erzeugt von | Gekauft von | Handelsplatz |
|---|---|---|---|
| Rohkaffee (div. Sorten) | Farmer | Händler, (Cafés) | Kaffeebörse |
| Gewaschener Kaffee | Farmer, Händler | Händler, Röster | Kaffeebörse |
| Gerösteter Kaffee | Händler, (Farmer) | Cafés | Sofortmarkt / Börse |
| Blend-Marken | Händler | Cafés | Sofortmarkt |
| Spezialitäten / Single Origin | Farmer, Händler | Cafés, Händler | Kaffeebörse |
| Zubehör (Milch, Sirup, Becher) | Bank | Cafés | Sofortmarkt |
| Dünger, Saatgut | Bank | Farmer | Sofortmarkt |
| Ausrüstung | Bank | Alle | Sofortmarkt |

---

## 4. Spielpfad: Café-Betreiber

### 4.1 Kern-Loop

Kaffee einkaufen → Getränke anbieten → Kunden kommen → Geld verdienen → reinvestieren

Das Café ist ein stetiger Einkommensstrom. Kunden kommen automatisch (Idle-Teil), aber Menge und Qualität hängen von den Entscheidungen des Spielers ab.

### 4.2 Standorte

Jedes Café steht in einem abstrakten Viertel-Typ, der die Grundwerte bestimmt:

| Viertel-Typ | Miete | Laufkundschaft | Dominanter Kundentyp | Preis-Toleranz |
|---|---|---|---|---|
| Geschäftsviertel | Hoch | Sehr hoch | Pendler (schnell, to-go) | Mittel |
| Altstadt/Zentrum | Sehr hoch | Hoch | Touristen + Mix | Hoch |
| Uni-Viertel | Niedrig | Hoch | Studenten (preissensibel) | Niedrig |
| Wohnviertel | Niedrig | Niedrig | Stammkunden-Potenzial | Mittel |
| Trendviertel | Mittel | Mittel | Hipster (qualitätsfokussiert) | Hoch |

Es gibt kein „bestes“ Viertel – jedes belohnt eine andere Strategie.

### 4.3 Getränke-Menü

8–12 Getränke in drei Kategorien, die stufenweise freigeschaltet werden.

**Basis (sofort verfügbar):**

| Getränk | Benötigt | Marge | Beliebtheit |
|---|---|---|---|
| Filterkaffee | Bohnen (Standard) | Niedrig | Hoch |
| Espresso | Bohnen (Gut) + Maschine Lvl 2 | Mittel | Mittel |
| Cappuccino | Bohnen (Gut) + Milch + Maschine Lvl 2 | Mittel-Hoch | Hoch |
| Tee | Tee-Sortiment | Niedrig | Mittel |

**Erweitert (Maschinen-Upgrade nötig):**

| Getränk | Benötigt | Marge | Beliebtheit |
|---|---|---|---|
| Latte Macchiato | Bohnen (Gut) + Milch + Maschine Lvl 2 | Mittel | Hoch |
| Americano | Bohnen (Standard) + Maschine Lvl 2 | Mittel | Mittel |
| Chai Latte | Chai-Sirup + Milch | Mittel-Hoch | Mittel |
| Heiße Schokolade | Kakao + Milch | Mittel | Mittel |

**Premium (Premium-Bohnen + Maschine Lvl 3 + geschulter Barista):**

| Getränk | Benötigt | Marge | Beliebtheit |
|---|---|---|---|
| Cold Brew | Premium-Bohnen + spez. Ausrüstung | Hoch | Mittel |
| Flat White | Premium-Bohnen + Maschine Lvl 3 | Hoch | Mittel |
| Specialty Single Origin | Spezialitäten-Bohnen + Barista Skill 3+ | Sehr hoch | Niedrig |
| Saisongetränk | Wechselt (z.B. Pumpkin Spice) | Hoch | Variabel |

### 4.4 Personal

| Rolle | Funktion | Kern-Mechanik |
|---|---|---|
| Barista | Stellt Getränke her | Skill-Level bestimmt Getränkequalität und Geschwindigkeit |
| Servicekraft | Bedient Kunden | Beeinflusst Zufriedenheit und Verweildauer |
| Manager | Führt Café autonom | Benötigt ab Café Nr. 2, ohne Manager: Idle-Penalty |

**Personal-Mechaniken:**
- Skill-Level: Steigt über Zeit, kann durch Schulung beschleunigt werden (kostet CC + Zeit)
- Gehalt: Höherer Skill → höhere Gehaltserwartung
- Zufriedenheit: Schlechte Bezahlung oder Überarbeitung → Kündigung
- Kapazität: Jeder Barista kann X Getränke pro Zeiteinheit. Mehr Kunden als Kapazität → Wartezeit → schlechte Bewertung

### 4.5 Preissetzung

Für jedes Getränk auf der Karte wird der Verkaufspreis aktiv vom Spieler festgelegt. Das System reagiert dynamisch:

- Preis zu hoch → weniger Verkäufe, höhere Marge pro Stück
- Preis zu niedrig → mehr Verkäufe, weniger Marge, evtl. Verlust
- Sweet Spot → abhängig von Viertel, Qualität und Konkurrenz
- Realwelt-Events können den Sweet Spot verschieben (steigende Einkaufspreise)

### 4.6 Kundenzufriedenheit & Bewertung

Dynamische Bewertung von 1–5 Sternen als gleitender Durchschnitt.

**Bewertungsfaktoren:**

| Faktor | Einflussgrößen |
|---|---|
| Getränkequalität | Bohnen-Qualität + Maschinen-Level + Barista-Skill |
| Service | Servicekraft-Skill + Wartezeit |
| Atmosphäre | Einrichtungs-Level |
| Preis-Leistung | Preis vs. Qualität vs. Viertel-Erwartung |
| Bonus/Malus | Events, Kooperationen, Werbung |

**Auswirkung der Bewertung:**
- 1–2 Sterne: Nur verzweifelte Laufkundschaft
- 3 Sterne: Solider Betrieb, moderate Kundschaft
- 4 Sterne: Stammkunden entstehen, Word-of-Mouth-Bonus
- 5 Sterne: Premium-Kunden, Sichtbarkeit in Rankings

### 4.7 Einrichtung & Atmosphäre

| Kategorie | Effekt | Upgrade-Kosten |
|---|---|---|
| Mobiliar | Sitzplatzkapazität + Komfort | CC |
| Dekoration | Atmosphäre-Score | CC |
| Technik | WLAN, Steckdosen → zieht Studenten/Arbeiter an | CC |
| Außenbereich | Bonus-Kapazität im Sommer (Saison-Event) | CC + höhere Miete |

### 4.8 Café-Kooperationen

Mehrere Café-Betreiber können eine „Kette“ gründen mit gemeinsamem Branding. Stammkunden eines Cafés besuchen auch die anderen – ein starker Anreiz zur Kooperation. Gemeinsame Bonusprogramme erhöhen die Kundenbindung.

---

## 5. Spielpfad: Farmer

### 5.1 Kern-Loop

Land erwerben → Anbauen → Pflegen → Ernten → Verkaufen/Verarbeiten → Reinvestieren

Der Farmer arbeitet in Zyklen – investieren, warten, ernten, großer Payday. Das Spielgefühl ist völlig anders als beim Café: strategische Geduld statt stetigem Strom.

### 5.2 Kaffeesorten

| Sorte | Anbaudauer | Ertrag | Qualität | Marktpreis | Risiko |
|---|---|---|---|---|---|
| Robusta | Kurz | Hoch | Niedrig | Niedrig | Gering |
| Arabica Standard | Mittel | Mittel | Mittel | Mittel | Mittel |
| Arabica Premium | Lang | Niedrig | Hoch | Hoch | Hoch |
| Spezialität (z.B. Geisha) | Sehr lang | Sehr niedrig | Exzellent | Sehr hoch | Sehr hoch |

Natürliche Risiko-Rendite-Kurve: Robusta ist das sichere Einkommen, Spezialitäten-Kaffee die Wette auf großen Gewinn.

### 5.3 Regionen & Plantagen

| Region | Klima | Gut für | Risiken | Landpreis |
|---|---|---|---|---|
| Tiefland Tropen | Feucht-heiß | Robusta | Schädlinge | Niedrig |
| Hochland Mittelamerika | Gemäßigt | Arabica Standard | Sturm | Mittel |
| Hochland Ostafrika | Kühl-trocken | Arabica Premium | Dürre | Hoch |
| Vulkanboden Spezial | Perfekt | Spezialitäten | Vulkan-Events | Sehr hoch |

### 5.4 Der Anbauzyklus

**Phase 1: Pflanzen**
Sorte wählen, Feld bepflanzen. Kosten: Saatgut + Arbeitskraft.

**Phase 2: Wachstum (Idle-Phase)**
Pflanzen wachsen automatisch über X Spielzeit. Während des Wachstums fallen aktive Entscheidungen an:
- Dünger einsetzen? → Kosten steigen, Ertrag steigt
- Bewässerung? → Kosten steigen, Dürre-Risiko sinkt
- Schädlingsbekämpfung? → Kosten steigen, Verlust-Risiko sinkt

**Phase 3: Ernte**
Ernte-Qualität = Sorte + Pflege + Zufall + Events. Menge = Feldgröße × Ertragsfaktor.

**Phase 4: Nachbearbeitung**
Der Farmer entscheidet, wie weit er die Bohnen selbst verarbeitet:
- Rohkaffee verkaufen → weniger Arbeit, geringste Marge
- Selbst aufbereiten (Washing/Natural) → Qualitäts-Bonus, mittlere Marge
- Selbst rösten → große Investition nötig, aber höchste Marge und Direktverkauf an Cafés möglich

### 5.5 Personal & Ausrüstung

| Ressource | Funktion | Upgrade-Effekt |
|---|---|---|
| Feldarbeiter | Pflanzen & Ernten | Mehr → größere Felder bearbeitbar |
| Agrar-Spezialist | Pflege & Schädlingsbekämpfung | Höherer Skill → bessere Qualität |
| Aufbereitungsanlage | Washing/Natural Processing | Level → höhere Qualitätsstufen |
| Rösterei | Bohnen selbst rösten | Level → Premium-Röstung möglich |
| Lager | Rohkaffee/Fertigware lagern | Größe → mehr Vorrat, Markt-Timing |

Das Lager ist strategisch wichtig: Bei schlechten Marktpreisen einlagern und auf bessere Preise warten. Aber Lagerung kostet – und bei zu langer Lagerung sinkt die Qualität.

### 5.6 Risiken & Events

**Permanente Risiken:**
- Schädlingsbefall (Kaffeekirschenkäfer) → Ernte teilweise zerstört
- Krankheiten (Kaffeerost) → kann ganze Felder befallen
- Wetter-Extreme → Dürre, Frost, Überschwemmung

**Gegenmaßnahmen:**
- Versicherung abschließen → regelmäßige Kosten, Schutz vor Totalverlust
- Diversifikation → mehrere Felder, verschiedene Sorten/Regionen
- Genossenschaften → geteiltes Risiko, geteilter Gewinn

### 5.7 Farmer-Kooperationen: Genossenschaften

- Gemeinsamer Dünger-/Saatgut-Einkauf → Mengenrabatt
- Gemeinsame Aufbereitungsanlage teilen → niedrigere Investition pro Spieler
- Gemeinsam am Markt auftreten → Genossenschafts-Marke = Qualitätssiegel = Preisaufschlag
- Erträge werden nach Beitrag aufgeteilt, Entscheidungen müssen abgestimmt werden

---

## 6. Spielpfad: Händler

### 6.1 Warum Händler spielen?

Obwohl Farmer direkt an Cafés verkaufen können, bietet der Händler drei unschlagbare Vorteile:

- **Volumen & Effizienz:** Economies of Scale – professionelle Rösterei mit 10x Kapazität = niedrigere Stückkosten
- **Sortiment & Bequemlichkeit:** Alles aus einer Hand (Bohnen, Milch, Sirup, Becher) statt bei 5 Quellen einzeln kaufen
- **Marktmacht & Information:** Sieht beide Seiten – was Farmer anbieten UND was Cafés brauchen. Wissen ist Macht.

### 6.2 Kern-Loop

Einkaufen (Farmer/Bank) → Verarbeiten/Veredeln → Lagern → Verkaufen (Cafés/Markt) → Reinvestieren

Der Händler lebt von Timing, Netzwerk und Marktkenntnis. Es ist der dynamischste und anspruchsvollste Spielpfad.

### 6.3 Einkauf

| Quelle | Vorteil | Nachteil |
|---|---|---|
| Einzelne Farmer | Verhandlungsspielraum, Exklusivverträge | Kleine Mengen, unzuverlässig |
| Genossenschaften | Große Mengen, konstante Qualität | Weniger Verhandlungsspielraum |
| Die Bank | Immer verfügbar, sofort | Höhere Preise, Standard-Qualität |
| Andere Händler | Spezialitäten weiterverkaufen | Geringe Marge |

**Exklusivverträge:** Ein Händler kann mit einem Farmer vereinbaren: „Ich kaufe deine gesamte nächste Ernte zu Preis X.“ Der Farmer hat Planungssicherheit, der Händler sichert sich Ware. Wenn ein Frost-Event die Preise hochtreibt, profitiert der Händler. Fallen die Preise, sitzt er auf zu teurer Ware. Hohes Risiko, hohe Belohnung.

### 6.4 Verarbeitung & Veredelung

| Stufe | Investition | Kapazität | Ergebnis |
|---|---|---|---|
| Aufbereitung (Basic) | Niedrig | Klein | Rohkaffee → gewaschener Kaffee |
| Rösterei (Standard) | Mittel | Mittel | Gewaschener Kaffee → Röstkaffee |
| Rösterei (Premium) | Hoch | Groß | Spezialröstungen, Blends, Single Origin |
| Blend-Labor | Sehr hoch | – | Eigene Mischungen → Markenbildung |

Das Blend-Labor ist der Endgame-Content für Händler: Eigene Mischungen aus verschiedenen Bohnen kreieren und als eigene Marke verkaufen. Cafés wollen deine Blends, du bestimmst den Preis.

### 6.5 Lager & Logistik

- **Kapazität:** Upgradefähig, bestimmt maximale Lagermenge
- **Lagerkosten:** Pro Einheit pro Spielzeit – großes Lager = große Kosten
- **Qualitätsverlust:** Rohkaffee verliert langsam Qualität, Röstkaffee schneller
- **Strategie:** Antizyklisch handeln – bei Überangebot günstig einlagern, bei Knappheit teuer verkaufen

### 6.6 Verkaufskanäle

| Kanal | Marge | Aufwand | Voraussetzung |
|---|---|---|---|
| Marktplatz (offen) | Niedrig-Mittel | Gering | Keine |
| Direkt an Cafés | Mittel-Hoch | Mittel | Reputation + Beziehung |
| Langzeit-Lieferverträge | Stabil, planbar | Hoch | Hohe Reputation |
| Eigene Marke (Blend) | Höchste | Sehr hoch | Blend-Labor + Marketing |

### 6.7 Reputations-System

Der Händler hat ein einzigartiges Beziehungssystem, das die anderen Pfade so nicht haben:

- **Farmer-Reputation:** Zahlst du pünktlich? Bietest du faire Preise? Hohe Rep = bessere Farmer wollen mit dir handeln. Niedrige Rep = nur Bank oder verzweifelte Farmer.
- **Café-Reputation:** Lieferst du zuverlässig? Stimmt die Qualität? Hohe Rep = Langzeitverträge, Premium-Cafés als Kunden. Niedrige Rep = nur Spot-Markt-Verkäufe.
- **Markt-Reputation:** Dein allgemeines Ansehen. Beeinflusst, ob andere Spieler überhaupt mit dir handeln wollen. Reputation ist schwer aufzubauen und leicht zu verlieren – ein gebrochener Liefervertrag schadet sofort.

### 6.8 Personal

| Rolle | Funktion |
|---|---|
| Röstmeister | Bestimmt Röst-Qualität, kann Blends entwickeln |
| Lagerarbeiter | Umschlagkapazität – wie viel Ware bewegt werden kann |
| Einkäufer | Automatisiert Einkäufe nach deinen Regeln (Idle-Komfort) |
| Vertriebler | Pflegt Café-Beziehungen, findet neue Kunden |
| Qualitätsprüfer | Erkennt minderwertige Ware vor dem Kauf (Risiko-Reduktion) |

### 6.9 Händler-Kooperationen

- **Handelsgilden:** Mehrere Händler bündeln Einkaufsvolumen → bessere Preise
- **Logistik teilen:** Gemeinsame Lager, geteilte Kosten
- **Marktabsprachen:** Gemeinsam Preise stabilisieren (lukrativ, aber riskant – siehe Graue Mechaniken)

---

## 7. Graue Mechaniken

CoffeeChain erlaubt ethisch fragwürdige, aber realistische Geschäftspraktiken – mit dem Risiko, erwischt zu werden.

### 7.1 Kartellbildung

Händler können Preisabsprachen treffen, um den Markt zu kontrollieren.
- **Vorteil:** Gemeinsam höhere Preise durchsetzen → mehr Gewinn für alle Beteiligten
- **Risiko:** „Kartellamt-Event“ – zufällige Untersuchungen, die bei Auffälligkeiten zu Strafen führen
- **Strafen:** Hohe Geldbußen, Reputationsverlust, temporäres Handelsverbot

### 7.2 Qualitätsbetrug

Minderwertige Ware als Premium verkaufen – kurzfristig profitabel, langfristig zerstörerisch.
- **Vorteil:** Höhere Marge auf billige Ware
- **Risiko:** Qualitätsprüfung durch Kunden/Cafés → Reputationsschaden
- **Schwerer Fall:** „Lebensmittelskandal-Event“ → massive Strafen, Kundenverlust

### 7.3 Marktmanipulation

Große Mengen aufkaufen, um künstliche Knappheit zu erzeugen.
- **Vorteil:** Preise treiben und teuer verkaufen
- **Risiko:** Andere Spieler weichen auf Alternativen aus, Bank erhöht Angebot
- **Langfristiges Risiko:** Reputation als „Marktmanipulator“ – Spieler meiden dich

---

## 8. CoffeeCoins & Monetarisierung

### 8.1 CoffeeCoin (CC) – Die Spielwährung

CoffeeCoins sind die zentrale Währung in CoffeeChain. Sie werden im Spiel verdient und für alle In-Game-Transaktionen verwendet.

**CC verdienen:**
- Getränke verkaufen (Café)
- Kaffee am Markt verkaufen (Farmer/Händler)
- Handelsgewinne (Händler)
- Wochenziele erreichen

**CC ausgeben:**
- Waren einkaufen (Bohnen, Zubehör, Dünger)
- Personal bezahlen
- Upgrades & Expansion
- In-Game-Werbeflächen buchen

### 8.2 Monetarisierung – Drei Ebenen

**Ebene 1: Werbefreiheit**
Spieler zahlt echtes Geld → keine Werbebanner mehr. Klassisches Freemium-Modell.

**Ebene 2: In-Game-Werbeflächen**
Spieler können Werbeflächen in der Spielwelt buchen – auf dem Kaffeetraktor, im Café, auf dem Marktplatz. Das erhöht Sichtbarkeit und kann zu mehr Kunden/Verkäufen führen. Bezahlbar mit CC (erspielt) ODER echtem Geld. Pay-to-Accelerate, nicht Pay-to-Win: Wer viel spielt, erreicht das gleiche ohne echtes Geld.

**Ebene 3: Echtgeld → CC Tausch**
Spieler können echtes Geld in CoffeeCoins tauschen. Wichtig: Einbahnstraße – CC können NICHT zurück in Echtgeld getauscht werden. Das vermeidet rechtliche Probleme mit Glücksspiel- und Finanzregulierung.

### 8.3 Werbeflächen im Detail

Werbeflächen sind eine In-Game-Spielmechanik. Spieler buchen Werbeplätze in der Spielwelt, um ihre Produkte, Cafés oder Marken sichtbarer zu machen.

| Werbeplatz | Effekt | Dauer | Preis (CC) | Preis (Echtgeld) |
|---|---|---|---|---|
| Café-Schild | +15% Laufkundschaft für dein Café | 7 Spieltage | 50 CC | 0,50 € |
| Marktplatz-Banner | Angebot steht ganz oben | 3 Spieltage | 30 CC | 0,30 € |
| Kaffeetraktor-Werbung | +10% Bekanntheit Farmer-Marke | 7 Spieltage | 80 CC | 0,80 € |
| Stadtweite Kampagne | +20% Kundenstrom alle Cafés | 5 Spieltage | 150 CC | 1,50 € |
| Börsen-Spotlight | Verkaufsorder hervorgehoben | 1 Spieltag | 20 CC | 0,20 € |
| Genossenschafts-Siegel | +10% Preisaufschlag akzeptiert | 7 Spieltage | 100 CC | 1,00 € |
| Premium-Listung | Blend in Empfehlungen sichtbar | 5 Spieltage | 120 CC | 1,20 € |

**Kernregeln für Werbeflächen:**
- Kein Pay-to-Win: Jede Fläche ist mit CC (erspielt) ODER Echtgeld buchbar
- Effekte sind Vorteile, keine Garantien – Werbung auf schlechte Produkte verpufft
- Begrenzte Plätze pro Viertel (3–5 Café-Schilder, 10 Marktplatz-Banner)
- Alle Plätze belegt → Auktionsmechanik: Wer mehr bietet, bekommt den Platz
- Werbeflächen sind ein wichtiger CC-Sink (Geld fließt aus dem Spiel)

### 8.4 CC-Echtgeld-Wechselkurs

Basisrate: 1 € = 100 CC. Nur Einbahnstraße: Echtgeld → CC, niemals CC → Echtgeld.

| Paket | Preis | CC | Bonus | Entspricht Spielzeit |
|---|---|---|---|---|
| Espresso | 1,99 € | 200 CC | – | ~1–2 Spieltage Gewinn |
| Cappuccino | 4,99 € | 550 CC | +10% | ~3–4 Spieltage Gewinn |
| Grande | 9,99 € | 1.200 CC | +20% | ~1 Spielwoche Gewinn |
| Barista | 19,99 € | 2.600 CC | +30% | ~2 Spielwochen Gewinn |

---

## 9. Kooperations-System

Kooperationen sind ein zentrales Element von CoffeeChain und bieten Vorteile auf allen Ebenen.

### 9.1 Horizontale Kooperationen (innerhalb eines Pfads)

| Pfad | Kooperationsform | Vorteil |
|---|---|---|
| Café | Ketten-Gründung / gemeinsames Bonusprogramm | Geteilte Stammkunden, stärkere Marke |
| Farmer | Genossenschaften | Mengenrabatte, geteilte Anlagen, Qualitätssiegel |
| Händler | Handelsgilden | Einkaufsvolumen, geteilte Logistik |

### 9.2 Vertikale Kooperationen (über Pfade hinweg)

- **Farmer + Händler:** Exklusivverträge, planbare Einnahmen für beide Seiten
- **Händler + Café:** Langzeit-Lieferverträge, garantierte Qualität und Preisstabilität
- **Farmer + Café:** Direktlieferung (Farm-to-Cup), Premium-Positionierung

---

## 10. Wöchentliche Rankings & KPIs

Jede Woche starten alle KPI-Rankings bei 0. Der Besitz bleibt, aber der Wettbewerb ist jede Woche frisch.

### 10.1 Mögliche KPI-Kategorien

| KPI | Pfad | Was wird gemessen |
|---|---|---|
| Umsatz | Alle | Gesamteinnahmen der Woche |
| Gewinn | Alle | Einnahmen minus Ausgaben |
| Kundenzufriedenheit | Café | Durchschnittliche Bewertung |
| Erntemenge | Farmer | Kg Kaffee geerntet |
| Handelsvolumen | Händler | Gesamtwert aller Transaktionen |
| Qualitäts-Champion | Alle | Durchschnittliche Qualität der Produkte |
| Kooperations-König | Alle | Anzahl aktiver Kooperationen |

---

## 11. Balancing

### 11.1 Spielzeit-Taktung

1 Spieltag = 4 echte Stunden. Das ergibt 6 Spieltage pro echtem Tag und eine Spielwoche von 28 echten Stunden (~1,2 echte Tage).

| Zyklus | Spielzeit | Echtzeit |
|---|---|---|
| Robusta-Ernte | 3 Spieltage | 12 echte Stunden |
| Arabica Standard-Ernte | 5 Spieltage | 20 echte Stunden |
| Arabica Premium-Ernte | 10 Spieltage | 40 Std. (~1,7 Tage) |
| Spezialität-Ernte | 15 Spieltage | 60 Std. (~2,5 Tage) |
| Café-Lager reicht | 2–3 Spieltage | 8–12 echte Stunden |
| Markt-Angebote | 12–24 Spielstunden | 2–4 echte Stunden |
| Spielwoche (KPI-Reset) | 7 Spieltage | 28 echte Stunden |

### 11.2 Wertschöpfungskette – Preise & Margen

Jede Stufe der Kette verdoppelt bis verdreifacht den Wert. Wer mehr Stufen selbst abdeckt, hat höhere Margen – aber auch höhere Kosten und Komplexität.

**Farmer: Anbaukosten pro Feld pro Zyklus**

| Sorte | Saatgut | Dünger (opt.) | Bewässerung (opt.) | Schädlingsschutz (opt.) | Gesamt min | Gesamt max |
|---|---|---|---|---|---|---|
| Robusta | 2 CC | +1 CC | +1 CC | +1 CC | 2 CC | 5 CC |
| Arabica Standard | 4 CC | +2 CC | +2 CC | +2 CC | 4 CC | 10 CC |
| Arabica Premium | 8 CC | +4 CC | +3 CC | +3 CC | 8 CC | 18 CC |
| Spezialität | 15 CC | +6 CC | +5 CC | +5 CC | 15 CC | 31 CC |

**Farmer: Ernte-Ertrag pro Feld**

| Sorte | Zyklus (Spieltage) | Ertrag (Einheiten) | Wert/Einheit | Erlös gesamt |
|---|---|---|---|---|
| Robusta | 3 | 20 | 0,5 CC | 10 CC |
| Arabica Standard | 5 | 15 | 1 CC | 15 CC |
| Arabica Premium | 10 | 8 | 3 CC | 24 CC |
| Spezialität | 15 | 4 | 10 CC | 40 CC |

**Nachbearbeitung – Wertsteigerung**

| Verarbeitungsstufe | Kosten/Einheit | Wertsteigerung | Neuer Wert (Arabica Std.) |
|---|---|---|---|
| Rohkaffee (unverarbeitet) | 0 CC | Basis | 1,0 CC |
| Gewaschen / Natural | 0,3 CC | +50% | 1,5 CC |
| Selbst geröstet | 0,8 CC | +150% | 2,5 CC |

### 11.3 Bank-Preise & Spread

Bank-Spread beträgt immer mindestens 40%. Spieler-zu-Spieler-Handel ist IMMER günstiger als die Bank.

| Ware | Referenzpreis | Bank kauft für | Bank verkauft für | Spread |
|---|---|---|---|---|
| Robusta roh | 0,5 CC | 0,4 CC | 0,6 CC | 40% |
| Arabica Standard roh | 1,0 CC | 0,8 CC | 1,2 CC | 40% |
| Arabica Premium roh | 3,0 CC | 2,4 CC | 3,6 CC | 40% |
| Spezialität roh | 10,0 CC | 8,0 CC | 12,0 CC | 40% |
| Gerösteter Kaffee (Std.) | 2,2 CC | 1,8 CC | 2,6 CC | 40% |
| Milch (10 Einheiten) | 3,0 CC | – | 3,0 CC | – |
| Dünger | 1,0 CC | – | 1,0 CC | – |

**Dynamische Bank-Preisformel:**
- Basis-Preis = Sortengrundwert × Realwelt-Event-Faktor
- Nachfrage-Faktor: 0,9 bis 1,3 (steigt, wenn viele Spieler kaufen)
- Angebots-Faktor: 0,7 bis 1,1 (sinkt, wenn viele Spieler verkaufen)
- Absolute Obergrenze: 150% des Referenzpreises (Neueinsteiger-Schutz)
- Absolute Untergrenze: 50% des Referenzpreises (Farmer-Schutz)

### 11.4 Getränke-Kalkulation (Café)

| Getränk | Rohstoffkosten | Verkaufspreis (Sweet Spot) | Marge/Stück | Verkäufe/Spieltag |
|---|---|---|---|---|
| Filterkaffee | 1 CC | 3 CC | 2 CC | 25–40 |
| Espresso | 1,5 CC | 4 CC | 2,5 CC | 15–25 |
| Cappuccino | 2,5 CC | 6 CC | 3,5 CC | 20–35 |
| Latte Macchiato | 2,5 CC | 6 CC | 3,5 CC | 15–25 |
| Americano | 1,5 CC | 4 CC | 2,5 CC | 10–20 |
| Chai Latte | 2 CC | 5 CC | 3 CC | 8–15 |
| Heiße Schokolade | 2 CC | 5 CC | 3 CC | 8–15 |
| Cold Brew | 3 CC | 8 CC | 5 CC | 5–12 |
| Flat White | 3,5 CC | 9 CC | 5,5 CC | 5–10 |
| Specialty Single Origin | 5 CC | 14 CC | 9 CC | 3–8 |
| Saisongetränk | 3 CC | 8 CC | 5 CC | 8–15 |

### 11.5 Laufende Kosten

| Kostenstelle | Uni-Viertel | Wohnviertel | Geschäftsviertel | Trendviertel | Altstadt |
|---|---|---|---|---|---|
| Miete / Spieltag | 10 CC | 8 CC | 20 CC | 15 CC | 25 CC |
| Barista / Spieltag | 15 CC | 15 CC | 15 CC | 15 CC | 15 CC |
| Servicekraft / Spieltag | 10 CC | 10 CC | 10 CC | 10 CC | 10 CC |
| Manager / Spieltag | 25 CC | 25 CC | 25 CC | 25 CC | 25 CC |

### 11.6 Investitionskosten & Progression

**Einstieg (Startkapital: 500 CC geschenkt):**

| Pfad | Erste Investition | Erste Einnahme nach |
|---|---|---|
| Café | Basis-Café: ~300 CC | 1 Spieltag (~4 Std.) |
| Farmer | 1 Feld + Robusta: ~50 CC | 3 Spieltage (~12 Std.) |
| Händler | Aufbereitung + Einkauf: ~150 CC | 1 Spieltag (~4 Std.) |

**Upgrades & Meilensteine:**

| Upgrade | Kosten | Effekt | ROI (Spieltage) |
|---|---|---|---|
| Kaffeemaschine Lvl 2 | 200 CC | Erweiterte Getränke | ~5 |
| Kaffeemaschine Lvl 3 | 500 CC | Premium-Getränke | ~10 |
| 2. Café eröffnen | 800 CC | Doppelte Einnahmen (+ Manager!) | ~8 |
| 2. Feld (Farmer) | 100 CC | Doppelte Ernte | ~3–5 |
| Rösterei Standard | 200 CC | Selbst rösten möglich | ~6 |
| Rösterei Premium | 500 CC | Höhere Kapazität, niedrigere Stückkosten | ~12 |
| Blend-Labor | 1.000 CC | Eigene Marken kreieren | ~20 |

### 11.7 Personal-Balancing

| Skill-Level | Gehalt/Spieltag | Leistung | Trainingskosten | Trainingszeit |
|---|---|---|---|---|
| Level 1 (Anfänger) | 10 CC | Basis (100%) | – | – |
| Level 2 (Erfahren) | 18 CC | +30% | 50 CC | 3 Spieltage |
| Level 3 (Profi) | 28 CC | +60% | 120 CC | 5 Spieltage |
| Level 4 (Experte) | 40 CC | +100% | 250 CC | 8 Spieltage |
| Level 5 (Meister) | 55 CC | +150% | 500 CC | 12 Spieltage |

Gehalt steigt steiler als Leistung: Ein Level-5-Mitarbeiter ist 2,5× so gut wie Level 1, kostet aber 5,5× so viel. Natürliches Skill-Wachstum: Alle ~10 Spieltage +1 Level ohne Training.

**Zufriedenheits-System:**
- Start: 70 von 100 Punkten
- Gehalt über Erwartung: +5/Spieltag | Unter Erwartung: -10/Spieltag
- Ausreichend Personal: +3/Spieltag | Überarbeitung (>120% Last): -8/Spieltag
- Training erhalten: +10 (einmalig) | Kein Training seit 20 Tagen: -3/Spieltag
- Unter 30 Punkte: Kündigungsrisiko (10% pro Spieltag) | Unter 10: Sofortige Kündigung

### 11.8 Event-Balancing

| Event | Effekt | Dauer | Häufigkeit |
|---|---|---|---|
| Frost-Warnung | Hochland -30%, Arabica +20% | 3–5 Spieltage | ~alle 2 Spielwochen |
| Monsun-Saison | Tiefland +50% Zeit, Robusta +15% | 5–7 Spieltage | ~alle 3 Spielwochen |
| Marktboom | Alle Verkaufspreise +15% | 3 Spieltage | ~alle 2 Spielwochen |
| Marktkrise | Alle Verkaufspreise -15% | 3 Spieltage | ~alle 3 Spielwochen |
| Schädlingsplage | Betroffene Felder -20 bis -50% | 2–4 Spieltage | ~alle 4 Spielwochen |
| Forschungsdurchbruch | Neues Saatgut, +10% Ertrag | Permanent | ~alle 6 Spielwochen |
| Kaffee-Trend | Bestimmtes Getränk +30% Nachfrage | 5 Spieltage | ~alle 2 Spielwochen |

**Event-Balance-Regeln:**
- Maximaler negativer Effekt: -30% (nie mehr!)
- Maximaler positiver Effekt: +30%
- Maximale Dauer: 7 Spieltage (28 echte Stunden)
- Mindest-Vorwarnung: 1 Spieltag vor Eintreten
- Maximal 2 Events gleichzeitig aktiv

### 11.9 Graue Mechaniken – Risiko-Balancing

| Mechanik | Gewinn | Entdeckungs-Risiko | Strafe |
|---|---|---|---|
| Kartellbildung | +20–40% Preise | 15% pro Spielwoche | 500 CC + 5 Tage Handelsverbot + Rep-Verlust |
| Qualitätsbetrug | +50–100% Marge | 25% pro Transaktion | 200 CC + Rep-Verlust + Vertragskündigungen |
| Marktmanipulation | Variable Gewinne | Auto bei >40% Marktanteil | Bank erhöht Angebot + Rep-Verlust |

### 11.10 Pfad-Balance – Einkommensvergleich

| Pfad | Tagesgewinn (Starter) | Wochengewinn | Skalierung |
|---|---|---|---|
| Café (Starter) | ~160 CC | ~1.120 CC | Höchste laufende Kosten |
| Farmer (3 Felder, Robusta) | ~8 CC (zyklisch) | ~175 CC | Niedrigste Einstiegskosten, skaliert schnell |
| Händler (aktiv) | ~54 CC | ~378 CC | Skaliert über Volumen am besten |
| Vertikal integriert | ~250+ CC | ~1.750+ CC | Höchste Marge, höchste Komplexität |

Hinweis: Alle Zahlen sind Version 0.1 – Ausgangswerte für den Prototyp. Echtes Balancing erfordert Playtesting mit realen Spielern.

---

## 12. Progression & Endgame

### 12.1 Progressions-Kurve

| Phase | Echtzeit | Spielwochen | Ziel | Kapital |
|---|---|---|---|---|
| 1: Einstieg | Tag 1–3 | Woche 1–4 | Erstes Geschäft läuft, erste Gewinne | 500 → 2.000 CC |
| 2: Wachstum | Tag 3–10 | Woche 5–15 | Zweites Café/Farm, erste Kooperationen | 2.000 → 10.000 CC |
| 3: Spezialisierung | Tag 10–30 | Woche 15–45 | Eigene Marke, feste Handelsbeziehungen | 10.000 → 50.000 CC |
| 4: Endgame | Tag 30+ | Woche 45+ | Marktführer, Mentoring, Legendäre Titel | 50.000+ CC |

### 12.2 Prestige-System (Saisons)

Alle 4 echten Wochen endet eine „Kaffee-Saison“. Top-Spieler jeder Kategorie erhalten permanente Titel (z.B. „Kaffeekönig Saison 3“, „Meisterröster Frühjahr 2026“). Titel sind permanent sichtbar für alle Spieler. Optional: Kleine permanente Boni (+2% Reputation-Gewinn).

### 12.3 Meilensteine & Achievements

| Meilenstein | Bedingung | Belohnung |
|---|---|---|
| Erste Tasse | Erstes Getränk verkauft | Titel „Barista-Lehrling“ |
| Ernte-Profi | 1.000 Einheiten geerntet | +5% Erntequalität permanent |
| Handelsgenie | 10.000 CC Handelsvolumen/Woche | Exklusiver Marktplatz-Rahmen |
| Ketten-Mogul | 5 Cafés gleichzeitig | Titel „Kaffee-Tycoon“ |
| Blend-Meister | 10 verschiedene Blends kreiert | Zugang zu seltenen Bohnen-Events |
| Farm-to-Cup | Eigene Bohnen im eigenen Café | Titel „Vertikal Integriert“ |
| Kooperations-König | 5 aktive Kooperationen | +5% Kooperations-Boni |
| Marktflüsterer | 50 erfolgreiche Börsen-Trades | Erweiterte Marktdaten |
| Kaffeelegende | Alle Pfade auf höchstem Level | Legendärer Titel + goldener Rahmen |

### 12.4 Dynamische Endgame-Events

| Event | Voraussetzung | Mechanik |
|---|---|---|
| Kaffee-Olympiade | Min. Level 3 in einem Pfad | Wettbewerb: Bester Blend, schnellste Lieferung, höchste Zufriedenheit |
| Ernte-Auktion | Min. 5 Felder | Seltene Spezialitäten-Samen versteigert, nur 1 Gewinner |
| Franchise-Angebot | Min. 3 Cafés, 4+ Sterne | NPC bietet Franchise-Lizenzierung → passives CC-Einkommen |
| Weltmarkt-Crash | Alle Spieler | Preise fallen 40% – Chance zum günstigen Einkaufen |
| Geheime Bohne | Zufällig für Top-Farmer | Zugang zu extrem seltener Sorte mit höchstem Wert |

### 12.5 Sozialer Endgame-Loop

Der Marktplatz selbst ist das Endgame. Veteranen-Spieler werden wertvoll für neue Spieler: Erfahrene Händler haben die besten Preise, erfahrene Farmer die beste Qualität, erfahrene Café-Betreiber die meisten Kunden. Beziehungen, Reputation und Netzwerk sind der wahre Besitz.

**„Niemals fertig“-Design:**
- Wöchentliche KPI-Resets → Jede Woche neuer Wettbewerb
- Realwelt-Events → Markt ist nie vorhersehbar
- Andere Spieler → Menschen sind die beste KI
- Saisonale Events → Regelmäßig frischer Content
- Vertikale Integration → Wer alles hat, optimiert Details
- Kooperationen → Soziale Dynamik ändert sich ständig

---

## 13. Technische Überlegungen & nächste Schritte

### 13.1 Geplanter Tech-Stack (Vorschlag)

| Komponente | Empfehlung | Begründung |
|---|---|---|
| Frontend | React / Next.js | Browserspiel, schnelles UI, große Community |
| Backend | Node.js / Python | Idle-Berechnungen, Marktplatz-Logik |
| Datenbank | PostgreSQL | Komplexe Beziehungen, Transaktionen |
| Echtzeit | WebSockets | Marktplatz-Updates, Live-Preise |
| Hosting | Cloud (AWS/Vercel) | Skalierbar |

### 13.2 Entwicklungsphasen

**Phase 1: MVP (Minimum Viable Product)**
- Ein Spielpfad vollständig spielbar (empfohlen: Café)
- Grundlegender Marktplatz mit Bank
- Einfache UI (Abstrakt+)
- Basis-Idle-Mechanik

**Phase 2: Erweiterung**
- Farmer-Pfad einführen
- Händler-Pfad einführen
- Spieler-zu-Spieler-Handel
- Kooperations-System

**Phase 3: Polish & Features**
- Realwelt-Events-Integration
- Graue Mechaniken
- Ranking-System
- Monetarisierung & Werbeflächen
- Progression & Endgame-Content
- Visuelle Aufwertung

### 13.3 Offene Design-Fragen

Die folgenden Punkte sollten im weiteren Designprozess geklärt werden:
- Fein-Balancing aller Zahlen durch Playtesting
- Tutorial/Onboarding: Art und Umfang
- Anti-Cheat & Fairness bei Marktplatz-Manipulation
- Rechtliche Prüfung des CC-Echtgeld-Systems
- API-Quellen für Realwelt-Daten (Wetter, Kaffee-Weltmarktpreise)
- Kooperations-System Detailregeln (Gründung, Gewinnverteilung, Abstimmung)
- Reputations-System Detailmechanik
- Saisonale Mechaniken (Jahreszeiten, Saisongetränke)

---

*Ende des Game Design Documents*
