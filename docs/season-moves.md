# Saison verbessern: Roto und Wochen-Matchups

Maiks Produktwunsch, 11.09.2026: Nach einem vollständigen Testdraft bzw. mit dem aktuellen ESPN-Kader soll Monster selbst sinnvolle Moves vorschlagen. Als Vorbild dient der beschriebene Basketball-Monster-Vergleich: Saisonprojektionen einschließlich individueller projected GP gegen alle Ligateams auswerten. Ein Vorteil im Roto-Modell ist nicht zwangsläufig ein Vorteil im echten Wochen-Spielplan. Beide Ergebnisse sollen erkennbar bleiben.

## Eingebauter Entwurf

Unter den Conference-Tabellen steht „Saison verbessern“. „Moves finden“ prüft für das ausgewählte Team alle 13 möglichen Drops gegen jeden nicht vergebenen Spieler im geladenen Draft-Pool mit vollständiger Projektion. Es gibt keine Vorauswahl nach Gesamtrang oder einer einzelnen Stärke. Der Pool ist der vorhandene App-Pool; die Suche behauptet keine Abdeckung aller NBA-Spieler. Alle acht Kader müssen vollständig sein. Im Testdraft bestimmen dessen Picks die Eigentümer, sonst die geladenen ESPN-Kader.

Jeder Einzeltausch durchläuft den bestehenden vollständigen `monsterSeasonProjectionCalculate`-Rechner. Gesucht werden ausschließlich alternative 1:1-Pickups, keine Trade-Pakete, Kombinationen mehrerer Moves oder laufende Streaming-Strategien. Jeder Vorschlag startet mit demselben Ausgangskader, unabhängig vom manuell ausgewählten Pickup-Lab-Szenario. Kein Move ändert Picks, ESPN-Kader oder sendet eine Transaktion.

Zwei Sortierungen zeigen jeweils bis zu drei positive Optionen:

- **Saisonpunkte:** zusätzliche gewonnene FBA-Punkte in W1–18, bei Gleichstand Roto-Veränderung.
- **Roto-Wertung:** Veränderung der Roto-Punkte, bei Gleichstand zusätzliche Saisonpunkte.

Pro Free Agent erscheint der beste Drop für die jeweilige Sortierung. Unterschiedliche Drops für denselben Add werden nicht als drei unterschiedliche Top-Optionen dargestellt. Keine Verbesserung im gewählten Maßstab ergibt einen ehrlichen Leerzustand. Ausgelassene Projektionen und geprüfte Spieler/Moves werden gezählt. Ein ungültiges Szenario bricht die Suche mit einer sichtbaren Fehlermeldung ab; eine unvollständige Suche liefert keine scheinbar fertige Bestenliste.

## Berechnungsgrundlage

Die vorhandene Engine verteilt `max(projectedGp − actualGp, 0)` auf die bekannten verbleibenden NBA-Termine, höchstens einen erwarteten Einsatz pro Termin. Gegnerprofile gewichten den Tageswert gemäß bestehender Normalisierung. Für die Suche wird kein zweites GP-Modell erfunden. Ohne aktive vollständige Projektionsbasis inklusive individueller GP bleibt sie im Wartemodus; die Vorsaison-Ersatzrechnung mit voller Verfügbarkeit darf keine Move-Empfehlungen erzeugen.

Beide Vergleiche beziehen sich ausdrücklich auf **FBA W1–18**, nicht auf die gesamte NBA-Saison. Roto summiert die projizierten Wochenwerte der acht Teams. FG% und FT% entstehen aus summierten Treffern und Versuchen. Je Wert erhält das beste Team acht, das schlechteste einen Roto-Punkt; Gleichstände teilen die betroffenen Plätze. Acht Werte ergeben maximal 64 Roto-Punkte. Die Detailansicht zeigt zur Einordnung auch die vollständigen NBA-Saison-GP der beiden Spieler, die zeitlich in den FBA-Zeitraum verteilt werden.

Die Wochenrechnung verwendet weiterhin den echten FBA-Spielplan und Heimvorteil bei exakt gleichen Punktwerten. Abgeschlossene FBA-Ergebnisse bleiben fixiert. Während einer laufenden Saison gilt ausschließlich die bestätigte aktuelle Woche, nicht eine im Wochen-Browser ausgewählte Zukunftswoche. Früher erzielte Werte verbleiben beim Besitzer zum Spielzeitpunkt; die Punkte eines Free Agents aus früheren Spielen werden nicht importiert. Vor Saisonstart gilt W1. Fehlt die aktuelle Woche oder liegt sie außerhalb W1–18, gibt es keine neuen Saison-Moves.

Karten zeigen vorher/nachher für Saisonpunkte und Roto, die WIN%-Veränderung in Prozentpunkten und die geänderten Wochen. Positive Roto-Wertung bei unveränderten oder schlechteren Saisonpunkten wird ausdrücklich so beschrieben.

## Annahmen und Rechenzeit

Die bestehende Saisonrechnung zählt alle 13 Kaderspieler. Eine tägliche Aufstellungsoptimierung mit Positions-/Slotgrenzen ist nicht implementiert. Waiver-Wartefristen, Nicht-abgebbar-Listen, Transaktionslimits und zukünftige Verfügbarkeit sind nicht modelliert. Deshalb sind die Ergebnisse hypothetische Kadervergleiche für den geladenen Stand, keine ausführbaren Transaktionsanweisungen und keine garantierten Saisonergebnisse.

Die Suche läuft auf Anforderung mit Fortschrittsanzeige und Abbruch. Ein unveränderlicher Input-Snapshot ermöglicht die Wiederverwendung einzelner Spieler-Wochen-Projektionen; der vollständige Saisonrechner bleibt für jeden Kandidaten maßgeblich. Der Cache gehört ausschließlich diesem Suchlauf und wird bei anderen Engine-/Spielplanobjekten zurückgesetzt. Team-, Daten-, Draft- oder Basisszenarioänderungen machen laufende bzw. fertige Suchergebnisse ungültig. Regelmäßiges Yielding hält während größerer Suchen die Abbruchmöglichkeit offen.

## Prüfung und Veröffentlichung

Numerische Tests prüfen GP-Gewichtung, volumenrichtige Quoten, Roto-Gleichstände, vollständige Enumeration, identische Ergebnisse mit/ohne Suchcache, unveränderte Eingaben, unterschiedliche Roto-/Wochenwirkung, historische Eigentümer, fixierte Wochen, Abbruch und fehlende Daten. Die bisherigen Season-Simulation-, Projection-Engine-, Frontend- und Startseitenprüfungen werden ebenfalls ausgeführt. Kein visueller Browser-/iPhone-Test und kein Lauf mit dem privaten Live-Kader.

Nur als Code-Entwurf auf dem bestehenden Feature-Branch gespeichert. Nicht produktiv veröffentlicht.
