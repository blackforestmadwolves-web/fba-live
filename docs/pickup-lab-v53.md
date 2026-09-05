# Pickup Lab · v53

## Auftrag und Oberfläche

Pickup Impact Lab heißt jetzt **Pickup Lab**. Der B2B Radar liegt im selben
Bereich direkt unter dem Drop-/Add-Vergleich. Eine gemeinsame Mehrfachauswahl
gilt für beide Suchwege. GESAMT oder das Abwählen des letzten Punkts aktiviert
das gesamte Profil. Die aktuelle Gewichtung steht unter den Schaltern;
Keyboard-Fokus kehrt nach einer Auswahl auf denselben Schalter zurück.

„Im Lab testen“ übernimmt einen tatsächlich noch freien, für die gewählte
Woche auswertbaren B2B-Spieler in den Vergleich. Der Drop bleibt erhalten.
Auch ein Treffer außerhalb der ersten 120 Wochenvorschläge bleibt im Auswahlfeld
sichtbar und kann simuliert werden. Ein Fokuswechsel sortiert neu, erhält aber
Drop und Add. Reset löscht nur das Szenario. Es werden keine ESPN-Transaktionen
ausgeführt.

## Bewertung

Die Wochen-Suche verwendet jetzt wie B2B den Durchschnitt der ausgewählten
z-Werte. Zwei Punkte zählen je 50 %, vier je 25 %. Nicht ausgewählte z-Werte
gehen nicht in die Rechnung ein. Bei gleichem Ergebnis entscheidet nur die
stabile Spieler-ID, kein Gesamtwert aus den übrigen Punkten.

`Such-Value = (Summe der ausgewählten z-Werte / Anzahl) × erwartete offene Einsätze`

Beide Wege verwenden weiterhin den vorhandenen `draftValueModel`-Maßstab des
Radars, einschließlich über Treffer und Versuche bewerteter Quoten. Es wird
kein neuer Vergleichspool passend zur aktuellen Filterung gebildet. Die acht
individuellen Gewichte und die feste 104er-Referenz des **FBA-Value** bleiben
unverändert. Dieses vollständige, gewichtete Profil ist als eigenes Badge
weiter sichtbar; es bestimmt die gezielte Suchsortierung nicht.

In der aktiven Engine werden nur `futureTotals / remainingGames` normalisiert
und anschließend mit `remainingGames` multipliziert. Bereits gespielte Partien
verbessern den Suchwert weder beim Drop noch beim Add. Das eigentliche
Vorher-/Nachher-Szenario erhält die bisherigen Ist-Ergebnisse und tauscht wie
bisher ausschließlich zukünftige Beiträge aus. Die Zusammenfassung nennt die
gewählten Punkte einzeln; die Matchup-Anzeige zeigt weiterhin alle acht Effekte.

B2B verwendet nur die offenen Termine seines Tagespaars; Wochen-Pickups nur
die ausgewählte FBA-Woche. Bei Sonntag/Montag ist der Übertrag sichtbar erklärt.
Ein Spieler ohne auswertbaren Wochenrest kann im Radar erscheinen, erhält aber
keine Übernahmeaktion. Unvollständige Daten, fehlende Profile, kein Einsatz und
ein laufendes NBA-Spiel dürfen keine scheinbaren Nullwerte oder Empfehlungen
erzeugen. Negative, vollständig berechnete Suchwerte bleiben gültig.

## Prüfung und Auslieferung

Sieben neue Verhaltenstests prüfen die Mittelwerte für 1/2/3/4 Punkte, das
Ignorieren anderer Werte, Rangwechsel, gemeinsame Auswahl, Quotenvolumen,
Eigentümerfilter, unvollständige Engine-Daten, fehlende Einsätze, negative Werte,
den Ausschluss bereits gespielter Werte und die Übernahme auch jenseits Platz 120.
Bestehende Tests wurden an die zusammengeführte Auswahl angepasst.

Gesamter v53-Testlauf: **66 Runner-Tests in 16 Testdateien**, alle bestanden.
Vollständiges Inline-JavaScript wird geparst und alle lokalen Produktionsassets
werden geprüft. Die neue Browseransicht konnte nicht visuell geprüft werden:
die Cloud-Browser-URL-Richtlinie blockiert die lokale Vorschau; keine Umgehung.

Gemeinsames v53-Frontend-ZIP mit Draft Top 100 und FBA-Value-Beschriftung.
Neue Abhängigkeiten `pickup-lab.js` und `pickup-lab.css` müssen mit ausgeliefert
werden. Kein Backend-Deploy, kein Main-Push und kein Produktionsdeploy.
