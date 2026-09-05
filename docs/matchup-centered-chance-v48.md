# Matchup Projection: mittige Kategorie-Siegchance — v48

Vorbereiteter Stand vom 05.09.2026, noch nicht veröffentlicht.
Basis: Main `64897c231b5f6d06ce2da58e99421aca032f21f9`, produktive v47.
Frontend-Build: `war-room-monster-v48-20260905`.

## Anzeige

Die Kategoriezeilen verwenden die ruhige Darstellung des Performance-
Form-Checks: eine schmale dunkle Schiene, eine feste Mitte und ein farbiger
Balken, der von der Mitte zur Seite des favorisierten Teams wächst.

Über dem Balken steht genau eine Hauptwahrscheinlichkeit für das gewählte
Analyse-Team. Der Hinweis „Siegchance für …“ benennt dieses Team. 58 % bedeutet
58 % modellierte Kategorie-Siegchance, nicht 8 % Siegchance oder eine
prozentuale Abweichung der Statistikwerte.

- Über 50 %: grün; Balken zum Analyse-Team.
- Unter 50 %: rot; Balken zum Gegner.
- 50 %: neutral weiß, nur die feste Mitte, kein farbiger Ausschlag.
- Fehlende oder ungültige Wahrscheinlichkeit: Strich, kein erfundener Wert.

Die Anzeige rundet wie bisher auf ganze Prozent. Farbe und Balken folgen
demselben gerundeten Wert; auf 50 % gerundete knappe Unterschiede bleiben
deshalb ebenfalls neutral. Bei 58 % reicht der Ausschlag acht Prozentpunkte
der gesamten Schienenbreite von der Mitte zum Favoriten. 100 % würde eine
komplette Schienenhälfte füllen. Die bisherige Begrenzung des bestehenden
Modells wird durch diese Anzeige nicht geändert.

Auswärts bleibt links, Heim rechts. Das Analyse-Team wird auch ohne aktiven
Pickup ausdrücklich an die Zeilendarstellung übergeben. Die Anzeige behält
dadurch bei einem Seitenwechsel denselben Teambezug. Projizierte Kategorie-
Gesamtwerte bleiben links und rechts sichtbar. Beim Pickup bleiben die eigenen
Vorher-/Nachher-Werte und die Änderung der Chance in Prozentpunkten erhalten.

Das bestehende Wahrscheinlichkeitsmodell, die erwarteten FBA-Kategoriepunkte,
Spielerwerte und die Saison-Projektion werden nicht geändert. Die Zahlen sind
die vorhandenen Modellschätzungen; die neue Darstellung belegt keine neue
Kalibrierung oder höhere Genauigkeit.

## Prüfung

Die bestehenden Frontend-Regressionen prüfen die tatsächlichen Funktionen:
Analyse-Team links und rechts, Favorit auf beiden Seiten, Teamwechsel, 51/49,
58/42, Gleichstand, Rundung, ungültige Werte, Balkenrichtung/-länge,
unveränderte Statistikwerte sowie Pickup 40 % → 60 % mit +20 Prozentpunkten.
Es gibt genau eine Hauptwahrscheinlichkeit je Kategorie, und die Darstellung
verändert keine Prognose-Eingaben.

Alle acht Testdateien / 15 Runner-Tests bestanden; vollständiges Inline-
JavaScript, Backend-Syntax und `git diff --check` geprüft. Die privaten
Darstellungsprüfungen sind Funktions-/Markup-Tests in Node, keine visuelle
Browserprüfung der freigeschalteten Monster-Seite und kein iPhone-Test.
Die lokale Browser-Vorschau war in dieser Umgebung gesperrt; private
Zugangskontrollen wurden nicht umgangen.

## Veröffentlichung

Nur Frontend, Manifest, Frontendtests und dieses Dokument ändern sich.
Backend bleibt Apps Script Version 39, öffentliche Payload-Version 46 und
interner Projektionsvertrag v36. Die v46-Startbeschleunigung und das
v47-Free-Agency-Vorladen bleiben erhalten.

Der vorbereitete Stand wird auf `feature/matchup-centered-chance` gesichert.
Für eine spätere Veröffentlichung Main abgleichen, den exakten Release-Tree
prüfen, Main aktualisieren und Netlify bis ready verfolgen. Live-HTML und
Manifest mit den getesteten Dateien vergleichen. Ein Backend-Deploy ist für
diesen unveränderten Backendstand nicht erforderlich.
