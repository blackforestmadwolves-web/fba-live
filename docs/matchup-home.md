# Matchups als täglicher Einstieg

Auftrag von Maik, 11.09.2026. Diese Produktrichtung gilt auch für weitere App-Arbeit: Beim Öffnen zuerst die vier aktuellen Matchups mit Spielstand. Täglich neue, belegbare Inhalte sollen einen Grund zum Wiederkommen geben. Bestehende Draft-, Performance- und Teamseiten bleiben erreichbar.

## Umsetzung

- Vier kompakte Spielstände im Zweier-Raster, auch auf dem Handy. Auswärts links, Heim rechts. Wochenwahl, direkter Sprung zum Bericht und aufklappbare acht Punktwerte.
- Darunter je Matchup ein kurzer Bericht, normalerweise etwa fünf bis sieben Sätze. Quellenzeitpunkt sichtbar. Frische Texte entstehen aus dem erfolgreichen ESPN-Sync und den in der FBA-Tabelle gespeicherten Daten.
- Keine erfundenen Paarungen oder 0:0-Platzhalter. Kein 0:8 vor dem ersten Einsatz. Der alte Saison-Snapshot darf niemals als aktuelles Matchup erscheinen.
- Spielplan-Gate: genau vier Paarungen, acht unterschiedliche Teams, passende Saison und Woche. Fehlende Daten bleiben leer. Widersprüche führen zu DATA ISSUE.
- Spielstand aus allen acht vollständigen StatsRaw-Wertepaaren. Heimvorteil bei Gleichstand. Zweiter Abgleich mit Results für abgeschlossene Wochen.
- Einsatz- und Spielerangaben nur bei vollständigen finalen Boxscores mit bestätigter damaliger Eigentümer- und Lineup-Zuordnung; Zählwerte müssen zu StatsRaw passen. DNP, Bank und spätere Transfers dürfen die Auswertung nicht verfälschen.
- Bei offenen oder widersprüchlichen Daten bleibt der Bericht gesperrt. Der Zeitpunkt des letzten erfolgreichen Datenabrufs wird angezeigt; ein Seitenaufruf ist kein neuer Datenstand.

## Team-Performance Watch – Entscheidung vom 11.09.2026

Maik lehnt einzelne Spieler-Performance-Watches ausdrücklich ab: zu viel Information, offensichtliche Einzelabweichungen brauchen keine eigene Auswertung. Diese Idee ist verworfen. Gewünscht ist eine kleine Plus-/Minus-Prozentzahl direkt bei jedem Team im Matchup. Positiv grün, negativ rot, null neutral. Spielstand und Performance bleiben unabhängig.

Die Startseite zeigt Team-PW pro gewertetem Einsatz. Woche 1: Strich statt eines erfundenen Nullwerts. Woche 2: Zahl mit Hinweis „erste Tendenz“. Weitere Wochen erweitern die Baseline; mehr Daten beseitigen aber keine Unsicherheit durch kleine aktuelle Stichproben oder Kaderwechsel.

Berechnung: Für die sechs Zählwerte wird der aktuelle Teamwert durch tatsächlich gewertete Einsätze geteilt. Die Baseline ist die Summe der Teamwerte aus allen vollständig abgeschlossenen Vorwochen derselben Saison, geteilt durch deren gesamte gewertete Einsätze. FG% und FT% werden jeweils aus summierten Treffern und Versuchen berechnet. Pro Punkt: Ist/Baseline − 1. Team-PW ist das gleichgewichtete Mittel aller acht relativen Abweichungen, in Prozent dargestellt. Das entspricht der bisherigen Gleichgewichtung, mit korrekter Einsatzbereinigung und Quotenaggregation.

Alle Vorwochen müssen vollständig mit StatsRaw, Spielplan und Results abgeglichen sein. Fehlende Eigentümer-/Lineup-Zuordnung, unvollständige Boxscores, fehlende Einsätze oder ein nicht definierter Vergleich (z. B. Baseline null) ergeben keine Zahl. Zielwoche und spätere Wochen fließen nie in die Baseline ein. Spielerbezogene Leistungsnoten werden weder berechnet noch angezeigt.

Der historische Performance-Tab bleibt in diesem Schritt unverändert. Sein älterer Wochenvergleich ist nicht die Quelle der neuen ausdrücklich als „Teamleistung pro Einsatz“ bezeichneten Startseitenzahl.

## Aktualisierung und Grenzen

Das Modul hängt an der bestehenden öffentlichen Datenkette und deren ESPN-Sync, ergänzt deren Cache und aktualisiert sich bei erneuten Abrufen. Auf der sichtbaren Startseite und bei Rückkehr in die App werden nach fünf Minuten erneut Daten angefragt. Fehlversuche werden ebenfalls gedrosselt. Es richtet keinen separaten ChatGPT-Task ein. Tägliche Inhalte brauchen den laufenden serverseitigen ESPN-Sync; der Frontend-Umbau allein aktiviert keine Datensammlung.

Diese Änderung ist vorbereitet und getestet, aber nicht produktiv veröffentlicht. Es werden keine bestehenden historischen Excel-Werte geändert. Berichte enthalten keine historischen H2H-Behauptungen .

Geprüft: neue Regressionsfälle für vollständigen Spielplan, Saisonabweichung, fehlende Werte, Start ohne Spiele, Heim-Ties, Endstand-Abgleich, drei gegen einen Einsatz, Boxscore-/Eigentümerfehler, Aktualisierung und Wurfquoten. Die bestehenden acht Startup-/Cachetests bestehen ebenfalls. Das Inline-JavaScript wurde vollständig geparst. Kein visueller Browsertest auf einem iPhone wurde durchgeführt.
