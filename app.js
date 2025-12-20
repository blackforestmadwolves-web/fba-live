// --- Spotify Podcast Embed (oben auf der Seite) ---
const PODCAST_EMBED_URL =
  "https://open.spotify.com/embed/episode/1bAjmdy5kmOiO9yzGitSxg?utm_source=generator";

// --- CSV URLs (dein neues Google Sheet, per gid) ---
const URLS = {
  matchups:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=624759412&single=true&output=csv",
  standings:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=1515860354&single=true&output=csv",
  pr:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=1046538265&single=true&output=csv",
  prp:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=1897631088&single=true&output=csv",
};

const VIEW_TITLES = {
  standings: "Standings",
  pr: "Power Ranking",
  prp: "Power Ranking+",
  matchups: "Matchups",
};

// ✅ Gewünschte Reihenfolge: Matchups -> Standings -> PR -> PR+
const VIEW_ORDER = ["matchups", "standings", "pr", "prp"];

// ✅ Matchups: nur die 4 Matchup-Zeilen anzeigen
const MATCHUPS_MAX_ROWS = 4;

const statusEl = document.getElementById("status");
const titleEl = document.getElementById("title");
const tableWrap = document.getElementById("tableWrap");
const searchEl = document.getElementById("search");
const refreshBtn = document.getElementById("refreshBtn");

// ✅ Start-View: Matchups
let currentView = "matchups";
let currentRows = [];
let currentCols = [];
let teamColGuess = null;

// -----------------------
// Header / Footer UI Fixes
// - Podcast rechts in die Kopfzeile
// - Lila Balken unten (Footer-Optik) entfernen
// -----------------------
function ensureHeaderPodcastAndFooterFixStyles() {
  if (document.getElementById("headerPodcastFooterFixStyles")) return;

  const style = document.createElement("style");
  style.id = "headerPodcastFooterFixStyles";
  style.textContent = `
    /* 1) Podcast rechts in die Kopfzeile (Title-Zeile wird zum Flex-Container) */
    #title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    #title .title-text {
      display: inline-block;
      min-width: 160px;
    }

    /* Podcast Container im Header */
    .podcast-inline {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
      max-width: 420px;
    }

    .podcast-inline-label {
      font-weight: 700;
      font-size: 12px;
      opacity: 0.85;
      white-space: nowrap;
    }

    .podcast-inline iframe {
      border: 0;
      border-radius: 12px;
      overflow: hidden;
      width: 320px;
      height: 80px; /* kompakt in der Kopfzeile */
      background: rgba(255,255,255,0.02);
    }

    @media (max-width: 800px) {
      .podcast-inline {
        width: 100%;
        max-width: 100%;
      }
      .podcast-inline iframe {
        width: 100%;
        height: 96px;
      }
    }

    /* 2) Lila Balken unten entfernen (defensiv) */
    footer,
    .footer,
    #footer,
    .bottom-bar,
    #bottomBar,
    .purple-bar,
    .footer-accent,
    .accent-bar-bottom {
      display: none !important;
    }

    /* Falls es ein ::after/::before Akzent am Body/Main ist */
    body::after,
    body::before,
    main::after,
    main::before {
      background: transparent !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);
}

// -----------------------
// Title-Span Container (wichtig: damit titleEl.textContent NICHT den Podcast löscht)
// -----------------------
function ensureTitleTextContainer() {
  if (!titleEl) return null;

  let span = document.getElementById("titleText");
  if (span) return span;

  span = document.createElement("span");
  span.id = "titleText";
  span.className = "title-text";

  // bestehenden reinen Text im Title übernehmen (ohne Kinder zu löschen)
  const firstTextNode = Array.from(titleEl.childNodes).find(
    (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
  );

  if (firstTextNode) {
    span.textContent = firstTextNode.textContent.trim();
    firstTextNode.textContent = "";
  } else {
    span.textContent = titleEl.textContent.trim() || "FBA Live";
  }

  titleEl.insertBefore(span, titleEl.firstChild);
  return span;
}

// -----------------------
// Podcast Embed (im Header rechts)
// -----------------------
function ensurePodcastEmbedInHeader() {
  ensureHeaderPodcastAndFooterFixStyles();
  ensureTitleTextContainer();

  // schon vorhanden?
  if (document.getElementById("podcastInline")) return;

  const inline = document.createElement("div");
  inline.id = "podcastInline";
  inline.className = "podcast-inline";
  inline.innerHTML = `
    <div class="podcast-inline-label">Podcast</div>
    <iframe
      src="${PODCAST_EMBED_URL}"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title="Spotify Podcast Player"
    ></iframe>
  `;

  // in #title rechts anhängen
  if (titleEl && titleEl.appendChild) {
    titleEl.appendChild(inline);
  } else {
    document.body.prepend(inline);
  }
}

// -----------------------
// Nav-Reihenfolge im DOM anpassen (Matchups -> Standings -> PR -> PR+)
// -----------------------
function reorderNavButtons() {
  const nav = document.querySelector("nav");
  if (!nav) return;

  const buttons = Array.from(nav.querySelectorAll("button"));
  if (!buttons.length) return;

  const indexOf = (view) => {
    const idx = VIEW_ORDER.indexOf(view);
    return idx === -1 ? 999 : idx;
  };

  buttons.sort((a, b) => {
    const av = a.dataset.view || "";
    const bv = b.dataset.view || "";
    return indexOf(av) - indexOf(bv);
  });

  // umhängen in sortierter Reihenfolge
  buttons.forEach((btn) => nav.appendChild(btn));
}

// -----------------------
// Helpers
// -----------------------
function setStatus(msg) {
  statusEl.textContent = msg;
}

function isNonEmpty(v) {
  return String(v ?? "").trim() !== "";
}

function parseNum(val) {
  const n = Number(String(val ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function formatDelta(val) {
  const n = parseNum(val);
  if (!Number.isFinite(n)) return String(val ?? "");
  if (n > 0) return `+${n}`;
  return `${n}`;
}

async function fetchCsv(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (parsed.errors?.length) console.warn("CSV parse warnings:", parsed.errors);

  const rows = (parsed.data || []).filter((r) =>
    Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== "")
  );

  return rows;
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function teamLogoPath(teamName) {
  return `./assets/teams/${encodeURIComponent(teamName)}.png`;
}

// --- Heuristik: Team-Spalte finden (für andere Views) ---
function guessTeamColumn(cols) {
  const preferred = ["team", "Team", "team_name", "team_sorted", "team_name_conf", "Teamname", "Away", "Home"];
  for (const p of preferred) {
    if (cols.includes(p)) return p;
  }
  const maybe = cols.find((c) => c.toLowerCase().includes("team"));
  return maybe || null;
}

// -----------------------
// Standings: FIX auf Spalten I–M (Index 8..12) + harte Benennung
// -----------------------
function getStandingsColumnPlanByIM(rawCols) {
  const im = rawCols.length >= 13 ? rawCols.slice(8, 13) : null;
  const cols = im && im.length ? im : rawCols.slice(0, 5);

  const fixedLabels = ["Team", "Conf", "W", "L", "WIN%"];
  const rename = {};
  cols.forEach((c, idx) => {
    rename[c] = fixedLabels[idx] || c;
  });

  const teamCol = cols[0];
  const wCol = cols[2] || null;
  const lCol = cols[3] || null;
  const winPctCol = cols[4] || null;

  return { cols, rename, teamCol, wCol, lCol, winPctCol };
}

// -----------------------
// Standings Sortierung
// -----------------------
function parseWinPct(val) {
  if (val === null || val === undefined) return NaN;
  const s = String(val).trim().replace("%", "").replace(",", ".");
  const n = Number(s);
  if (Number.isNaN(n)) return NaN;
  return n <= 1 ? n * 100 : n;
}

function sortStandingsRows(rows, plan) {
  const { wCol, lCol, winPctCol } = plan;

  return [...rows].sort((a, b) => {
    const aPct = winPctCol ? parseWinPct(a[winPctCol]) : NaN;
    const bPct = winPctCol ? parseWinPct(b[winPctCol]) : NaN;

    const aPctOk = Number.isFinite(aPct);
    const bPctOk = Number.isFinite(bPct);
    if (aPctOk && bPctOk && aPct !== bPct) return bPct - aPct;
    if (aPctOk && !bPctOk) return -1;
    if (!aPctOk && bPctOk) return 1;

    const aW = wCol ? parseNum(a[wCol]) : NaN;
    const bW = wCol ? parseNum(b[wCol]) : NaN;
    const aWOk = Number.isFinite(aW);
    const bWOk = Number.isFinite(bW);
    if (aWOk && bWOk && aW !== bW) return bW - aW;
    if (aWOk && !bWOk) return -1;
    if (!aWOk && bWOk) return 1;

    const aL = lCol ? parseNum(a[lCol]) : NaN;
    const bL = lCol ? parseNum(b[lCol]) : NaN;
    const aLOk = Number.isFinite(aL);
    const bLOk = Number.isFinite(bL);
    if (aLOk && bLOk && aL !== bL) return aL - bL;
    if (aLOk && !bLOk) return -1;
    if (!aLOk && bLOk) return 1;

    const aT = String(a[plan.teamCol] ?? "");
    const bT = String(b[plan.teamCol] ?? "");
    return aT.localeCompare(bT);
  });
}

// -----------------------
// PR: Spalten umbenennen (Rank, Team, Score)
// PR+: zusätzlich Delta
// -----------------------
function getPrColumnPlan(rawCols, includeDelta = false) {
  const findDeltaCol = () =>
    rawCols.find((c) => String(c).trim().toLowerCase() === "delta") ||
    rawCols.find((c) => String(c).trim().toLowerCase().includes("delta")) ||
    null;

  const rankCol = rawCols[0] || null;
  const teamCol = rawCols[1] || guessTeamColumn(rawCols) || null;
  const scoreCol = rawCols[2] || null;

  let cols = [rankCol, teamCol, scoreCol].filter(Boolean);

  let deltaCol = null;
  if (includeDelta) {
    deltaCol = findDeltaCol() || rawCols[3] || null;
    if (deltaCol) cols = [rankCol, teamCol, scoreCol, deltaCol].filter(Boolean);
  }

  const rename = {};
  if (rankCol) rename[rankCol] = "Rank";
  if (teamCol) rename[teamCol] = "Team";
  if (scoreCol) rename[scoreCol] = "Score";
  if (includeDelta && deltaCol) rename[deltaCol] = "Delta";

  return { cols, rename, teamCol, deltaCol };
}

// -----------------------
// Matchups: nur Away, Score, Home, Projection
// -----------------------
function getMatchupsColumnPlan(rawCols) {
  const findCol = (cands) =>
    rawCols.find((c) => cands.some((x) => String(c).trim().toLowerCase() === x.toLowerCase())) ||
    rawCols.find((c) => cands.some((x) => String(c).trim().toLowerCase().includes(x.toLowerCase()))) ||
    null;

  const awayCol = findCol(["Away", "Away Team", "away", "away_team", "visitor"]);
  const scoreCol = findCol(["Score", "Current", "score", "result"]);
  const homeCol = findCol(["Home", "Home Team", "home", "home_team", "host"]);
  const projCol = findCol(["Projection", "Proj", "projection", "projected", "proj_score"]);

  const cols = [awayCol, scoreCol, homeCol, projCol].filter(Boolean);
  const finalCols = cols.length ? cols : rawCols.slice(0, 4);

  const rename = {};
  if (finalCols[0]) rename[finalCols[0]] = "Away";
  if (finalCols[1]) rename[finalCols[1]] = "Score";
  if (finalCols[2]) rename[finalCols[2]] = "Home";
  if (finalCols[3]) rename[finalCols[3]] = "Projection";

  return {
    cols: finalCols,
    rename,
    awayCol: finalCols[0] || null,
    homeCol: finalCols[2] || null,
  };
}

// ✅ Matchups: Zusatzzeilen (z.B. Notes/Leere) entfernen => nur echte Matchups
function cleanMatchupsRows(rows) {
  if (!rows || !rows.length) return [];
  const rawCols = Object.keys(rows[0]).filter((c) => c && c.trim() !== "");
  const plan = getMatchupsColumnPlan(rawCols);

  // Wenn wir Away/Home sauber identifizieren konnten: nur Zeilen mit beidem behalten
  if (plan.awayCol && plan.homeCol) {
    return rows.filter((r) => isNonEmpty(r[plan.awayCol]) && isNonEmpty(r[plan.homeCol]));
  }

  // Fallback: nur Zeilen behalten, die in den ersten 4 Spalten mindestens 2 Werte haben
  const cols = rawCols.slice(0, 4);
  return rows.filter((r) => cols.reduce((acc, c) => acc + (isNonEmpty(r[c]) ? 1 : 0), 0) >= 2);
}

// -----------------------
// Mobile Tabellen-Optimierung
// -----------------------
function ensureMobileTableStyles() {
  if (document.getElementById("mobileTableStyles")) return;

  const style = document.createElement("style");
  style.id = "mobileTableStyles";
  style.textContent = `
    .table-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }

    .scroll-hint {
      display: none;
      font-size: 12px;
      opacity: 0.75;
      padding: 8px 4px 0;
    }

    /* Wichtig: fixed layout, damit Spaltenbreiten greifen */
    .table-scroll table {
      width: 100%;
      min-width: 520px;
      table-layout: fixed;
    }

    /* --- Team-Spalte generell begrenzen (auch Desktop) --- */
    .table-scroll table th:first-child,
    .table-scroll table td:first-child {
      width: 200px;
      max-width: 200px;
    }

    /* Team-Cell: Text darf nicht die Spalte aufziehen */
    .table-scroll .cell-team { min-width: 0; }
    .table-scroll .cell-team span {
      display: inline-block;
      min-width: 0;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: bottom;
    }

    /* --- Rank-Spalte schmaler (PR & PR+) --- */
    .table-scroll.is-pr table th:first-child,
    .table-scroll.is-pr table td:first-child {
      width: 64px;
      max-width: 64px;
      text-align: center;
    }

    /* --- PR+: Delta-Spalte kompakt (4. Spalte) --- */
    .table-scroll.is-pr table th:nth-child(4),
    .table-scroll.is-pr table td:nth-child(4) {
      width: 80px;
      max-width: 80px;
      text-align: center;
    }

    /* --- Matchups: Abstände kleiner (Away/Score & Home/Projection) --- */
    .table-scroll.is-matchups table th,
    .table-scroll.is-matchups table td {
      padding-left: 4px;
      padding-right: 4px;
    }

    .table-scroll.is-matchups .cell-team img { margin-right: 6px; }
    .table-scroll.is-matchups .cell-team span { max-width: 125px; }

    .table-scroll.is-matchups table th:nth-child(1),
    .table-scroll.is-matchups table td:nth-child(1),
    .table-scroll.is-matchups table th:nth-child(3),
    .table-scroll.is-matchups table td:nth-child(3) {
      width: 175px;
      max-width: 175px;
    }

    .table-scroll.is-matchups table th:nth-child(2),
    .table-scroll.is-matchups table td:nth-child(2),
    .table-scroll.is-matchups table th:nth-child(4),
    .table-scroll.is-matchups table td:nth-child(4) {
      width: 80px;
      max-width: 80px;
      text-align: center;
    }

    @media (max-width: 520px) {
      .scroll-hint { display: block; }
      table th, table td { padding: 8px 10px; font-size: 13px; }

      /* Team-Spalte am Handy nochmal schmaler */
      .table-scroll table th:first-child,
      .table-scroll table td:first-child {
        width: 160px;
        max-width: 160px;
      }

      .table-scroll .cell-team span { max-width: 110px; }

      /* PR/PR+: Rank am Handy extra schmal */
      .table-scroll.is-pr table th:first-child,
      .table-scroll.is-pr table td:first-child {
        width: 52px;
        max-width: 52px;
      }

      /* PR+: Delta am Handy noch kompakter */
      .table-scroll.is-pr table th:nth-child(4),
      .table-scroll.is-pr table td:nth-child(4) {
        width: 70px;
        max-width: 70px;
      }

      /* Matchups am Handy */
      .table-scroll.is-matchups table { min-width: 520px; }

      .table-scroll.is-matchups table th:nth-child(1),
      .table-scroll.is-matchups table td:nth-child(1),
      .table-scroll.is-matchups table th:nth-child(3),
      .table-scroll.is-matchups table td:nth-child(3) {
        width: 155px;
        max-width: 155px;
      }

      .table-scroll.is-matchups table th:nth-child(2),
      .table-scroll.is-matchups table td:nth-child(2),
      .table-scroll.is-matchups table th:nth-child(4),
      .table-scroll.is-matchups table td:nth-child(4) {
        width: 75px;
        max-width: 75px;
      }

      .table-scroll.is-matchups .cell-team span { max-width: 105px; }

      /* Sticky erste Spalte */
      .table-scroll table th:first-child,
      .table-scroll table td:first-child {
        position: sticky;
        left: 0;
        z-index: 3;
        background: rgba(18, 18, 18, 0.95);
        box-shadow: 8px 0 12px rgba(0,0,0,0.25);
      }

      .table-scroll table thead th:first-child { z-index: 4; }
    }
  `;
  document.head.appendChild(style);
}

// -----------------------
// Zusatz: East/West Tabellen UNTER dem bestehenden Standings-Table
// -----------------------
function ensureConfTablesStyles() {
  if (document.getElementById("confTablesStyles")) return;
  const style = document.createElement("style");
  style.id = "confTablesStyles";
  style.textContent = `
    .conf-tables-wrap { margin-top: 16px; }
    .conf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .conf-panel { border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.02); }
    .conf-panel-title { padding: 10px 12px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .conf-panel-body { padding: 0; }
    @media (max-width: 900px) { .conf-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}

function normalizeConf(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s === "e" || s.includes("east") || s.includes("ost")) return "east";
  if (s === "w" || s.includes("west") || s.includes("westen")) return "west";
  return s;
}

function buildTableHtml(rows, colsToUse, rename, teamCol, wCol, lCol, winPctCol) {
  const displayName = (c) => rename[c] || c;

  const thead = `<thead><tr>${colsToUse
    .map((c) => `<th>${escapeHtml(displayName(c))}</th>`)
    .join("")}</tr></thead>`;

  const tbody = `<tbody>${
    rows
      .map((r) => {
        const tds = colsToUse.map((c) => {
          const val = r[c];

          if (teamCol && c === teamCol) {
            const name = String(val ?? "").trim();
            const src = teamLogoPath(name);
            const logoHtml = name
              ? `<img class="team-logo" src="${src}" alt="${escapeHtml(name)}" onerror="this.style.display='none'">`
              : "";
            return `<td><div class="cell-team">${logoHtml}<span>${escapeHtml(name)}</span></div></td>`;
          }

          if ((wCol && c === wCol) || (lCol && c === lCol)) {
            const n = parseNum(val);
            return `<td>${Number.isFinite(n) ? escapeHtml(n) : escapeHtml(val)}</td>`;
          }

          if (winPctCol && c === winPctCol) {
            const pct = parseWinPct(val);
            if (Number.isFinite(pct)) return `<td>${escapeHtml(pct.toFixed(1))}%</td>`;
          }

          return `<td>${escapeHtml(val)}</td>`;
        });

        return `<tr>${tds.join("")}</tr>`;
      })
      .join("")
  }</tbody>`;

  return `
    <div class="table-scroll">
      <table>${thead}${tbody}</table>
    </div>
  `;
}

function appendConferenceTablesUnderStandings(rows, plan) {
  ensureConfTablesStyles();

  const cols = plan.cols;
  const teamCol = plan.teamCol;
  const wCol = plan.wCol;
  const lCol = plan.lCol;
  const winPctCol = plan.winPctCol;

  const confCol = cols[1];

  const eastRows = rows.filter((r) => normalizeConf(r[confCol]) === "east");
  const westRows = rows.filter((r) => normalizeConf(r[confCol]) === "west");

  const confLessCols = [teamCol, wCol, lCol, winPctCol].filter(Boolean);

  const renameConf = {
    [teamCol]: "Team",
    [wCol]: "W",
    [lCol]: "L",
    [winPctCol]: "WIN%",
  };

  const eastHtml = buildTableHtml(eastRows, confLessCols, renameConf, teamCol, wCol, lCol, winPctCol);
  const westHtml = buildTableHtml(westRows, confLessCols, renameConf, teamCol, wCol, lCol, winPctCol);

  const extraHtml = `
    <div class="conf-tables-wrap">
      <div class="conf-grid">
        <div class="conf-panel">
          <div class="conf-panel-title">East</div>
          <div class="conf-panel-body">${eastHtml}</div>
        </div>
        <div class="conf-panel">
          <div class="conf-panel-title">West</div>
          <div class="conf-panel-body">${westHtml}</div>
        </div>
      </div>
    </div>
  `;

  tableWrap.insertAdjacentHTML("beforeend", extraHtml);
}

// -----------------------
// Table render
// -----------------------
function renderTable(rows) {
  if (!rows || !rows.length) {
    tableWrap.innerHTML = "<div style='padding:12px;'>Keine Daten.</div>";
    return;
  }

  const rawCols = Object.keys(rows[0]).filter((c) => c && c.trim() !== "");
  let cols = rawCols;
  let rename = {};
  let plan = null;

  let matchupsPlan = null;
  let prDeltaCol = null;

  if (currentView === "standings") {
    plan = getStandingsColumnPlanByIM(rawCols);
    cols = plan.cols;
    rename = plan.rename || {};
    teamColGuess = plan.teamCol || null;
    rows = sortStandingsRows(rows, plan);
  } else if (currentView === "pr") {
    const prPlan = getPrColumnPlan(rawCols, false);
    cols = prPlan.cols;
    rename = prPlan.rename || {};
    teamColGuess = prPlan.teamCol || guessTeamColumn(cols);
  } else if (currentView === "prp") {
    const prpPlan = getPrColumnPlan(rawCols, true);
    cols = prpPlan.cols;
    rename = prpPlan.rename || {};
    teamColGuess = prpPlan.teamCol || guessTeamColumn(cols);
    prDeltaCol = prpPlan.deltaCol || null;
  } else if (currentView === "matchups") {
    matchupsPlan = getMatchupsColumnPlan(rawCols);
    cols = matchupsPlan.cols;
    rename = matchupsPlan.rename || {};
    teamColGuess = null;
  } else {
    teamColGuess = guessTeamColumn(cols);
  }

  currentCols = cols;

  const displayName = (c) => rename[c] || c;

  const thead = `<thead><tr>${cols
    .map((c) => `<th>${escapeHtml(displayName(c))}</th>`)
    .join("")}</tr></thead>`;

  const tbody = `<tbody>${
    rows
      .map((r) => {
        const tds = cols.map((c) => {
          const val = r[c];

          // Matchups: Away/Home als Team-Cell mit Logo
          if (currentView === "matchups" && matchupsPlan) {
            if (c === matchupsPlan.awayCol || c === matchupsPlan.homeCol) {
              const name = String(val ?? "").trim();
              const src = teamLogoPath(name);
              const logoHtml = name
                ? `<img class="team-logo" src="${src}" alt="${escapeHtml(name)}" onerror="this.style.display='none'">`
                : "";
              return `<td><div class="cell-team">${logoHtml}<span>${escapeHtml(name)}</span></div></td>`;
            }
          }

          // PR+: Delta schöner (+/-)
          if (currentView === "prp" && prDeltaCol && c === prDeltaCol) {
            return `<td>${escapeHtml(formatDelta(val))}</td>`;
          }

          // Standard: Team-Spalte
          if (teamColGuess && c === teamColGuess) {
            const name = String(val ?? "").trim();
            const src = teamLogoPath(name);
            const logoHtml = name
              ? `<img class="team-logo" src="${src}" alt="${escapeHtml(name)}" onerror="this.style.display='none'">`
              : "";
            return `<td><div class="cell-team">${logoHtml}<span>${escapeHtml(name)}</span></div></td>`;
          }

          // Standings: WIN% hübscher
          if (currentView === "standings" && plan && plan.winPctCol && c === plan.winPctCol) {
            const pct = parseWinPct(val);
            if (Number.isFinite(pct)) return `<td>${escapeHtml(pct.toFixed(1))}%</td>`;
          }

          return `<td>${escapeHtml(val)}</td>`;
        });

        return `<tr>${tds.join("")}</tr>`;
      })
      .join("")
  }</tbody>`;

  ensureMobileTableStyles();

  const wrapClass =
    currentView === "pr" || currentView === "prp"
      ? "table-scroll is-pr"
      : currentView === "matchups"
      ? "table-scroll is-matchups"
      : "table-scroll";

  tableWrap.innerHTML = `
    <div class="scroll-hint">Tipp: Seitlich wischen für mehr Spalten</div>
    <div class="${wrapClass}">
      <table>${thead}${tbody}</table>
    </div>
  `;

  if (currentView === "standings" && plan) {
    appendConferenceTablesUnderStandings(rows, plan);
  }
}

// -----------------------
// Suche/Filter
// -----------------------
function applySearch() {
  const q = (searchEl?.value || "").trim().toLowerCase();
  if (!q) {
    renderTable(currentRows);
    return;
  }

  const filtered = currentRows.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))
  );

  renderTable(filtered);
  setStatus(`OK: ${VIEW_TITLES[currentView]} (${filtered.length}/${currentRows.length} Zeilen, gefiltert).`);
}

// -----------------------
// Tabs / Load
// -----------------------
function setActiveTab(viewKey) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.remove("is-active"));
  const btn = document.querySelector(`.tab[data-view="${viewKey}"]`);
  if (btn) btn.classList.add("is-active");
}

async function loadView(viewKey) {
  const url = URLS[viewKey];
  if (!url) return;

  currentView = viewKey;
  setActiveTab(viewKey);

  // WICHTIG: NICHT titleEl.textContent setzen, sonst verschwindet der Podcast
  const titleSpan = ensureTitleTextContainer();
  if (titleSpan) titleSpan.textContent = VIEW_TITLES[viewKey] || "FBA Live";
  ensurePodcastEmbedInHeader();

  setStatus(`Lade ${VIEW_TITLES[viewKey]}…`);
  tableWrap.innerHTML = "";

  try {
    let rows = await fetchCsv(url);

    if (viewKey === "matchups") {
      rows = cleanMatchupsRows(rows).slice(0, MATCHUPS_MAX_ROWS);
    }

    if (viewKey === "standings" && rows.length) {
      const rawCols = Object.keys(rows[0]).filter((c) => c && c.trim() !== "");
      const plan = getStandingsColumnPlanByIM(rawCols);
      rows = sortStandingsRows(rows, plan);
    }

    currentRows = rows;
    renderTable(rows);

    setStatus(`OK: ${VIEW_TITLES[viewKey]} geladen (${rows.length} Zeilen).`);

    if (searchEl) searchEl.value = "";
  } catch (e) {
    console.error(e);
    setStatus(`Fehler: ${e.message}`);
    tableWrap.innerHTML =
      "<div style='padding:12px;'>Fehler beim Laden. Prüfe, ob das Sheet weiterhin „im Web veröffentlicht“ ist.</div>";
  }
}

// --- Events (Listener) ---
document.querySelectorAll("nav button").forEach((btn) => {
  btn.addEventListener("click", () => loadView(btn.dataset.view));
});

refreshBtn?.addEventListener("click", () => loadView(currentView));
searchEl?.addEventListener("input", () => applySearch());

// --- Start ---
reorderNavButtons();
ensureTitleTextContainer();
ensurePodcastEmbedInHeader();
loadView("matchups");
