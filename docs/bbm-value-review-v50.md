# Maik-Value: Anzeige und BBM-Vergleich — v50

Vorbereitet am 05.09.2026 auf v49-Commit
`9eea541b706fb95b0dc4b49c75f4cba954262593`. Kein Produktionsdeploy in diesem
Arbeitsgang. Der Nutzer veröffentlicht das Frontend selbst per ZIP.

## Änderung

Der Maik-Value steht im Draft Radar rechts direkt unter ESPN ADP. Eine
gemeinsame Kopfzeile reserviert die Höhe beider Kennzahlen vor dem Namen.
Historische Badges und Auswahltexte zeigen nur `2025/26`. Tooltip,
Detailtabelle und Quellenmetadaten behalten die vollständige Herkunft;
aktuelle Projektions- und Ist-plus-Rest-Kennzeichnungen bleiben erhalten.

Frontend und Manifest: `war-room-monster-v50-20260905`. Modell, Quelldaten,
ADP-Sortierung, Backend und privater Zugriff sind unverändert.

## Öffentlich belegter BBM-Rechenweg

[BBM Help](https://basketballmonster.com/Help.aspx) beschreibt Kategorie-z-Werte,
null als Vergleichsmittel, optionale Kategoriegewichte sowie den Unterschied
zwischen Per-Game- und Total-Value. Per Game verwendet Spielschnittwerte;
die Zahl absolvierter Spiele geht dort nicht unmittelbar als Multiplikator ein.
Die Standardansicht mit neun Kategorien berücksichtigt auch Turnover.

Die frei geladene [Rangliste 2025/26](https://basketballmonster.com/PlayerRankings.aspx)
zeigte bei Full Season / Per Game am Prüftag Jokić mit 1,12. Seine neun
angezeigten Kategorie-Werte ergeben zusammen 10,05; geteilt durch neun
entsteht 1,1167, gerundet 1,12. Dies rekonstruiert die Standardanzeige aus
gerundeten Einzelwerten, nicht Maiks persönliche BBM-Konfiguration.

Über den normalen öffentlichen Filter All Players waren 582 Spieler sichtbar.
Telfort stand dort auf Rang 581 mit −1,28; seine vom Nutzer beschriebenen
Spiel-/Statistikwerte passen.

Eine zweite Prüfung mit frischer anonymer Sitzung und normalem öffentlichen
Refresh-Formular übernimmt Maiks acht Gewichte und die TO-Puntcheckbox.
Jokić erhält dort 1,33 und Telfort −1,49 (Rang 582). Die ausgegebenen acht
Kategorie-Werte enthalten die Gewichte bereits: bei Jokić zusammen 10,61,
geteilt durch acht = 1,32625; bei Telfort zusammen −11,94, geteilt durch acht
= −1,4925. BBM mittelt hier über die Zahl aktiver Kategorien, nicht über
die Gewichtssumme 6,3. Die Referenznormierung verändert sich dabei ebenfalls
leicht. Es wurden keine angemeldeten Konto- oder Ligaeinstellungen verändert.

Die genannten persönlichen Werte Jokić 1,11 und Telfort −1,59 sind auch mit
dieser öffentlichen Konfiguration nicht exakt reproduziert. Persönliche
Ligaeinstellungen und Ansichten dürfen nicht ohne Beleg gleichgesetzt werden.

## Vergleichsfeld: Anzeige ist nicht Referenz

Eigene lineare Rückrechnung `Kategorie-z = a × Stat + b` über alle 582
öffentlich angezeigten Zeilen: Für PTS ergeben sich ungefähr 16,8129 als
Referenzmittel und 5,6458 als Standardabweichung. Der RMS-Restfehler beträgt
0,0057 z-Punkte und passt zur Rundung der angezeigten Stats und Werte.
Der einfache Mittelwert der 582 angezeigten PTS-Schnitte beträgt dagegen
9,1579. BBMs gezeigte Punktewerte entsprechen somit nicht einer einfachen
z-Normierung über alle 582 Spieler mit gleichem Gewicht.

Die offizielle [historische Spieleransicht](https://history.basketballmonster.com/Player/Details/6806?name=Oscar_Tshiebwe)
nennt als Ligamodell zwölf Teams mit je 13 Spielern. Das sind 156 Kaderplätze;
die Seite legt die exakte Auswahl bzw. iterative Berechnung des Referenzpools
nicht offen. Auch die in der Hilfe bei Advanced Ownership genannten 156
Spieler sind kein eigenständiger Beweis für die konkrete z-Referenzauswahl.
Eine exakte BBM-Kopie ist deshalb nicht bestätigt.

## Was unser bestehender Maik-Value tatsächlich berechnet

Der unveränderte Code verwendet 374 strukturell vollständige, explizit als
`TESTMODELL · ESPN-Basis 2025/26` gekennzeichnete Profile. Seine historische
Quellenqualität wurde in diesem Arbeitsgang nicht vollständig neu auditiert.
Fallbacks und fehlende Platzhalter werden ausgeschlossen; eine Mindestzahl
historischer Spiele oder ein Top-N-Filter besteht bisher nicht.

PTS-Referenzmittel: 11,350810; Standardabweichung: 6,594630. Jede Zählkategorie
wird über ihr eigenes Mittel und ihre Streuung normiert. FG/FT werden zuerst
als Trefferüberschuss gegenüber der volumenbezogenen Referenzquote berechnet
und anschließend normiert. Die acht Kategorie-z-Werte werden mit Maiks
Gewichten multipliziert und durch deren Summe 6,3 geteilt.

Damit ergibt sich für Jokić 2,338260, angezeigt als +2,34. Schon jetzt haben
199 der 374 Referenzspieler einen negativen MV; beispielsweise Noa Essengue
−1,269343, angezeigt als −1,27. Ein negatives Ergebnis bezeichnet einen
gewichteten Beitrag unter dem Vergleichsmittel, keine negative Siegchance.

Die zusätzlich bestätigte Nenner-Differenz erklärt einen Teil der
Abweichung: Derselbe eigene Jokić-Zähler geteilt durch acht statt 6,3 ergäbe
1,841380. Dieser reine Skalenwechsel würde alle MV-Werte mit 0,7875
multiplizieren und keinen Rang verändern. Er allein erreicht BBMs 1,33
nicht; Vergleichsfeld und Normierung bleiben ebenfalls relevant.

## Schlussfolgerung für eine spätere Modellentscheidung

Eine reine gewichtete Rohstatistiksumme wäre ein anderes Modell: Ein Punkt
und ein Steal liegen auf völlig unterschiedlichen Verteilungen. Die
Normierung macht diese Kategorien vergleichbar; sie sollte erhalten bleiben.

Ein gemeinsamer positiver Skalierungsfaktor ändert nur die Anzeige, nicht die
Reihenfolge. Andere Referenz-Streuungen und Kategoriegewichte können dagegen
auch Ränge ändern. Jokić auf einen gewünschten Einzelwert zu skalieren würde
keine Übereinstimmung mit BBM beweisen.

Sinnvoll ist ein bewusst definierter, stabiler und für Fantasy relevanter
Vergleichspool. Bewertbare Spieler außerhalb dieses Pools können weiterhin
angezeigt werden, ohne dessen Durchschnitt zu verändern. Die Auswahlgröße,
Auswahlregel und ausreichende historische Datengrundlage müssen gemeinsam
festgelegt werden; v50 nimmt hier keine stillschweigende Änderung vor.

## Prüfung und Auslieferung

Alle zehn Testdateien / 28 Runner-Tests bestanden; vollständiges Inline-JS,
Backend-Syntax und `git diff --check` geprüft. Funktion und Markup sind in Node
geprüft. Keine neue visuelle Browser- oder iPhone-Prüfung: Die zuvor gesperrte
lokale Vorschau wurde nicht umgangen.

Die Frontend-ZIP enthält ausschließlich versionierte statische Projektdateien
einschließlich `maik-value.js`. Backend, Tests, Recherche-Rohdaten und lokale
Dateien gehören nicht in das öffentliche Upload-Archiv. Apps Script bleibt
Version 39, äußeres Payload v46 und Engine-Vertrag v36.
