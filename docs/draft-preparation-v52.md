# Draft-Vorbereitung und Teamberichte – v52

Vorbereitet am 05.09.2026 auf v51-Commit
`9d3ff3f32baccba7b076547429eb5249b655036f`.
Build: `war-room-monster-v52-20260905`.

## Verhalten

Die öffentliche Navigation enthält nach Start die Seite **Draft-Vorbereitung**.
Die bestehende Seite **Draft** mit ihrem War Room bleibt daneben erhalten.
Die 25 Spielerkarten wechseln von der Preseason-Startseite in die Vorbereitung.
Alle bisherigen Analysen, Porträts, Fantasy-Positionen, ADPs, Tagestrends und
Maik-Values verwenden weiterhin dieselben Daten und Renderer.

Sortierung: ESPN ADP aufsteigend als Vorgabe, Maik-Value absteigend oder Name
alphabetisch. Die Auswahl wird innerhalb der Sitzung gespeichert. Die
Ausgangsmenge bleiben die 25 frühesten ADPs; MV-Sortierung wählt nicht die
25 höchsten MV aus dem gesamten Spielerbestand aus. Die sichtbare Nummer
ist die Position in der gerade angezeigten Liste. Der ursprüngliche ADP-Rang
bleibt im Datenattribut erhalten. Fehlende Werte stehen hinter negativen MV;
Gleichstände werden reproduzierbar über ADP und Spieler-ID aufgelöst.

Sortieren ersetzt nur die Karten und den Begleittext. Das Auswahlfeld und
sein Fokus bleiben bestehen; eine geöffnete Spieleranalyse bleibt geöffnet.
Die ADP-Erklärung in jeder Karte beschreibt nun den durchschnittlichen
Draft-Pick unabhängig von der gewählten Sortierung.

Die Preseason-Startseite enthält einen Link zur Vorbereitung und acht
aufklappbare Teamberichte für 2026/27. Jeder Bericht hat eigene Geschichte,
Vorjahresrückblick, Saisonvorschau, Draft-Ausblick und vier Faktenfelder.
Die Quellen sind in `team-previews-v52-sources.md` dokumentiert.
Native Details-Elemente brauchen zum Öffnen kein weiteres Datenladen;
Teamlinks führen zum vorhandenen Team-Center. Geöffnete Artikel bleiben
bei Hintergrundaktualisierungen offen. Artikel sind auf ihre geprüfte Saison
begrenzt und werden bei einer anderen Saison nicht als aktuelle Vorschau gezeigt.

Conferences, Draftreihenfolge, Pickprognosen und Early Odds bleiben auf Start.
Die Startansicht der laufenden Saison bleibt erhalten; sie verwendet nicht
automatisch die redaktionellen Preseason-Berichte. Die genaue Rangberechnung,
die 104 festen MV-Referenzspieler, Backend, Eigentümerhistorie, Zugriffsschutz,
Startcache und privates Free-Agency-Vorladen wurden nicht geändert.

## Dateien und Prüfung

- `draft-prep.js` / `.css`: neue Seite und lokale Sortierung.
- `team-previews-2026-27.js`: geprüfte öffentliche Redaktion.
- `team-previews.js` / `.css`: Karten und lesbare Artikelansicht.
- `index.html`: Abhängigkeiten, Navigation, Startintegration und Buildkennung.
- `manifest.webmanifest`: Buildkennung.
- Zwei neue Verhaltenstestsuiten; bestehende Frontend-Prüfung um CSS-Dateien
  und die angepasste ADP-Erklärung erweitert.

Die Funktionsprüfungen decken fehlende/negative Werte, stabile Reihenfolge,
unveränderte Eingaben, blockierten Session-Speicher, offene Analysen, Navigation,
private Zugangsschranken, Teamzuordnung, Saisonfilter, Escaping und den
Erhalt der bisherigen Startinhalte ab. Der vollständige Testlauf umfasst
13 Testdateien und 46 Runner-Tests. Alle bestanden, ebenso vollständiger
Inline-JavaScript-Parse, Syntaxprüfungen und `git diff --check`.

Zusätzlich unabhängiger Code-Review der Ladereihenfolge, Helferauflösung,
CSS-Abgrenzung und mobilen Breiten. Keine neue visuelle Browser- oder
iPhone-Prüfung: Die gesperrte lokale Vorschau wurde nicht umgangen.

## Auslieferung

Frontend-ZIP mit `index.html` im Archivwurzelverzeichnis und allen benötigten
versionierten öffentlichen Assets, einschließlich der fünf neuen JS/CSS-Dateien.
Das Archiv wird aus dem getesteten Commit erstellt und jede enthaltene Datei
mit diesem Commit verglichen. Backend, Tests, Redaktion-Dokumentation,
Recherche-Rohdaten und lokale Uploads gehören nicht in das öffentliche ZIP.

Dieser Arbeitsgang bereitet den Download für einen manuellen Upload vor.
Es erfolgt kein Produktionsdeploy und keine Aktualisierung von Main.
Das geprüfte Remote-Main blieb bei `64897c231b5f6d06ce2da58e99421aca032f21f9`;
die Änderung wird auf einem eigenen Featurebranch gesichert. Für diese
Frontenderweiterung ist kein Apps-Script-Deploy erforderlich.
