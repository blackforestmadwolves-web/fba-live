# Maik-Value und größere Hot-Zone-Porträts — v49

Vorbereitet am 05.09.2026; auf Nutzerwunsch noch nicht veröffentlicht.
Basis dieser Erweiterung: v48-Vorbereitung `7887acc852443a95fd71d9384d8a6a8cad73b4ed`.
Produktionsstand bleibt v47/Main `64897c231b5f6d06ce2da58e99421aca032f21f9`.
Der vorbereitete Build `war-room-monster-v49-20260905` enthält auch die
mittige Kategorie-Siegchance aus v48. Kein v48- oder v49-Produktionsdeploy.

## Fachliche Definition

Maik-Value ist eine eigene gewichtete Kategorie-Bewertung pro Spiel ohne
Turnover. Er ist keine Punkte-pro-Stat-Summe und keine Sieg-Wahrscheinlichkeit.

| Kategorie | Gewicht |
|---|---:|
| PTS | 1,0 |
| 3PM | 0,8 |
| REB | 1,0 |
| AST | 1,0 |
| STL | 0,7 |
| BLK | 0,8 |
| FG% | 0,5 |
| FT% | 0,5 |

Die 0,5 sind Kategoriegewichte, nicht 0,5 Prozent. Summe der Gewichte: 6,3.

Für Zählkategorien wird `(Spielerwert − Referenzmittel) / Referenz-SD`
berechnet. Die Standardabweichung ist die Populations-SD. Bei einer konstanten
Referenzkategorie ohne messbare Streuung ist ihr Beitrag neutral null.

Für FG% wird zuerst `FGM − Referenz-FG% × FGA` verwendet; FT% entsprechend
mit FTM/FTA. Die Referenzquoten entstehen aus summierten Treffern und Versuchen
der pro-Spiel-Profile. Anschließend wird auch dieses Volumenmaß normiert.
So bekommt eine hohe Quote bei wenigen Würfen nicht denselben Einfluss wie
dieselbe Quote bei vielen Würfen.

`Maik-Value = Σ(Gewicht × Kategorie-z) / 6,3`.
Die Anzeige rundet auf zwei Nachkommastellen, mit Pluszeichen bei positivem
Wert. Höher ist besser; null entspricht dem Referenzmittel. Ein negativer Wert
ist eine Bewertung unter dem Vergleichsmittel, keine negative Siegchance.

Der Nutzer hat diese Gewichte aus seinen BBM-Einstellungen vorgegeben.
[BBM Help](https://basketballmonster.com/Help.aspx) erläutert z-Scores und
Kategoriegewichte; [Josh Lloyds Artikel](https://basketballmonster.com/article.aspx?article=1831)
beschreibt das Heruntergewichten einzelner Kategorien. Unser Datenpool und
unsere explizite Mittelwertdefinition belegen keinen identischen BBM-Score.

## Datenbasis und gemeinsame Referenz

Der vorhandene `draft-prototype-data.js` enthält 500 eindeutige Spieler-IDs:

- 374 strukturell vollständige Profile mit Quelle `TESTMODELL · ESPN-Basis 2025/26`.
- 7 anders gekennzeichnete `TESTMODELL · ESPN-Fallback`-Profile.
- 119 Platzhalter ohne Statistikbasis/`projectionReady:false`.

Nur die 374 ausdrücklich bezeichneten Basisprofile bilden die Referenz.
Die vollständige Richtigkeit jedes historischen Ausgangswerts oder der
GP-Angaben wurde damit nicht neu gegen ESPN verifiziert. Die Anzeige lautet
deshalb „Basis 2025/26“. Fallback-Spielern und Platzhaltern wird kein
angeblich echter Vorjahres-Maik-Value zugewiesen.

Das Vergleichsfeld wird weder auf freie Spieler noch auf eine Position,
Top25-ADP, ein Analyse-Team oder eine Woche eingeschränkt. Es gilt auf jeder
Seite. Es verwendet alle geeigneten Profile, nicht das alte 360er-Limit des
weiter vorhandenen FBA-Modells. ADP-Reihenfolge und Eigentümer ändern es nicht.

Aktuelle vollständige Projections werden gegen dieselbe Referenz bewertet.
Neue Spieler können dadurch einen Projektionswert erhalten, auch wenn sie
keine Vorjahresbasis besitzen. Hauptwert ist eine gültige aktuelle Projektion,
sonst die ausdrücklich bezeichnete historische Basis. Ohne beides steht „–“.

Aktuelle Projections benötigen die bereite bestehende Engine, eindeutige
Saison 2026/27 (seasonId 2027) und vollständige gültige Treffer-/Versuchs- und
Zählwerte. Widersprüchliche Saisons, Teilprofile, negative Werte und nicht
bestätigte Ist-Abdeckung werden nicht als aktueller Value ausgegeben.

Bei bestätigten Ist-Spielen wird `monsterProjectionSeasonFinish` benutzt:
Ist-Summen plus unverbrauchte eingefrorene Baseline, geteilt durch Ist-GP plus
Rest-GP. Die Kennzeichnung lautet dann „Ist + Rest 2026/27“. Das ist der
erwartete Saison-Endschnitt. Die reine Zukunftsannahme wird durch diesen
Anzeigewert nicht neu gelernt oder verändert. DNP, Final- und historische
Eigentümerregeln der bestehenden Engine bleiben maßgeblich.

## Oberfläche

Maik-Value erscheint in den öffentlichen Draft-Prognosen, Top25-Karten,
Draft-Spielersuche, Snake-Board, Best-Fit-Karten, Pickup-Auswahllisten und
Ergebnissen, Matchup-Szenariobanner, B2B-Karten, Verletztenliste, Season-Pickup-
Ergebnis und Journey-Spielerhinweisen, Free-Agency-Karten einschließlich Hot
Zone/Upside, Spieler-des-Abends-/Starting-Five-Karten sowie Team-Pickup-Hinweisen.
Unvollständige Quellenprofile zeigen ausdrücklich einen fehlenden aktuellen
Value. Namen ohne ID werden nur bei eindeutigem exaktem Namensmatch zugeordnet.

Im aufklappbaren Draft-Radar und in Free-Agency-Details stehen Maik-Value und
die acht Statistiken für Basis und aktuelle Projektion nebeneinander. Eine
aufklappbare Erklärung nennt Gewichte, Rechnung und Referenz. Die Datenbasis
steht außerdem direkt bei jedem normalen Value-Badge beziehungsweise im
Text einer Auswahloption.

Free Agency startet mit Sortierung nach Maik-Value; Hot Zone nimmt die höchsten
verfügbaren Maik-Werte. Bestehender FBA-Rang, dessen Sortieroption, Upside-
Definition und B2B-Wochenrestwerte bleiben eigenständige bisherige Kennzahlen.
Die Top25 auf der Startseite bleiben nach tatsächlichem ESPN-ADP sortiert.
Hunt/Punt/Best-Fit-Algorithmen, Matchup-Wahrscheinlichkeiten und echte FBA-
Kategoriepunkte werden durch diesen zusätzlichen Spielerwert nicht geändert.

Hot-Zone-/Upside-Porträts wachsen von 53×60 auf 82×94 CSS-Pixel. Die Bildspalte
und Kachelhöhe wachsen mit; Namen können zwei Zeilen nutzen. Starting-Five-
Karten nutzen für ihren größeren Textblock normalen Layoutfluss, damit der
Maik-Value nicht in ein absolut platziertes Foto wächst.

Season-Journey ergänzt eine separate `displayId`: Vor einem simulierten
Pickup zeigt der Drop-Name auf die Drop-ID, ab Wirksamkeit auf den Add.
Die bisherige ID für die Rechenzuordnung und die Summen bleiben erhalten.

## Umsetzung und Prüfung

`maik-value.js` enthält das gemeinsame reine Modell für Browser und Node.
Index-Helfer erzeugen einmal pro Ansicht/Datensatz die Nachschlagetabellen und
merken berechnete Spielerwerte. Die Referenzverteilung wird nur bei tatsächlich
geänderten Eingangsstats neu gebaut; auch gleicher Poolumfang mit geänderten
Werten wird nach neuem Render korrekt erkannt.

Es wird kein weiterer Datenabruf ausgelöst. Vorjahreswerte nutzen die bereits
geladene lokale Basis. Aktuelle private Daten werden ausschließlich im
Arbeitsspeicher eines freigeschalteten Geräts verwendet und nicht dem
öffentlichen v46-Startcache hinzugefügt. Logout entfernt ihre Verwendbarkeit.
v46-Startbeschleunigung und v47-Free-Agency-Vorladen bleiben erhalten.

Prüfungen umfassen exakte Gewichte, unabhängige mathematische Erwartungen,
Volumeneinfluss, Null-/Fehlwerte, konstante Kategorien, doppelte Identitäten,
ADP-/Reihenfolge-/Eigentümerunabhängigkeit, neue Spieler, Quellenabgrenzung,
Cachewechsel, Wemby-Ist-plus-Rest, Saisonprüfung, Logout, HTML-Escaping,
Maik-Sortierung und korrekte Journey-Anzeige-ID vor/nach Pickup-Wirksamkeit.

Alle zehn Testdateien / 28 Runner-Tests bestanden. Vollständiges Inline-JS,
`maik-value.js`, Backend-Syntax und `git diff --check` geprüft.
Diese Prüfungen sind Funktions-/Markup-Tests in Node und statische CSS-
Prüfungen. Keine neue visuelle private Browserprüfung, kein iPhone-Test;
die lokale Browser-Vorschau war in dieser Umgebung gesperrt. Die bestehende
private Freischaltung wurde für die Prüfung nicht umgangen.

## Späterer Release

Vorbereitung auf `feature/maik-value`. Frontend/Manifest, neues JS-Modul,
Tests und Dokumentation ändern sich. Apps Script bleibt Version 39,
öffentliche Payload-Version 46 und interner Projektionsvertrag v36.

Bei „live“ aktuellen Main abgleichen, exakten kombinierten Tree testen und
veröffentlichen. Das Netlify-Archiv muss auch das neue versionierte
`maik-value.js` enthalten. Netlify bis ready verfolgen, HTML, Manifest und
Maik-Modul bytegenau live prüfen. Für diesen unveränderten Backendstand ist
kein neuer Apps-Script-Deploy nötig.
