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
| 1 | 40 | 78 | 111.444 | 1093 |
| 2 | 41 | 88 | 96.041 | 1093 |
| 3 | 41 | 84 | 89.705 | 1052 |
| 4 | 37 | 77 | 106.054 | 1106 |
| 5 | 43 | 88 | 96.951 | 1106 |
| 6 | 38 | 80 | 87.140 | 1078 |
| 7 | 45 | 94 | 96.479 | 1229 |
| 8 | 38 | 78 | 94.778 | 995 |
| 9 | 39 | 92 | 66.811 | 1080 |
| 10 | 53 | 99 | 81.609 | 1098 |
| 11 | 33 | 73 | 112.922 | 1141 |
| 12 | 40 | 86 | 104.969 | 1061 |
| 13 | 40 | 85 | 108.570 | 1204 |
| 14 | 39 | 81 | 109.308 | 1129 |
| 15 | 38 | 83 | 98.013 | 1081 |
| 16 | 38 | 79 | 116.612 | 1141 |
| 17 | 39 | 85 | 106.259 | 1070 |
| 18 | 38 | 76 | 105.612 | 1035 |
| 19 | 34 | 74 | 102.648 | 1074 |
| 20 | 37 | 79 | 88.869 | 918 |

|  | Tag bis 2.000 CC | Tag bis 10.000 CC | Kapital Tag 200 (CC) | Parzellen |
| --- | --- | --- | --- | --- |
| Median | 39 | 82 | 100.331 | 1.087 |
| Min | 33 | 73 | 66.811 | 918 |
| Max | 53 | 99 | 116.612 | 1.229 |

## Kapitalkurve (CC)

| Tag | Median | Min | Max |
| --- | --- | --- | --- |
| 10 | 605 | 538 | 653 |
| 20 | 972 | 738 | 1.146 |
| 30 | 1.422 | 1.023 | 1.743 |
| 40 | 2.118 | 1.387 | 2.682 |
| 50 | 3.170 | 1.862 | 4.159 |
| 60 | 4.617 | 2.592 | 6.176 |
| 70 | 6.791 | 3.531 | 9.463 |
| 80 | 9.560 | 5.055 | 13.553 |
| 90 | 13.475 | 7.238 | 19.187 |
| 100 | 17.967 | 10.520 | 26.210 |
| 110 | 23.956 | 14.105 | 34.759 |
| 120 | 31.933 | 17.775 | 45.509 |
| 130 | 41.413 | 23.472 | 54.027 |
| 140 | 51.109 | 29.431 | 63.038 |
| 150 | 60.113 | 35.870 | 72.230 |
| 160 | 68.708 | 44.478 | 82.647 |
| 170 | 76.618 | 48.808 | 92.892 |
| 180 | 84.665 | 55.026 | 98.853 |
| 190 | 92.728 | 61.514 | 108.666 |
| 200 | 100.331 | 66.811 | 116.612 |

## Empfehlung zu PRD §12 Punkt 1

Der Median bis 2.000 CC (Tag 39) liegt über dem Ziel von 28 Spieltagen (GDD: 4 Spielwochen).
Phase 1 muss um den Faktor 1,4 schneller werden.
Parzellen sind 18 % der Ausgaben des Bots (Saatgut und Dünger: 82 %).
Empfehlung: **höhere Erträge pro Parzelle**. Alternative: **niedrigere Phasengrenzen**.
Robert entscheidet. Diese Simulation ändert keinen Wert in `config/balance.json`.
