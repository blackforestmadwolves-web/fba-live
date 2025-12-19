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

const statusEl = document.getElementById("status");
const titleEl = document.getElementById("title");
const tableWrap = document.getElementById("tableWrap");
const searchEl = document.getElementById("search");
const refreshBtn = document.getElementById("refreshBtn");

let currentView = "standings";
let currentRows = [];
let currentCols = [];
let teamColGuess = null;

// -----------------------
// Helpers
// -----------------------
function setStatus(msg) {
  statusEl.textContent = msg;
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
  const preferred = ["team", "Team", "team_name", "team_sorted", "team_name_conf", "Teamname"];
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
  // I–M: I=8 ... M=12  => slice(8,13) nimmt 8,9,10,11,12
  const im = rawCols.length >= 13 ? rawCols.slice(8, 13) : null;

  // Fallback: wenn Sheet weniger Spalten hat, nimm die ersten 5 (damit nichts crasht)
  const cols = im && im.length ? im : rawCols.slice(0, 5);

  // Fixe Anzeige-Namen nach Position (I..M)
  const fixedLabels = ["Team", "Conf", "W", "L", "WIN%"];
  const rename = {};
  cols.forEach((c, idx) => {
    rename[c] = fixedLabels[idx] || c;
  });

  // Team ist immer die erste Spalte (I)
  const teamCol = cols[0];

  // Conf/W/L/WIN% sind fix nach Position
  const confCol = cols[1] || null;
  const wCol = cols[2] || null;
  const lCol = cols[3] || null;
  const winPctCol = cols[4] || null;

  return { cols, rename, teamCol, confCol, wCol, lCol, winPctCol };
}

// -----------------------
// Standings Sortierung (absteigend nach WIN%, dann W, dann L aufsteigend)
// -----------------------
function parseWinPct(val) {
  if (val === null || val === undefined) return NaN;
  const s = String(val).trim().replace("%", "").replace(",", ".");
  const n = Number(s);
  if (Number.isNaN(n)) return NaN;
  return n <= 1 ? n * 100 : n;
}

function parseNum(val) {
  const n = Number(String(val ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function sortStandingsRows(rows, plan) {
  const { wCol, lCol, winPctCol } = plan;

  return [...rows].sort((a, b) => {
    const aPct = winPctCol ? parseWinPct(a[winPctCol]) : NaN;
    const bPct = winPctCol ? parseWinPct(b[winPctCol]) : NaN;

    // 1) WIN% desc (NaN nach hinten)
    const aPctOk = Number.isFinite(aPct);
    const bPctOk = Number.isFinite(bPct);
    if (aPctOk && bPctOk && aPct !== bPct) return bPct - aPct;
    if (aPctOk && !bPctOk) return -1;
    if (!aPctOk && bPctOk) return 1;

    // 2) W desc
    const aW = wCol ? parseNum(a[wCol]) : NaN;
    const bW = wCol ? parseNum(b[wCol]) : NaN;
    const aWOk = Number.isFinite(aW);
    const bWOk = Number.isFinite(bW);
    if (aWOk && bWOk && aW !== bW) return bW - aW;
    if (aWOk && !bWOk) return -1;
    if (!aWOk && bWOk) return 1;

    // 3) L asc
    const aL = lCol ? parseNum(a[lCol]) : NaN;
    const bL = lCol ? parseNum(b[lCol]) : NaN;
    const aLOk = Number.isFinite(aL);
    const bLOk = Number.isFinite(bL);
    if (aLOk && bLOk && aL !== bL) return aL - bL;
    if (aLOk && !bLOk) return -1;
    if (!aLOk && bLOk) return 1;

    // 4) Fallback: Teamname
    const aT = String(a[plan.teamCol] ?? "");
    const bT = String(b[plan.teamCol] ?? "");
    return aT.localeCompare(bT);
  });
}

// -----------------------
// Standings: East/West Split + 2 Tabellen
// -----------------------
function ensureStandingsGridStyles() {
  if (document.getElementById("standings-grid-styles")) return;

  const style = document.createElement("style");
  style.id = "standings-grid-styles";
  style.textContent = `
    .standings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .standings-panel { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }
    .standings-panel .panel-title { padding: 10px 12px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .standings-panel .panel-body { padding: 0; }
    .standings-panel table { width: 100%; }
    .standings-panel thead th { position: sticky; top: 0; backdrop-filter: blur(6px); }
    @media (max-width: 900px) { .standings-grid { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}

function normalizeConf(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  // akzeptiere "East", "E", "Ost" etc.
  if (s === "e" || s.includes("east") || s.includes("ost")) return "east";
  if (s === "w" || s.includes("west") || s.includes("westen")) return "west";
  return s; // falls du mal andere Labels hast
}

function buildTableHtml(rows, cols, rename, teamCol, winPctCol) {
  const displayName = (c) => rename[c] || c;

  const thead = `<thead><tr>${cols
    .map((c) => `<th>${escapeHtml(displayName(c))}</th>`)
    .join("")}</tr></thead>`;

  const tbody = `<tbody>${
    rows
      .map((r) => {
        const tds = cols.map((c) => {
          const val = r[c];

          if (teamCol && c === teamCol) {
            const name = String(val ?? "").trim();
            const src = teamLogoPath(name);
            const logoHtml = name
              ? `<img class="team-logo" src="${src}" alt="${escapeHtml(name)}" onerror="this.style.display='none'">`
              : "";
            return `<td><div class="cell-team">${logoHtml}<span>${escapeHtml(name)}</span></div></td>`;
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

  return `<table>${thead}${tbody}</table>`;
}

function renderStandingsTwoConferences(rows, plan) {
  ensureStandingsGridStyles();

  const cols = plan.cols;
  const rename = plan.rename;
  const teamCol = plan.teamCol;
  const winPctCol = plan.winPctCol;
  const confCol = plan.confCol;

  // wenn confCol fehlt -> fallback: eine Tabelle
  if (!confCol) {
    tableWrap.innerHTML = buildTableHtml(rows, cols, rename, teamCol, winPctCol);
    return;
  }

  const eastRows = rows.filter((r) => normalizeConf(r[confCol]) === "east");
  const westRows = rows.filter((r) => normalizeConf(r[confCol]) === "west");

  // fallback: wenn nicht sauber erkannt wird -> zeig trotzdem alles links und leer rechts
  const leftRows = eastRows.length ? eastRows : rows.filter((r) => String(r[confCol] ?? "").toLowerCase().includes("east"));
  const rightRows = westRows.length ? westRows : rows.filter((r) => String(r[confCol] ?? "").toLowerCase().includes("west"));

  const eastHtml = buildTableHtml(leftRows, cols, rename, teamCol, winPctCol);
  const westHtml = buildTableHtml(rightRows, cols, rename, teamCol, winPctCol);

  tableWrap.innerHTML = `
    <div class="standings-grid">
      <div class="standings-panel">
        <div class="panel-title">East</div>
        <div class="panel-body">${eastHtml}</div>
      </div>
      <div class="standings-panel">
        <div class="panel-title">West</div>
        <div class="panel-body">${westHtml}</div>
      </div>
    </div>
  `;
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

  if (currentView === "standings") {
    plan = getStandingsColumnPlanByIM(rawCols);

    cols = plan.cols;
    rename = plan.rename || {};
    teamColGuess = plan.teamCol || null;

    // Sortierung sicherstellen
    rows = sortStandingsRows(rows, plan);

    // -> Zwei Tabellen East/West
    renderStandingsTwoConferences(rows, plan);
    return; // wichtig: wir rendern hier bereits
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

          if (teamColGuess && c === teamColGuess) {
            const name = String(val ?? "").trim();
            const src = teamLogoPath(name);
            const logoHtml = name
              ? `<img class="team-logo" src="${src}" alt="${escapeHtml(name)}" onerror="this.style.display='none'">`
              : "";
            return `<td><div class="cell-team">${logoHtml}<span>${escapeHtml(name)}</span></div></td>`;
          }

          return `<td>${escapeHtml(val)}</td>`;
        });

        return `<tr>${tds.join("")}</tr>`;
      })
      .join("")
  }</tbody>`;

  tableWrap.innerHTML = `<table>${thead}${tbody}</table>`;
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
  titleEl.textContent = VIEW_TITLES[viewKey] || "FBA Live";

  setStatus(`Lade ${VIEW_TITLES[viewKey]}…`);
  tableWrap.innerHTML = "";

  try {
    let rows = await fetchCsv(url);

    // Standings: schon beim Laden sortieren (damit currentRows sortiert ist)
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

// --- Events ---
document.querySelectorAll("nav button").forEach((btn) => {
  btn.addEventListener("click", () => loadView(btn.dataset.view));
});

refreshBtn?.addEventListener("click", () => loadView(currentView));
searchEl?.addEventListener("input", () => applySearch());

// --- Start ---
loadView("standings");
