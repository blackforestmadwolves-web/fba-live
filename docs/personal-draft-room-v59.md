# Persönlicher Draft War Room · v59

Der War Room behielt bislang das gerade pickende Team als Grundlage seiner Best-Fit-Hinweise. Der Nutzer möchte sein eigenes Team dauerhaft auswählen, acht Kategorie-Ränge direkt sehen und während des Drafts zwischen Zielen wechseln. Die Spielerkarten waren zudem zu eng, mit kleinen Fotos und Schmucklinien durch die Inhalte.

## Ergebnis

- Persönliche Team-Auswahl oberhalb von Spielerpool und Board, standardmäßig BlackForest Mad Wolves. Die Auswahl bleibt erhalten, während andere Teams picken.
- Ziele: Ausgeglichen draften, Punt-Build, Stärken ausbauen. Sie lassen sich jederzeit wechseln und werden lokal mit dem Draft gespeichert. Bestehende Punt/Hunt-Sitzungen werden übernommen. Zielwechsel löscht die aktiven Punt/Hunt-Auswahlen; diese können beim nächsten Wechsel erneut gewählt werden.
- Acht kompakte Kategorie-Kacheln mit Liga-Rang, farblicher Einordnung und Punt-Status. Keine addierten Teamwerte unter den Rangzahlen, ausdrücklich auf Nutzerwunsch. Die Rangzahlen stammen unmittelbar aus der vorhandenen Live-Standings-Funktion.
- Hinweise zu Lücken oder Stärken sowie bis zu drei verfügbare Spieler zum gewählten Ziel. Der bestehende erweiterte Punt-/Hunt-Fokus bleibt einklappbar zugänglich.
- Spielervorschau für das ausgewählte eigene Team: Kategorie-Ränge vor/nach einem hypothetischen zusätzlichen Pick sowie Profilrichtung je Kaderplatz. Eine Vorschau verändert keine Picks. Ein tatsächlicher Pick geht weiterhin an das gemäß Snake-Board nächste Team; die Schaltfläche der Vorschau nennt dieses ausdrücklich.
- Spielerpool: große Porträts, lesbare Namen und Positionen, eigene Zeile für FBA-Value/ADP/Merge, sechs Statistikwerte, bisherige Stärken-/Schwächen-Badges, Modell-Rang und Saison-/GP-Basis. Separate Schaltflächen für Vorschau und Draft verhindern versehentliche Picks beim Prüfen.
- Auch die Board-Porträts sind größer. Orange Schmucklinien an Spielerkarten, Board-Spielern und Uhr wurden entfernt. Die echte Fortschrittsanzeige bleibt bestehen.
- ADP/FBA/Merge-Sortierung, feste FBA-Referenz, Top-150-Berichte, Vorbereitungspunts und andere App-Seiten bleiben erhalten.

## Rechenbasis und Grenzen

`draft-coach.js` arbeitet ohne Netzabrufe und ohne Mutation von Spielerpool oder Picks. Es nutzt vollständige Werte des bestehenden War-Room-Datensatzes, einschließlich dessen Kennzeichnung `projectionReady`:

1. Zählwerte werden wie in den Live-Standings mit ausdrücklich hinterlegten `projectedGp` multipliziert; andernfalls gilt das bestehende 72-GP-Testmodell auf Basis 2025/26. FG%/FT% werden aus aufsummierten Treffern und Versuchen berechnet.
2. Die sichtbaren Ränge sind die vorhandenen Live-Standings-Ränge. Gleiche Werte erhalten denselben Rang, ungepickte Teams keine künstlichen Nullen.
3. Für die Beratung werden Zählwerte zusätzlich durch besetzte Kaderplätze geteilt. So führt eine unterschiedliche Pickzahl nicht allein zu Handlungsdruck. Quoten bleiben volumenbereinigt.
4. Ausgeglichen/Punt priorisieren Rückstände zum Median der bereits beteiligten Teams; ausgewählte Punts sind aus der Beratung ausgeschlossen. Stärken ausbauen gewichtet die drei stärksten aktiven Bereiche stärker; ein expliziter Hunt fokussiert die gewählte Kategorie.
5. Spielerkandidaten werden nach normalisierten Profilverbesserungen und erreichbaren Rangänderungen je Kaderplatz bewertet. Verschlechterungen zählen mit. Streuung des Spielerpools begrenzt die Übergewichtung sehr kleiner Liga-Abstände; Ausreißer werden in der Gewichtung gedeckelt.
6. Für die drei Vorschläge werden zunächst verfügbare Spieler mit ADP bis 24 Plätze hinter dem nächsten eigenen Pick berücksichtigt. Ohne bewertbare Kandidaten in diesem Bereich wird der Pool erweitert. Jeder noch verfügbare Spieler mit vollständiger Basis kann separat zur Vorschau ausgewählt werden. ADP ist keine Zusage späterer Verfügbarkeit.
7. Fehlende Statistik bei gedrafteten Spielern blockiert Coach-Ränge und Empfehlungen mit einer konkreten Meldung. Ein leerer Kader, erst ein beteiligtes Team und ein voller Kader erhalten eigene Zustände.

Die Beratung ist eine offengelegte Modellheuristik, keine neue ESPN-Projektion und keine Wochenprognose. Die Vorschau addiert einen hypothetischen eigenen Pick; deshalb können aktuelle Summenränge steigen, obwohl die mittlere Leistung pro Kaderplatz sinkt. Beide Betrachtungen sind im Vorschaufeld beschriftet. FBA-Value, ADP und Merge werden dafür nicht verändert.

## Validierung

`node --test tests/*.test.mjs`: 97 Tests erfolgreich. Zusätzliche Tests decken ab: realer 500er-Spielerpool und 452 verfügbare Karten nach 48 Picks, identische Live-Standings-Ränge, fehlende absolute Kachelwerte, Auswahl/Speicherung/Migration, unveränderte Snake-Zuordnung, rein hypothetische Vorschau, Pick/Rücknahme, Mehrfach-Punts, unterschiedliche Pickzahlen, Quotenvolumen, fehlende Daten, leere/volle Kader und ADP-Auswahlbereich.

Die lokale visuelle Browser-Abnahme wurde durch die URL-Sicherheitsrichtlinie des Cloud-Browsers blockiert. Produktionsmarkup und CSS wurden als lokale Prüfansicht erzeugt; es wird keine bestandene visuelle Browser-Abnahme behauptet. Die Funktionstests verwenden die realen App-Module und den vorhandenen Spielerpool.

Auslieferung: vollständige Netlify-Upload-ZIP mit allen öffentlichen Dateien. Produktion wird durch den Nutzer hochgeladen. Source-Snapshot als separater Draft-PR auf v58; keine automatische Produktionsbereitstellung.
