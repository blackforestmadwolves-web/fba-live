# Matchup Projection: Rot zeigt Verlustrisiko — v54.1

Auftrag vom 05.09.2026: Die rote Hauptzahl soll das Risiko zeigen, den jeweiligen
FBA-Punkt zu verlieren. Im angefragten REB-Beispiel werden deshalb 68 % rot
angezeigt, wenn die Gewinnchance des Analyse-Teams 32 % beträgt.

## Grundlage

Die bei Übernahme tatsächlich veröffentlichte App ist v54. Ihr HTML wurde am
05.09.2026 geladen und stimmt bytegenau mit dem lokalen Commit
`a10cdb08a79f82f1fd0ac8286d8410db2217f0c4` überein. Der entsprechende GitHub-Commit
ist `63cd1db3e5c1f08d47f4f36af816af83de769b0e` auf
`feature/draft-search-v54`. Beide haben den Tree
`4bee7fb76e929dfcc81f7362405ce2bc6109a8f3`.

GitHub Main steht bei dieser Prüfung noch auf v47. Deshalb darf Main nicht als
vollständiger aktueller Produktionsquellstand behandelt werden. Die separate,
noch unvollendete v55-Arbeit wurde bei dieser Korrektur nicht verändert. Bei
ihrer späteren Fertigstellung muss diese Prozentkorrektur übernommen werden.

## Verhalten

- Rot: `100 − eigene gerundete Gewinnchance`, also Verlustrisiko.
- Grün: eigene Gewinnchance wie bisher.
- 50 %: neutral; Rundung und mittige Balkendarstellung bleiben erhalten.
- Fehlende Wahrscheinlichkeit: Strich, kein erfundener Wert.
- Der Teambezug gilt links und rechts sowie bei einem Teamwechsel.

Die sichtbare Legende lautet „Grün: Gewinn · Rot: Verlust“. Die barrierefreie
Beschreibung bezeichnet die jeweilige Zahl als Gewinnchance oder Verlustrisiko.
Auch `data-percent` enthält die tatsächlich sichtbare Zahl.

Die Wahrscheinlichkeitsberechnung, erwarteten FBA-Punkte und Balkenlängen werden
nicht verändert. Intern bleibt `monsterChanceIndicator().percent` die eigene
Gewinnchance. Der Pickup-Vergleich trägt ausdrücklich die Beschriftung
„Gewinnchance“ und verwendet weiterhin diese Bezugsgröße: 32 % → 42 % bedeutet
+10 Prozentpunkte Verbesserung, während die rote Hauptzahl auf 58 % sinkt.

## Prüfung

`node --test tests/*.test.mjs`: 68 Tests bestanden. Die bestehenden
Frontendprüfungen wurden an die neue Bedeutung angepasst und prüfen zusätzlich
das REB-Beispiel auf beiden Teamseiten sowie einen verbesserten, weiterhin
unterlegenen Pickup. Bestehende Prüfungen für Teamwechsel, Rundung, Gleichstand,
fehlende Werte und den Wechsel von rot zu grün bleiben enthalten.

Vollständiges Inline-JavaScript wird von der Frontendsuite geparst;
`node --check apps-script/Code.js` und `git diff --check` sind ebenfalls ohne
Befund. Die lokale Browserprüfung wurde mit `net::ERR_BLOCKED_BY_CLIENT`
blockiert. Keine erfolgreiche visuelle Browser- oder iPhone-Prüfung behaupten.

## Auslieferung

Vorbereiteter Build: `war-room-monster-v54.1-20260905`.
Nur Frontend, Manifest, bestehende Frontendtests und diese Dokumentation ändern
sich. Das Backend braucht keinen neuen Deploy.

Der Auftrag setzt die letzte Anzeigeänderung um; eine neue Veröffentlichung
wurde nicht angefordert. Die Korrektur wird auf `fix/matchup-loss-risk`
gesichert. Vor einem späteren Live-Auftrag den dann aktuellen Produktionsstand
abgleichen und den exakt geprüften Frontendstand verwenden.
