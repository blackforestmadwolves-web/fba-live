const URLS = {
  matchups: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=624759412&single=true&output=csv",
  standings: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=1515860354&single=true&output=csv",
  pr: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=1046538265&single=true&output=csv",
  prp: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=1897631088&single=true&output=csv",
  const TEAM_LOGOS = {
  "BlackForest Mad Wolves": "./assets/teams/BlackForest Mad Wolves.png",
  "East Bay Pirates": "./assets/teams/East Bay Pirates.png",
  "Balingen Lions": "./assets/teams/Balingen Lions.png",
  "Toronto Polar Bears": "./assets/teams/Toronto Polar Bears.png",
  "Karlsruhe Unicorns": "./assets/teams/Karlsruhe Unicorns.png",
  "Guardians of Rhinos": "./assets/teams/Guardians of Rhinos.png",
  "Dormettingen Eagles": "./assets/teams/Dormettingen Eagles.png",
  "Wild Cheetahs": "./assets/teams/Wild Cheetahs.png",
};

};

const statusEl = document.getElementById("status");
const tableWrap = document.getElementById("tableWrap");

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

  return parsed.data;
}

function renderTable(rows) {
  if (!rows || !rows.length) {
    tableWrap.innerHTML = "<p>Keine Daten.</p>";
    return;
  }

  const cols = Object.keys(rows[0]).filter((c) => c && c.trim() !== "");

  // Kandidaten für Team-Spalte (wir nehmen die erste, die passt)
  const teamCol = cols.find((c) =>
    ["team", "team_name", "team_sorted", "team_name_conf", "Team"].includes(c)
  );

  const thead = `<thead><tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`;

  const tbodyRows = rows.map((r) => {
    const tds = cols.map((c) => {
      const val = r[c] ?? "";

      if (teamCol && c === teamCol) {
        const name = String(val).trim();
        const logo = TEAM_LOGOS[name];
        const logoHtml = logo ? `<img class="team-logo" src="${logo}" alt="${escapeHtml(name)}" />` : "";
        return `<td><div class="cell-team">${logoHtml}<span>${escapeHtml(name)}</span></div></td>`;
      }

      return `<td>${escapeHtml(val)}</td>`;
    });

    return `<tr>${tds.join("")}</tr>`;
  }).join("");

  tableWrap.innerHTML = `<table>${thead}<tbody>${tbodyRows}</tbody></table>`;
}

  }

  // Entfernt komplett leere Spaltenköpfe (kommt bei Sheets manchmal vor)
  const cols = Object.keys(rows[0]).filter((c) => c && c.trim() !== "");

  const thead = `<thead><tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${
    rows.map((r) => `<tr>${cols.map((c) => `<td>${escapeHtml(r[c] ?? "")}</td>`).join("")}</tr>`).join("")
  }</tbody>`;

  tableWrap.innerHTML = `<table>${thead}${tbody}</table>`;
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadView(viewKey) {
  const url = URLS[viewKey];
  if (!url) return;

  setStatus(`Lade ${viewKey}…`);
  tableWrap.innerHTML = "";

  try {
    const rows = await fetchCsv(url);
    renderTable(rows);
    setStatus(`OK: ${viewKey} geladen (${rows.length} Zeilen).`);
  } catch (e) {
    console.error(e);
    setStatus(`Fehler: ${e.message}`);
    tableWrap.innerHTML = "<p>Fehler beim Laden.</p>";
  }
}

// Navigation
document.querySelectorAll("nav button").forEach((btn) => {
  btn.addEventListener("click", () => loadView(btn.dataset.view));
});

// Start: Standings
currentView = "standings";
setActiveTab(currentView);
loadView(currentView);

function setActiveTab(viewKey) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.remove("is-active"));
  const btn = document.querySelector(`.tab[data-view="${viewKey}"]`);
  if (btn) btn.classList.add("is-active");
}

document.querySelectorAll("nav button").forEach((btn) => {
  btn.classList.add("tab"); // falls du noch alte Buttons hattest
  btn.addEventListener("click", () => {
    currentView = btn.dataset.view;
    setActiveTab(currentView);
    loadView(currentView);
  });
});

document.getElementById("refreshBtn")?.addEventListener("click", () => {
  loadView(currentView);
});
