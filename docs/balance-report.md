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
| 1 | 42 | 82 | 104.041 | 1093 |
| 2 | 42 | 91 | 89.756 | 1093 |
| 3 | 42 | 89 | 82.126 | 1052 |
| 4 | 38 | 82 | 99.400 | 1106 |
| 5 | 46 | 93 | 89.944 | 1106 |
| 6 | 41 | 84 | 79.878 | 1078 |
| 7 | 47 | 99 | 89.272 | 1229 |
| 8 | 40 | 81 | 89.177 | 995 |
| 9 | 41 | 95 | 60.974 | 1080 |
| 10 | 56 | 104 | 73.677 | 1098 |
| 11 | 35 | 75 | 105.948 | 1141 |
| 12 | 42 | 90 | 98.282 | 1061 |
| 13 | 42 | 88 | 100.505 | 1204 |
| 14 | 40 | 84 | 103.161 | 1129 |
| 15 | 41 | 86 | 91.236 | 1081 |
| 16 | 39 | 82 | 109.304 | 1141 |
| 17 | 41 | 88 | 99.828 | 1070 |
| 18 | 40 | 79 | 99.645 | 1035 |
| 19 | 36 | 78 | 96.903 | 1074 |
| 20 | 39 | 83 | 82.868 | 918 |

|  | Tag bis 2.000 CC | Tag bis 10.000 CC | Kapital Tag 200 (CC) | Parzellen |
| --- | --- | --- | --- | --- |
| Median | 41 | 85 | 94.070 | 1.087 |
| Min | 35 | 75 | 60.974 | 918 |
| Max | 56 | 104 | 109.304 | 1.229 |

## Kapitalkurve (CC)

| Tag | Median | Min | Max |
| --- | --- | --- | --- |
| 10 | 599 | 534 | 645 |
| 20 | 932 | 726 | 1.122 |
| 30 | 1.356 | 984 | 1.663 |
| 40 | 1.979 | 1.307 | 2.519 |
| 50 | 2.906 | 1.719 | 3.853 |
| 60 | 4.104 | 2.334 | 5.597 |
| 70 | 6.016 | 3.104 | 8.564 |
| 80 | 8.614 | 4.349 | 12.254 |
| 90 | 11.867 | 6.138 | 17.223 |
| 100 | 15.629 | 8.944 | 23.339 |
| 110 | 20.905 | 12.004 | 30.907 |
| 120 | 27.837 | 15.137 | 40.369 |
| 130 | 35.956 | 19.789 | 48.742 |
| 140 | 45.081 | 24.986 | 57.472 |
| 150 | 54.414 | 31.391 | 66.401 |
| 160 | 62.320 | 38.908 | 76.629 |
| 170 | 70.482 | 43.068 | 86.676 |
| 180 | 78.604 | 49.224 | 92.227 |
| 190 | 86.492 | 55.609 | 101.567 |
| 200 | 94.070 | 60.974 | 109.304 |

## Empfehlung zu PRD §12 Punkt 1

Der Median bis 2.000 CC (Tag 41) liegt über dem Ziel von 28 Spieltagen (GDD: 4 Spielwochen).
Phase 1 muss um den Faktor 1,5 schneller werden.
Parzellen sind 19 % der Ausgaben des Bots (Saatgut und Dünger: 81 %).
Empfehlung: **höhere Erträge pro Parzelle**. Alternative: **niedrigere Phasengrenzen**.
Robert entscheidet. Diese Simulation ändert keinen Wert in `config/balance.json`.
