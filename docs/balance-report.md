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
| 1 | 41 | 85 | 78.740 | 1105 |
| 2 | 42 | 93 | 67.659 | 1105 |
| 3 | 48 | 108 | 53.112 | 1064 |
| 4 | 43 | 94 | 71.166 | 1118 |
| 5 | 47 | 98 | 67.015 | 1118 |
| 6 | 42 | 92 | 67.091 | 1090 |
| 7 | 45 | 96 | 74.775 | 1241 |
| 8 | 42 | 90 | 68.102 | 1007 |
| 9 | 42 | 94 | 62.614 | 1092 |
| 10 | 56 | 112 | 53.241 | 1110 |
| 11 | 40 | 88 | 73.820 | 1153 |
| 12 | 44 | 93 | 69.945 | 1073 |
| 13 | 46 | 99 | 71.171 | 1216 |
| 14 | 41 | 88 | 75.022 | 1141 |
| 15 | 43 | 92 | 72.083 | 1093 |
| 16 | 42 | 92 | 72.311 | 1153 |
| 17 | 40 | 88 | 73.234 | 1082 |
| 18 | 42 | 91 | 70.189 | 1047 |
| 19 | 40 | 87 | 72.272 | 1086 |
| 20 | 41 | 95 | 58.387 | 930 |

|  | Tag bis 2.000 CC | Tag bis 10.000 CC | Kapital Tag 200 (CC) | Parzellen |
| --- | --- | --- | --- | --- |
| Median | 42 | 92,5 | 70.678 | 1.099 |
| Min | 40 | 85 | 53.112 | 930 |
| Max | 56 | 112 | 78.740 | 1.241 |

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
| 80 | 7.192 | 3.999 | 8.565 |
| 90 | 9.479 | 5.354 | 11.535 |
| 100 | 12.238 | 7.195 | 14.858 |
| 110 | 15.629 | 9.535 | 18.913 |
| 120 | 19.752 | 12.218 | 24.129 |
| 130 | 24.964 | 15.292 | 30.342 |
| 140 | 30.882 | 18.895 | 37.250 |
| 150 | 37.472 | 23.371 | 44.992 |
| 160 | 45.327 | 28.654 | 52.492 |
| 170 | 52.082 | 34.520 | 59.555 |
| 180 | 58.681 | 40.740 | 66.343 |
| 190 | 64.614 | 47.205 | 72.760 |
| 200 | 70.678 | 53.112 | 78.740 |

## Empfehlung zu PRD §12 Punkt 1

Der Median bis 2.000 CC (Tag 42) liegt über dem Ziel von 28 Spieltagen (GDD: 4 Spielwochen).
Phase 1 muss um den Faktor 1,5 schneller werden.
Parzellen sind 21 % der Ausgaben des Bots (Saatgut und Dünger: 79 %).
Empfehlung: **höhere Erträge pro Parzelle**. Alternative: **niedrigere Phasengrenzen**.
Robert entscheidet. Diese Simulation ändert keinen Wert in `config/balance.json`.
