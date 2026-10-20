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
| 1 | 77 | 186 | 12.151 | 114 |
| 2 | 75 | 192 | 11.062 | 97 |
| 3 | 84 | nicht erreicht | 8.641 | 65 |
| 4 | 87 | nicht erreicht | 9.659 | 82 |
| 5 | 78 | 197 | 10.457 | 88 |
| 6 | 77 | 189 | 11.435 | 101 |
| 7 | 84 | nicht erreicht | 9.909 | 84 |
| 8 | 75 | 187 | 11.859 | 104 |
| 9 | 74 | 190 | 11.289 | 96 |
| 10 | 109 | nicht erreicht | 6.500 | 50 |
| 11 | 75 | 187 | 11.838 | 104 |
| 12 | 74 | 188 | 11.726 | 102 |
| 13 | 78 | 198 | 10.281 | 84 |
| 14 | 76 | 190 | 11.315 | 101 |
| 15 | 89 | nicht erreicht | 9.947 | 86 |
| 16 | 74 | 189 | 11.607 | 101 |
| 17 | 73 | 181 | 12.781 | 114 |
| 18 | 74 | 185 | 12.081 | 106 |
| 19 | 74 | 183 | 12.428 | 111 |
| 20 | 74 | 193 | 10.926 | 94 |

|  | Tag bis 2.000 CC | Tag bis 10.000 CC | Kapital Tag 200 (CC) | Parzellen |
| --- | --- | --- | --- | --- |
| Median | 75,5 | 190 | 11.302 | 99 |
| Min | 73 | 181 | 6.500 | 50 |
| Max | 109 | nicht erreicht | 12.781 | 114 |

## Kapitalkurve (CC)

| Tag | Median | Min | Max |
| --- | --- | --- | --- |
| 10 | 556 | 515 | 567 |
| 20 | 717 | 589 | 746 |
| 30 | 879 | 678 | 927 |
| 40 | 1.069 | 778 | 1.117 |
| 50 | 1.311 | 888 | 1.368 |
| 60 | 1.560 | 1.014 | 1.631 |
| 70 | 1.845 | 1.173 | 1.907 |
| 80 | 2.167 | 1.343 | 2.272 |
| 90 | 2.522 | 1.547 | 2.662 |
| 100 | 2.926 | 1.769 | 3.079 |
| 110 | 3.398 | 2.021 | 3.574 |
| 120 | 3.941 | 2.315 | 4.175 |
| 130 | 4.542 | 2.658 | 4.851 |
| 140 | 5.217 | 3.051 | 5.622 |
| 150 | 6.006 | 3.498 | 6.502 |
| 160 | 6.844 | 4.008 | 7.515 |
| 170 | 7.778 | 4.580 | 8.635 |
| 180 | 8.852 | 5.133 | 9.880 |
| 190 | 10.022 | 5.769 | 11.248 |
| 200 | 11.302 | 6.500 | 12.781 |

## Empfehlung zu PRD §12 Punkt 1

Der Median bis 2.000 CC (Tag 75,5) liegt über dem Ziel von 28 Spieltagen (GDD: 4 Spielwochen).
Phase 1 muss um den Faktor 2,7 schneller werden.
Parzellen sind 60 % der Ausgaben des Bots (Saatgut und Dünger: 40 %).
Empfehlung: **günstigere Parzellen**. Alternative: **niedrigere Phasengrenzen**.
Robert entscheidet. Diese Simulation ändert keinen Wert in `config/balance.json`.
