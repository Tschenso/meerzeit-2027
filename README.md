# MEERZEIT – AIDA & Mein Schiff 2027

Ein statisches Kreuzfahrt-Dashboard mit Suche, Kabinenpreisvergleich und Jahreskalender. Es arbeitet ohne Installation oder externe Laufzeitdienste direkt im Browser.

**Öffentliche Seite:** [MEERZEIT 2027](https://tschenso.github.io/meerzeit-2027/) · [Jahreskalender](https://tschenso.github.io/meerzeit-2027/#kalender). Auch über mobile Daten erreichbar; der lokale Rechner muss dafür nicht laufen.

## Preise aktualisieren und Verlauf ansehen

In den Reisedetails steht ein Preisdiagramm mit allen dokumentierten Preisständen. Zuerst die Kabinenart, dann Tarif und Anreise wählen. Die vollständige Angebotsgrundlage steht lesbar unter der Auswahl. Kabine, Tarif, Flugpaket, Belegung und Anbieter bleiben getrennt. Der Verlauf beginnt mit den tatsächlich vorhandenen Abrufen vom 23./24. Oktober 2026. Frühere Preise werden nicht nachträglich erfunden. Bei berechneten Kombinationen öffnen die Schaltflächen unter den Teilreisen deren Preisverläufe; eine wechselnde Zusammenstellung wird nicht als durchgehend gleiches Paket dargestellt.

Mit Node.js 22 oder neuer:

```sh
node scripts/preise-aktualisieren.cjs
node pruefen.cjs
node scripts/preise-pruefen.cjs
```

Das Skript aktualisiert die **bereits erfassten Reisen**, einschließlich der zwei unterstützenden Abfahrten 2028. Es liest öffentliche EURESA-Kategoriepreise für AIDA und die eindeutig zugeordneten Mein-Schiff-Reisen sowie die Kabinentabellen der beiden Ostrock-Einzelreisen von Polster & Pohl. Historische mykreuzfahrt-Angebote bleiben in eigenen Preisreihen erhalten. Der zusätzliche Quellenabgleich prüft Schiff, Zeitraum, Dauer, Start-/Zielhafen und Belegung; EURESA-Angebote führen die konkreten Mein-Schiff-Tarife PRO, PLUS und PUR. Nicht eindeutig bestätigte Zuordnungen bleiben offen. Das Skript fügt keine neuen Katalogreisen hinzu.

`--dry-run` prüft den Abruf ohne Dateien zu schreiben. `--source=cloud` verwendet EURESA und die beiden unterstützten Polster-&-Pohl-Einzelreisen. `--source=euresa` beschränkt den Abruf auf EURESA. Andere, nicht archivierte Angebote bleiben historisch. `--pending-only` fragt nur bislang unbestätigte unterstützte Quellen und vorgemerkte Detailquellen ab; bereits bestätigte Preise bleiben unverändert. Die Abdeckungsanzeige wird weiterhin aus dem gesamten Katalog berechnet. Mit `--operator=aida` oder `--operator=mein-schiff` lässt sich die Reederei eingrenzen; `--limit=3` begrenzt zum Test die Anzahl bearbeiteter Quellen. Ohne Optionen werden alle unterstützten, nicht archivierten Quellen abgefragt. EURESA wird nacheinander mit kurzer Pause angefragt, HTTP-Anfragen haben ein Zeitlimit. Es werden keine Zugangsdaten benötigt. Der einmalige Abgleich `node scripts/mein-schiff-euresa.cjs --catalog-only` ordnet mögliche EURESA-Quellen anhand der Katalogdaten zu. Erst der Preisabruf prüft zusätzlich Häfen, Belegung, Kabinen und Tarife und speichert eine bestätigte Quelle. Ohne diese Option erledigt der Quellenabgleich auch die Preisprüfung unmittelbar. Für Wochenläufe ist dieser Katalogabgleich nicht nötig.

Der Verlauf speichert pro Angebotsreihe einen Stand je UTC-Tag, zusätzlich jede beobachtete Preisänderung innerhalb des Tages. Ein weggefallener Kategoriepreis wird als Lücke erfasst. Ein Abruffehler erzeugt keinen neuen Preispunkt und setzt keinen Preis auf null. Der letzte bestätigte Abrufzeitpunkt bleibt erhalten; bisherige Angebote werden als alt markiert und vom aktuellen Vergleich ausgeschlossen. Ein explizites „nicht mehr buchbar“ oder ausschließlich ausdrücklich nicht verfügbare Kabinen bei korrekt bestätigter Reise wird als geprüfte Nichtverfügbarkeit gespeichert. Das ist kein Abruffehler und kein Nullpreis. Diese Quellen werden weiterhin wöchentlich abgefragt. Der Ostrock-Parser unterscheidet buchbar, auf Anfrage und ausgebucht, ignoriert HTML-Kommentare und übernimmt keine Kinder- oder Zusatzbettpreise. Für die 14-Nächte-Charterkombination gibt es keinen belegten Paketpreis; die 80er-live-Charterquelle hat noch keinen automatischen Kabinenparser. Diese Fälle bleiben manuell. Scheitern sämtliche unterstützten Abfragen einer bearbeiteten Reederei, bleiben beide Datendateien unverändert.

### Aktualisieren und veröffentlichen unter Windows

Im ursprünglichen Git-Checkout mit Node.js 22+, Git und angemeldeter GitHub CLI:

```powershell
.\Aktualisieren-und-veroeffentlichen.ps1
```

Das Skript ruft die Preise lokal ab, prüft die Daten, sichert ausschließlich die beiden Datendateien als Git-Commit und pusht nach `main`. GitHub Actions prüft und veröffentlicht die Seite anschließend automatisch. Es übernimmt keine ungesicherten Änderungen und überschreibt keinen abweichenden GitHub-Stand. `-OhnePreisabruf` veröffentlicht einen bereits geprüften lokalen Stand ohne erneuten Preisabruf. Die manuelle lokale Ausführung bleibt als Alternative erhalten.

### Wöchentlicher Cloud-Auftrag

[Actions → Preise in der Cloud aktualisieren](https://github.com/Tschenso/meerzeit-2027/actions/workflows/preise-cloud.yml) läuft **montags um 09:00 Uhr, Europe/Berlin**, einschließlich Sommer-/Winterzeit. Laptop und Codex-App werden dafür nicht benötigt. GitHub kann einen geplanten Lauf zeitversetzt starten. Im selben Menü startet **Run workflow** einen zusätzlichen Abruf; die Option **nur_pruefen** führt nur einen begrenzten Test ohne Speicherung und Veröffentlichung aus. **offene_quellen** wiederholt gezielt nur die unbestätigten unterstützten Quellen; ohne diese Auswahl und im Wochenlauf wird stets der gesamte unterstützte Bestand geprüft.

Der Auftrag verwendet `--source=cloud`, führt die Daten- und Verlaufstests aus, committet ausschließlich `data.js` und `mein-schiff.js` und ruft anschließend die gemeinsame Pages-Veröffentlichung auf. Dafür reicht das auf dieses Repository begrenzte `GITHUB_TOKEN`; ein persönlicher Token oder ein zusätzlicher Hosting-Dienst ist nicht nötig. [Standard-GitHub-Runner sind für öffentliche Repositories kostenlos](https://docs.github.com/en/actions/concepts/billing-and-usage). Der Auftrag übernimmt keine fremden Änderungen und pusht ohne Überschreiben abweichender Stände. Bei vollständigem Abrufausfall einer Reederei oder fehlgeschlagenen Tests wird kein neuer Preisstand veröffentlicht. Einzelne Quellenprobleme stehen im Abrufbericht und auf der Seite; sie erzeugen keine erfundenen Preise.

mykreuzfahrt beantwortet GitHub-Anfragen beim erneuten Test vom 24. Oktober 2026 mit HTTP 403. Der Cloud-Auftrag fragt diese Quelle nicht ab. Er verwendet regulär veröffentlichte EURESA-Angebote beider Reedereien. Bestehende mykreuzfahrt-Preisreihen werden beim Quellenwechsel nicht mit EURESA-Tarifen verbunden. Reisebezogene Hafenabgleiche für Leixões/Porto und Bayonne/Cape Liberty sind mit Reedereinachweisen in `scripts/euresa-hafenabgleich.cjs` hinterlegt und in den Reisedetails verlinkt. Sie gelten nur für die geprüften Schiff-/Code-/Zeitraum-Kombinationen; New York City wird nicht global mit Cape Liberty gleichgesetzt. Auch die vier langen Asienreisen, die in der verfügbaren Jahresliste fehlen, haben ihre eigene geprüfte Detailquelle. Nicht unterstützte Veranstalterquellen erhalten keine frischen Preisbestätigungen. Der erste vollständige Cloud-Lauf samt Datenprüfung, Commit und Pages-Veröffentlichung wurde am 24. Oktober 2026 erfolgreich geprüft. Die vorherige lokale Wochenautomation ist pausiert, damit keine zwei Aufträge denselben Preisstand schreiben.

GitHub Pages liefert die veröffentlichten Daten unabhängig vom lokalen Rechner aus. Unter [Actions → Dashboard auf GitHub Pages veröffentlichen](https://github.com/Tschenso/meerzeit-2027/actions/workflows/pages.yml) kann **Run workflow** den Repository-Stand auch ohne neue Preisabfrage erneut veröffentlichen.

Die direkte Ausführung des Node-Skripts verändert zunächst nur die lokalen Datendateien. Das Windows-Skript übernimmt zusätzlich Prüfung, Commit und Upload. Der Git-Verlauf erhält vorherige Datenstände. Schlägt der Abruf, ein Test oder der Upload fehl, meldet das Skript den Fehler; der letzte erfolgreich veröffentlichte Stand bleibt erreichbar.

### GitHub Pages bauen

```sh
node scripts/build-pages.cjs
```

Der Build kopiert ausschließlich die sieben Laufzeitdateien und `.nojekyll` nach `dist/`. Der Workflow veröffentlicht dieses Paket über GitHub Pages mit HTTPS. Lokale Sicherungen, Betriebsdateien und Skripte sind nicht im Webpaket. Das Repository selbst ist öffentlich. Jeder Push nach `main` prüft und veröffentlicht den aktuellen Stand erneut.

## Enthaltene Reisen

- **819 veröffentlichte Reisevarianten**: 320 recherchierte AIDA-Angebote und 499 Mein-Schiff-Angebote auf neun Schiffen.
- **608 Abfahrtstermine auf 17 Schiffen** nach Zusammenfassung gleicher Schiffe, Startdaten und Starthäfen.
- **Ab Kiel: 168 Reisevarianten und 110 Abfahrtstermine**, davon 132 AIDA- und 36 Mein-Schiff-Varianten. 153 Varianten enden wieder in Kiel.
- 181 erfasste Rundreisevarianten ab/bis Hamburg und fünf berechnete AIDA-Reisekombinationen.
- 29 einfache Atlantiküberquerungen sowie vier Atlantik-Rundreisen und eine Weltreise im Zusatzfilter.

Die AIDA-Auswahl umfasst die recherchierten Hamburg-, Kiel-, Rück- und Atlantikreisen. Die 132 Kiel-Varianten wurden am 24. Oktober 2026 mit der AIDA-Jahresliste von mykreuzfahrt abgeglichen; die 129 ergänzten Reisen sind mit Reisedaten und Kabinenpreisen bei EURESA bestätigt. Die Mein-Schiff-Auswahl umfasst die zum Abrufzeitpunkt in der Jahresquelle gelisteten Reisen weltweit. Die Themenbereiche überschneiden sich; eine vollständige und tagesaktuelle Abdeckung der Reedereikataloge ist nicht zugesichert.

Alle regulär auswählbaren Reisen beginnen 2027. Das Ende kann 2028 liegen. Zwei zusätzliche Abfahrten 2028 dienen ausschließlich als Teilreisen der berechneten Kombinationen.

## Öffnen

Repository herunterladen oder klonen und `index.html` im Browser öffnen. Die sieben Laufzeitdateien müssen im selben Ordner liegen:

`index.html`, `dashboard.css`, `dashboard.js`, `kalender.js`, `kombinationen.js`, `data.js`, `mein-schiff.js`.

Direktansichten:

| Ansicht | Adresse |
| --- | --- |
| Alle erfassten Reisen | `index.html#alle` |
| Mein Schiff | `index.html#mein-schiff` |
| Ab Hamburg | `index.html#hamburg` |
| Ab Kiel | `index.html#kiel` |
| Rundreisen ab/bis Hamburg | `index.html#rundreisen-alle` |
| Große Rundreisen | `index.html#rundreisen` |
| Berechnete Kombinationen | `index.html#kombinationen` |
| Auslandsreisen nach Hamburg/Kiel | `index.html#rueckreisen` |
| Transatlantik | `index.html#transatlantik` |
| Jahreskalender | `index.html#kalender` |

## Suche und Filter

Reederei, Schiff, Start- und Zielhafen sowie Kabinenart lassen sich direkt wählen. Weitere Filter umfassen Abreisezeitraum, Route, Tarif, Dauer, Budget und Flugpakete. Die Datumsgrenzen gelten einschließlich und beziehen sich auf das Abreisedatum.

Die Mehrwortsuche verknüpft Begriffe mit UND und berücksichtigt Route, Reederei, Schiff, Ein-/Ausschiffungshafen, erfasste Fahrtgebiete und Abreisemonat. Beispiel: `Mein Schiff Norwegen Juli`. Schiffsnummern wie `Mein Schiff 1` werden gezielt erkannt.

Bezeichnungen desselben Hafens, etwa Palma/Palma de Mallorca und Gran Canaria/Las Palmas, werden zusammengeführt. Unterschiedliche Häfen wie New York City und Cape Liberty bleiben getrennt. Zwischenstopps sind nicht Teil der Hafensuche.

## Jahreskalender

Schiffsnamen und Starthäfen stehen direkt beim Datum. Mehrere Abfahrten werden vollständig untereinander angezeigt. Ein Tagesklick ist zum Lesen der Namen nicht erforderlich.

Zwölf Monatskarten zeigen die Anzahl der Abfahrtstermine und den günstigsten erfassten Preis zur gewählten Kabine und Preisbasis. Sie ermöglichen den direkten Monatswechsel. Auf großen Bildschirmen erscheinen beschriftete Monatsraster. Auf kleinen Bildschirmen zeigt der ausgewählte Monat lesbare Tageszeilen. Die Suche und alle Reisefilter gelten auch im Kalender.

Reisevarianten desselben Schiffs mit gleichem Startdatum und Starthafen zählen als ein Termin. Die Varianten und ihre unterschiedlichen Dauern bleiben einzeln aufrufbar. Leere Tage bedeuten, dass im gefilterten Datenbestand kein Termin erfasst ist. Abfahrtsuhrzeiten sind nicht enthalten.

Berechnete Kombinationen werden als Kombinationsstarts mit dem Schiff der ersten Teilreise dargestellt. Ein späterer Schiffwechsel wird nicht als gleichzeitige Abfahrt ausgegeben.

## Preise, Datenstand und Quellen

**Katalogstand: 23./24. Oktober 2026.** Den letzten Preisabruf und dessen erfolgreiche bzw. unbestätigte Quellen zeigt die Seite an. Gleiche Preise verschiedener Quellen können getrennt erscheinen. Die zwei unterstützenden Teilreisen 2028 sind in der Preisaktualisierung enthalten.

Die Preise sind Ab-Preise pro Person; die Vergleichsansicht rechnet für zwei Erwachsene in einer Kabine. Preisquelle und Abrufzeit stehen bei den Angeboten. Fehlende Preise sind keine Aussage über die Verfügbarkeit. Flugpakete bleiben gekennzeichnet und können gesondert einbezogen werden.

Ein allgemeiner Ab-Preis ohne eindeutige Kabinenzuordnung wird keiner Innenkabine zugewiesen. Eindeutig bestimmte Suiten und Junior-Suiten bleiben getrennt. Die Mein-Schiff-Anbietergruppe „Suite“ kann Junior-Suiten enthalten und erscheint deshalb als gesonderte Suitenkategorie.

Mein Schiff hat ein eigenes All-Inclusive-Bordkonzept. EURESA-Angebote nennen PRO, PLUS oder PUR. Ältere Angebote aus der Jahresquelle haben keinen aufgeschlüsselten Tarif und heißen weiterhin „Angebot · Tarif prüfen“. Unterschiedliche Anbieter und Tarife bleiben getrennte Preisreihen. Leistungen und Buchungsbedingungen sind zwischen Reedereien und Tarifen verschieden.

Hauptquellen:

- [EURESA Reisen](https://euresa-reisen.de/reisesuche)
- [mykreuzfahrt: Mein Schiff 2027](https://www.mykreuzfahrt.de/tui-cruises/mein-schiff-2027/)
- [mykreuzfahrt: AIDA 2027](https://www.mykreuzfahrt.de/aida/aida-2027/)
- [Mein Schiff: Reisen ab Hamburg](https://www.meinschiff.com/de/kreuzfahrten/ab-hamburg)
- Die in den einzelnen Reiseangeboten verlinkten Veranstalter und Vermittler.

Filter lösen keine Live-Preisabfragen aus. Aktuelle Buchbarkeit, Leistungen und Endpreise sind über die jeweiligen Anbieterlinks zu prüfen. Dieses unabhängige Dashboard ist kein offizielles Angebot von AIDA oder TUI Cruises.

## Berechnete Kombinationen

Die fünf Pläne umfassen zwei direkt anschließende Fernreisen mit AIDAluna bzw. AIDAmar sowie drei AIDAprima-/AIDAbella-Kombinationen mit längerem Aufenthalt in der Karibik.

Die Summen verwenden auf jeder Teilreise den günstigsten passenden Kabinenpreis ohne Flug. Bei fehlendem Teilpreis bleibt die Summe offen. Die gleichzeitige Buchbarkeit und dieselbe Kabine auf beiden Teilreisen sind nicht bestätigt.

Unterkunft, Verpflegung und Transfers während eines Zwischenaufenthalts kommen zusätzlich hinzu. Deshalb ist eine Kreuzfahrten-Summe kein vollständiger Reisepreis. Der Preis pro Bordnacht verwendet ausschließlich die Nächte an Bord.

## Lokaler Server und WLAN

Optional mit Node.js starten:

```sh
node server.cjs
```

Die lokale Ansicht ist dann unter `http://127.0.0.1:8787/#kalender` erreichbar.

Unter Windows startet `Start-WLAN.ps1` den Server auf der aktuellen IPv4-Adresse des Adapters `WLAN` und gibt den Link aus. Laptop und andere Geräte müssen im gleichen lokalen Netz sein. Der Server bleibt an die konkrete Adapteradresse und deren IPv4-Subnetz gebunden.

Falls erforderlich, richtet `WLAN-Freigabe.ps1` mit Administratorrechten eine eng begrenzte eingehende Firewallregel ein: ausschließlich der Node-Prozess, der gewählte TCP-Port, der WLAN-Adapter und Clients im lokalen Subnetz. Das Skript verändert keine vorhandenen Regeln und ändert das Netzwerkprofil nicht.

Der Server liefert nur die ausdrücklich freigegebenen Dashboard-Dateien aus. Verzeichnisauflistungen, Schreibzugriffe sowie Zugriffe auf Dokumentation, Startskripte und Rückfallsicherungen sind gesperrt. Es wird kein Autostart eingerichtet.

## Prüfen

Benötigt Node.js 22 oder neuer, ohne zusätzliche Pakete:

```sh
node pruefen.cjs
node --check dashboard.js
node --check kalender.js
node --check server.cjs
```

Die Prüfungen kontrollieren Reisedaten, Filter, Kabinen-/Tariftrennung, Kombinationssummen, CSV, Kalenderdaten und direkte Beschriftungen. HTTP-Prüfungen kontrollieren die freigegebenen Dateien, HEAD-Anfragen, Methodenbegrenzung und den Ausschluss interner Dateien.

Die letzte Änderung an der direkten Kalenderbeschriftung ist durch Daten- und Rendering-Prüfungen abgesichert. Eine zusätzliche visuelle Browserprüfung dieses Stands konnte nicht abgeschlossen werden, weil das verwendete Computer-Use-Werkzeug die aktuelle Browseradresse nicht sicher erkennen konnte.

Lokale Rückfallsicherungen, Betriebsnotizen und ältere Vorschaubilder sind durch `.gitignore` von der Veröffentlichung ausgeschlossen.
