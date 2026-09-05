# Fester FBA-Vergleichsmaßstab — v51

Vorbereitet am 05.09.2026 auf v50-Commit
`db226252bdd4c818ca5a1ea9aef911b2f283de56`. Der Nutzer hat die saubere
Festlegung des Vergleichspools und gemeinsame Neuberechnung autorisiert.
Kein Produktionsdeploy in diesem Arbeitsgang; Auslieferung als Frontend-ZIP.

## Entscheidung

Der Vergleichspool ist die feste Spielergruppe, deren Mittel und Streuung
die Kategorie-Werte bestimmen. Spieler außerhalb dieser Gruppe können
gegen denselben Maßstab bewertet werden, ohne ihn zu verändern.

Die FBA hat acht Teams mit jeweils 13 Kaderplätzen: 104 Spieler. Diese Größe
ist im vorhandenen Draft (`DRAFT_MAX_ROUNDS=13`, acht Picks pro Runde) und
in den Kaderprüfungen der Season Simulation bestätigt.

Unsere ausdrücklich eigene Auswahlregel für 2026/27:

1. Vollständige tatsächliche NBA-Regular-Season-Totals 2025/26 verwenden.
2. Mindestens 20 tatsächlich absolvierte Spiele für Referenzkandidaten.
3. Über dieses Kandidatenfeld einmal das bestehende gewichtete Maik-Modell
   berechnen und die 104 höchsten Auswahlwerte nehmen; Gleichstände über
   die ESPN-ID lexikografisch auflösen.
4. Mittel, Streuungen und Quotenmaßstab auf diesen 104 Spielern berechnen.
   Dieser letzte Maßstab bewertet alle Spieler, einschließlich der 104 selbst.

Die 20-Spiele-Grenze ist eine bewusste Mindeststichprobe, kein empirisch
bewiesenes Optimum und keine behauptete BBM-Regel. Es gibt keinen zusätzlichen
Minuten-, Positions-, Ownership-, ADP- oder Live-Kaderfilter. Es wird nicht
iterativ neu ausgewählt. Nach dem letzten Neufit sind die ausgewählten 104
deshalb nicht zwingend identisch mit den anschließend neu sortierten Top 104.
Die Bezeichnung lautet bewusst „104 feste Referenzspieler“.

Die Snapshot-Datei und Auswahlregel sind für 2026/27 fest. Spätere Projections,
neue Spieler, Trades, Pickups und abgeschlossene Spiele ändern die Referenz
nicht. Eine spätere bewusste Datenkorrektur oder Regeländerung ist ein eigener
versionierter Release, kein unbemerkter Browser-Sync.

## Historische Quelle

Verwendet wird der öffentliche [ESPN-NBA-Statistik-Endpunkt](https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&limit=1000&season=2026&seasontype=2&sort=offensive.avgPoints:desc).
Die Antwort bestätigt `requestedSeason.year=2026`, Regular Season `type=2`,
ein abgeschlossenes Saisonende und genau eine vollständige Seite mit 582
Spielern. Zahlen werden aus `category.values` anhand von `category.names`
gelesen, nicht aus gerundeten Anzeigestrings. Alle zehn Zählkategorien sind
vollständig und ganzzahlig; GP, Treffer/Versuche, Dreier und Punkteidentität
werden geprüft. Keine doppelte ID im veröffentlichten Datensatz.

Die lokale Datei `maik-history-2025-26.js` enthält nur die nötigen ESPN-IDs,
Namen, echten GP, zehn Saison-Totals und Herkunftsmetadaten. Alle Objekte sind
rekursiv eingefroren. Pro-Spiel-Stats entstehen ausschließlich aus Totals/GP.
`statSourceId/statSplitTypeId/scoringPeriodId=0` und `final=true` sind unsere
semantischen Herkunftstags, keine behaupteten nativen Felder dieses Endpunkts.

Abruf: `2026-09-05T13:08:19.064813+00:00`.
SHA-256 der geprüften Rohantwort:
`cb048788b5e47a02af789a15010c8876e81e933606795e893ff24653b0cfd242`.

`scripts/build-maik-history.mjs` erzeugt das Asset aus einer vollständigen,
geprüften Rohantwort und explizitem Abrufdatum. Es schreibt erst nach
Scope-, Vollständigkeits- und Modellprüfung. Dies ist ein Offline-Schritt
für einen bewussten Release, keine automatische Aktualisierung der Referenz.

Der vorherige Fantasy-Hub war als historische Vollquelle ungeeignet: nur
560 positive-GP-Zeilen, Olbrich unter zwei IDs mit Teilstatistiken sowie ein
unbestätigtes Lillard-Nullprofil. Diese Antwort wird nicht übernommen.
Die NBA-Statistikquelle enthält Olbrich eindeutig mit 37 Spielen und Lillard
ohne Saisonauftritt gar nicht. Prototype-GP wie Jokić 74 oder Wemby 71 werden
für Maik nicht weiterverwendet; bestätigt sind 65 beziehungsweise 64.
Andere bestehende Prototype-Anwendungen werden durch diesen Release nicht
still verändert oder als vollständig korrigiert ausgegeben.

## Ergebnisse und Bedeutung

582 historische Profile bleiben bewertbar. 452 erfüllen die Mindestzahl von
20 Spielen, daraus werden 104 Referenzspieler ausgewählt. PTS-Mittel dieser
Gruppe: 19,077390; PTS-Standardabweichung: 5,121988.

| Spieler | Echte GP | Neuer historischer MV | Referenzmitglied |
|---|---:|---:|---|
| Nikola Jokić | 65 | +1,55 | Ja |
| Luka Dončić | 64 | +1,19 | Ja |
| Victor Wembanyama | 64 | +1,11 | Ja |
| Shai Gilgeous-Alexander | 68 | +0,83 | Ja |
| Jahmyl Telfort | 8 | −2,14 | Nein |

Null bedeutet den gewichteten Durchschnitt der Referenzgruppe. Es ist keine
Draft-Grenze, kein Ersatzspielerwert und keine Siegchance. Auch ein nützlicher
Kaderspieler kann negativen MV haben. Im ganzen historischen Bestand sind
46 Werte positiv und 536 negativ. Das ist eine Folge des stärkeren Maßstabs,
kein Ausschluss dieser Spieler. Kleine Stichproben werden in den Details
mit tatsächlichen GP kenntlich gemacht.

Maiks acht Gewichte, die Volumenbehandlung von FG/FT und der Nenner 6,3
bleiben unverändert. Es wird weder ein BBM-Wert kopiert noch Jokić künstlich
auf 1,33 kalibriert. Dies definiert unseren Maßstab nachvollziehbar; eine
höhere zukünftige Prognosegenauigkeit wurde damit nicht empirisch bewiesen.

## Integration und Prüfung

`createSeasonModel(snapshot)` ergänzt das bestehende reine Maik-Modul;
`createModel` und `score` bleiben generisch unverändert. Das Modell hält die
104 Referenzwerte und separat sämtliche gültigen historischen Profile.
Bei unklarem Saison-Scope oder weniger als 104 geeigneten Kandidaten blockiert
die MV-Anzeige, statt auf Prototype-Daten oder einen kleineren Pool auszuweichen.

Alle bestehenden MV-Anzeigen verwenden diesen gemeinsamen Maßstab. Auch
gültige neue Projections und „Ist + Rest“ werden dagegen bewertet. Die
historischen Detailstatistiken wechseln auf die neue tatsächliche Quelle.
Die sichtbare Jahreszeile bleibt `2025/26`, der MV im Draft Radar rechts unter
ESPN ADP. Zugriffsschutz und historische Eigentümerberechnung bleiben erhalten.

Das Asset umfasst rund 90 KB, lokal gzip-komprimiert rund 24 KB. Es braucht
keinen weiteren ESPN- oder Apps-Script-Aufruf beim Öffnen. Die Verteilung wird
einmal je unverändertem Asset aufgebaut und im Speicher wiederverwendet.
Das ist keine neue Messung der realen Browserladezeit.

Geprüft werden Auswahlgröße, Mittelwert null, feste Gewichte, 19-/20-GP-Grenze,
bewertbare Spieler außerhalb des Pools, echte Totals/GP, Scope-Widersprüche,
fehlendes Asset, doppelte Identitäten, Reihenfolge-/ADP-/Kaderunabhängigkeit,
Projektions- und Ist-plus-Rest-Verwendung, Logout, Markup und Inline-Syntax.
Alle elf Testdateien / 36 Runner-Tests und sämtliche Syntaxprüfungen bestanden.
Ein unabhängiger Review bestätigte die exakte Übereinstimmung aller 582
veröffentlichten Datensätze mit der normalisierten ESPN-NBA-Quelle.

Keine neue visuelle Browser- oder iPhone-Prüfung; die gesperrte lokale
Vorschau und private Freischaltung wurden nicht umgangen.

## Paket

Build `war-room-monster-v51-20260905`. Frontend-ZIP muss zusätzlich
`maik-history-2025-26.js` enthalten; Backend, Recherche-Rohantworten, Tests und
lokale Dateien gehören nicht in das öffentliche Archiv. Apps Script bleibt
Version 39, öffentliches Payload v46, Engine-Vertrag v36. Kein Backenddeploy
für diese Frontend-Erweiterung erforderlich.
