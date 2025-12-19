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

// Findet die erste passende Spalte aus einer Kandidatenliste
function pickCol(rawCols, candidates) {
  for (const c of candidates) {
    if (rawCols.includes(c)) return c;
  }
  // Fallback: case-insensitive match
  const lower = rawCols.map((c) => c.toLowerCase());
  for (const cand of candidates) {
    const idx = lower.indexOf(String(cand).toLowerCase());
    if (idx !== -1) return rawCols[idx];
  }
  return null;
}

// -----------------------
// Standings: automatische Spalten-Auswahl + hübsche Namen
// -----------------------
function getStandingsColumnPlan(rawCols) {
  // Du willst praktisch H–M: Team, Conf, W, L, WIN%
  // Wir wählen dafür automatisch passende Header aus deinem Sheet.
  const teamCol = pickCol(rawCols, [
    "team_sorted",
    "Team",
    "team",
    "team_name",
    "team_name_conf",
    "Teamname",
  ]);

  const confCol = pickCol(rawCols, [
    "conf_sorted",
    "Conf",
    "conf",
    "conference",
    "Conference",
    "Division",
  ]);

  const wCol = pickCol(rawCols, [
    "W_live_sort",
    "W_live",
    "W",
    "Wins",
    "wins",
    "W_live_week",
  ]);

  const lCol = pickCol(rawCols, [
    "L_live_sort",
    "L_live",
    "L",
    "Losses",
    "losses",
    "L_live_week",
  ]);

  const winPctCol = pickCol(rawCols, [
    "win_pct_sorted",
    "WIN%",
    "Win%",
    "win_pct",
    "win%",
    "pct",
    "win_pct_live",
  ]);

  const cols = [];
  if (teamCol) cols.push(teamCol);
  if (confCol) cols.push(confCol);
  if (wCol) cols.push(wCol);
  if (lCol) cols.push(lCol);
  if (winPctCol) cols.push(winPctCol);

  const rename = {};
  if (teamCol) rename[teamCol] = "Team";
  if (confCol) rename[confCol] = "Conf";
  if (wCol) rename[wCol] = "W";
  if (lCol) rename[lCol] = "L";
  if (winPctCol) rename[winPctCol] = "WIN%";

  const missing = [];
  if (!wCol) missing.push("W");
  if (!lCol) missing.push("L");

  return {
    cols,
    rename,
    teamCol,
    winPctCol,
    missing,
  };
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
  let winPctCol = null;

  // Standings: nur ausgewählte Spalten + rename
  if (currentView === "standings") {
    const plan = getStandingsColumnPlan(rawCols);

    // Falls irgendwas komplett schief geht, fallback auf rawCols
    cols = plan.cols.length ? plan.cols : rawCols;
    rename = plan.rename || {};
    teamColGuess = plan.teamCol || null;
    winPctCol = plan.winPctCol || null;

    if (plan.missing.length) {
      // Kurzer Hinweis im Status, ohne die Seite kaputt zu machen
      setStatus(
        `OK: ${VIEW_TITLES[currentView]} geladen (${rows.length} Zeilen). Hinweis: Spalte(n) nicht gefunden: ${plan.missing.join(
          ", "
        )}.`
      );
    }
  } else {
    // andere Views wie bisher
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

          // Teamzelle: Logo + Name
          if (teamColGuess && c === teamColGuess) {
            const name = String(val ?? "").trim();
            const src = teamLogoPath(name);
            const logoHtml = name
              ? `<img class="team-logo" src="${src}" alt="${escapeHtml(name)}" onerror="this.style.display='none'">`
              : "";
            return `<td><div class="cell-team">${logoHtml}<span>${escapeHtml(name)}</span></div></td>`;
          }

          // Standings: WIN% hübscher formatieren, egal wie die Spalte heißt
          if (currentView === "standings" && winPctCol && c === winPctCol) {
            const num = Number(val);
            if (!Number.isNaN(num) && Number.isFinite(num)) {
              const pct = num <= 1 ? num * 100 : num;
              return `<td>${escapeHtml(pct.toFixed(1))}%</td>`;
            }
          }

          return `<td>${escapeHtml(val)}</td>`;
        });

        return `<tr>${tds.join("")}</tr>`;
      })
      .join("")
  }</tbody>`;

  tableWrap.innerHTML = `<table>${thead}${tbody}</table>`;
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
    const rows = await fetchCsv(url);
    currentRows = rows;

    renderTable(rows);

    // Wenn Standings nicht schon einen Hinweis gesetzt hat:
    if (currentView !== "standings") {
      setStatus(`OK: ${VIEW_TITLES[viewKey]} geladen (${rows.length} Zeilen).`);
    }

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
