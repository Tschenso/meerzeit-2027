# MEERZEIT – AIDA & Mein Schiff 2027

Ein statisches Kreuzfahrt-Dashboard mit Suche, Kabinenpreisvergleich und Jahreskalender. Es arbeitet ohne Installation oder externe Laufzeitdienste direkt im Browser.

**Öffentliche Seite:** [MEERZEIT 2027](https://tschenso.github.io/meerzeit-2027/) · [Jahreskalender](https://tschenso.github.io/meerzeit-2027/#kalender). Auch über mobile Daten erreichbar; der lokale Rechner muss dafür nicht laufen.

## Preise aktualisieren und Verlauf ansehen

In den Reisedetails steht ein Preisdiagramm mit allen dokumentierten Preisständen. Kabine, Tarif, Flugpaket, Belegung und Anbieter bleiben getrennt. Der Verlauf beginnt mit den tatsächlich vorhandenen Abrufen vom 23./24. Oktober 2026. Frühere Preise werden nicht nachträglich erfunden. Bei berechneten Kombinationen öffnen die Schaltflächen unter den Teilreisen deren Preisverläufe; eine wechselnde Zusammenstellung wird nicht als durchgehend gleiches Paket dargestellt.

Mit Node.js 22 oder neuer:

```sh
node scripts/preise-aktualisieren.cjs
node pruefen.cjs
node scripts/preise-pruefen.cjs
```

Das Skript aktualisiert die **bereits erfassten Reisen**, einschließlich der zwei unterstützenden Abfahrten 2028. Es liest die öffentlichen EURESA-Kategoriepreise, die paginierte Mein-Schiff-Jahresliste und die vorhandenen mykreuzfahrt-AIDA-Detailseiten. Es fügt keine neuen Katalogreisen hinzu. Die Jahresliste kann inzwischen weniger Reisen enthalten; verschwundene Reisen bleiben mit ihrem bisherigen Verlauf erhalten, werden aber nicht als frisch bestätigt ausgegeben.

`--dry-run` prüft den Abruf ohne Dateien zu schreiben. Mit `--operator=aida` oder `--operator=mein-schiff` lässt sich die Quelle eingrenzen; `--limit=3` begrenzt zum Test die Anzahl bearbeiteter Quellen. Ohne Optionen werden alle unterstützten Quellen abgefragt. EURESA wird nacheinander mit kurzer Pause angefragt, HTTP-Anfragen haben ein Zeitlimit. Es werden keine Zugangsdaten benötigt.

Der Verlauf speichert pro Angebotsreihe einen Stand je UTC-Tag, zusätzlich jede beobachtete Preisänderung innerhalb des Tages. Ein weggefallener Kategoriepreis wird als Lücke erfasst. Ein Abruffehler erzeugt keinen neuen Preispunkt und setzt keinen Preis auf null. Der letzte bestätigte Abrufzeitpunkt bleibt erhalten; bisherige Angebote werden als alt markiert und vom aktuellen Vergleich ausgeschlossen. Charter- und zusätzliche offizielle Quellen ohne implementierten Parser benötigen eine manuelle Prüfung und behalten ihren dokumentierten Stand. Scheitern sämtliche unterstützten Abfragen einer bearbeiteten Reederei, bleiben beide Datendateien unverändert.

### Aktualisieren direkt auf GitHub

Unter [Actions → Dashboard veröffentlichen und Preise aktualisieren](https://github.com/Tschenso/meerzeit-2027/actions/workflows/pages.yml) auf **Run workflow** klicken. Das aktivierte Feld „Aktuelle Preise abrufen und den Verlauf fortschreiben“ führt den Abruf aus, prüft die Daten, sichert die Preisstände als Git-Commit und veröffentlicht die Seite neu. Ohne dieses Feld wird nur der aktuelle Repository-Stand veröffentlicht. **Es ist kein automatischer Zeitplan eingerichtet.**

Die lokale Skriptausführung verändert zunächst nur die lokalen Datendateien. Für die öffentliche Seite die geprüften Änderungen committen und nach `main` pushen oder den GitHub-Workflow verwenden. Der Git-Verlauf erhält vorherige Datenstände.

### GitHub Pages bauen

```sh
node scripts/build-pages.cjs
```

Der Build kopiert ausschließlich die sieben Laufzeitdateien und `.nojekyll` nach `dist/`. Der Workflow veröffentlicht dieses Paket über GitHub Pages mit HTTPS. Lokale Sicherungen, Betriebsdateien und Skripte sind nicht im Webpaket. Das Repository selbst ist öffentlich. Jeder Push nach `main` prüft und veröffentlicht den aktuellen Stand erneut.

## Enthaltene Reisen

- **690 veröffentlichte Reisevarianten**: 191 recherchierte AIDA-Angebote und 499 Mein-Schiff-Angebote auf neun Schiffen.
- **531 Abfahrtstermine auf 17 Schiffen** nach Zusammenfassung gleicher Schiffe, Startdaten und Starthäfen.
- 181 erfasste Rundreisevarianten ab/bis Hamburg und fünf berechnete AIDA-Reisekombinationen.
- 29 einfache Atlantiküberquerungen sowie vier Atlantik-Rundreisen und eine Weltreise im Zusatzfilter.

Die AIDA-Auswahl umfasst die recherchierten Hamburg-, Rück- und Atlantikreisen. Die Mein-Schiff-Auswahl umfasst die zum Abrufzeitpunkt in der Jahresquelle gelisteten Reisen weltweit. Die Themenbereiche überschneiden sich; eine vollständige und tagesaktuelle Abdeckung der Reedereikataloge ist nicht zugesichert.

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

Auf großen Bildschirmen erscheinen beschriftete Monatsraster. Auf kleinen Bildschirmen zeigt der ausgewählte Monat lesbare Tageszeilen. Die Monatsnavigation ermöglicht den direkten Wechsel. Die Suche und alle Reisefilter gelten auch im Kalender.

Reisevarianten desselben Schiffs mit gleichem Startdatum und Starthafen zählen als ein Termin. Die Varianten und ihre unterschiedlichen Dauern bleiben einzeln aufrufbar. Leere Tage bedeuten, dass im gefilterten Datenbestand kein Termin erfasst ist. Abfahrtsuhrzeiten sind nicht enthalten.

Berechnete Kombinationen werden als Kombinationsstarts mit dem Schiff der ersten Teilreise dargestellt. Ein späterer Schiffwechsel wird nicht als gleichzeitige Abfahrt ausgegeben.

## Preise, Datenstand und Quellen

**Katalogstand: 23./24. Oktober 2026.** Den letzten Preisabruf und dessen erfolgreiche bzw. unbestätigte Quellen zeigt die Seite an. Gleiche Preise verschiedener Quellen können getrennt erscheinen. Die zwei unterstützenden Teilreisen 2028 sind in der Preisaktualisierung enthalten.

Die Preise sind Ab-Preise pro Person; die Vergleichsansicht rechnet für zwei Erwachsene in einer Kabine. Preisquelle und Abrufzeit stehen bei den Angeboten. Fehlende Preise sind keine Aussage über die Verfügbarkeit. Flugpakete bleiben gekennzeichnet und können gesondert einbezogen werden.

Ein allgemeiner Ab-Preis ohne eindeutige Kabinenzuordnung wird keiner Innenkabine zugewiesen. Eindeutig bestimmte Suiten und Junior-Suiten bleiben getrennt. Die Mein-Schiff-Anbietergruppe „Suite“ kann Junior-Suiten enthalten und erscheint deshalb als gesonderte Suitenkategorie.

Mein Schiff hat ein eigenes All-Inclusive-Bordkonzept. PRO, PLUS und PUR sind in der verwendeten Jahresquelle nicht aufgeschlüsselt; solche Preise heißen „Angebot · Tarif prüfen“. Leistungen und Buchungsbedingungen sind zwischen Reedereien und Tarifen verschieden.

Hauptquellen:

- [EURESA Reisen](https://euresa-reisen.de/reisesuche)
- [mykreuzfahrt: Mein Schiff 2027](https://www.mykreuzfahrt.de/tui-cruises/mein-schiff-2027/)
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
