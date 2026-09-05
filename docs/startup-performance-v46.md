# Startgeschwindigkeit — Diagnose und vorbereitete v46

Stand: 05.09.2026. Basis ist der veröffentlichte Main
`698ac479ab085e794f950ef0559eea28f9494cba` (Frontend v45, Apps Script v38).
Die hier beschriebene v46 ist auf `feature/startup-performance` vorbereitet,
noch nicht auf Main oder Netlify veröffentlicht. Keine Apps-Script-Version angelegt.

## Messungen an Produktion

| Messung | Ergebnis | Einordnung |
|---|---:|---|
| Browser, erste Seitenhülle | 1.069 ms | Direkt danach noch 0 Draft-Karten |
| Browser, weiterer Reload | 872 ms | Direkt danach noch 0 Draft-Karten |
| Öffentliche Daten-API, Abruf 1 | 38,692 s | 38,658 s bis Antwort-Header; 308.706 Bytes |
| Öffentliche Daten-API, Abruf 2 | 52,210 s | 52,174 s bis Antwort-Header; 308.706 Bytes |
| HTML, separater HTTP-Abruf | 9,064 s | 605.531 Bytes, anderer Abrufweg als Browser |

Die API-Messungen nutzen normale GETs mit `?data=1`, ohne Cache-Bypass.
Die Zeit bis zu den Headern enthält Netzwerk, Google-Weiterleitungen und
Serverarbeit; sie ist kein isoliertes Profil einer einzelnen Backendfunktion.
Die Browseransicht zeigte bei späteren Kontrollen LIVE und alle 25 Karten.
Diese Kontrollen liefern keine genaue Ankunftszeit der Karten. Insbesondere
wurden die zwischen Werkzeugaufrufen verstrichenen 38 bzw. 49 Sekunden nicht
als Browser-Ladezeit gewertet. Kein iPhone-Test und kein CPU-Profil.

Der größte Anteil der gemessenen API-Wartezeit liegt vor der Übertragung des
Antwortkörpers. Eine zusätzliche Offline-Gzip-Berechnung ergab ca. 40 KB für
JSON und 137 KB für HTML; das ist keine gemessene Transferkomprimierung.

## Befunde im tatsächlichen Startpfad

1. `doGet(?data=1)` ruft bisher `syncEspnIfStale_(false)` auf, bevor der
   Daten-Cache geprüft wird. Bei fälligem Sync kann der Besucher darauf warten.
2. Die letzte aktive `getPayload`-Definition ruft auch bei vorhandenem
   Sechs-Stunden-Basiscache `enhancePayloadPhaseV1` erneut auf. Sie baut Draft,
   Analytics, Syncstatus, Player Hub, Draftprognosen, ADP-Trend und Top25 auf.
   Die Positions-Ergänzung kann dabei nochmals den ESPN-Hub abrufen.
3. Es gibt keinen gespeicherten letzten öffentlichen Datenstand im Browser.
   Der eingebettete historische Snapshot enthält noch keine aktuellen Top25.
4. JSONP endet bisher nach 20 Sekunden. Danach beginnt ein weiterer Fetch ohne
   Zeitlimit. Bei den gemessenen 39–52 Sekunden kann dadurch dieselbe Arbeit
   erneut ausgelöst werden. Die zwei tatsächlichen Browseranfragen wurden
   nicht separat als Netzwerk-Waterfall aufgezeichnet.
5. Der aktive `onEdit`-Hook referenziert nicht deklarierte Altvariablen
   `CONFIG_SHEET`/`CONFIG_CACHE_KEY`; ein Fehler wird verschluckt und kann die
   beabsichtigte Cache-Invalidierung abbrechen. Ein neuer Verhaltenstest fand
   dies; die Referenzen werden jetzt nur bei vorhandener Definition benutzt.

## Vorbereitete Änderungen

- Vollständige öffentliche Antwort maximal 120 Sekunden in einem separaten
  Apps-Script-Cache. Ein Treffer benötigt keine Daten-Builder, Tabellen-Reads
  oder ESPN-Synchronisierung. Der bestehende historische Cache bleibt bestehen.
- Gleiche Invalidierung bei relevanten Tabellenänderungen, ESPN-Aktualisierung
  und ADP-Snapshot. Der explizite Reset (`nocache=1`) umgeht den Antwortcache.
- Die bestehende Sync-Automatik bleibt erhalten. Bei leerem Antwortcache bleibt
  auch die bisherige Prüfung auf fälligen Sync erhalten. Daher keine Zusage
  einer durchgehend schnellen ersten Antwort bei leerem Server-Cache.
- Getrennte, eindeutige Chunk-Schlüssel pro Antwort verhindern vermischte
  Fragmente paralleler Cache-Schreibvorgänge. Fehlende Fragmente führen zum
  regulären Neuaufbau. Cachefehler verwerfen keine gültigen Daten.
- Letzter erfolgreicher öffentlicher Abruf wird vor dem ersten Render geladen,
  wenn Quelle und Saison stimmen und der Abruf weniger als 24 Stunden alt ist.
  Danach immer frischer Abruf im Hintergrund. Markierung `GESPEICHERT` bzw.
  `SYNC…`, Abrufzeit im Footer; ein gespeicherter Stand wird nicht LIVE genannt.
- Gespeichert wird nur eine explizite Liste öffentlicher Payload-Felder.
  Private Monster-/Free-Agency-Daten und Gerätezugang werden nicht in diesen
  neuen Cache aufgenommen. Quellenwechsel und Live-Reset löschen den Cache.
- Doppelte öffentliche Anfragen für dieselbe Quelle werden zusammengefasst;
  verspätete Antworten nach Quellenwechsel/Zurücksetzen werden ignoriert.
- JSONP bekommt 60 Sekunden für einen kalten Apps-Script-Abruf, bevor der
  Ersatzabruf startet. Der Ersatzabruf wird nach 15 Sekunden abgebrochen.
  Das ist vor allem Schutz vor Doppelarbeit und endlosem Warten, keine
  Beschleunigung einer einzelnen langsamen Google-Antwort.
- Frontend/Manifest tragen die vorbereitete v46-Buildkennung. Öffentliche
  Antworten erhalten `meta.publicPayloadVersion=46` und `publicUpdatedAt`;
  interne Projektionsversion v36 bleibt erhalten. Der v43-Datumsparser,
  die Tabellenzeitzone, Saisonfilter, Positionslogik und 25 Analysen bleiben.

Das Cache-Prinzip und die Größenbegrenzung folgen der offiziellen
[CacheService-Dokumentation](https://developers.google.com/apps-script/reference/cache/cache).
Auch Google empfiehlt, externe Aufrufe zu reduzieren und teure Ergebnisse zu
[cachen](https://developers.google.com/apps-script/guides/support/best-practices).

## Prüfung und verbleibende Veröffentlichung

Alle acht Testdateien bestanden, insgesamt 15 vom Node-Runner gemeldete Tests.
Die acht neuen Verhaltenstests prüfen Antwortcache/Invalidierung, beschädigte
Chunks, Größenlimits, sofort verfügbaren gespeicherten Stand, Saison/Quelle/TTL,
Speicherausfall, doppelte und verspätete Antworten sowie Abbruch des Ersatzabrufs.
Bestehende Regressionen schützen unter anderem ADP-Datumswerte und Positionen.
Backend-Syntax, vollständiges Inline-JavaScript und `git diff --check` bestanden.

Die neuen Tests laufen in Node mit kontrollierten Schnittstellen; sie sind
keine Browsermessung der geänderten App. Die zuvor blockierte lokale Browser-
Vorschau wurde nicht erneut aufgerufen. An Produktion wurden nur die oben
beschriebenen Diagnosemessungen durchgeführt. Deshalb keine behauptete neue
Produktions-Ladezeit, kein Performance-Prozentwert und keine Mobilgeräte-Zusage.

Bei einem Auftrag zur Veröffentlichung: aktuellen Main abgleichen, exakt den
getesteten Tree veröffentlichen, Backend-Workflow bis Erfolg verfolgen, neue
unveränderliche Apps-Script-Version bestätigen, Netlify bis ready verfolgen,
Live-HTML bytegenau prüfen. Danach normale erste und wiederholte Abrufe messen
und im Browser Cache-Start, Hintergrundaktualisierung und Reset prüfen.
