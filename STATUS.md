# Meerzeit 2027 · 22.11.2026

## Stand

- GitHub Pages zeigte den erfolgreichen Preisstand vom 02.11.2026. Der Lauf vom 09.11. speicherte 42 bestätigte und 777 fehlgeschlagene Quellen im Git-Verlauf (`5eb2caa`), scheiterte aber bei der Veröffentlichung. Am 16.11. brach der Quellenabruf mit HTTP 429 ab. Am 22.11. lieferte EURESA bei direkten Abfragen eine Browserprüfung.
- Geprüften Preisstand vom 02.11. als Veröffentlichungsbasis wiederhergestellt. Der Datenstand vom 09.11. bleibt in seiner Git-Version erhalten. Das Dashboard kennzeichnet einen überfälligen Preisstand.
- In der Preisaktualisierung führen HTTP 403/429, die EURESA-Browserprüfung sowie weniger als 90 % bestätigte Quellen pro Reederei zum Abbruch vor dem Schreiben. Tests simulieren Sperre und Teilabruf.
- Am 22.11. bestätigte der [Cloud-Kurztest](https://github.com/Tschenso/meerzeit-2027/actions/runs/45024243386) je eine AIDA- und Mein-Schiff-Reise. Der [Vollabgleich](https://github.com/Tschenso/meerzeit-2027/actions/runs/45024303246) brach anschließend bei der EURESA-Browserprüfung vor dem Schreiben ab. GitHub Pages zeigt den Hinweis und weiterhin die Preise vom 02.11.
- Stichproben der Rückreisen bestätigten unter anderem Lissabon–Kiel mit AIDAbella sowie Leixões–Hamburg mit Mein Schiff 6 (11 und 18 Nächte). Die veröffentlichten Zwischenstopps der 11-Nächte-Reise stimmen in beiden geprüften Logbuchfassungen überein.

## Nächste Schritte

- Preisvollabgleich nach Wiederherstellung eines unterstützten Anbieterzugangs. Die geplanten Zwischenstopps mit den Reedereidaten vergleichen, sobald eine stabile Quelle dafür verfügbar ist.

## Offene Entscheidungen (Jens)

- Keine. Für einen neuen vollständigen Preisstand fehlt ein verlässlich abrufbarer Zugang zu den öffentlichen Preisangaben des Anbieters.
