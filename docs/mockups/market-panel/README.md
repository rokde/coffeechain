# Markt-Panel (Issue #48)

Entwurf, nichts gebaut. Ein Panel für Bankverkauf (#20, #38), Aufträge (#22, Platz für #23) und Saatgut (#26). Freigabe durch Bastian oder Robert, bevor #20 oder der UI-Teil von #22 beginnt.

| Datei | Inhalt |
|---|---|
| `market-bank-1440.png`, `-800.png`, `-390.png` | Tab „Bank“: Zeile „Robusta roh“ aufgeklappt, 50 % gewählt |
| `market-orders-1440.png`, `-800.png`, `-390.png` | Tab „Aufträge“: ein lieferbarer, zwei nicht lieferbare Aufträge |
| `market-seed-1440.png`, `-800.png`, `-390.png` | Tab „Saatgut“: Kauf bei der Bank |
| `market-states.png` | Zustände: gewaschener Kaffee mit laufender Aufbereitung, Saatgut zurücklegen, Filter „Lieferbar“, leeres Lager |
| `market-panel.html` | Quelle. Ohne Parameter: Übersicht, in der Tabs, Zeilen, Regler und Mengenknöpfe bedienbar sind. Mit `?frame=desktop\|tablet\|phone&tab=bank\|orders\|seed[&open=<ware>][&mode=keep]`: ein Rahmen in Originalgröße. Mit `?view=states`: nur die Zustände |

Screenshots neu erzeugen (Edge headless, absolute Pfade, eigenes `--user-data-dir`, nacheinander statt parallel):
`msedge --headless=new --hide-scrollbars --window-size=1440,900 --user-data-dir=<tmp> --screenshot=<abs>\market-bank-1440.png "file:///<abs>/market-panel.html?frame=desktop&tab=bank"`

Die Seite rechnet alle Preise mit der Formel aus `src/sim/market/market.ts` (`saturation`, `priceAt`) und den Werten aus `config/balance.json`. Bestand, Aufträge und Preisverlauf sind Beispielwerte (12. März, Jahr 2, Phase 2, Lager 600).

## Entwurf in Kürze

- **Ein Panel, drei Tabs: Bank, Aufträge, Saatgut.** Verkaufen an die Bank, Liefern an Käufer und Kaufen von Saatgut sind drei verschiedene Aufgaben. Tabs trennen sie, ohne dass der Markt in mehrere Werkzeuge zerfällt. Die Zahl am Tab „Aufträge“ zeigt die offenen Aufträge und wird grün, sobald einer lieferbar ist.
- **Gleiche Hülle wie das Lager-Panel:** 640 px rechts ab 1280 px, `Breite − 348 px` neben der linken Spalte bis 1279 px, Sheet über die ganze Breite bis 480 px. Kopf nur mit Titel und Schließen-Knopf, weil Geld und Lagerstand schon in der Leiste stehen. Gruppierung nach Sorte, Marken „roh“ und „gewaschen“ wie im Lager.
- **Bank: Liste, dann Ticket.** Eine Zeile je Ware (Sorte × roh/gewaschen) mit verkaufbarem Bestand, Bankpreis, Prozent der Referenz und Trend zum Vormonat. Ein Klick klappt die Zeile zum Verkaufsticket auf, immer nur eine. Das ist das Muster von Handelsoberflächen: Kursliste, dann Order-Ticket.
- **Ticket:** Menge als Zahlenfeld, Regler und Knöpfe 25 % / 50 % / Alles, alle drei gekoppelt. Vorschau mit Erlös, Durchschnittspreis und Preis danach (beide mit drei Nachkommastellen, dazu die Änderung in Prozent) und verbleibendem Bestand. Unter dem Knopf steht, welche Chargen der Verkauf nimmt („140 × Q 74, 40 × Q 82“). Sie nutzt `sellIncome`, also dieselbe Funktion wie die Buchung. Der Knopf nennt, was passiert: „180 Einh. verkaufen · 68 CC“. Er klebt am unteren Rand der Liste und bleibt ohne Scrollen erreichbar.
- **Diagramm:** 12 Monatswerte auf fester Skala von 50 bis 150 % der Referenz, gestrichelte Referenzlinie, hervorgehobener heutiger Wert mit Betrag, daneben der Preis nach dem Handel als zweiter Punkt mit Änderung in Prozent. Jeder Monatspunkt bekommt beim Bau einen Tooltip (im Mockup als `title`).
- **Unverkäufliches (#38):** Kaffee unter der Bank-Mindestqualität zählt nicht zum verkaufbaren Bestand. Die Zeile nennt ihn („+ 40 unter Q 40“), das Ticket erklärt ihn als Erstes und führt ins Lager, wo das Entsorgen liegt. „Alles“ verkauft nur, was die Bank nimmt.
- **Bank oder Auftrag:** Passt ein lieferbarer Auftrag zur aufgeklappten Ware, nennt das Ticket oben Käufer, Preis, Menge und Frist und führt zum Auftrag. Reicht der Bestand nach dem gewählten Verkauf nicht mehr für den Auftrag, sagt es, wie viel fehlt. Die Auftragskarte zeigt umgekehrt Preis und Erlös neben dem Bankwert für dieselbe Menge.
- **Aufträge:** Eine Karte je Auftrag. Käufer mit Kürzel und Profil, Frist mit Resttagen (30 Tage oder weniger: Bernstein), Ware mit Zustand und Mindestqualität, Preis, Erlös, passender Bestand mit Balken und den Chargen. Lieferbare stehen oben und haben einen grünen Rand und ein „✓ Lieferbar“. Ein gesperrtes „Liefern“ nennt im Text, was fehlt und welche Charge knapp darunter liegt.
- **Platz für #23 (gestrichelt):** „Laufende Verträge“ als Block über den Aufträgen, weil eine bindende Lieferung dringender ist als ein offenes Angebot. Der Ruf steht als Marke neben dem Käufernamen.
- **Saatgut:** gleiche Zeile und gleiches Ticket in Kaufrichtung. Bestand getrennt nach „gekauft“ (feste Qualität) und „eigenes“ (Qualität der Charge). Umschalter im Ticket: „Bei der Bank kaufen“ oder „Aus der Ernte zurücklegen“. Zurücklegen zeigt die Chargen zur Wahl, das Ergebnis, den verbrauchten Rohkaffee, den entgangenen Bankerlös und zum Vergleich den Kaufpreis.
- **Aufbereiten** bleibt im Markt: als zweite Aktion im Ticket des Rohkaffees, mit dem Bankpreis für gewaschenen Kaffee und dem Grund, wenn es gerade nicht geht.
- **Zugänglichkeit:** Tabs als `tablist` mit Unterstrich (Auswahl nicht nur über Farbe), Zeilen als Knöpfe mit `aria-expanded`, natives `input type="range"` mit `aria-valuetext`, Vorschau als Live-Region, Gründe für gesperrte Knöpfe als sichtbarer Text mit `aria-describedby`, Trend immer mit Pfeil und Zahl, Ziele mindestens 44 px hoch (Filter und Anteil-Knöpfe 36 px).

## Offene Fragen für Robert

1. **Tabs oder ein langes Panel?** Der Entwurf trennt Bank, Aufträge und Saatgut in Tabs. Alternative: Aufträge als eigenes Werkzeug in der Leiste. Die Leiste braucht bei 390 px aber schon zwei Zeilen.
2. **Bank-Mindestqualität (#38).** Das Mockup nimmt Q 40 an (`market.bankMinQuality`, NEU). „Alles“ überspringt Unverkäufliches, statt den Verkauf zu sperren. Entsorgen liegt im Lager, nicht im Markt.
3. **Welche Chargen verkauft die Bank?** Heute die ältesten zuerst. Wer gute Qualität für einen Auftrag behalten will, kann das im Ticket nicht steuern, nur über „Verkaufen“ je Zeile im Lager. Reicht der Hinweis im Ticket, oder braucht das Ticket eine Wahl („niedrigste Qualität zuerst“)?
4. **Welche Chargen gehen in einen Auftrag?** Der Entwurf sagt „niedrigste passende Qualität zuerst“, damit gute Chargen für anspruchsvollere Aufträge bleiben. Gibt es Teillieferungen? Der Entwurf kennt nur ganz oder gar nicht.
5. **Auftragspreis.** Die Karte vergleicht mit dem Bankpreis von heute und mit dem Bankerlös für dieselbe Menge. Ein Qualitätsaufschlag (#22) bekäme eine eigene Zeile in der Preiszelle.
6. **Käuferprofile.** Drei Beispiele (Discounter, Rösterei, Spezialitätencafé). Reicht eine Zeile Profiltext, oder braucht der Käufer eine eigene Ansicht, sobald Ruf und Verträge (#23) kommen?
7. **Saatgut zurücklegen (#26).** Annahmen: 4 Einheiten Rohkaffee je Einheit Saatgut, ab Q 75, gekauftes Saatgut hat Q 70 (alle NEU). Mit diesen Werten ist eigenes Saatgut billiger und besser als gekauftes; bei 10 : 1 wäre es teurer. Zählt Saatgut zur Lagerkapazität? Der Kopf zeigt es im Entwurf nicht mit.
8. **Preisverlauf über der Referenz.** Die Beispielkurven gehen über 100 %. Das gibt es erst mit Marktleben (#19); bis dahin liegt die Kurve zwischen 70 und 100 % und nutzt nur das untere Drittel der festen Skala. Bleibt die Skala trotzdem bei 50 bis 150 %?
9. **Drei Nachkommastellen im Ticket.** Ein Verkauf von 180 Einheiten senkt den Robusta-Preis um 2,2 %, das sind weniger als 0,01 CC. Der Entwurf zeigt deshalb Durchschnittspreis und Preis danach mit drei Nachkommastellen und die Änderung in Prozent; Liste und Diagramm bleiben bei zwei. In Ordnung?
10. **Vorauswahl der Menge.** Vorschlag: „Alles“, wie heute. Die Screenshots zeigen 50 %, damit Regler und Vorschau sichtbar arbeiten.

## Grenzen des Entwurfs

- Bis 1279 px steht im Ticket die Menge vor dem Diagramm, und das Diagramm ist flacher. So sind Regler und Vorschau sichtbar, bevor der klebende Knopf sie verdeckt.
- Fehlende Zustände: Auftrag kurz vor oder nach der Frist, zu wenig Geld oder volles Lager beim Saatgutkauf, aller Kaffee einer Ware unter der Bank-Mindestqualität, Rückmeldung nach dem Verkauf (heute: Geld-Toast).
- „Zurücklegen“ und die laufende Aufbereitung gibt es nur bei 1440 px. Sie nutzen dasselbe Ticket, das bei 800 und 390 px für den Bankverkauf gezeigt ist.
- Einstieg aus dem Lager: „Zum Markt“ öffnet den Tab „Bank“. Ob „Verkaufen“ je Zeile im Lager bleibt oder das Ticket der Ware öffnet, ist offen (Frage 3).

## Beim Bauen zu beachten

- Texte in `src/ui/i18n/de.json`, Zahlen aus `config/balance.json`. Neue Werte (`market.bankMinQuality`, Saatgut-Verhältnis, Saatgut-Mindestqualität, Qualität von gekauftem Saatgut) mit `src: "NEU"` anlegen und in `docs/open-questions.md` eintragen.
- Vorschau und Buchung über dieselbe Sim-Funktion (`sellIncome`, `bankSellPrice` mit `units`). „Preis danach“ ist `bankBuyPrice` beim Volumen nach dem Handel; dafür fehlt noch eine reine Funktion in `src/sim/market/`.
- `focusgroup="tablist"` gibt es nur in Chrome und Edge ab 150. Für die WebView von Tauri auf dem Mac (WebKit) braucht es `@microsoft/focusgroup-polyfill` oder eine eigene Pfeiltasten-Steuerung.
- Der Regler ist ein natives `input type="range"`. Die gefüllte Spur kommt in WebKit über eine Custom Property, die bei `input` mitgeführt wird; WebKit- und Firefox-Pseudoelemente stehen in getrennten Regeln.
- Das Diagramm braucht einen Tooltip mit Fadenkreuz und eine Tabellenansicht oder ein `aria-label` mit den Kernwerten (im Mockup: `aria-label`).
- Das Panel ist 640 px breit wie das Lager-Panel, nicht 330 px wie die übrigen Werkzeug-Panels. `Hud.vue` braucht dafür dieselbe Regel wie beim Lager.
