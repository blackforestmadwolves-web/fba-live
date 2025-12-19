const URLS = {
  matchups: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=624759412&single=true&output=csv",
  standings: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=1515860354&single=true&output=csv",
  pr: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=1046538265&single=true&output=csv",
  prp: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYWM5IreOqW2E2BAOSczd40_uwSh4678zDw6E7g2aea5_0elsET9EZeMCl7VUWLw/pub?gid=1897631088&single=true&output=csv",
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
loadView("standings");
