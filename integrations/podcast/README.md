# FBA Podcast: Quellenverbindung 132

Dieser Adapter verbindet den vorhandenen App-Backend-Speicher mit aktuellen
ESPN-Ligadaten und den bereits validierten privaten BBM-Projektionen.
Er erzeugt und veröffentlicht keine Folge und verbraucht keine ElevenLabs-Credits.

## Betrieb

- `refreshFbaPodcast132` aktualisiert den privaten Quellenstand alle 30 Minuten.
- `verifyFbaPodcast132` prüft Speicher, acht Teams, vier Paarungen, Scheduler und
  die Sperre für anonyme Zugriffe. Das Protokoll enthält keine Zugangsdaten.
- Der bestehende App-Web-App-Endpunkt liefert mit `podcast=132` und einem bereits
  freigeschalteten `token` das Paket. Öffentliche App-Endpunkte bleiben unverändert.
- `source_client.py` ruft das Paket über `FBA_APP_API_URL` / `FBA_DEVICE_TOKEN`
  ab und speichert es atomar mit privaten Dateirechten. Token nur im Secret Store
  des späteren Produktionsdienstes hinterlegen, niemals ins Repository oder Chat.
- Der Speicher bewahrt den vorherigen gültigen Stand. Abruffehler und Daten älter
  als 90 Minuten sperren die Freigabe neuer Tagesfolgen.

## Daten und Grenzen

ESPN liefert aktuelle Kader, Verletzungsstatus, acht Kategorien, vier aktuelle
Matchups und Transaktionsmetadaten. Transaktionen werden je Spieltag nachgeladen
und die letzten zwei Spieltage erneut geprüft. Vollzogene Trades ohne sichtbare
Spielerbewegungen bleiben ausdrücklich offene Pflichtmeldungen. Ein ausgeführtes
`TRADE_DECLINE` ist kein vollzogener Trade. Vorschlagszeit und bestätigte
Ausführungszeit bleiben getrennt. Trades werden durch einen Quellenabruf niemals
als gesendet markiert; eine spätere Veröffentlichung benötigt eine eigene Quittung.

BBM kommt aus dem **vorhandenen privaten Importbestand der App**. Diese Integration
schafft keinen neuen automatischen BBM-Download. Die bestehende Prüfung begrenzt
ROS-Daten auf 72 Stunden und Ausfallinformationen auf 48 Stunden. Kaderprofile
verwenden projizierte Restspiele; Wurfquoten werden über Versuche gewichtet.
Rang und Teamstärken sind eigene Berechnungen aus BBM, **keine Ergebnisse von
Analysis Monster oder Trade Monster**. Aufstellungen werden darin nicht optimiert.

Der Browser-CSV-Export wurde bei der Einrichtung durch die Browser-Sicherheitsregel
für nicht zugelassene Download-Protokolle blockiert. Es wurde kein Umgehungsweg
implementiert. Für einen automatischen Direktimport ist weiterhin eine bestätigte,
zulässige Anbieter-Schnittstelle nötig.

Der Adapter hält tägliche Matchup-/Standings-/Verletzungsverläufe bis 240 Tage vor.
Das ist ab Installation aufgebaute Erinnerung, keine nachträglich erfundene Historie.
Eine gespeicherte Startprognose ist noch nicht angebunden. Der Spielstand wird
deshalb nicht als Prognose oder Gewinnwahrscheinlichkeit ausgegeben. Der spätere
Podcast-Generator muss die Begrenzungen im Paket berücksichtigen.

NBA-Nächte beziehen sich auf America/New_York. Vor 20. Oktober 2026 lautet der
Status `out_of_season`. Während der Saison werden nur fertige Boxscores mit
belegtem damaligem Fantasy-Besitzer in die Spielerleistungen aufgenommen.

## Installation ohne Rücksetzen der Live-App

Das Repo enthält noch einen älteren App-Stand. Deshalb **nicht dessen Code.js
komplett auf die aktuelle Produktion deployen**.

1. Den aktuellen Live-Code aus Apps Script sichern.
2. `python integrations/podcast/patch-live.py live.js patched.js` setzt genau
   zwei geprüfte Änderungen: private Route und Korrektur des ungültigen
   ESPN-Transaktionsfilters (`limit` ohne Sortierung).
3. `core.js` und `gas.js` zusammen als separate Datei `FBAPodcast132.gs` einfügen;
   den frisch gepatchten Live-Code in Code.gs speichern.
4. `installFbaPodcast132` ausführen; danach dieselbe bestehende Web-App-Bereitstellung
   mit einer neuen Version aktualisieren. Keine Rechte oder Zugangsdaten ändern.
5. Anonymen Endpunkt prüfen: `DEVICE_AUTH_REQUIRED`.

Prüfungen: `node --test integrations/podcast/core.test.js`.
Fixtures sind synthetisch; echte ESPN-Rohantworten und bezahlte BBM-Daten werden
nicht in diesem öffentlichen Repository gespeichert.
