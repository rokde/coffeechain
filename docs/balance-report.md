# Balance-Report (Bot-Simulation)

Erzeugt mit `npm run balance-sim`. Der Bot spielt die Simulation ohne Grafik. Jeden Spieltag erntet er alle reifen Parzellen, verkauft das ganze Lager an die Bank, pflanzt auf leeren Parzellen (Arabica Standard im Hochland, sonst Robusta), düngt und kauft neue Parzellen. Neue Parzellen kauft er in fester Reihenfolge (bester Boden zuerst), solange das Geld für Saatgut und Dünger aller Parzellen reicht.

Kapital nach PRD §10: Kontostand + Lager zum Bank-Ankaufspreis + bezahlte Parzellenkosten.

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
| 1 | 39 | 82 | 83.372 | 1093 |
| 2 | 40 | 89 | 72.736 | 1093 |
| 3 | 44 | 102 | 59.149 | 1052 |
| 4 | 41 | 89 | 76.735 | 1106 |
| 5 | 43 | 93 | 71.286 | 1106 |
| 6 | 39 | 89 | 70.628 | 1078 |
| 7 | 42 | 92 | 80.180 | 1229 |
| 8 | 40 | 87 | 72.263 | 995 |
| 9 | 40 | 90 | 67.896 | 1080 |
| 10 | 52 | 106 | 59.489 | 1098 |
| 11 | 38 | 84 | 79.105 | 1141 |
| 12 | 41 | 90 | 73.804 | 1061 |
| 13 | 43 | 95 | 77.118 | 1204 |
| 14 | 39 | 85 | 79.657 | 1129 |
| 15 | 41 | 89 | 76.540 | 1081 |
| 16 | 41 | 88 | 77.589 | 1141 |
| 17 | 39 | 85 | 77.506 | 1070 |
| 18 | 39 | 87 | 74.456 | 1035 |
| 19 | 38 | 85 | 76.008 | 1074 |
| 20 | 39 | 91 | 62.619 | 918 |

|  | Tag bis 2.000 CC | Tag bis 10.000 CC | Kapital Tag 200 (CC) | Parzellen |
| --- | --- | --- | --- | --- |
| Median | 40 | 89 | 75.232 | 1.087 |
| Min | 38 | 82 | 59.149 | 918 |
| Max | 52 | 106 | 83.372 | 1.229 |

## Kapitalkurve (CC)

| Tag | Median | Min | Max |
| --- | --- | --- | --- |
| 10 | 610 | 538 | 635 |
| 20 | 966 | 740 | 1.045 |
| 30 | 1.410 | 1.018 | 1.515 |
| 40 | 2.004 | 1.395 | 2.187 |
| 50 | 2.897 | 1.883 | 3.176 |
| 60 | 4.140 | 2.514 | 4.613 |
| 70 | 5.856 | 3.435 | 6.741 |
| 80 | 7.900 | 4.664 | 9.523 |
| 90 | 10.431 | 6.319 | 12.704 |
| 100 | 13.399 | 8.537 | 16.421 |
| 110 | 17.192 | 11.152 | 21.097 |
| 120 | 21.957 | 14.188 | 27.048 |
| 130 | 27.745 | 17.835 | 33.852 |
| 140 | 34.628 | 22.285 | 41.579 |
| 150 | 42.434 | 27.628 | 49.369 |
| 160 | 49.772 | 33.687 | 56.867 |
| 170 | 56.532 | 40.291 | 63.994 |
| 180 | 62.864 | 47.034 | 70.858 |
| 190 | 69.523 | 53.440 | 77.318 |
| 200 | 75.232 | 59.149 | 83.372 |

## Empfehlung zu PRD §12 Punkt 1

Der Median bis 2.000 CC (Tag 40) liegt über dem Ziel von 28 Spieltagen (GDD: 4 Spielwochen).
Phase 1 muss um den Faktor 1,4 schneller werden.
Parzellen sind 19 % der Ausgaben des Bots (Saatgut und Dünger: 81 %).
Empfehlung: **höhere Erträge pro Parzelle**. Alternative: **niedrigere Phasengrenzen**.
Robert entscheidet. Diese Simulation ändert keinen Wert in `config/balance.json`.
