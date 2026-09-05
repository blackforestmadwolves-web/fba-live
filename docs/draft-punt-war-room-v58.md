# Draft-Vorbereitung und War Room · v58

Die Vorbereitung kann jetzt mehrere Punt-Kategorien markieren. Der War Room bietet ADP-, FBA-Value- und Merge-Sortierung neben seinem bestehenden Strategie-Modus.

## Punt-Builds in der Vorbereitung

- Acht auswählbare Kategorien: PTS, REB, AST, 3PM, STL, BLK, FG%, FT%. Mindestens eine bleibt aktiv.
- Grundlage ist das vollständige Kategorieprofil des angezeigten FBA-Values, einschließlich dessen Saisonbasis und bestehender FBA-Gewichte. Das Referenzfeld bleibt unverändert.
- Positive Stärke pro Kategorie = max(0, Gewicht × z). Liegen mindestens 50 % der Summe dieser positiven Stärken in den ausgewählten Punt-Kategorien, erhält die Karte eine graue Darstellung und „Passt nicht gut zum …-Punt-Build“.
- Die Analyse nennt den entfallenden Anteil und bis zu drei verbleibende Stärken. Die Schwelle ist eine offengelegte Orientierung, keine neue Prognose oder automatische Draft-Empfehlung. Das Punten einer negativen Kategorie allein markiert keinen Spieler. Ein ausschließlich negatives Profil hat keine positiven Stärken zu verlieren.
- Ohne vollständiges Profil bleibt die Karte neutral und zeigt „Punt-Fit offen“.
- Namen, Bilder, FBA-Farben und aufklappbare Berichte bleiben erhalten. ADP, FBA-Value, Merge Value und Reihenfolge ändern sich durch die Auswahl nicht.
- Die Auswahl bleibt in diesem Browser-Tab gespeichert und ist unabhängig von den War-Room-Punts. Suche, gewählte Sortierung, Fokus und geöffneter Bericht bleiben bei Änderungen erhalten.

## Sortierung im War Room

- ADP aufsteigend verwendet den tatsächlichen ADP des bestehenden War-Room-Datensatzes, nicht das separate ESPN-Ranking-Feld.
- FBA-Value absteigend verwendet denselben angezeigten Wert samt Saisonbasis wie andere App-Bereiche.
- Merge Value aufsteigend = (ADP-Rang + FBA-Value-Rang) / 2. Ränge werden vor Suchfiltern und ausgeblendeten Picks über den vollständigen War-Room-Pool berechnet. Gleiche Rohwerte erhalten den Mittelwert ihrer belegten Ränge. Bei gleichem Merge entscheidet ADP; fehlende Werte bleiben offen und stehen am Ende.
- Der bestehende War-Room-Pool umfasst 500 Spieler, die Vorbereitung die aktuellen ESPN-Top-150. Ihre Rangmittelwerte können deshalb abweichen. Diese unterschiedliche Basis steht in der Oberfläche; es werden keine fehlenden ADPs oder Projektionen ergänzt.
- Das Aktivieren eines War-Room-Punts oder Hunts wählt die bisherige Strategie-Sortierung. Anschließend kann jede andere Sortierung ausdrücklich gewählt werden, ohne die Strategie oder Picks zu löschen.
- Der alte gleichgewichtete Rang heißt jetzt „Modell #“, damit er nicht mit dem gewichteten FBA-Value-Rang verwechselt wird.
- Die War-Room-Sortierung wird mit dem bestehenden lokalen Draft-Zustand gespeichert. Alte gespeicherte Punt/Hunt-Sitzungen behalten bei der Migration die Strategie-Sortierung; ein Reset stellt ADP wieder her.

## Prüfung und Auslieferung

`node --test tests/*.test.mjs`: 88 Tests erfolgreich. Enthalten sind reale Top-150-Profile, Mehrfach-Punts, fehlende Daten, unveränderte FBA-Werte und Berichte, offene Karten/Fokus, ADP versus ESPN-Rang, stabile Merge-Ränge nach Suche und Picks, Strategie-Wechsel und Speicherung/Migration. Die bestehende 104-Spieler-Referenz und bisherigen App-Regressionstests bestehen weiter.

Keine visuelle Browser-Abnahme dieser Version: Der lokale Preview-Zugang war in dieser Umgebung blockiert. Die HTML-Erzeugung und Interaktionen wurden im Frontend-Testkontext geprüft. Die ZIP enthält die vollständigen öffentlichen Dateien einschließlich des neuen Punt-Moduls; ihre lokalen HTML- und Manifest-Abhängigkeiten und Archiv-Prüfsummen werden vor Auslieferung kontrolliert. Produktion wird durch den Nutzer hochgeladen.
