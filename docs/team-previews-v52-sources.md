# FBA-Teamberichte 2026/27 – Quellen und Redaktion

Geprüft am 05.09.2026. Datenmodul: `team-previews-2026-27.js`.

Die acht Artikel sind eine redaktionelle Vorschau für die acht aktiven FBA-Franchises. Die historischen Angaben stammen aus den bestehenden Projektarchiven und wurden mit der öffentlichen FBA-Antwort abgeglichen. Es wurden keine Tabellen geändert, keine privaten Module geöffnet und keine NBA-Spieler einem noch nicht gedrafteten FBA-Kader zugeschrieben.

## Quellen

1. **Öffentliche FBA-API**, read-only am 05.09.2026 abgerufen:
   [Apps-Script-Datenantwort](https://script.google.com/macros/s/AKfycby02oSRlkddDZfq1od7DXtKkPVgGScoJBa9x-Jsj50LF1sHUYnfIRicV3KTIZRQI9Sh/exec?data=1).
   Die gelesene Antwort meldete `meta.publicPayloadVersion = 46`, `meta.publicUpdatedAt = 2026-09-05T13:44:35.473Z`, `meta.source = FBA SUPER EXCEL (7)` und `appConfig.effectivePhase = PRESEASON`.
   Verwendet wurden ausschließlich `appConfig`, `draft`, `seasons[].final` und `analytics.seasons[].games`. Der Wert `meta.generated = 05.09.2026 12:20` ist der Erstellungsstand des öffentlichen Inhalts, nicht eine behauptete sekundengenaue Vollsynchronisierung aller Backend-Module.
2. **`index.html`**: `CHAMPIONSHIPS`, `FINAL_STANDINGS_25_26`, `SNAPSHOT.seasons`, `PHASE_SNAPSHOT_CONFIG`, `phaseDraftSnapshot`, `canonicalTeamName`, `draftTeams`, `aggregateScopedTeam`, `completeMatchupRecord` und die historischen Bishkek-Ergänzungen.
3. **`analytics-snapshot.js`**: `HISTORICAL_ANALYTICS`, Version 3, `generated = 2026-09-01`. Es enthält die historischen FBA-Wochen und Postseason-Duelle. Für die Vorjahresprofile wurde ausschließlich `S25_26`, Wochen 1–18, ausgewertet.

Die am Chat angehängte XLSX wurde nicht als neuerer Tabellenstand angenommen. Das ältere Inline-`SNAPSHOT` trägt zwar den Hinweis `Snapshot 12.03.2026`; für aktuelle Draftkonfiguration und vollständige Finalplatzierungen wurde die zusätzliche öffentliche Antwort geprüft. Die Finalplatzierung 2025/26 stimmt mit der expliziten Korrektur `FINAL_STANDINGS_25_26` überein.

## Aktive Teilnehmer, Draft und Conference

Die öffentliche Antwort und die bestehende Fallbackkonfiguration stimmen hierin überein:

| Team | Conference 2026/27 | Draftposition |
|---|---|---:|
| East Bay Pirates | East | 1 |
| Balingen Lions | West | 2 |
| Toronto Polar Bears | East | 3 |
| Guardians of Rhinos | East | 4 |
| Dormettingen Eagles | West | 5 |
| BlackForest Mad Wolves | East | 6 |
| Karlsruhe Unicorns | West | 7 |
| Bishkek Easy Snipers | West | 8 |

`appConfig.draftDate` und `draft.draftDate`: **27.09.2026 19:00**. Zwei Playoffplätze je Conference. Die 18 Regular-Season-Wochen entsprechen dem bestehenden FBA-Format und dem bisherigen Saisonmodell. Keine Artikelstelle behauptet bereits feststehende NBA-Picks oder ein Ergebnis für 2026/27.

Die Notiz der öffentlichen Draftzeile für `Bishkek Easy$Snipers` lautet, dass Bishkek den Platz der pausierenden Wild Cheetahs übernimmt. Der bestehende Namensnormalisierer führt `Bishkek Easy$Snipers` und `Bishkek Easy Snipers` unter dem letzteren Anzeigenamen zusammen. Die Berichte übertragen keine Cheetahs-Resultate auf Bishkek. Cheetahs erhalten als pausierende Franchise keinen aktiven 2026/27-Artikel; ihre Historie bleibt im restlichen Projekt erhalten.

## Meister und Finalplatzierungen

Die verwendeten Meister stehen sowohl in `CHAMPIONSHIPS` als auch auf Platz 1 der jeweiligen öffentlichen Abschlusstabelle:

| Saison | Meister |
|---|---|
| 2020/21 | Guardians of Rhinos |
| 2021/22 | Balingen Lions |
| 2022/23 | BlackForest Mad Wolves |
| 2023/24 | BlackForest Mad Wolves |
| 2024/25 | East Bay Pirates |
| 2025/26 | BlackForest Mad Wolves |

Für 2019/20 wird kein Titel ergänzt: In den gelesenen Quellen fehlt eine belastbare Finalplatzierung. Die Artikel sprechen deshalb beispielsweise von der ersten **verifizierten** Meisterzeile und nicht von einer vermeintlich zweifelsfrei ersten Saison der Ligageschichte.

| Team | Im Artikel verwendete Abschlüsse |
|---|---|
| Wolves | 2022/23 #1, 2023/24 #1, 2024/25 #2, 2025/26 #1. Daraus vier Finalteilnahmen hintereinander und drei Titel in diesem Zeitraum. |
| Bears | 2023/24 #2, 2024/25 #6, 2025/26 #2. Zwei dokumentierte Finalteilnahmen in diesem Dreijahresabschnitt. |
| Pirates | 2020/21 #2, 2021/22 #2, 2022/23 #6, 2023/24 #6, 2024/25 #1, 2025/26 #5. |
| Rhinos | 2020/21 #1, 2021/22 #7, 2022/23 #4, 2023/24 #7, 2024/25 #7, 2025/26 #6. |
| Lions | 2021/22 #1, 2022/23 #8, 2023/24 #5, 2024/25 #4, 2025/26 #3. Daraus drei aufeinanderfolgende Platzverbesserungen nach 2022/23. |
| Eagles | 2024/25 #8, 2025/26 #4. Verbesserung um vier Abschlussplätze. |
| Unicorns | 2021/22 #3, 2022/23 #5, 2023/24 #3, 2024/25 #3, 2025/26 #7. |
| Snipers | 2020/21 #4, 2021/22 #4, 2022/23 #3, 2023/24 #8; in den vollständigen Teilnehmer- und Abschlusstabellen 2024/25 und 2025/26 nicht vorhanden. |

Die Bishkek-Historie ist ausdrücklich vorhanden: öffentliche `seasons[].final`-Zeilen, ältere `analytics`-Spiele mit dem Bishkek-Namen und bestehende `BISHKEK_ETERNAL`/`BISHKEK_RS_DUELS`-Ergänzungen. Der dritte Platz und die Rückkehr nach zwei Saisons ohne Teilnahme wurden daher nicht aus einer fremden Franchise abgeleitet. Eine persönliche Kontinuität desselben Managers oder der Grund der damaligen Abwesenheit wird nicht behauptet.

## Regular Season 2025/26

Zählweise wie im bestehenden FBA-Team-Center: pro Spiel acht Kategorien, bei identischem Kategorienwert erhält Team B als Heimteam den Kategorienpunkt. Das Verhältnis der acht Kategorien entscheidet über Sieg, Niederlage oder Matchup-Remis. Die folgenden Werte wurden aus den 18 vollständigen Wochen je Team berechnet und stimmen mit den vorhandenen Vorjahresübersichten überein.

| Team | Matchups: S–N–U | Kategorien: Siege–Niederlagen |
|---|---|---|
| Wolves | 12–3–3 | 91–53 |
| Bears | 11–4–3 | 91–53 |
| Lions | 11–5–2 | 82–62 |
| Eagles | 8–9–1 | 70–74 |
| Pirates | 8–9–1 | 67–77 |
| Rhinos | 5–13–0 | 58–86 |
| Unicorns | 5–9–4 | 62–82 |
| Cheetahs | 3–11–4 | 55–89 |

**Matchupsiege und Kategorienpunkte werden im Artikel getrennt bezeichnet.** Beispielsweise sind Wolves' 91 Siege Kategorienpunkte, nicht 91 gewonnene Wochen.

Verwendete Statistikangaben sind arithmetische Mittel der 18 abgeschlossenen FBA-Regular-Season-Wochen, keine NBA-Per-Game-Werte. Die Kategorienränge beziehen sich auf alle acht damaligen FBA-Teams einschließlich Cheetahs.

| Team | Verwendete Wochenmittel und Rang |
|---|---|
| Wolves | 3PM = 73,9444 → 73,9; Rang 1. |
| Bears | PTS = 758,8889 → 758,9; STL = 44,5; BLK = 29,0556 → 29,1. Alle drei Rang 1. |
| Rhinos | 3PM = 72,1111 → 72,1; Rang 2. REB = 191,8333 → 191,8; BLK = 19,4444 → 19,4. Beide Rang 8. |
| Lions | REB = 248,9444 → 248,9; AST = 184,0. Beide Rang 1. |
| Eagles | PTS = 710,1667 → 710,2; REB = 238,3889 → 238,4; AST = 138,5556 → 138,6. Keine Rangbehauptung im Text. |
| Unicorns | STL = 43,6667 → 43,7; Rang 2. PTS = 648,2222 → 648,2; 3PM = 57,2778 → 57,3. Beide Rang 7. |

Es werden keine gemittelten FG-/FT-Prozentwerte als Saisonquote publiziert. Für eine echte Saisonquote wären summierte Treffer und Versuche nötig. Die genannten historischen Kategorienprofile sind keine Projektion oder feststehende Strategie des neuen Kaders.

## Postseason 2025/26

Die aus den acht Kategorien errechneten Resultate stimmen mit der verifizierten Abschlussreihenfolge überein:

| Duell | Kategorienergebnis | Verwendung |
|---|---|---|
| Halbfinale: Lions – Wolves | 3:5 | Lions-Artikel; Heimregel bei Gleichstand der Dreier berücksichtigt. |
| Halbfinale: Eagles – Bears | 1:7 | Bears- und Eagles-Artikel. |
| Finale: Wolves – Bears | 5:3 | Wolves/Bears. Wolves gewinnen PTS, REB, AST, 3PM, STL; Bears BLK, FG%, FT%. |
| Platz 3: Eagles – Lions | 2:6 | Eagles/Lions. |
| Platz 5: Rhinos – Pirates | 3:5 | Rhinos/Pirates. |
| Platz 7: Cheetahs – Unicorns | 3:5 | Unicorns. |

Zusätzliche konkrete Finalszene: `S25_26`, Woche 20, `mu = Finale` enthält `3PM = [190, 125]` für Wolves/Bears sowie `BLK = [57, 59]`. Daraus stammen die 190:125 Dreier im Wolves-Artikel und die zwei zusätzlichen Bears-Blocks im Toronto-Artikel. Beide Zahlen sind lokal und öffentlich identisch.

Beim zusätzlichen Vergleich wurde ein bestehender Unterschied der Quellen festgestellt: In der öffentlichen `analytics`-Antwort liegen die sechs Mengenkategorien der vier Spiele in `S25_26`, Woche 19, exakt bei der Hälfte der lokalen `analytics-snapshot.js`-Werte. Die Quoten sind identisch; alle Kategorienergebnisse bleiben identisch. Woche 20 ist hinsichtlich der Stats identisch. In diesen Berichten werden deshalb **keine absoluten Mengen der Woche 19** genannt. Die Datenkette wurde im Rahmen dieser redaktionellen Aufgabe nicht geändert. Diese Feststellung ist kein Beleg, dass die bestehende Normalisierung anderer Ansichten korrekt oder fehlerhaft ist; das bedürfte einer separaten Prüfung.

## Redaktionelle Grenze und Darstellung

- Je Team vier Abschnitte mit jeweils klar erkennbarer History/Rückblick- bzw. Preview/Draft-Perspektive. Je Artikel 335–376 Wörter im Fließtext. Redaktionelle Einordnung wird außerdem im gemeinsamen Frontend-Footer gekennzeichnet; die Artikel wiederholen keine technischen Haftungs- oder Methodenhinweise.
- Titel und Teaser verdichten belegte Franchiseverläufe. Sie enthalten keine erfundenen Zitate, Interviews, Gefühle, Managercharaktere oder Insiderinformationen.
- Aussagen über mögliche Draftansätze und sportliche Aufgaben sind redaktionelle Einordnungen. Sie werden nicht als beschlossene Teamstrategie oder Prognose einer bereits bekannten Mannschaft dargestellt.
- Es werden keine Early-Odds-Zahlen als sportliche Prognose oder historische Bilanz verwendet. Insbesondere führt die öffentliche Draftquelle Bishkek derzeit für Teile des Early-Odds-Modells unter `LEAGUE_AVERAGE`; das ist trotz vorhandener Archivhistorie keine belegte historische Stärke und wird nicht als solche übernommen.
- Keine konkrete NBA-Spielerzuordnung, Verletzungsbehauptung, zukünftige Saisonstatistik oder garantierte Platzierung.
- Datenvertrag: `window.FBA_TEAM_PREVIEWS` mit `season`, `reviewedAt`, `sourceNote` und acht `teams`. Texte sind reine Zeichenketten. Der Frontend-Renderer muss sie wie die anderen dynamischen Inhalte über `E()` escapen.
- Das Modul enthält ausschließlich öffentliche Franchiseberichte. Bestehende private Zugriffe, Spieleranalysen, Maik-Value, Archivdaten und Berechnungen werden dadurch nicht verändert.

## Lokale Prüfungen dieses Datenmoduls

- `node --check team-previews-2026-27.js` erfolgreich.
- Acht eindeutige aktive Teams, vier je Conference; jeder Artikel vier Abschnitte, vier Faktenfelder und 300–450 Wörter geprüft.
- Alle historischen Zahlen und abschließenden Ergebnisse gegen die oben genannten Quellen und bestehende FBA-Auswertung geprüft. Kein neuer visueller Browser- oder Gerätecheck wird hiermit behauptet.
