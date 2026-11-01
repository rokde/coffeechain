# Lager-Panel (Issue #9)

Entwurf, nichts gebaut. Keine Änderungen in `src/`. Basis: Branch `claude/harvest-quality-21` (PR #34), damit die Chargen echte Qualitäten haben.

| Datei | Inhalt |
|---|---|
| `lager-1440.png` | Panel rechts, Tabelle |
| `lager-800.png` | Panel neben der linken Spalte, Karten |
| `lager-390.png` | Sheet über die ganze Breite |
| `lager-panel.html` | Quelle. Ohne Parameter: Übersicht mit Zuständen (gefiltert, voll, leer). Mit `?frame=desktop\|tablet\|phone[&state=full\|empty]`: ein Rahmen in Originalgröße |

Screenshots neu erzeugen (Edge headless, absolute Pfade, eigenes `--user-data-dir`):
`msedge --headless=new --window-size=1440,900 --user-data-dir=<tmp> --screenshot=<abs>\lager-1440.png "file:///<abs>/lager-panel.html?frame=desktop"`

## Entwurf in Kürze

- **Einstieg:** Das Lager-Chip in der Leiste („Lager 164 / 250“) wird zum Knopf (`aria-pressed`, hervorgehoben solange das Panel offen ist). Ein Klick öffnet oder schließt das Panel. Es ist kein Werkzeug in der Leiste, weil die schon bei 390 px zwei Zeilen braucht.
- **Aufbau:** Kopf mit Belegung und Balken (roh / gewaschen / frei), nächster Monatswechsel und die dort gebuchten Lagerkosten, Filter (Alle / Roh / Gewaschen), Liste, Fußzeile mit „Zum Markt“.
- **Zeilen:** eine je Sorte × roh/gewaschen × Qualität, unter einer Überschrift je Sorte mit Summe. Die Sim hält jede Ernte als eigene Charge. Das Panel fasst Chargen mit gleicher Sorte, gleichem Zustand und gleicher Qualität zusammen. Gewaschene Chargen mit verschiedenem `readyDay` bleiben getrennt, weil „verkaufbar ab“ verschieden ist.
- **Spalten:** Menge, Qualität (Zahl und Balken, weißer Strich = Schwelle), Verlust pro Monat, Kosten pro Monat, Haltbar bis, bei gewaschenem Kaffee „Verkaufbar ab“ (Datum und „in 16 Tagen“, oder „✓ verkaufbar“).
- **Haltbar bis:** `Qualität − Schwelle` Monate ab heute (Verlust 1 pro Monat), als Monat (`formatMonth`, Jahr nur wenn nicht das laufende) plus „noch 12 Mon.“. Drei Monate oder weniger: Bernstein. Unter der Schwelle: rot, „unter Q 70, seit März“. Die Granularität bleibt Monat, auch in der Wochen-Stufe, weil Verlust und Kosten nur am Monatswechsel gebucht werden.
- **Breiten:** 1440 px (und alles ab 1280): 640 px breites Panel mit Tabelle. 481 bis 1279 px: Panel `Breite − 348 px` neben der linken Spalte, jede Zeile eine Karte mit vier Kennzahlen. Bis 480 px: Sheet über die ganze Breite, deckt die Werkzeugleiste ab, drei Kennzahlen pro Zeile, „Verkaufbar ab“ in voller Breite. Die Umbrüche folgen den bestehenden HUD-Grenzen (1279 / 760 / 480).
- **Platzhalter (gestrichelt, nicht ausgearbeitet):** Slot „Aufträge · #22“ in jeder Sortenüberschrift, Block „Saatgut · folgt mit #26“ am Ende der Liste.

## Offene Fragen für Robert

1. **Schwelle für „haltbar bis“.** Die Bank zahlt unabhängig von der Qualität (PRD §7), die Qualität zählt nur bei Aufträgen (Mindestqualität 70 bis 95). Das Mockup nimmt eine feste Schwelle von 70 an (neuer Wert, `NEU`). Alternativen: (a) feste Schwelle, (b) die Mindestqualität des passenden Auftrags (dann zeigt erst #22 ein sinnvolles Datum), (c) statt eines Datums „Qualität in 3 Monaten“.
2. **Alter einer Charge zeigen?** Dafür müsste die Sim ein Einlagerungsdatum je Charge speichern, `SAVE_VERSION` und `MIN_SAVE_VERSION` würden steigen. Ohne Datum geht nur die Reihenfolge: Chargen liegen in Erntereihenfolge im Array, und die Bank verkauft die ältesten zuerst.
3. **Verkauf nach Charge statt „älteste zuerst“.** Die Bank nimmt die ältesten Chargen, nicht die mit der niedrigsten Qualität. Wer hohe Qualität für einen Auftrag behalten will, kann das nicht steuern. Soll das Panel Verkaufen und Aufbereiten je Zeile bekommen, oder gehört das ins Markt-Mockup (#14, #20, #22)? Im Entwurf gibt es nur „Zum Markt“.
4. **Verlieren gewaschene Chargen Qualität?** Das PRD sagt „Rohkaffee langsam“, `monthlyUpkeep` in `src/sim/storage/daily.ts` zieht aber allen Chargen Qualität ab, auch den gewaschenen. Das Mockup zeigt, was der Code tut (−1). Soll gewaschener Kaffee weniger oder nichts verlieren?
5. **Lagerkosten pro Zeile.** Die Sim bucht einmal pro Monat auf ganze CC aufgerundet (Summe × 0,02, dann `roundCost`). Zeilen zeigen Dezimalstellen (0,64 CC), der Kopf nennt die gebuchte Summe („4 CC (3,28 aufgerundet)“). Reicht das, oder lieber nur die Summe?
6. **Zeiteinheit.** Soll die Haltbarkeit in der Wochen-Stufe (ab Phase 2) in Wochen erscheinen (Kommentar in #9)? Der Entwurf bleibt bei Monaten, weil sich nur monatlich etwas ändert.
7. **Zusammenfassen.** Ist es richtig, gleiche Sorte, Zustand und Qualität zu einer Zeile zu summieren? Sonst entsteht nach einem Jahr pro Ernte eine Zeile, auch bei Gleichstand.
8. **Taste und Einstieg.** Nur das Lager-Chip, oder auch eine Taste? Die belegten Tasten sind V P L G R N B M O Z.
9. **Config-Schlüssel.** `costPerUnitPerDay` und `qualityLossPerDayRaw` gelten pro Monat. Beim Bau umbenennen (`costPerUnitPerMonth` usw.), sonst steht „Day“ im Code und „Monat“ im Panel? Der Hilfetext im Markt-Panel sagt „1 CC je angefangene 50 Einheiten“, die Sim rechnet 0,02 je Einheit auf die Gesamtsumme.
10. **Saatgut (#26).** Eigene Gruppe am Ende der Liste (wie skizziert) oder eigener Tab neben Roh und Gewaschen? Hängt davon ab, ob Saatgut zur Lagerkapazität zählt.
11. **Aufträge (#22).** Slot in der Sortenüberschrift („passt zu 1 Auftrag“) oder eigene Spalte? Ein Klick auf den Slot könnte den Auftrag im Markt-Panel öffnen.

## Beim Bauen zu beachten

- Texte in `src/ui/i18n/de.json`, Zahlen aus `config/balance.json`. Die Schwelle aus Frage 1 wäre ein neuer Eintrag mit `src: "NEU"` und gehört dann in `docs/open-questions.md`.
- Berechnung (Gruppierung, Haltbarkeit, Kosten) als reine Funktion in `src/sim/storage/`, mit Tabellentests. Das Panel liest sie nur.
- Die Daten im Mockup (Qualitäten 69 bis 85, Menge 164 von 250) sind Beispielwerte.
