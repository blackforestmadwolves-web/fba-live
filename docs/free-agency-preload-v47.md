# Free Agency beim App-Start vorladen — v47 vorbereitet

Basis: Main `7e02454cd4d91738347ab6cc280a791fcbc46ddf`, veröffentlichte v46.
Vorbereiteter Frontend-Build: `war-room-monster-v47-20260905`.
Diese Änderung ist noch nicht produktiv veröffentlicht.

## Verhalten

Nach dem synchronen Aufbau der ersten Ansicht startet die App im nächsten
JavaScript-Task das Vorladen der Free-Agent-Daten. Der öffentliche Abruf muss
dafür nicht erst abgeschlossen sein. Voraussetzungen sind ein bereits
freigeschaltetes Gerät und eine konfigurierte Datenquelle.

Free Agency und Monster verwenden denselben geschützten Datensatz. Deshalb
nutzt die Vorbereitung den bestehenden `loadMonsterData`-Ladeweg samt
Authentifizierung, Wochenzuordnung und Schutz vor doppelten Anfragen. Der
Datensatz bleibt im Arbeitsspeicher der geöffneten App; der öffentliche
v46-Startcache wird nicht um private Inhalte erweitert.

Ein späterer Wechsel zu Free Agency kann den bereits geladenen Datensatz
verwenden. Erfolgt der Wechsel während des Abrufs, läuft dieser weiter;
für dieselbe Woche beginnt kein zweiter Abruf. Monster profitiert ebenfalls
von den bereits geladenen Daten. Ein notwendiger Wechsel zur aktuellen
FBA-Woche kann wie bisher einen eigenen Folgeabruf auslösen.

Der Hintergrundabruf öffnet keine Seite, baut die Startseite nicht neu auf
und startet keinen vollständigen ESPN-Sync. Eine bestehende Reset-Markierung
wird beim tatsächlichen Ladebeginn berücksichtigt. Ohne gültige Freischaltung
erscheint beim App-Start kein unerwarteter PIN-Dialog. Die bewusste private
Navigation behält ihren bisherigen Zugangs-Dialog.

Bei einem Netzfehler bleibt die Startseite nutzbar. Ein späterer Aufruf der
Free-Agent-Seite kann den regulären Ladeversuch erneut starten. Sofortiges
Wechseln nach dem Öffnen kann weiterhin eine Ladeanzeige zeigen, solange der
Hintergrundabruf noch nicht fertig ist. Daten, Berechnung und Spielerfotos
werden nicht künstlich als schon verfügbar dargestellt.

## Geprüft

Die bestehenden Frontend-Regressionen wurden um Verhaltenstests mit den
wirklichen Start-, Navigations- und Loader-Funktionen und kontrollierten
Schnittstellen ergänzt:

- Private Anfrage startet trotz noch offener öffentlicher Anfrage.
- Startseite bleibt beim Abschluss unverändert; kein automatischer Seitenwechsel.
- Früher und späterer Wechsel zu Free Agency erzeugt keinen doppelten Abruf.
- Kein Abruf ohne Zugang/Quelle oder bei bereits laufendem/fertigem Abruf.
- Abgelaufener Zugang wird entfernt, ohne einen PIN-Dialog auf der Startseite.
- Netzfehler und anschließender neuer Versuch funktionieren.
- Reset-Markierung bleibt bei übersprungenem Vorladen erhalten und wird beim
  tatsächlichen Vorladen berücksichtigt; kein zusätzlicher Vollsync.

Alle acht Testdateien, vollständiges Inline-JavaScript und Whitespace geprüft.
Die privaten Prüfungen sind Node-Verhaltenstests, keine neue produktive
Browserprüfung eines freigeschalteten Geräts. Keine private Sperre umgangen,
kein iPhone-Test und keine neue Geschwindigkeitszahl für Free Agency behauptet.

## Veröffentlichung

Frontend/Manifest und die zugehörigen Tests/Dokumentation ändern sich.
Das Backend bleibt Apps Script Version 39, öffentliche Payload-Version 46,
interner Projektionsvertrag v36. Bei späterer Veröffentlichung Main abgleichen,
den getesteten Tree veröffentlichen und Netlify bis ready prüfen; ein erneuter
Apps-Script-Deploy ist für diesen unveränderten Backendstand nicht nötig.
