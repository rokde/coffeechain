# Balance-Report (Bot-Simulation)

Erzeugt mit `npm run balance-sim`. Der Bot spielt die Simulation ohne Grafik. Jeden Spieltag erntet er alle reifen Parzellen, verkauft das ganze Lager an die Bank, pflanzt auf leeren Parzellen (Arabica Standard im Hochland, sonst Robusta), düngt und kauft neue Parzellen. Neue Parzellen kauft er in fester Reihenfolge (bester Boden zuerst), solange das Geld für Saatgut und Dünger aller Parzellen reicht.

Kapital nach PRD §10: Kontostand + Lager zum Bank-Ankaufspreis + bezahlte Parzellen und Gebäude.

Jede Buchung bewegt ganze CC (S57): Kosten runden auf, Einnahmen runden ab, einmal je Befehl und Lagerkosten einmal je Spieltag.

## Parameter

| Parameter | Wert |
| --- | --- |
| Spieltage | 200 |
| Seeds | 20 (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20) |
| Startkapital | 500 CC |
| Phase 2 ab | 2.000 CC |
| Phase 3 ab | 10.000 CC |
| Ziel Phase 1 | 28 Spieltage |

## Ergebnis je Seed

| Seed | Tag bis 2.000 CC | Tag bis 10.000 CC | Kapital Tag 200 (CC) | Parzellen |
| --- | --- | --- | --- | --- |
| 1 | 41 | 86 | 77.781 | 1093 |
| 2 | 42 | 93 | 67.071 | 1093 |
| 3 | 48 | 108 | 52.750 | 1052 |
| 4 | 43 | 94 | 70.824 | 1106 |
| 5 | 47 | 98 | 66.248 | 1106 |
| 6 | 42 | 93 | 65.143 | 1078 |
| 7 | 45 | 97 | 73.577 | 1229 |
| 8 | 42 | 90 | 67.436 | 995 |
| 9 | 42 | 94 | 62.355 | 1080 |
| 10 | 56 | 113 | 52.400 | 1098 |
| 11 | 40 | 88 | 73.334 | 1141 |
| 12 | 44 | 94 | 68.294 | 1061 |
| 13 | 46 | 99 | 70.494 | 1204 |
| 14 | 41 | 88 | 74.855 | 1129 |
| 15 | 43 | 92 | 71.828 | 1081 |
| 16 | 42 | 92 | 71.997 | 1141 |
| 17 | 40 | 88 | 72.728 | 1070 |
| 18 | 42 | 91 | 69.477 | 1035 |
| 19 | 40 | 87 | 71.199 | 1074 |
| 20 | 41 | 95 | 57.927 | 918 |

|  | Tag bis 2.000 CC | Tag bis 10.000 CC | Kapital Tag 200 (CC) | Parzellen |
| --- | --- | --- | --- | --- |
| Median | 42 | 93 | 69.986 | 1.087 |
| Min | 40 | 86 | 52.400 | 918 |
| Max | 56 | 113 | 77.781 | 1.229 |

## Kapitalkurve (CC)

| Tag | Median | Min | Max |
| --- | --- | --- | --- |
| 10 | 601 | 534 | 625 |
| 20 | 924 | 730 | 1.014 |
| 30 | 1.324 | 985 | 1.453 |
| 40 | 1.874 | 1.311 | 2.028 |
| 50 | 2.656 | 1.733 | 2.938 |
| 60 | 3.768 | 2.263 | 4.254 |
| 70 | 5.235 | 2.993 | 6.014 |
| 80 | 7.192 | 3.996 | 8.533 |
| 90 | 9.351 | 5.339 | 11.461 |
| 100 | 11.864 | 7.152 | 14.732 |
| 110 | 15.174 | 9.441 | 18.763 |
| 120 | 19.329 | 12.068 | 23.910 |
| 130 | 24.383 | 15.110 | 30.033 |
| 140 | 30.279 | 18.648 | 36.831 |
| 150 | 37.105 | 23.043 | 44.503 |
| 160 | 44.550 | 28.205 | 51.885 |
| 170 | 51.373 | 34.004 | 58.872 |
| 180 | 57.803 | 40.088 | 65.548 |
| 190 | 63.821 | 46.441 | 71.859 |
| 200 | 69.986 | 52.400 | 77.781 |

## Empfehlung zu PRD §12 Punkt 1

Der Median bis 2.000 CC (Tag 42) liegt über dem Ziel von 28 Spieltagen (GDD: 4 Spielwochen).
Phase 1 muss um den Faktor 1,5 schneller werden.
Parzellen sind 21 % der Ausgaben des Bots (Saatgut und Dünger: 79 %).
Empfehlung: **höhere Erträge pro Parzelle**. Alternative: **niedrigere Phasengrenzen**.
Robert entscheidet. Diese Simulation ändert keinen Wert in `config/balance.json`.
