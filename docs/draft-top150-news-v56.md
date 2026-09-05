# Draft-Vorbereitung v56 · 05.09.2026

Die bisherige Auswahl von 100 Spielern ist auf 150 aktive Spieler nach dem
aktuellen ESPN-ADP erweitert. Jeder der 150 Spieler im geprüften Snapshot hat
einen eigenen Bericht mit Stärken, Risiko, FBA-Fit, Teamfolgen und Draft-Plan.
Die 50 zusätzlichen Berichte verwenden keine erfundenen NBA-Vorjahreswerte.
Chris Paul bleibt als historische Identität erhalten, ist aber als zurückgetreten
von der aktiven Auswahl ausgeschlossen. Kelly Oubre Jr. ist im Prüf-Snapshot #150.

`draft-editorial-150.js` enthält die vollständige aktuelle Redaktion und ersetzt
den geladenen 75er-Ergänzungsbestand. Die bisherigen Dateien bleiben als
historischer Projektbestand erhalten. Search, Sortierung, Fotos und Positionen
funktionieren weiter. `draft-news-context.js` enthält 43 Ereignisse einschließlich
direkter Spieler, beteiligter Teams, mittelbar betroffener Top-150-Spieler,
Quellen, Status und Datum. Die Nachrichten sind in der jeweiligen Analyse
aufklappbar. Eigene Folgen stehen getrennt von belegten Ereignissen.

## Recherche und Grenzen

Geprüft wurden der vollständige aktuelle Offseason-Trade-Tracker und die
Sommerübersichten aller 30 Teams, ergänzt durch individuelle NBA-, ESPN-,
Reuters-, AP- und Beat-Writer-Meldungen. Die Quellenlinks zu jedem verwendeten
Ereignis stehen im Ereignisregister. Einstieg:

- [Offizielle Offseason-Transaktionen](https://www.nba.com/news/2026-offseason-trade-tracker)
- [ESPN-Transaktionsübersicht](https://www.espn.co.uk/nba/story/_/id/48957844/nba-trade-tracker-details-every-deal-2026-offseason-draft-free-agency)
- [Alle 30 Teamübersichten](https://www.nba.com/news/nba-offseason-deals-2026)
- [Verletzungsmeldungen mit ursprünglichem Meldungsdatum](https://www.espn.co.uk/nba/injuries)

Nicht jede gesichtete Transaktion rechtfertigt einen Text im Spielerbericht:
reine Draftrechte-/Cash-Deals ohne belegte aktuelle Top-150-Rollenfolge erzeugen
keine erfundene Aufwertung. Die Registry ist daher ein Register relevanter
Ereignisse, keine vollständige Abschrift aller NBA-Transaktionen.
Frühere In-Season-Wechsel werden nicht als neue Sommerereignisse umdatiert.
Vertragsverlängerungen sind keine Zusage für mehr Minuten. Die Recherche
behauptet keinen vollständigen Zugriff auf alle X-Timelines oder Camp-Berichte.

Datumswerte stehen nur dort als exaktes Ereignisdatum, wo sie belegt sind;
andernfalls zeigt die Oberfläche „Offseason 2026“. Bei Verletzungen kann das
Datum die datierte Statusmeldung bezeichnen. Alte Meldungen sind als solche
sichtbar. Geschätzte Rückkehrspalten werden nicht als Freigabe übernommen.

## Besonders relevante Änderungen

- Ball/Randle/Reid/Claxton: alle vier Zielteams und unter anderem Edwards,
  Gobert, McDaniels, Kuminga, White, Knueppel, Miller, Giddey, Porter und Demin.
- Giannis/Portis/Herro/Ware: Auswirkungen auf Bam, Turner und die Guard-Aufteilung;
  Klays und Richards’ Verpflichtungen ergänzen Miamis Kontext.
- Brown/George und LeBron: neue Abschluss- und Aufbauverteilung in Philadelphia,
  Boston und bei den Lakers. Kessler und Ayton separat berücksichtigt.
- Morant: neues Portland-Backcourt-Verhältnis mit Lillards erwarteter Rückkehr;
  Sharpes langer Ausfall wird nicht automatisch Henderson zugeschrieben.
- Sharpe und DiVincenzo: Risiko, Fit und Draft-Plan tatsächlich verschärft;
  zum Saisonstart keine normale Wochenproduktion eingeplant.
- Brunsons Operation, Millers Schulter-Reha, Butlers Rehabilitation, Aldamas
  Camp-Erwartung sowie Verletzungen außerhalb der Top 150 mit möglichen
  Mitspielerfolgen sind berücksichtigt.
- Leonard/Ingram: trotz abgeschlossener NBA-Untersuchung kein hier belegter
  Tradevollzug. LAC/TOR-Katalog bleibt erhalten, Folgen sind bedingt formuliert.
- Mathurin: gemeldete Einigung mit New Orleans, keine erfundene Vollzugsbestätigung.
  Widersprechender ESPN-Teamtext wird ausdrücklich erklärt.

## Unveränderte Berechnungsgrundlage

NBA-Historie 2025/26 und die feste 104-Spieler-Referenz des FBA-Value bleiben
unverändert. Nachrichten erzeugen keine numerischen Projektionen und verändern
weder ADP noch FBA-Value. Bei fehlender NBA-Historie bleibt der Wert leer.
Die zuvor vorbereitete Korrektur roter Verlustwahrscheinlichkeiten ist enthalten.
Die unabhängige angefangene Draft-Strategie-Arbeit in einem anderen Worktree
wurde nicht überschrieben oder ungeprüft übernommen.

## Wiederkehrende Prüfung

Die bestehende Automation „FBA NBA-Newscheck“ wurde am 05.09.2026 erweitert,
nicht dupliziert. Weiterhin alle zwei Tage um 08:00 Europe/Berlin, Start
07.09.2026. Sie prüft direkte und mittelbare Folgen bei allen beteiligten Teams,
liefert konkrete Vorschläge und wartet auf Maiks Einzelentscheidung.
Keine automatische Artikeländerung oder Veröffentlichung. Ein bloßer Check
verändert nicht das Änderungsdatum eines Berichts.

## Prüfung und Veröffentlichung

71 Tests erfolgreich (`node --test tests/*.test.mjs`). Geprüft: tatsächliche
150er-Abdeckung, eigenständige vollständige Berichte, Suche/Sortierung, unveränderte
104er-Wertreferenz, fehlende Historie, aktive Auswahl, Quellenverknüpfung,
Mitspielerfolgen über vier Teams, offene Dealstatus, verschärfte Verletzungspläne,
HTML-Escaping und unveränderte Berichtdaten beim Öffnen. `git diff --check` sauber.
Die bestehende Testsuite umfasst auch die rote Verlustwahrscheinlichkeitsanzeige.

Lokale Browser-Vorschau in dieser Umgebung war durch ERR_BLOCKED_BY_CLIENT
blockiert; deshalb keine behauptete visuelle Browser-Abnahme. Quellenanzeige
und Kartenmarkup sind per Rendering-Harness getestet.

Vorbereiteter Build: `war-room-monster-v56-20260905`. Nicht produktiv veröffentlicht.
