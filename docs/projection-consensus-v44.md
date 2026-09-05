# Private projection consensus — prepared v44

Base: production v43, main 5be26ec03ce4effb98d8b5924e5f8e504829d04c.
Prepared on 2026-09-05. This branch is not a production release.
Internal projection/actuals/ownership engine contract remains v36.

## Verified acquisition results

The initial research identified eight candidates, not eight working free feeds.
Direct requests and saved-response parsing produced the following results:

| Source | Observed result | Prepared ingestion |
| --- | --- | --- |
| ESPN | seasonId 2027, 1,095 players, zero valid current projection rows; available year projections were seasonId 2026 | Existing exact-season parser, now independently refreshable even if preseason roster sync fails |
| Yahoo / RotoWire | Public ROS view: 25 players matched to ESPN IDs; GP and six counting statistics; all four shooting-volume fields absent | Tested HTML parser, explicit partial coverage, one 25-player page per refresh |
| CBS | Projection tables readable; requested 2027 URL still returned a 2026 heading; full 2026/27 season could not be established | Reachability/availability audit; normalized import only until season is independently confirmed |
| LineupExperts | Website research showed current projections; direct server request returned HTTP 403 | Normalized private import; no claim that a free API exists |
| Hashtag | Direct server request HTTP 403; public research identifies only top 30 free | Normalized private import of legitimately available rows |
| FantasyPros | Returned “Projections are not available yet”; last-update text still October 2025 | Availability audit; import requires known underlying source family |
| FanScout | Direct server request HTTP 403 | Normalized private import; no implemented/verified native API |
| Basketball-Reference | Direct server request HTTP 403; model is per 36 minutes | Normalized import requires explicit projected minutes and GP |

Yahoo also returned HTTP 429 on a separate public table. No further page harvesting,
login, access change, fingerprint/proxy workaround or paid subscription was attempted.
The tested Yahoo table is a public global player list rendered with a public league's
stat columns. Other teams' ownership, results and roster data are not ingested.
The limited Yahoo scope is deliberate and visible; it is not a complete league-wide feed.

Current verified additional FULL projection sets: **zero**.
Current verified additional PARTIAL sets: **one, Yahoo (25 players)**.
The layer is ready to combine complete current exports and future ESPN projections;
it cannot honestly enable a full eight-stat FBA model from this Yahoo table alone.

## Data routes / privacy

New source rows and blended baselines live only in the existing private Google book:

- `FBA_Projection_Inputs`: normalized private export/import staging.
- `FBA_Projection_Snapshots`: per-source validated data.
- `FBA_Consensus_Baseline`: complete blended player profiles.

No real provider table, private lineup, token or credential is committed in this branch.
`?data=1` is unchanged. The new payload and refresh action use the existing
server-side device-token validation in `matchupMonsterResponseV30_`.
The new menu wrappers require a spreadsheet UI context; their internal helpers end in `_`.
The public GitHub repository and current site access settings are unchanged.

## Import procedure (after a separately authorized release)

1. In the existing book, FBA App → Projections: Import-Tabelle vorbereiten.
2. Paste legitimately obtained projection rows in `FBA_Projection_Inputs` using
   the columns of `projection-import-v44.csv`. This is a normalized interchange
   format, not an assertion that all vendors' native CSVs share this layout.
3. `source_id`: one of espn, yahoo, cbs, lineupexperts, hashtag, fantasypros,
   fanscout, basketballreference. `season_id`: 2027.
4. `player_id` is an ESPN ID (never a vendor ID), or leave blank and provide a full,
   unique name. Accents/punctuation are normalized; initials/fuzzy names are not guessed.
   If both name and ID exist, they must agree.
5. `basis`: per_game, totals, or per_36. Projected GP is mandatory (0 < GP <= 82).
   per_36 additionally requires projected_mpg (0 < MPG <= 48).
6. `snapshot_date` is the date the data was captured, not an invented vendor update
   date. Current preseason imports must be no more than 32 days old. Native Sheets
   Date cells use the book's timezone (America/Los_Angeles in this project).
7. Provide PTS, REB, AST, 3PM, STL, BLK, FGM, FGA, FTM, FTA when available. Leave
   unavailable values empty; 0 is a valid explicit value. FG% alone cannot replace FGA.
8. For a FantasyPros import, `origin_family` must identify its actual single known
   underlying family. A multi-provider aggregate with unknown overlap stays rejected.
   Do not mark a multi-provider blend as a single independent provider.
9. Use Projections: Quellen aktualisieren in the book, or Quellen aktualisieren
   in the authenticated Monster page. Inspect rejected reasons / partial counts.

The existing ESPN scheduled handler calls this refresh at most once per day.
Manual refresh has a 15-minute cooldown. No new external ChatGPT automation or
separate trigger is created. Blocked/import-only providers are not retried via hidden APIs.

## Export preparation without provider-specific code changes

`scripts/prepare-projection-import.mjs` converts CSV, semicolon CSV or TSV through
an explicit JSON column mapping and the **same backend validator**. No network or
spreadsheet writes occur. Example mapping: `projection-import-mapping.example.json`.
Its headers are illustrative, not a verified LineupExperts export schema. Replace
the source, capture date, units and column names after inspecting the real export.
Remove mappings for absent stats; never fill them with zeros. Do not map a vendor
ID to player_id; use full names or confirmed ESPN IDs.

```bash
node scripts/prepare-projection-import.mjs export.csv mapping.json espn-metadata.json prepared.csv
```

Metadata is a JSON array of current ESPN `{player_id, full_name, season_id}` records
(alternatively `{id, fullName}`). The report gives accepted/rejected records and
complete profiles. Any invalid or duplicate player/source record blocks file output;
existing output files are never overwritten. Successfully prepared CSV can then be
pasted into the private input sheet using the procedure above. A source without
GP, shot volumes, verified season or legitimate export remains partial/unavailable.
New vendor export layouts require configuration and validation, not another adapter.
An unsupported file format or changed remote API may still need implementation.

Within refresh, newer same-source snapshots win; on the same date a more complete
import wins over a partial native row. At season freeze, eligibility is checked
against the recorded freeze timestamp: an already stale baseline cannot reactivate.
Once eligible and frozen, it remains usable throughout the season.

## Consensus calculation

- Each available independent source family contributes equal weight PER STAT.
- Yahoo and RotoWire-derived FantasyPros data share one family; identical lineage
  gets at most one contribution per statistic. Newer snapshot wins; at the same
  date the direct source wins over a republished FantasyPros row.
- Shot makes and attempts remain paired. Percentages are calculated from combined
  makes/attempts in the existing engine, not averaged as percentages.
- GP is averaged once per contributing family. Preserve raw meanProjectedGp;
  round to an integer for the unchanged v36 projectedGp contract, and show the rule.
- Each player exposes source IDs/count, independent-family count, per-stat
  contributions and snapshot dates. Counts may differ between players/statistics.
- Only profiles containing ALL ten underlying numeric fields become usable baselines.
  Partial profiles are visible separately, without a fabricated FBA rank.
- Wrong season, missing data, implausible values, ambiguous identity, unknown lineage,
  stale/future/invalid dates and missing per-36 minutes are rejected.
- Before season start, successful refreshes update the consensus. Incomplete fetches
  retain a recent last-known-good source; failures never clear complete baselines.
- On the first confirmed actual game, the consensus baseline freezes. Subsequent
  completed games flow only through the existing v36 actual replacement logic.
  No rolling future-performance learning was introduced.
- Existing ESPN append-only handling for newly appearing players remains intact.
  Late addition of *new consensus sources* after freeze is deliberately not automatic.
- Actuals, final-event IDs, ownership snapshots, completed FBA results, in-progress
  blocks and game schedule are passed through. Missing ownership still blocks.

## UI / validation

The lower Monster sources section now contains a collapsed eight-source inspector,
explicit status/count/reason and optional partial-profile table. Complete Free Agency
profiles show an expandable source breakdown. The existing computed blend of actual
and remaining games is labelled Saison-Endschnitt when actual games exist.

Tests: all five existing test files plus monster-v44-consensus.test.mjs; backend
syntax, complete inline-script parsing and git diff whitespace check. Existing release
assertions updated to v44; obsolete hard-coded “adapter prepared” checks replaced by
checks that activation follows validated private backend data.

Reproduce the live-file parser audit without fetching new data:

```bash
node scripts/audit-projection-files.mjs /path/to/espn.json /path/to/yahoo.html 2026-09-05
node --test tests/*.test.mjs
node --check apps-script/Code.js
git diff --check
```

Raw responses are temporary audit inputs outside the repository. Tests use synthetic
numbers, clearly separated from the observed provider results above.

Browser QA limitation: the Cloud browser rejected the local preview URL and the
isolated data-URL component preview under its URL security policy. No workaround
was attempted after that explicit rejection. No successful visual/browser or iPhone
verification is claimed. The component has syntax/markup and functional VM coverage.

## Remaining release gates

No Apps Script deployment, Google-sheet write, main push or Netlify production
publication has occurred for this change. On release, verify the new authenticated
refresh in actual Apps Script, source statuses and private UI with a legitimately
registered device. A local VM run is not an Apps Script runtime or iPhone test.
