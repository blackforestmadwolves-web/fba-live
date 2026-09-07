# FBA Bridge · 0.2.0 · ESPN + Hashtag

## Update für Hashtag (Control Center v75)

1. Die Website mit FBA-v75-Netlify-Upload.zip aktualisieren.
2. Im Control Center unter Draft-Vorbereitung → Expert-Projektionen das **Bridge-Update laden** und entpacken.
3. Die Dateien aus diesem ZIP in den bereits installierten FBA-Bridge-Ordner kopieren und die alten gleichnamigen Dateien ersetzen. In `chrome://extensions` bei **FBA ESPN Mock Bridge** auf **Neu laden** klicken. Neue Berechtigungen gegebenenfalls bestätigen. Alternativ die alte Erweiterung entfernen und diesen Ordner einmal als entpackte Erweiterung laden; nicht zwei FBA-Bridges gleichzeitig aktiv lassen.
4. Den FBA-Tab neu laden. Hashtag im selben Chrome-/Edge-Profil anmelden.
5. Das Control Center entsperren, unter **Expert-Projektionen** auf **Hashtag verbinden** klicken. Ein eigener Hashtag-Tab wird im Hintergrund geöffnet und auf die vollständige 2026/27-Pro-Spiel-Liste gestellt.
6. Die Anzahl übertragener Spieler und die Uhrzeit abwarten. Danach wird alle sechs Stunden neu eingelesen, solange das Control Center geöffnet und entsperrt ist. **Hashtag jetzt aktualisieren** startet einen sofortigen Neuabruf. **Automatik pausieren** beendet weitere automatische Versuche.

Geschlossene Tabs, abgelaufene Anmeldung und geänderte Tabellenansichten werden als Fehler gemeldet. Der letzte gültige Stand bleibt erhalten; ein neuer Login muss im Browser erfolgen. Das ist keine rund um die Uhr laufende Serververbindung. Nach dem ersten Saisonspiel bleibt die vorhandene FBA-Saisonbasis eingefroren.

Hashtag-Spieler werden anhand ihrer Anbieter-ID dauerhaft ESPN-Spielern zugeordnet. Alle acht Kategorien werden mit den jeweils vorhandenen unabhängigen Quellen gemittelt. FG%/FT% entstehen aus Treffer- und Versuchsvolumen. Unbekannte oder widersprüchliche Spielerzuordnungen werden ausgewiesen.

Die Hashtag-Tabelle wurde im angemeldeten Browser geprüft; Import, erneutes Einlesen und Drei-Quellen-Berechnung wurden automatisiert getestet. Der erste vollständige Abgleich mit der installierten Bridge in deinem Chrome-/Edge-Profil steht noch aus.

Die Erweiterung liest keine Hashtag- oder ESPN-Passwörter und keine Cookies. Für den Hashtag-Import übergibt die FBA-Seite ihre vorhandene Gerätefreigabe an die Erweiterung. Diese sendet sie ausschließlich an den fest hinterlegten FBA-Apps-Script-Endpunkt; sie wird nicht gespeichert. Die ESPN-Verbindung ist unverändert.

## ESPN Mock Draft

Die vorhandene ESPN-Pick-Übernahme ist unverändert. Beide Seiten müssen im selben Chrome-/Edge-Profil geöffnet sein. Im ESPN-Draftraum Pick History → All Rounds offen lassen, im FBA War Room den passenden Mock verbinden. Die Spieler weiterhin bei ESPN auswählen. Es werden keine automatischen Picks ausgelöst.

## Technische Prüfung

Die Übertragung erlaubt nur die FBA-Seite als Absender und sendet Daten ausschließlich an den fest hinterlegten FBA-Endpunkt. Zugriff auf andere Websites oder beliebige URLs ist nicht vorgesehen. Hashtag-Zeilen werden weder in diesem ZIP noch in öffentlichen App-Daten gespeichert. Die vorhandenen privaten FBA-Gerätefreigaben schützen Import und Projektionsabruf.

Chrome-Anleitung zur Installation einer entpackten Erweiterung:
https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked
