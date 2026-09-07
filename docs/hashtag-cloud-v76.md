# Hashtag cloud refresh (2026/27)

The scheduled ChatGPT Work cloud task reads the authenticated, rendered Hashtag table and writes only the private Google Sheets inbox. It does not access a local Mac, export cookies, or publish paid projections. The existing Apps Script job consumes the inbox on its next run; an authenticated projection load also consumes it immediately. Consensus, player mapping, missing-data protection and the preseason freeze use the existing backend rules.

Spreadsheet: `1UcwG__dOLRqFD-Ylnw67pSwMNXR8q0brq5Zw2EZIsoE`.
Inbox: `FBA_Hashtag_Cloud_Inbox`, 901 rows minimum, 8 columns.

| Range | Owner | Meaning |
| --- | --- | --- |
| A1:D1 | Schema | snapshot_id, observed_at, metadata_json, row_json |
| A2 | Cloud task | Unique snapshot ID, letters/numbers/hyphens, max 80 characters |
| B2 | Cloud task | Actual fresh read timestamp, ISO UTC |
| C2 | Cloud task | JSON of sourceUrl, heading, updatedText, options, headers, rowCount |
| D2:D901 | Cloud task | One JSON player row per cell; unused tail cleared |
| F1 / F2 | Backend | import_status / JSON acknowledgement |
| H1 / H2 | Cloud task | fetch_status / JSON of enabled, state, lastAttempt, message |

Write A2:D901 and H2 in ONE atomic Sheets batch. Preserve F2 and the rest of the workbook. Data values must be literal stringValue, never formulas. Validate observed values first. Read the written rectangle back and compare every cell. A submitted inbox is not a merged baseline: the backend acknowledgement in F2 must be READY and refer to the same snapshot ID before claiming server acceptance. Merge then happens during the same normal projection read/refresh. If another newer source read was already stored, SKIPPED is safe and must not overwrite it.

Use the browser skill's cloud browser and secure browserAuth only. Navigate freshly to https://hashtagbasketball.com/import-v4/fantasy-basketball-projections. Never read authentication fields, cookies, hidden app state or perform network requests via browser evaluate. Set visible selects via normal browser interactions: DDSHOW=900, DDGAMES=0, DropDownList1=Off, DDPOS=All, DDTSUM=All, DDDURATION=0 (label must contain 2026-27 Rest of Season), DDRANK=AVG. Wait for each ASP.NET page update before the next action. Read only rendered table ContentPlaceHolder1_GridView1: first row headers, rows containing a[href$="/player"], cell innerText, playerName from that anchor and playerLink from href. Read h5, visible Updated date, select values and labels. Require 100–900 distinct player IDs; normally about 430. Do not trust a partial/free Top 30 view. FG% and FT% cells must include made/attempted volumes.

If sign-in expires, a challenge appears, source changes, or connector access fails, do not overwrite valid data, do not bypass restrictions. When Google Sheets is still available, write only H2 with enabled:true, state:AUTH_REQUIRED or ERROR, actual lastAttempt, and a short non-sensitive message. Notify Maik that reauthentication or repair is required. No success timestamp may advance on failure. Preserve provider_updated_at independently from the read date. Never substitute a cached capture for a fresh read.

The task can run without a local computer. It depends on ChatGPT Work cloud tasks, connected Google Drive, an available cloud browser and a valid Hashtag login. First unattended run must be verified; session expiry can require secure sign-in again. This source is the preseason basis; after the existing season freeze, report FROZEN instead of silently changing the in-season model.
