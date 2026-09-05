# FBA ESPN Mock Bridge · Testversion 0.1.0

Die Erweiterung übernimmt den sichtbaren Pick-Verlauf eines ESPN Basketball Mock Drafts in den FBA War Room v60. Die Einrichtung ist einmalig. Sie funktioniert in Chrome oder Edge auf Mac und Windows; Safari und die ESPN-iPhone-App werden nicht unterstützt.

## Einrichten

1. Zuerst die Website mit **FBA-v60-Netlify-Upload.zip** aktualisieren.
2. **FBA-ESPN-Mock-Bridge.zip** entpacken. Den entstandenen Ordner dauerhaft auf deinem Rechner behalten.
3. In Chrome `chrome://extensions` öffnen (Edge: `edge://extensions`). Oben **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** wählen und den entpackten Ordner auswählen, in dem `manifest.json` liegt.
5. Den FBA-Tab und einen bereits geöffneten ESPN-Tab einmal neu laden.

## Mock testen

1. In der ESPN Basketball Mock-Draft-Lobby einen **8-Team-Snake-Mock mit 13 Runden** auswählen und normal mit deinem ESPN-Konto teilnehmen.
2. Im gestarteten ESPN-Draftraum **Pick History → All Rounds** öffnen. Diese Ansicht offen lassen; ein zweites Fenster neben dem War Room ist praktisch.
3. Im FBA War Room dein gewünschtes FBA-Team wählen, beispielsweise BlackForest Mad Wolves.
4. Oben **ESPN Mock Draft → Mock verbinden / fortsetzen** aufklappen. Den vollständigen Link deines ESPN-Draftraums einfügen. Enthält er eine `teamId`, wird dein Draftplatz automatisch erkannt. Sonst deinen ESPN-Draftplatz auswählen.
5. **Mock verbinden** anklicken. Im Status müssen die gelesene Uhrzeit und die Anzahl übernommener Picks erscheinen.
6. Alle Spieler weiterhin bei ESPN draften. FBA übernimmt die angezeigten Picks etwa alle vier Sekunden. Kategorie-Ränge, Ziele, Punt-Auswahl, ADP/FBA/Merge und Vorschauen stehen im War Room zur Verfügung.
7. **Zurück zum lokalen Test** stellt deinen vorherigen lokalen Draft wieder her. Der Mock wird separat gespeichert. Nach einem Neuladen muss er bewusst erneut verbunden werden.

## Wenn keine Picks ankommen

- Beide Seiten müssen im selben Chrome-/Edge-Profil geöffnet sein; private Fenster verwenden einen anderen Kontext.
- Die Website muss v60 oder neuer sein. Nach Installation oder Aktualisierung der Erweiterung beide Tabs neu laden.
- Nur einen ESPN-Draft-Tab für denselben Mock offen halten.
- Im ESPN-Tab **Pick History** und **All Rounds** sichtbar halten. Ein eingeklappter, gefilterter oder nicht geladener Verlauf wird nicht als vollständiger Stand übernommen.
- ESPN kann abgelaufene Mock-Räume entfernen. Dann einen neuen Raum verwenden.
- Bei unbekannten Spielern, fehlenden Picks oder unpassender Team-Zuordnung bleibt der letzte geprüfte Stand erhalten und eine konkrete Meldung erscheint.
- Ändert ESPN bereits übernommene Picks, ist eine Bestätigung des neuen Verlaufs erforderlich.

## Was geprüft ist – und was noch fehlt

Die öffentlichen ESPN-Raumdaten und der offizielle Draft-Client wurden untersucht. Der Live-Draft nutzt eine separate angemeldete Verbindung; der normale ESPN-API-Abruf lieferte bei laufenden Mocks keine Picks. Deshalb liest die Erweiterung ausschließlich die angezeigte Pick-Tabelle.

Automatisierte Tests prüfen DOM-Auswertung anhand aus dem offiziellen Client rekonstruierter Tabellen, Zuordnung aller 104 Snake-Picks, lokale Übertragung, Fehlerfälle und Erhalt des bisherigen War Rooms. Ein vollständiger Test in einem angemeldeten ESPN Mock Draft steht noch aus. Das ist eine Testversion, keine bereits am Live-Draft abgenommene Verbindung. Änderungen am ESPN-Layout können Anpassungen erforderlich machen.

Es werden keine Passwörter, Cookies, Mitgliedskennungen oder Zugriffstoken gelesen oder übertragen. Es gibt keine automatischen Draft-Aktionen, Nachrichten oder Schreibzugriffe auf ESPN. Die Erweiterung verbindet ausschließlich ESPN und die FBA-Seite in deinem Browser; sie hat keinen eigenen Datendienst. Ein Teil der offiziellen Raum-Metadaten wird von der FBA-Seite öffentlich bei ESPN gelesen.

ESPN-Lobby: https://fantasy.espn.com/basketball/mockdraftlobby
FBA: https://fba-control-center.netlify.app

Installation nach der offiziellen Chrome-Anleitung:
https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked
