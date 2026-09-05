# Free Agency beim App-Start vorladen — v47

Basis: Main `7e02454cd4d91738347ab6cc280a791fcbc46ddf`, veröffentlichte v46.
Frontend-Build: `war-room-monster-v47-20260905`.
Am 05.09.2026 auf ausdrücklichen Nutzerauftrag „Geh live“ veröffentlicht.
Die Produktionsbestätigung steht am Ende.

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


## Produktionsbestätigung — 05.09.2026

- Release/Main-Commit: `f6f80538e2211e411205e58e591d17bd13795e27`.
- Exakt geprüfter Tree: `97a73d42a7f7cc3b8d326b570471d6243f25dc89`.
- Netlify-Produktionsdeploy: `6a9bf19655b3f5022b485d31`, ready.
- Veröffentlicht um 10:40:28 UTC auf https://fba-control-center.netlify.app/.
- Upload aus einem Archiv ausschließlich der 56 versionierten Projektdateien.
- Live-HTML bytegleich mit dem getesteten Release: 609807 Bytes, SHA-256
  `75ffbbc239e2a7f1a964ea425d9c89152f88a2aade05cf74e5013cf3cc40f55c`.
- Live-Manifest ebenfalls bytegleich; Start-URL verweist auf v47.
- Alle acht Testdateien / 15 Runner-Tests am exakten Release-Stand bestanden;
  vollständiges Inline-JavaScript, Backend-Syntax und Whitespace geprüft.
- `apps-script/Code.js` ist gegenüber v46 unverändert. Kein neuer Backend-
  Workflow oder Apps-Script-Deploy nötig; letzter bestätigter Stand Version 39.

Live-Browser: Build v47, 25 gespeicherte Karten bei der ersten Kontrolle nach
1015 ms; währenddessen SYNC… und klar gekennzeichneter gespeicherter Abruf.
Kein unerwarteter PIN-Dialog auf dem nicht freigeschalteten Browsergerät.
Die Fehlerkontrolle zeigte keine Anwendungs-JavaScript-Fehler. Eine spätere
Kontrolle bestätigte LIVE und weiterhin 25 Karten nach der Aktualisierung.

Der authentifizierte Hintergrundabruf, Wiederverwendung beim Seitenwechsel und
Fehler-/Reset-Verhalten wurden mit den echten Frontendfunktionen in den
Verhaltenstests geprüft. Keine neue private Produktions-Browserprüfung auf einem
freigeschalteten Gerät durchgeführt und keine konkrete Free-Agency-Ladezeit
behauptet. Kein iPhone-Test. Bestehende Daten- und Projektionsgrenzen bleiben.

Diese nachfolgende Dokumentation verändert das veröffentlichte Frontend nicht.
