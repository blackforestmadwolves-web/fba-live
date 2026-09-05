# Draft Top 100 und FBA-Value – v53

Vorbereitet am 05.09.2026 auf v52-Commit
`65c390bc671d8d76a335a05a75f454ff5238693d`.
Frontend-Build: `war-room-monster-v53-20260905`.

## Nutzerauftrag

Die Draft-Vorbereitung soll 100 statt 25 Spieler mit ausführlichen individuellen
Analysen zeigen. Maik-Value wird appweit in FBA-Value umbenannt. Das gemeinsame
Werte-Badge zeigt zuerst die Zahl, darunter FBA-Value, darunter die tatsächliche
Saison/Basis. Im Draft Radar stehen diese drei Zeilen rechtsbündig unter ESPN ADP.
Es wurde kein neuer Produktionsdeploy beauftragt; Auslieferung wieder als ZIP.

## Datenweg ohne Backendänderung

Die bestehende öffentliche Apps-Script-Antwort enthält neben `draftTop25` bereits
den vollständigen ADP-Tagesverlauf unter `adpTrend.players`. Beim erneuten Abruf
am 05.09.2026 enthielt dieser **622** Spieler-IDs. Der frühere Vergleichsstand
desselben Tages hatte 600. Die ausgewählten Top-100-Identitäten sind identisch.
Der Backend-Radar selbst liefert weiterhin 25; das ist für diesen Release korrekt.

`draft-radar-pool.js` verbindet diesen vorhandenen vollständigen Tagesstand mit
einem geprüften öffentlichen ESPN-Spielerkatalog für **seasonId 2027**. Dadurch
liefert die Frontend-Seite 100 Spieler ohne zusätzlichen ESPN-Abruf im Browser
und ohne Änderung an Cache, Tabellen, Apps-Script-Deployment oder privatem Token.

Das neue statische Asset `draft-player-catalog.js` enthält 1.095 ESPN-Identitäten,
Namen, NBA-Kürzel, primäre Positionen, bestätigte Fantasy-Positionen und das
öffentliche Active-Flag. Keine Fantasy-Eigentümer, Mitglieder, Kaderhistorie,
Transaktionen, Zugangsdaten oder Projektionswerte werden darin veröffentlicht.
Seine Metadaten tragen den Stand 05.09.2026. Der Seitenfooter benennt diesen Stand.
Die aktuellen `draftTop25`-Metadaten können für ihre IDs den Katalog ergänzen.
Ein späterer Team- oder Positionswechsel außerhalb dieser 25 erfordert einen
erneut geprüften Katalog oder eine künftige erweiterte Backend-Metadatenantwort.

Der komplette aktuelle ESPN-Fantasy-Feed wurde erneut read-only über die bereits
bestehende Backend-URL abgerufen und bestätigte 2027 sowie 1.095 Spieler.
`scripts/build-draft-player-catalog.mjs` verwendet dieselbe bestätigte
Positionsnormalisierung wie das Backend: eligibleSlots 0/1/2/3/4 entsprechen
PG/SG/SF/PF/C. G/F/UTIL/BE/IR und das gemischte Legacy-Feld `positions` werden
nicht als zusätzliche Spielerpositionen ausgegeben. Der Generator validiert
Saison, Umfang, Herkunfts-Hash, Datum und eindeutige Identitäten vor dem Schreiben.

Die Erweiterung verlangt übereinstimmende Saisonangaben. Verwendet werden nur
positive, endliche ADPs des ausdrücklich neuesten Tages; fehlende Namen,
unbekannte Identitäten, widersprüchliche Duplikate und inaktive Spieler werden
ausgeschlossen. Bei fehlendem Katalog oder nicht verwendbarer Trendstruktur
bleibt der validierte vorhandene Backend-Radar nutzbar. Es werden keine ADPs
aus einem statischen Ranking erfunden. Die tatsächliche Anzahl bleibt sichtbar.

Prüfergebnis des vollständigen aktuellen Datenwegs: 100 eindeutige Karten,
100 bestätigte Fantasy-Positionen und NBA-Teams. Jokić mit ADP 1,8 zuerst,
Keyonte George mit ADP 110,93 an Position 100.

## Analysen und Statistikbasis

Die bisherigen 25 ausführlichen Berichte bleiben erhalten. 75 zusätzliche,
individuell geschriebene Berichte ergänzen sie in `draft-editorial-100.js`.
Der ältere zusätzliche Jalen-Johnson-Eintrag wird durch seine neue ausführliche
Einordnung ersetzt, ohne die anderen bisherigen Artikel zu überschreiben.
Die Redaktion hat keinen Einfluss auf ADP-Reihenfolge, FBA-Value oder Referenzpool.

Jede neue Karte enthält Kurzbeschreibung, Bericht, Ausblick 2026/27, Stärken,
Risiken, FBA-Fit, Draft-Plan und überprüfbare Quellen. Die Quellenbelege stehen in
`draft-editorial-v53-sources.md`. Historische NBA-Zahlen wurden aus derselben
geprüften tatsächlichen 2025/26-Quelle wie der feste Value-Maßstab gelesen.
Aktuelle Tatsachenbehauptungen benötigen Primary-Quellen; die sportlichen
Draft-Empfehlungen sind eigene qualitative Einordnungen.

Vier Top-100-Spieler haben keine NBA-Statistikbasis 2025/26: Tyrese Haliburton,
Damian Lillard, Kyrie Irving und AJ Dybantsa. Die ersten drei erhalten klar
gekennzeichneten Kontext zur letzten aktiven Saison bzw. zum Ausfalljahr.
Dybantsas College-Zahlen sind ausdrücklich von NBA-Zahlen getrennt. Die
Redaktionszeile unterstützt daher einen eigenen `historySeason`-Statistikbezug.
Ein Artikel mit älteren Zahlen erzeugt keinen historischen FBA-Value für 2025/26.
Im öffentlichen Stand bleiben für diese vier Spieler Wert und Statistik fehlend;
gültige echte zukünftige Projektionen dürfen später wie bisher bewertet werden.
Auch kleine NBA-Stichproben, insbesondere Kesslers fünf Spiele, werden benannt.

Die 100er-Abdeckung bezieht sich auf den geprüften ADP-Pool vom 05.09.2026.
ADPs können weiter täglich aktualisieren; manuell verfasste Spielerartikel
werden nicht dadurch automatisch neu recherchiert. Wenn neue IDs in die Top 100
rücken, bleiben Datenkarten möglich; ein weiterer vollständiger eigener Artikel
benötigt neue Redaktion. Fehlende Einordnungen werden nicht als vorhanden ausgegeben.

## Anzeige und bestehende Funktionen

ADP-, FBA-Value- und Namenssortierung bleiben verfügbar. Die sichtbare Nummer
beschreibt die gewählte Listenposition. Sortierung ersetzt weiterhin nur das
Raster und Begleittext; Auswahlfeld und offene Spieleranalyse bleiben erhalten.
Eine dreistellige Nummer erhält ausreichend Breite. Porträts laden weiter lazy.

FBA-Value ist eine Umbenennung, keine neue Kalibrierung. Die acht Gewichte,
Quotenbehandlung, Division durch 6,3 und 104 festen Referenzspieler bleiben
unverändert. Jokićs historischer Wert bleibt deshalb +1,55. Die Anzahl der
angezeigten Karten beeinflusst diesen Maßstab nicht. Historische Werte behalten
die Zeile 2025/26; Projektionen und Ist+Rest tragen ihren wirklichen Bezug.
Fehlende Werte zeigen Statistik fehlt, nicht einen erfundenen Saisonwert.
Interne Funktionen, CSS-Klassen und gespeicherte Sortierschlüssel behalten ihre
Namen für Kompatibilität; sämtliche sichtbaren Maik-Value-Labels sind umbenannt.

Das gemeinsame Pickup Lab ist in `pickup-lab-v53.md` dokumentiert.
Die acht Teamberichte, Startseite, bestehender Draft War Room, privates
Free-Agency-Vorladen, Eigentümerhistorie und bisherige Saisonmodelle bleiben
erhalten. Backenddatei und interner Engine-Vertrag werden nicht verändert.

## Prüfung und Paket

Neue Verhaltenstests schützen Top-100-Datenweg, Saison-/Datumsgrenzen,
Duplikate, Positionsfilter, Eingabe-Unveränderlichkeit, vollständige aktuelle
Redaktionsabdeckung, Sonderfälle ohne Vorjahresstatistik und den unveränderten
104er-Maßstab. Der Test verwendet eine auf öffentliche ADP-Felder beschränkte
Antwortfixture; sie gehört nicht ins Frontend-ZIP.

Im vorbereiteten Datenstand: Abgleich aller 1.095 Metadatenzeilen mit dem aktuellen
ESPN-Rohfeed, aller 100 Karten mit der öffentlichen Antwort und Code-Review der
Integration, Badge-Reihenfolge, alternativen Statistikjahre und Quellenlinks.
Keine neue visuelle Browser- oder iPhone-Prüfung: Die gesperrte lokale Vorschau
wurde nicht umgangen. Keine neue Produktionsmessung der Ladezeit wird behauptet.

ZIP nur aus dem getesteten Commit, mit `index.html` im Wurzelverzeichnis und
allen versionierten öffentlichen Frontenddateien. Die drei neuen Draft-Laufzeitdateien
`draft-player-catalog.js`, `draft-radar-pool.js`, `draft-editorial-100.js` müssen
enthalten sein; außerdem `pickup-lab.js` und `pickup-lab.css`. Backend, Tests, Recherche-Rohantworten, Dokumentation und lokale
Uploads gehören nicht ins öffentlich deploybare Paket. Kein Backenddeploy nötig.

Finaler gemeinsamer Testlauf: 66 Tests in 16 Testdateien bestanden.
