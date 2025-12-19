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

/**
 * View-spezifische Darstellung
 * - columns: welche Spalten (in dieser Reihenfolge) angezeigt werden sollen
 * - rename:  schöne Spaltennamen
 * - teamCol: welche Spalte als Teamname gilt (für Logos)
 */
const VIEW_CONFIG = {
  standings: {
    // Deine gewünschten Standings-Spalten (entspricht „H–M“ in deinem Setup)
    // Wenn bei dir Header anders heißen: NUR diese Liste + rename anpassen.
    columns: ["team_sorted", "conf_sorted", "W_live_sort", "L_live_sort", "win_pct_sorted"],
    rename: {
      team_sorted: "Team",
      conf_sorted: "Conf",
      W_live_sort: "W",
      L_live_sort: "L",
      win_pct_sorted: "WIN%",
    },
    teamCol: "team_sorted",
  },
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

  // Leere Zeilen raus (mind. ein Feld hat Inhalt)
  const rows = (parsed.data || []).filter((r) =>
    Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== "")
  );

  return rows;
}

// --- Utility: HTML escapen ---
function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- Teamlogo-Pfad: exakt so, wie du es ablegst (Teamname.png) ---
function teamLogoPath(teamName) {
  return `./assets/teams/${encodeURIComponent(teamName)}.png`;
}

// --- Heuristik: Team-Spalte finden ---
function guessTeamColumn(cols) {
  const preferred = ["team", "Team", "team_name", "team_sorted", "team_name_conf", "Teamname"];
  for (const p of preferred) {
    if (cols.includes(p)) return p;
  }
  const maybe = cols.find((c) => c.toLowerCase().includes("team"));
  return maybe || null;
}

function getViewConfig() {
  return VIEW_CONFIG[currentView] || {};
}

function getDisplayName(col) {
  const cfg = getViewConfig();
  return (cfg.rename && cfg.rename[col]) ? cfg.rename[col] : col;
}

function getColumnsForRows(rows) {
  const rawCols = Object.keys(rows[0] || {}).filter((c) => c && c.trim() !== "");
  const cfg = getViewConfig();

  if (cfg.columns && cfg.columns.length) {
    // Nur Spalten, die es wirklich gibt (sonst leere Header vermeiden)
    return cfg.columns.filter((c) => rawCols.includes(c));
  }
  return rawCols;
}

// --- Table render ---
function renderTable(rows) {
  if (!rows || !rows.length) {
    tableWrap.innerHTML = "<div style='padding:12px;'>Keine Daten.</div>";
    return;
  }

  const cols = getColumnsForRows(rows);
  currentCols = cols;

  const cfg = getViewConfig();
  teamColGuess = cfg.teamCol || guessTeamColumn(cols);

  const thead = `<thead><tr>${cols
    .map((c) => `<th>${escapeHtml(getDisplayName(c))}</th>`)
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

          // Optional: WIN% etwas hübscher formatieren, falls numerisch
          if (currentView === "standings" && c === "win_pct_sorted") {
            const num = Number(val);
            if (!Number.isNaN(num) && Number.isFinite(num)) {
              // Wenn es 0.xx ist -> als Prozent
              const pct = num <= 1 ? (num * 100) : num;
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

// --- Suche/Filter (einfach, aber effektiv) ---
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

// --- Tabs active state ---
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
