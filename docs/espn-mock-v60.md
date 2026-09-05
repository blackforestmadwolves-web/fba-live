# ESPN Mock Draft · v60

## Prüfung am 05.09.2026

- Die [öffentliche ESPN-Lobby](https://fantasy.espn.com/basketball/mockdraftlobby) enthält Basketball-Snake-Mocks mit acht Teams.
- Liga 2079171393 lieferte über den offiziellen Host `lm-api-reads.fantasy.espn.com`, Spiel `fba`, Saison 2027 und die Ansichten `mDraftDetail`, `mSettings`, `mTeam` eine lesbare JSON-Antwort, 8 Teams, 104 geplante Picks und CORS-Freigabe für `https://fba-control-center.netlify.app`. Der gespeicherte Test-Fall enthält nur notwendige öffentliche Metadaten, keine Eigentümerinformationen.
- Zwei als laufend markierte Räume (842793802 und 2009913349) lieferten `inProgress: true`, aber keine Picks mit positiver Spieler-ID. Auch der im offiziellen Client referenzierte `/draftDetail?view=kona_draft_detail` lieferte beim noch erreichbaren Raum keine Picks. Das beweist keine grundsätzliche Unmöglichkeit aller ESPN-API-Integrationen, reicht aber nicht als Grundlage für einen behaupteten funktionierenden Live-Pick-Import.
- Der [offizielle ESPN-Draft-Client](https://cdn1.espn.net/kona/2d26c1207d60-1.487/_next/3aebc425-bf2b-4597-b54e-7047327986b9/page/basketball/draft.js) verwendet eine separate authentifizierte WebSocket-/SSE-Verbindung. Diese wurde weder übernommen noch manipuliert. Ausgewertet wurden statische öffentliche Quelltexte, keine privaten Laufzeitobjekte.
- Derselbe Client rendert `Pick History` / `All Rounds` über `.pick-history`, `.pick-history-table`, FixedDataTable-Zeilen mit `role=row`, `.cell`, `.player-column`, `.playerinfo__playername` und Spielerporträts. Die History-Tabellen verwenden `disableHeight`, sodass pro Runde alle vorhandenen Zeilen gerendert werden. Auf dieser dokumentierten DOM-Struktur basiert die Erweiterung.

## Umsetzung

`extensions/espn-mock/` enthält eine Manifest-V3-Erweiterung für Chrome/Edge. Sie läuft im isolierten Content-Script-Kontext. Der FBA-Tab fordert etwa alle vier Sekunden genau einen passenden ESPN-Tab an. Der Service Worker prüft Ursprung, obersten Frame, Erweiterungs-ID, Basketball-Pfad, Liga und Saison. Der Leser gibt ausschließlich Liga/Saison/Team-ID, Beobachtungszeit und angezeigte Pick-Nummer, Teamname, Spielername bzw. Spieler-ID zurück. Kein Lesen von Cookies oder ESPN-Laufzeitobjekten, kein Intercept der Live-Verbindung, keine Aktionen auf ESPN und kein eigener Datendienst.

Die Implementierung folgt den offiziellen Chrome-Dokumentationen zu [Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) und [Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging). Externe Skripte werden nicht nachgeladen; es gibt keine zusätzlichen `permissions`, nur auf die beiden Hosts beschränkte Berechtigungen.

`espn-mock-core.js` prüft öffentliche Raum-Metadaten: Basketball, exakte Liga/Saison, öffentlicher Mock, 8 Teams, Snake, 13 Runden, eindeutige Teamnamen und eine vollständige unveränderte Pick-Reihenfolge ohne Keeper. Ein eingefügter URL wird sofort auf Liga/Saison/Team-ID reduziert. Mitgliedskennungen im URL werden nicht gespeichert.

Picks werden bevorzugt über ESPN-ID, andernfalls ausschließlich über eindeutig normalisierte volle Namen zugeordnet. Keine unscharfe Zuordnung, keine Ersatzstatistiken, kein Überspringen unbekannter Spieler. Die gesamte Übernahme wird abgewiesen, wenn ein Pick fehlt, ein Spieler doppelt ist oder ein Team nicht zum geprüften Snake-Slot passt. Identische doppelt gerenderte Zeilen werden dedupliziert. Abweichungen an bisherigen Picks verlangen eine ausdrückliche Bestätigung; veraltete Bestätigungen werden verworfen.

`espn-mock.js` hält den Mock getrennt vom manuellen Draft. Vor Aktivierung wird der manuelle Zustand gespeichert und in Erinnerung behalten. Der Mock verwendet `fba_espn_mock_v1`; die bisherige manuelle Speicherung bleibt erhalten. Reload startet weiterhin im manuellen Modus. Wiederverbinden stellt nur einen überprüften gespeicherten Stand derselben Liga, Saison und FBA-Zuordnung wieder her. Das eigene FBA-Team wird an den ESPN-Draftplatz gesetzt; andere FBA-Teams dienen als Platzhalter für die Gegner. Kategorie-Ränge/Coach/Sortierung verwenden anschließend dieselben bestehenden Funktionen mit den importierten Picks.

Während einer Mock-Verbindung sind manuelle Draft-/Undo-/Reset-Aktionen auch in den Handlern gesperrt. Vorschau, Teamansicht, Ziele, Punts und Sortierung funktionieren weiter. Der automatische Refresh erhält Suchfokus und Textauswahl. Pause, unlesbare Quellen und verlorene Erweiterungsantworten löschen keine Picks. Ein Status nennt den zuletzt gelesenen Verlauf; dies ist kein Nachweis, dass die ESPN-Seite selbst noch verbunden ist. Der Nutzer muss ESPN verbunden halten.

Die App wird weiterhin als statische Netlify-ZIP ausgeliefert. Keine Backendänderung, keine Produktionsbereitstellung. Die Browser-Erweiterung wird separat entpackt installiert; sie ist nicht Teil des Website-Uploads. Safari, iPhone-App, private echte Ligen, Salary-Cap-Mocks und andere Ligagrößen sind nicht Bestandteil dieser Testversion.

## Validierung und Grenze

**108 Tests erfolgreich**, keine übersprungenen Tests. `npm ci --ignore-scripts` und `npm test` führen alle bisherigen Tests sowie neue Tests für Parser, Protokoll, Quellenprüfung, 104-Pick-Zuordnung, persistierte Zustände, isolierte manuelle Speicherung, Sperren, Pause, veraltete Antworten und Korrekturen aus. LinkeDOM ist ausschließlich eine Testabhängigkeit; es gibt keine neue Laufzeitabhängigkeit der Website oder Erweiterung.

Die DOM-Testfälle wurden aus dem tatsächlich gelesenen offiziellen Client rekonstruiert. Sie sind keine gespeicherten echten Draft-Ergebnisse. Ein angemeldeter ESPN-Draft wurde in dieser Sitzung nicht durchgespielt. Auch die visuelle lokale Browser-Abnahme ist weiterhin durch die zuvor festgestellte Browser-URL-Richtlinie blockiert. Daher ausdrücklich **Testversion mit ausstehendem praktischem Live-Mock-Test**, nicht als produktiv erprobte ESPN-Verbindung ausgeben.

## Pakete

- `FBA-v60-Netlify-Upload.zip`: vollständiger öffentlicher Website-Stand, Index direkt im ZIP-Hauptverzeichnis. Tests, Node-Abhängigkeiten, Backend, Entwicklerdateien und Erweiterung sind ausgeschlossen.
- `FBA-ESPN-Mock-Bridge.zip`: exakt der Inhalt von `extensions/espn-mock/`, einschließlich Installationsanleitung; `manifest.json` liegt direkt im Hauptverzeichnis.
- Beide Archive werden aus demselben Git-Commit gebaut; Mitglieder, Bytes, lokale Asset-Referenzen und ZIP-CRC werden geprüft.
