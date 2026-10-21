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
| 1 | 42 | 85 | 93.426 | 1093 |
| 2 | 47 | 99 | 79.085 | 1093 |
| 3 | 45 | 97 | 73.685 | 1052 |
| 4 | 41 | 86 | 91.583 | 1106 |
| 5 | 46 | 97 | 81.197 | 1106 |
| 6 | 41 | 87 | 73.123 | 1078 |
| 7 | 47 | 100 | 80.545 | 1229 |
| 8 | 41 | 89 | 81.164 | 995 |
| 9 | 43 | 100 | 52.779 | 1080 |
| 10 | 57 | 107 | 67.559 | 1098 |
| 11 | 37 | 81 | 94.922 | 1141 |
| 12 | 44 | 91 | 90.802 | 1061 |
| 13 | 43 | 90 | 91.912 | 1204 |
| 14 | 42 | 87 | 92.889 | 1129 |
| 15 | 42 | 87 | 87.529 | 1081 |
| 16 | 39 | 85 | 97.070 | 1141 |
| 17 | 41 | 92 | 90.763 | 1070 |
| 18 | 43 | 86 | 89.810 | 1035 |
| 19 | 37 | 82 | 89.645 | 1074 |
| 20 | 41 | 89 | 75.845 | 918 |

|  | Tag bis 2.000 CC | Tag bis 10.000 CC | Kapital Tag 200 (CC) | Parzellen |
| --- | --- | --- | --- | --- |
| Median | 42 | 89 | 88.587 | 1.087 |
| Min | 37 | 81 | 52.779 | 918 |
| Max | 57 | 107 | 97.070 | 1.229 |

## Kapitalkurve (CC)

| Tag | Median | Min | Max |
| --- | --- | --- | --- |
| 10 | 599 | 534 | 644 |
| 20 | 910 | 717 | 1.020 |
| 30 | 1.316 | 946 | 1.514 |
| 40 | 1.887 | 1.266 | 2.401 |
| 50 | 2.656 | 1.664 | 3.693 |
| 60 | 3.939 | 2.259 | 4.927 |
| 70 | 5.552 | 2.992 | 7.240 |
| 80 | 7.739 | 4.225 | 9.718 |
| 90 | 10.444 | 5.915 | 13.629 |
| 100 | 13.784 | 8.215 | 18.708 |
| 110 | 18.132 | 11.030 | 24.896 |
| 120 | 23.257 | 14.120 | 32.088 |
| 130 | 29.746 | 18.022 | 39.131 |
| 140 | 38.760 | 21.718 | 46.873 |
| 150 | 48.308 | 25.937 | 55.975 |
| 160 | 56.828 | 31.043 | 65.831 |
| 170 | 66.117 | 35.235 | 75.211 |
| 180 | 72.357 | 41.585 | 81.282 |
| 190 | 80.330 | 47.732 | 89.357 |
| 200 | 88.587 | 52.779 | 97.070 |

## Empfehlung zu PRD §12 Punkt 1

Der Median bis 2.000 CC (Tag 42) liegt über dem Ziel von 28 Spieltagen (GDD: 4 Spielwochen).
Phase 1 muss um den Faktor 1,5 schneller werden.
Parzellen sind 21 % der Ausgaben des Bots (Saatgut und Dünger: 79 %).
Empfehlung: **höhere Erträge pro Parzelle**. Alternative: **niedrigere Phasengrenzen**.
Robert entscheidet. Diese Simulation ändert keinen Wert in `config/balance.json`.
