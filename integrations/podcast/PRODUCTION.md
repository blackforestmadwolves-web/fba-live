# FBA Funk production v134

Installed on 2026-09-29 in the existing Apps Script project, web deployment version 60.

## Actual status

- Source bridge v132 live, ESPN + private normalized BBM data.
- Daily editorial automation created; mornings 07:30 Europe/Berlin with hourly retries through 12:30. On Mondays it also prepares the weekly recap after a completed matchup.
- Renderer worker installed every five minutes; operates only 07:00–13:59 Berlin.
- Automatic rendering activated 2026-09-29 after explicit authorization. Restricted ElevenLabs key (100,000-credit cap) is held only in Script Properties. Michael Ellbogen uses Patrick; Tom Winter uses Samer/Sam.
- Trade episode daily-2026-09-29 published at 17:18:05 Europe/Berlin, duration 371.958 seconds, four validated MP3 parts, 5,951,319 bytes.
- Source, inbox, job and status sheets are private. Public feed returns only published episode metadata.

## Configure once, privately

Apps Script → Project settings → Script properties:
ELEVENLABS_API_KEY (restricted key; text-to-speech generation, voice reads, user/subscription reads)
FBA_VOICE_MICHAEL (approved voice ID)
FBA_VOICE_TOM (different approved voice ID)
FBA_HOSTS_APPROVED=true

Then run activateFbaPodcast133. This verifies credit reserve and voice availability before enabling FBA_PODCAST_AUTO_ENABLED. Never place credentials in Sheets, frontend, git, chat or logs. Creating/storing new credentials requires the separate browser access confirmation.

## Workflow

1. Private bridge stores current facts and source timestamps.
2. Worker prepares an atomic two-slot editorial context in FBA_Podcast_Redaktion_v133 (A1 points to prefixed JSON chunks).
3. Scheduled assistant writes only validated, source-linked two-host scripts to FBA_Podcast_Inbox_v133 (A2 chunks, B2 request ID, C2 count, D2 SUBMITTED:<id>).
4. Worker rejects duplicate slots, missing trades, stale sources, unfinished nights, unapproved speakers and scripts outside the word budget.
5. ElevenLabs eleven_v3 dialogue calls use at most 1800 characters. Credit checks reserve twice the next text cost plus 2000 credits. No paid retry after an ambiguous response.
6. Private MP3 chunks are validated and concatenated on complete MPEG frames. Final duration must be 5–10 minutes daily, 17–23 minutes weekly.
7. Only the verified final MP3 gets link-view access; temporary chunks and BBM data stay private. Google Drive audio preview is used in a persistent player dock in the app.
8. Publication after 08:00 Berlin rechecks episode date, completed night and newly discovered mandatory trades. Published status is committed only after the final file has reader access.

## Limits to verify at activation

Storage and voice access verified. The authorized drive.file scope was applied while preserving all existing scopes. No full-drive scope, subscription upgrade or enabled overage. Public web deployment version 60 serves the published-only feed; triggers execute current HEAD. Temporary private credential setup form and route were removed immediately after saving.

Live Eleven v3 validation identified that future_text and previous_request_ids are unsupported for this model despite appearing in the generic endpoint schema. Both fields are omitted. Professional voices use use_pvc_as_ivc. Explicit HTTP 400/401/403/404/422 responses persist a rejected state requiring review; timeouts remain requesting and must never be blindly retried. Successful parts are retained across resumed jobs. Credit reserve can stop generation as the Creator allowance approaches its limit.

ESPN redacts transaction legs for the 2026-09-29 trade. The pilot independently reconstructed Boozer to Lions / Daniels to Unicorns from the September 27 draft, current rosters and identical TRADE acquisition timestamps 33 ms after the accepted event. Its provenance is stored privately with the episode. The background comparison used the same BBM snapshot and swapped those two players in weighted whole-roster projections; this is not a direct Trade Monster result or an optimized-lineup prediction. Future incomplete trades must not be guessed. Historical forecasts not already captured cannot be reconstructed as past predictions. Manager cloning is disabled until documented voice consent and IDs are provided. BBM is background analysis, not a public values feed.

## Deploy safely

The repository root is an OLD frontend snapshot. Do not deploy it. patch-frontend.py expects the complete preserved live v131 deploy (136 files), adds the podcast tab and two assets. Code.gs gets one additional doGet route:
if (p.podcast === 'feed133') return fbaPodcastFeed133_(p);
Install production-core.js + production-gas.js as FBAProduction133.gs alongside all existing files. Do not replace the private BBM module.

## Validation

15 source/production unit tests passed. Real prior ElevenLabs MP3 parsed into 9521 complete frames, 248.7118 seconds; duplicated joined file verified by ffprobe at 497.4236 seconds. Existing rejected voices were used only as local MP3 format fixtures; no old pilot was published.
