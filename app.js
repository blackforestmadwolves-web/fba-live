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

  // PapaParse kann Warnungen liefern – nicht blockieren, nur loggen
  if (parsed.errors?.length) console.warn("CSV parse warnings:", parsed.errors);

  // Leere Zeilen/Objekte raus
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
  // Deine Dateinamen sind exakt "Teamname.png"
  // Wir encode'n nur für URL-Sicherheit (Leerzeichen etc.)
  return `./assets/teams/${encodeURIComponent(teamName)}.png`;
}

// --- Heuristik: Team-Spalte finden ---
function guessTeamColumn(cols) {
  const preferred = [
    "team",
    "Team",
    "team_name",
    "team_sorted",
    "team_name_conf",
    "Teamname",
  ];
  for (const p of preferred) {
    if (cols.includes(p)) return p;
  }
  // Fallback: erste Spalte, deren Header "team" enthält
  const maybe = cols.find((c) => c.toLowerCase().includes("team"));
  return maybe || null;
}

// --- Table render ---
function renderTable(rows) {
  if (!rows || !rows.length) {
    tableWrap.innerHTML = "<div style='padding:12px;'>Keine Daten.</div>";
    return;
  }

  // Spalten ermitteln (nur nicht-leere Header)
  const cols = Object.keys(rows[0]).filter((c) => c && c.trim() !== "");
  currentCols = cols;

  teamColGuess = guessTeamColumn(cols);

  const thead = `<thead><tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`;

  const tbody = `<tbody>${
    rows
      .map((r) => {
        const tds = cols.map((c) => {
          const val = r[c];

          // Teamzelle: Logo + Name
          if (teamColGuess && c === teamColGuess) {
            const name = String(val ?? "").trim();
            const src = teamLogoPath(name);

            // onerror -> wenn Logo fehlt, einfach ausblenden (kein rotes Broken-Icon)
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

    // initial render
    renderTable(rows);

    // Status
    setStatus(`OK: ${VIEW_TITLES[viewKey]} geladen (${rows.length} Zeilen).`);

    // Suche zurücksetzen
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
