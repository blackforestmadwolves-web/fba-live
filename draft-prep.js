/* Draft preparation filters and sorts the local view. The ESPN top-100 selection,
   fixed Maik reference, private access checks and player analyses stay shared. */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'fba-draft-preparation-sort-v1';
  const SORTS = Object.freeze({
    adp: 'ESPN ADP · niedrigster zuerst',
    maik: 'FBA-Value · höchster zuerst',
    name: 'Name · A–Z'
  });
  let selectedSort = null;
  let searchQuery = '';
  let openedPlayer = null;

  function normalizeSort(value) {
    return Object.prototype.hasOwnProperty.call(SORTS, value) ? value : 'adp';
  }

  function finiteValue(value) {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function searchText(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/['’\.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function filterPlayers(rows, query) {
    const words = searchText(query).split(/\s+/).filter(Boolean);
    return (Array.isArray(rows) ? rows : []).filter(player => {
      const name = searchText(player.name);
      return words.every(word => name.includes(word));
    });
  }

  function sortPlayers(rows, sort, valueFor) {
    const mode = normalizeSort(sort), valueLookup = typeof valueFor === 'function' ? valueFor : () => null;
    const decorated = (Array.isArray(rows) ? rows : []).map((player, index) => {
      const result = mode === 'maik' ? valueLookup(player) : null;
      return {player, index, value: finiteValue(result && result.primary && result.primary.value)};
    });
    const id = entry => String(entry.player.id || entry.player.playerId || '');
    const name = entry => String(entry.player.name || '');
    const adp = entry => {
      const value = finiteValue(entry.player.adp);
      return value != null && value > 0 ? value : Infinity;
    };
    const compareAdp = (a, b) => adp(a) === adp(b) ? 0 : adp(a) < adp(b) ? -1 : 1;
    decorated.sort((a, b) => {
      if (mode === 'maik') {
        if (a.value == null && b.value != null) return 1;
        if (b.value == null && a.value != null) return -1;
        if (a.value != null && b.value != null && a.value !== b.value) return b.value - a.value;
      }
      if (mode === 'name') {
        const byName = name(a).localeCompare(name(b), 'de', {sensitivity: 'base'});
        if (byName) return byName;
      }
      return compareAdp(a, b) || id(a).localeCompare(id(b), 'en', {numeric: true}) || name(a).localeCompare(name(b), 'de') || a.index - b.index;
    });
    return decorated.map(entry => entry.player);
  }

  function readSort(storage) {
    try { return normalizeSort(storage && storage.getItem(STORAGE_KEY)); }
    catch (_) { return 'adp'; }
  }

  function currentSort() {
    if (selectedSort === null) {
      try { selectedSort = readSort(root.sessionStorage); }
      catch (_) { selectedSort = 'adp'; }
    }
    return selectedSort;
  }

  function valueBasisDescription(rows, valueFor) {
    let history = 0, projection = 0, missing = 0;
    for (const player of rows) {
      const result = valueFor(player), primary = result && result.primary;
      if (!primary || finiteValue(primary.value) == null) missing++;
      else if (primary.kind === 'history') history++;
      else projection++;
    }
    const parts = [];
    if (history) parts.push(`${history} × 2025/26`);
    if (projection) parts.push(`${projection} × Projektion / Ist + Rest 2026/27`);
    if (missing) parts.push(`${missing} ohne vollständigen Wert`);
    return parts.length ? `FBA-Value: ${parts.join(' · ')}. Es zählt der angezeigte Wert je Karte; die Saison steht direkt darunter.` : '';
  }

  function cardsMarkup(rows) {
    return rows.map((player, index) => {
      const id = String(player.id || player.playerId || '');
      // Give the existing renderer a fresh display object. ESPN rank and input
      // data are never overwritten by a change of sort order.
      return draftRadarCard(Object.assign({}, player, {rank: index + 1}), index)
        .replace('<details class="draft-radar-card"', `<details data-draft-player="${E(id)}" data-draft-adp-rank="${E(player.rank || '')}" class="draft-radar-card"`)
        .replace('<span class="draft-radar-rank">', '<span class="draft-radar-rank" title="Position in dieser angezeigten Liste">');
    }).join('');
  }

  function statusText(rows, sort, total) {
    const count = searchQuery.trim() ? `${rows.length} von ${total} Spielern gefunden` : `${total} Spieler verfügbar`;
    return `Top 150 nach ESPN ADP · ${count} · Anzeige: ${SORTS[normalizeSort(sort)]} · # = Position in dieser Liste`;
  }

  function emptyText(total) {
    return total ? 'Kein Spieler gefunden. Suche nach Vor- oder Nachnamen oder leere das Suchfeld. Die Suche umfasst die ESPN-Top-150.' : 'Die Spieler erscheinen, sobald aktuelle ESPN-ADPs verfügbar sind.';
  }

  function trendText() {
    const trend = typeof D !== 'undefined' && D && D.adpTrend || {};
    return `ESPN-ADP täglich · 3T-Trend gegenüber dem Durchschnitt der drei abgeschlossenen Vortage · ${trend.latestDate ? `Stand ${monsterB2bDate(trend.latestDate)}` : 'Tagesstand noch nicht verfügbar'} · Quelle: ESPN Fantasy${root.FBA_DRAFT_PLAYER_CATALOG?.reviewedAt ? ` · Team/Positionen: ESPN-Katalog vom ${monsterB2bDate(root.FBA_DRAFT_PLAYER_CATALOG.reviewedAt)}` : ''}`;
  }

  function pgDraftPreparation() {
    const mode = currentSort(), source = draftRadarData(), rows = filterPlayers(sortPlayers(source, mode, maikValueFor), searchQuery);
    openedPlayer = null;
    return `<section class="draft-preparation" aria-label="Draft-Vorbereitung">${sect('Draft-Vorbereitung', 'Dein Blick auf den Draft')}
      <div class="draft-prep-toolbar"><div><h2>Draft Radar</h2><p>Vergleiche die 150 frühesten ESPN-Draft-Picks und öffne ihre Analysen.</p></div><div class="draft-prep-controls"><label class="draft-prep-search" for="draft-prep-search">Spieler suchen<input id="draft-prep-search" type="search" placeholder="Name eingeben …" value="${E(searchQuery)}" autocomplete="off" spellcheck="false" aria-controls="draft-prep-grid" oninput="draftPreparationSetQuery(this.value)"></label><label class="draft-prep-sort" for="draft-prep-sort">Sortierung<select id="draft-prep-sort" onchange="draftPreparationSetSort(this.value)">${Object.entries(SORTS).map(([key, label]) => `<option value="${key}"${mode === key ? ' selected' : ''}>${E(label)}</option>`).join('')}</select></label></div></div>
      <p class="draft-prep-status" id="draft-prep-status" role="status" aria-live="polite">${E(statusText(rows, mode, source.length))}</p>
      <div id="draft-prep-grid" class="draft-radar">${cardsMarkup(rows)}</div>
      <div id="draft-prep-empty" class="model-note"${rows.length ? ' hidden' : ''}>${E(emptyText(source.length))}</div>
      <div class="draft-radar-foot draft-prep-foot"><span id="draft-prep-basis">${E(valueBasisDescription(rows, maikValueFor))}</span><span>${E(trendText())}</span><span>Quellen und Prüfstand stehen in jeder Analyse. Sortierung und FBA-Value verändern die Auswahl der ESPN-Top-150 nicht.</span></div></section>`;
  }

  function updateView() {
    const doc = root.document, grid = doc && doc.getElementById('draft-prep-grid');
    if (!grid) return;
    const mode = currentSort(), source = draftRadarData(), rows = filterPlayers(sortPlayers(source, mode, maikValueFor), searchQuery);
    const visible = Array.from(grid.querySelectorAll('details[data-draft-player]'));
    const opened = visible.find(node => node.open);
    if (opened) openedPlayer = opened.getAttribute('data-draft-player');
    else if (visible.some(node => node.getAttribute('data-draft-player') === openedPlayer)) openedPlayer = null;
    // Keep both controls in place, including input focus and caret. Analyses
    // retain their state through sorting and temporary removal by a search.
    grid.innerHTML = cardsMarkup(rows);
    for (const node of grid.querySelectorAll('details[data-draft-player]')) node.open = node.getAttribute('data-draft-player') === openedPlayer;
    const status = doc.getElementById('draft-prep-status'), basis = doc.getElementById('draft-prep-basis'), empty = doc.getElementById('draft-prep-empty'), select = doc.getElementById('draft-prep-sort');
    if (status) status.textContent = statusText(rows, mode, source.length);
    if (basis) basis.textContent = valueBasisDescription(rows, maikValueFor);
    if (empty) {
      empty.hidden = rows.length > 0;
      empty.textContent = emptyText(source.length);
    }
    if (select) select.value = mode;
  }

  function draftPreparationSetSort(value) {
    selectedSort = normalizeSort(value);
    try { root.sessionStorage.setItem(STORAGE_KEY, selectedSort); } catch (_) { /* Session memory remains available. */ }
    updateView();
  }

  function draftPreparationSetQuery(value) {
    searchQuery = String(value ?? '');
    updateView();
  }

  const api = Object.freeze({sorts: SORTS, normalizeSort, sortPlayers, filterPlayers, readSort, valueBasisDescription});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FBA_DRAFT_PREP = api;
  root.pgDraftPreparation = pgDraftPreparation;
  root.draftPreparationSetSort = draftPreparationSetSort;
  root.draftPreparationSetQuery = draftPreparationSetQuery;
})(typeof globalThis !== 'undefined' ? globalThis : this);
