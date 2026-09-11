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

## Performance Watch: geprüfter Stand und offene Erweiterung

Der geprüfte Code auf Basis von main 31eb5a15f34ae36ce0b7be268f4e427521ed2968 vergleicht Wochenwerte mit vorherigen Wochen. Die Frontendfunktion analyticsCompute setzt GP sogar auf null. Das Backend liest zwar GP, verwendet es aber nicht als Divisor der Leistungsabweichung. Auch die beigefügte Excel enthält in S25_26 Performance Watch einen Wochenvergleich. Eine fertige Bereinigung pro Einsatz oder pro individuellem Spieler ist damit nicht belegt.

Die bestehende Performance Watch wird in diesem Schritt nicht fachlich umdefiniert. Berichte behaupten keine Über- oder Unterperformance aus bloßen Punktsummen oder aus unterschiedlichen Einsatzzahlen.

Geplante Weiterentwicklung, noch offen: Zählwerte pro tatsächlich gewertetem Spielereinsatz vergleichen; für individuelle Aussagen die eigene Baseline jedes Spielers verwenden. Vorherige Wochen und aktuelle Woche strikt trennen. Wurfquoten aus summierten Treffern und Versuchen bestimmen, niemals durch GP teilen. Auswahl der Baseline, ausreichende Stichprobe und Schwellen für redaktionelle Wertungen müssen festgelegt und anhand echter Daten geprüft werden. Frühe Saisonwerte als erste Eindrücke kennzeichnen.

## Aktualisierung und Grenzen

Das Modul hängt an der bestehenden öffentlichen Datenkette und deren ESPN-Sync, ergänzt deren Cache und aktualisiert sich bei erneuten Abrufen. Auf der sichtbaren Startseite und bei Rückkehr in die App werden nach fünf Minuten erneut Daten angefragt. Fehlversuche werden ebenfalls gedrosselt. Es richtet keinen separaten ChatGPT-Task ein. Tägliche Inhalte brauchen den laufenden serverseitigen ESPN-Sync; der Frontend-Umbau allein aktiviert keine Datensammlung.

Diese Änderung ist vorbereitet und getestet, aber nicht produktiv veröffentlicht. Es werden keine bestehenden historischen Excel-Werte geändert. Berichte enthalten keine historischen H2H-Behauptungen oder neue Performance-Watch-Berechnungen.

Geprüft: neue Regressionsfälle für vollständigen Spielplan, Saisonabweichung, fehlende Werte, Start ohne Spiele, Heim-Ties, Endstand-Abgleich, drei gegen einen Einsatz, Boxscore-/Eigentümerfehler, Aktualisierung und Wurfquoten. Die bestehenden acht Startup-/Cachetests bestehen ebenfalls. Das Inline-JavaScript wurde vollständig geparst. Kein visueller Browsertest auf einem iPhone wurde durchgeführt.
