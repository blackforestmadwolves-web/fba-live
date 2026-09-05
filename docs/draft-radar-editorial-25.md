# Draft Radar — 25 ausführliche Einordnungen

Vorbereitet am 05.09.2026 auf Main `153ca1bdb7930825a243f99b9eae8884422fd9d6`.
Produktionsrelease v45 am 05.09.2026 vom Nutzer beauftragt.
Frontend-Buildkennung: `war-room-monster-v45-20260905`.
Backend bleibt Apps Script Version 38, interner Engine-Vertrag v36.

Alle 25 Spieler des öffentlichen ESPN-ADP-Radars vom 05.09.2026 sind abgedeckt.
Jeder erhält einen eigenen Bericht, Ausblick auf 2026/27, Stärken, Risiken,
FBA-Fit und Draft-Plan (insgesamt 136–152 Wörter ohne Kurzbeschreibung).
Der bisherige zusätzliche Eintrag für Jalen Johnson bleibt erhalten und ist
weiter als ältere, nicht live aktualisierte redaktionelle Einordnung gekennzeichnet.

Die 25 neuen Einträge verlinken jeweils das geprüfte ESPN-Spielerprofil und tragen
den Prüfstand 05.09.2026. Numerische Angaben sind ausdrücklich Regular-Season-Werte
2025/26, keine neuen Projektionen. ESPN-Spielerprofile/Statistikseiten wurden per
Webrecherche geprüft; die Werte wurden zusätzlich mit dem am selben Tag bereits
abgerufenen öffentlichen ESPN-Hub abgeglichen (`seasonId:2026`, `statSourceId:0`,
`statSplitTypeId:0`, per-game `averageStats`). Keine Projektionszeilen oder Playoffs
wurden als vergangene Regular-Season-Leistung verwendet.

Ausblick, FBA-Fit und Ergänzungsvorschläge sind eigene qualitative Einordnungen,
keine berechneten Ränge und keine nachträglich behaupteten Expertenkonsenswerte.
Besonders kurze Vorjahresstichproben werden bei Tatum, Davis, Sabonis und Young
ausdrücklich erklärt. Neue Rollen werden als offene Entwicklung behandelt.

Änderungen betreffen ausschließlich `index.html` und diese Dokumentation.
ADP-Sortierung, Datumsparser, Positionsdaten, Trends, Projektion und Backend bleiben
unverändert. Native Details-Karten bleiben erhalten; die Quellen stehen je Karte.

Prüfung: bestehende Frontend-Regression inklusive vollständigem Inline-JS-Parsing,
Whitespace-Check und Abgleich aller 25 ESPN-IDs auf vollständige Inhaltsfelder sowie
HTTPS-Quellenlinks bestanden. Keine neuen Inhalts- oder DOM-Spiegeltests angelegt.
Die veröffentlichte Ansicht wurde im Live-Desktop-Browser geprüft; siehe unten.
Die zuvor abgewiesenen lokalen Browser-Preview-Routen wurden nicht erneut verwendet.


## Produktionsprüfung v45 — 05.09.2026

- Release-Commit: `85936609000200370d0a3aa7beb018de1e52f183`.
- Getesteter und veröffentlichter Git-Tree: `ff8d0db364671791824609d8e3675e62d8e28456`.
- Netlify: `6a9be182a32710330c041712`, production, ready, veröffentlicht 09:31:51 UTC.
- Live-HTML bytegleich zum Release: 605531 Bytes, SHA-256
  `490967f23a00eddc1f875394359c6c0db283c0b864ddbb4eca29cb399fd0973d`.
- Alle sieben Testdateien, Backend-Syntax, vollständiges Inline-JS und Whitespace geprüft.
- Live-Browser: Build v45, 25 Spieler, 25 vollständige redaktionelle Analysen,
  jeweils Ausblick, Draft-Plan und eigener ESPN-Quellenlink.
- Jede der 25 Karten erfolgreich geöffnet und geschlossen.
- Alle 25 Berichtbereiche ohne horizontalen Textüberlauf; mindestens 10 px
  zwischen Kurztext und Analyse-Hinweis, mindestens 15 px bis zur unteren Linie.
- Desktop-Screenshots: LeBron-Karte, langer Bericht, Fakten und Quellenzeile visuell
  geprüft. Keine separate iPhone-/Mobilgeräteprüfung durchgeführt.
- Fotoeffekte erzeugen geringfügigen, durch overflow:hidden abgeschnittenen
  dekorativen Überstand; die Berichtbereiche passen vollständig in ihre Karten.
- Backend unverändert gegenüber v44: kein neuer Apps-Script-Deploy erforderlich.
- Diese nachfolgende Dokumentation ändert den Frontend-Release nicht.
