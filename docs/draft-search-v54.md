# Draft-Vorbereitung: Spielersuche und kompakte Analyse – v54

Stand 05.09.2026, auf Basis des geprüften v53-Baums
`70382af09f0a5e51815104f12330d3bd606f2b9d`.
Frontend-Build: `war-room-monster-v54-20260905`.

## Änderung

Der Nutzer wünscht eine Namenssuche für die 100 Spielerkarten und die Entfernung
des unter jeder Karte wiederholten ADP-Erklärabsatzes. Beide Änderungen sind
enthalten. Die bestehenden ADP-Zahlen, Tagesstände, FBA-Values, Statistiken,
Berichte und Quellen bleiben Bestandteil der Analyse.

Das Suchfeld steht neben der Sortierung, auf kleinen Bildschirmen darüber.
Es filtert während der Eingabe nach Teilen des Vor- oder Nachnamens und
ignoriert Großschreibung, Akzente und gängige Namensinterpunktion. Beispiele:
Lillard, Jokic für Jokić, Dangelo für D’Angelo. Mehrere Wörter müssen alle im
Namen vorkommen; ihre Reihenfolge spielt keine Rolle. Die Suche umfasst den
aktuellen ESPN-Top-100-Pool, keine darüber hinausgehenden Spieler.

Trefferzahl und Hinweis bei fehlenden Treffern sind sichtbar. Ein leerer
Datenbestand erhält weiterhin den eigenen Ladehinweis. Suchfeld und Sortierung
bleiben beim Filtern im DOM, sodass Fokus und Cursor erhalten bleiben. Eine
offene Analyse wird auch nach vorübergehendem Ausfiltern wieder geöffnet;
eine vom Nutzer geschlossene Analyse bleibt geschlossen. Die angezeigte
Rangnummer beschreibt weiterhin die Position in der gerade sichtbaren Liste.

Die Suche arbeitet mit den bereits geladenen öffentlichen Daten. Sie ruft
weder ESPN noch ein Sprachmodell auf und benötigt keine Backendänderung.
Der Suchtext bleibt im Seitenspeicher, die bestehende Sortierpräferenz im
Session-Speicher. Es werden keine neuen Nutzerdaten gespeichert.

## Fragen zur Erweiterung und Pflege

150 Spieler sind bei 8 × 13 = 104 FBA-Kaderplätzen eine sinnvolle zusätzliche
Abdeckung. Eine ESPN-ADP-Auswahl garantiert wegen anderer FBA-Präferenzen keine
vollständige Abdeckung aller später gedrafteten Spieler. Die vorhandenen
öffentlichen Feeds und der Identitätskatalog reichen über 100 Spieler hinaus;
für eine Erweiterung müssen Auswahlgrenze, neue individuelle Berichte und
Quellenprüfung gemeinsam angepasst werden. Dieser Release bleibt bei 100.

Die Berichte sind statische Redaktion. Eine tägliche ADP-Aktualisierung
recherchiert keine neuen Verletzungs-, Rollen- oder Teamnachrichten. Ebenso
muss der öffentliche Team-/Positionskatalog bei Änderungen gepflegt werden.
Ein regelmäßiger gebündelter Nachrichtencheck mit Überarbeitung nur betroffener
Texte ist sparsamer als ein vollständiges Neuschreiben aller Berichte. Exakte
Tokenkosten lassen sich ohne konkreten Umfang und Recherchelauf nicht angeben;
auch eine Prüfung ohne Änderungen benötigt Rechercheaufwand. Für eine spätere
Pflegefunktion sollten Prüfdatum und tatsächliches Änderungsdatum getrennt
erkennbar sein. In diesem Release wurde kein automatischer Turnus eingerichtet.

## Prüfung und Auslieferung

Die Verhaltenstests prüfen Suche mit Namensvarianten, Kombination mit
FBA-Value-Sortierung, fehlende Treffer, Leeren der Suche, Fokus-/Cursorerhalt,
offene und geschlossene Analysen sowie HTML-Escaping. Der vollständige
gespeicherte öffentliche 100er-Datensatz findet Lillards Karte mit eigenem
Draft-Plan und korrekt bezeichnetem Statistikbezug 2024/25. Eine alte Testregel
verlangte den nun bewusst entfernten ADP-Erklärabsatz; sie wurde an den
aktuellen Nutzerauftrag angepasst.

Alle 68 Tests in 16 Testdateien bestanden; `git diff --check` ohne Befund.
Keine neue visuelle Browserprüfung: Die zuvor gesperrte lokale Vorschau wurde
nicht umgangen. Kein Produktionsdeploy und keine neue Live-Ladezeitmessung.

Die ZIP wird aus dem getesteten Commit erzeugt: `index.html` im Wurzelverzeichnis,
alle bisherigen öffentlichen Skripte, Styles und Bilder. Backend, Tests,
Dokumentation, Git-Dateien und Rechercheantworten gehören nicht ins Paket.
