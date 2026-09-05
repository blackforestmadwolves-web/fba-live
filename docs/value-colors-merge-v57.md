# FBA-Value-Farben und Merge Value · v57

Basis: v56 mit 150 Berichten und 43 Quellenereignissen. Build:
`war-room-monster-v57-20260905`.

Der FBA-Value verwendet überall dieselbe feste Farbskala: sichtbare Null neutral,
positive Werte zunehmend grün, negative zunehmend rot. Die Stärke folgt dem
Betrag und hängt nicht von Suche, Team oder gerade sichtbarer Auswahl ab.
Fehlende Werte bleiben grau und werden nicht zu Null umgedeutet. Vorzeichen,
Zahl und Saisonbasis bleiben lesbar. Gefärbt werden Karten, historische und
projizierte Tabellensummen, Inlinewerte in Spielplanhinweisen und
Pickup-/Szenarioübersichten sowie die nativen Auswahltexte. Betriebssystemeigene
Auswahlfenster können Optionsfarben überschreiben; die regulären Karten und
Szenarioanzeigen verwenden direkt die gemeinsame Farbe.

In der Draft-Vorbereitung gibt es zusätzlich die Sortierung **Merge Value**:

`Merge Value = (ADP-Rang + FBA-Value-Rang) / 2`

- ADP aufsteigend, FBA-Value absteigend; beide Ränge aus der vollständigen
  aktuellen Top-150-Auswahl vor der Namenssuche.
- 50/50-Gewichtung. Niedrigerer Merge Value steht weiter vorne.
- Gleiche ungerundete Ausgangswerte erhalten den Mittelwert der belegten
  Rangplätze: beispielsweise 1, 2,5, 2,5, 4.
- Fehlende ADPs oder FBA-Werte bekommen keinen entsprechenden Rang und keinen
  Merge Value. Sie stehen bei Merge-Sortierung am Ende. Fehlende FBA-Werte
  werden weder imputiert noch allein aus ADP bewertet.
- Bei gleichem Merge Value entscheidet der niedrigere echte ADP, dann die
  bestehende deterministische Identitätsreihenfolge.
- Die Karten zeigen den Merge Value zusätzlich. Im aufgeklappten Bericht steht
  die konkrete Rechnung. Eine Erklärung oberhalb der Liste nennt Formel,
  Gleichstände, fehlende Werte und die verwendete Saisonbasis.
- Die Anzeige verwendet denselben primären FBA-Value wie die bestehende
  FBA-Sortierung, einschließlich ihrer expliziten historischen oder aktuellen
  Saisonbasis. Die zugrunde liegende feste 104-Spieler-Referenz bleibt gleich.

76 Tests erfolgreich. Neu geprüft: 50/50-Rangmittel, echte Null versus fehlender
Wert, negative Werte, Mittelränge bei Gleichstand, Sortierungsstabilität,
unveränderte Ränge bei Suche, gemeinsame stetige Farbskala und konsistente Farben
in Karten, Tabellen und Inlineanzeigen. Bestehende Prüfungen für 150 Berichte,
Quellenstatus, Spielerbilder, offene Artikel und historische Wertberechnung
bleiben erfolgreich. `git diff --check` sauber.

Keine neue visuelle Browser-Abnahme: Die lokale Browser-Vorschau war in dieser
Umgebung zuvor blockiert. Kartenmarkup und Such-/Sortierinteraktion sind über
die vorhandenen Rendering-Harnesses geprüft. Zusätzlicher Merge-Wert nutzt den
freien Platz unter dem Listenrang; die bestehende rechte ADP/FBA-Anzeige bleibt.

Statisches Upload-Paket für den manuellen Upload durch Maik. Kein automatischer
Produktionsdeploy und keine Änderung der bestehenden News-Automation.
