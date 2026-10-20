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
| 1 | 81 | 191 | 11.416 | 107 |
| 2 | 79 | 197 | 10.348 | 91 |
| 3 | 89 | nicht erreicht | 7.774 | 58 |
| 4 | 91 | nicht erreicht | 8.957 | 76 |
| 5 | 82 | nicht erreicht | 9.517 | 79 |
| 6 | 80 | 194 | 10.762 | 94 |
| 7 | 87 | nicht erreicht | 8.957 | 77 |
| 8 | 78 | 192 | 11.058 | 98 |
| 9 | 78 | 197 | 10.347 | 87 |
| 10 | 114 | nicht erreicht | 5.752 | 43 |
| 11 | 79 | 193 | 11.028 | 97 |
| 12 | 79 | 195 | 10.658 | 92 |
| 13 | 82 | nicht erreicht | 9.404 | 77 |
| 14 | 80 | 197 | 10.427 | 93 |
| 15 | 92 | nicht erreicht | 9.256 | 81 |
| 16 | 79 | 196 | 10.622 | 93 |
| 17 | 78 | 187 | 11.881 | 106 |
| 18 | 78 | 193 | 11.036 | 97 |
| 19 | 78 | 189 | 11.593 | 105 |
| 20 | 78 | 199 | 10.148 | 87 |

|  | Tag bis 2.000 CC | Tag bis 10.000 CC | Kapital Tag 200 (CC) | Parzellen |
| --- | --- | --- | --- | --- |
| Median | 79,5 | 197 | 10.387 | 91,5 |
| Min | 78 | 187 | 5.752 | 43 |
| Max | 114 | nicht erreicht | 11.881 | 107 |

## Kapitalkurve (CC)

| Tag | Median | Min | Max |
| --- | --- | --- | --- |
| 10 | 552 | 514 | 565 |
| 20 | 705 | 584 | 726 |
| 30 | 858 | 669 | 895 |
| 40 | 1.029 | 764 | 1.071 |
| 50 | 1.247 | 869 | 1.295 |
| 60 | 1.482 | 987 | 1.537 |
| 70 | 1.733 | 1.138 | 1.786 |
| 80 | 2.036 | 1.299 | 2.100 |
| 90 | 2.384 | 1.479 | 2.458 |
| 100 | 2.752 | 1.690 | 2.859 |
| 110 | 3.197 | 1.904 | 3.340 |
| 120 | 3.688 | 2.172 | 3.911 |
| 130 | 4.240 | 2.479 | 4.534 |
| 140 | 4.870 | 2.812 | 5.234 |
| 150 | 5.574 | 3.195 | 6.076 |
| 160 | 6.305 | 3.632 | 6.999 |
| 170 | 7.155 | 4.110 | 8.029 |
| 180 | 8.119 | 4.611 | 9.202 |
| 190 | 9.199 | 5.147 | 10.479 |
| 200 | 10.387 | 5.752 | 11.881 |

## Empfehlung zu PRD §12 Punkt 1

Der Median bis 2.000 CC (Tag 79,5) liegt über dem Ziel von 28 Spieltagen (GDD: 4 Spielwochen).
Phase 1 muss um den Faktor 2,8 schneller werden.
Parzellen sind 60 % der Ausgaben des Bots (Saatgut und Dünger: 40 %).
Empfehlung: **günstigere Parzellen**. Alternative: **niedrigere Phasengrenzen**.
Robert entscheidet. Diese Simulation ändert keinen Wert in `config/balance.json`.
