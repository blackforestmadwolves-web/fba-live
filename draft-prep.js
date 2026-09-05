/* Draft preparation filters and sorts the local view. The ESPN top-150 selection,
   fixed Maik reference, private access checks and player analyses stay shared. */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'fba-draft-preparation-sort-v1';
  const SORTS = Object.freeze({
    adp: 'ESPN ADP · niedrigster zuerst',
    maik: 'FBA-Value · höchster zuerst',
    merge: 'Merge Value · niedrigster zuerst',
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

  // Both ranks are calculated before search from the same complete player pool.
  // Equal raw values share the mean of their occupied ranks (1, 2.5, 2.5, 4).
  // Missing values have no rank, and never become zero or a one-sided merge.
  function mergeValues(rows, valueFor) {
    const source = Array.isArray(rows) ? rows : [], lookup = typeof valueFor === 'function' ? valueFor : () => null;
    const result = new Map(source.map(player => {
      const primary = lookup(player)?.primary, rawAdp = finiteValue(player.adp);
      return [String(player.id || player.playerId || ''), {
        adp: rawAdp != null && rawAdp > 0 ? rawAdp : null,
        fba: finiteValue(primary?.value), adpRank: null, fbaRank: null, value: null
      }];
    }));
    function rank(key, target, direction) {
      const ordered = [...result.values()].filter(row => row[key] != null).sort((a, b) => direction * (a[key] - b[key]));
      for (let start = 0; start < ordered.length;) {
        let end = start + 1;
        while (end < ordered.length && ordered[end][key] === ordered[start][key]) end++;
        const shared = (start + 1 + end) / 2;
        for (let i = start; i < end; i++) ordered[i][target] = shared;
        start = end;
      }
    }
    rank('adp', 'adpRank', 1); rank('fba', 'fbaRank', -1);
    for (const row of result.values()) {
      if (row.adpRank != null && row.fbaRank != null) row.value = (row.adpRank + row.fbaRank) / 2;
      Object.freeze(row);
    }
    return result;
  }

  function sortPlayers(rows, sort, valueFor, merged) {
    const mode = normalizeSort(sort), valueLookup = typeof valueFor === 'function' ? valueFor : () => null;
    const merges = mode === 'merge' ? merged || mergeValues(rows, valueLookup) : null;
    const decorated = (Array.isArray(rows) ? rows : []).map((player, index) => {
      const result = mode === 'maik' ? valueLookup(player) : null;
      const value = mode === 'merge' ? merges.get(String(player.id || player.playerId || ''))?.value : result && result.primary && result.primary.value;
      return {player, index, value: finiteValue(value)};
    });
    const id = entry => String(entry.player.id || entry.player.playerId || '');
    const name = entry => String(entry.player.name || '');
    const adp = entry => {
      const value = finiteValue(entry.player.adp);
      return value != null && value > 0 ? value : Infinity;
    };
    const compareAdp = (a, b) => adp(a) === adp(b) ? 0 : adp(a) < adp(b) ? -1 : 1;
    decorated.sort((a, b) => {
      if (mode === 'maik' || mode === 'merge') {
        if (a.value == null && b.value != null) return 1;
        if (b.value == null && a.value != null) return -1;
        if (a.value != null && b.value != null && a.value !== b.value) return mode === 'merge' ? a.value - b.value : b.value - a.value;
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

  function mergeMarkup(entry) {
    const format = n => n == null ? '–' : String(Number(n.toFixed(2))).replace('.', ',');
    const ready = entry?.value != null;
    const detail = ready ? `(ADP-Rang ${format(entry.adpRank)} + FBA-Rang ${format(entry.fbaRank)}) ÷ 2` : 'Kein Merge Value: ADP oder vollständiger FBA-Value fehlt';
    return `<span class="draft-merge-value${ready ? '' : ' missing'}" title="${E(detail)} · innerhalb der vollständigen ESPN-Top-150 · niedriger ist besser"><strong>${E(format(entry?.value))}</strong><span>Merge Value</span></span>`;
  }

  function cardsMarkup(rows, merged) {
    return rows.map((player, index) => {
      const id = String(player.id || player.playerId || '');
      // Give the existing renderer a fresh display object. ESPN rank and input
      // data are never overwritten by a change of sort order.
      return draftRadarCard(Object.assign({}, player, {rank: index + 1}), index)
        .replace('<div class="draft-radar-copy">', `${mergeMarkup(merged.get(id))}<div class="draft-radar-copy">`)
        .replace('<div class="draft-radar-report">', `<div class="draft-radar-report"><p class="draft-merge-breakdown">${E(merged.get(id)?.value != null ? `Merge Value: (${merged.get(id).adpRank} ADP-Rang + ${merged.get(id).fbaRank} FBA-Rang) ÷ 2 = ${String(merged.get(id).value).replace('.', ',')}` : 'Merge Value offen: ADP oder vollständiger FBA-Value fehlt.')}</p>`)
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
    const mode = currentSort(), source = draftRadarData(), merged = mergeValues(source, maikValueFor), rows = filterPlayers(sortPlayers(source, mode, maikValueFor, merged), searchQuery);
    openedPlayer = null;
    return `<section class="draft-preparation" aria-label="Draft-Vorbereitung">${sect('Draft-Vorbereitung', 'Dein Blick auf den Draft')}
      <div class="draft-prep-toolbar"><div><h2>Draft Radar</h2><p>Vergleiche die 150 frühesten ESPN-Draft-Picks und öffne ihre Analysen.</p></div><div class="draft-prep-controls"><label class="draft-prep-search" for="draft-prep-search">Spieler suchen<input id="draft-prep-search" type="search" placeholder="Name eingeben …" value="${E(searchQuery)}" autocomplete="off" spellcheck="false" aria-controls="draft-prep-grid" oninput="draftPreparationSetQuery(this.value)"></label><label class="draft-prep-sort" for="draft-prep-sort">Sortierung<select id="draft-prep-sort" onchange="draftPreparationSetSort(this.value)">${Object.entries(SORTS).map(([key, label]) => `<option value="${key}"${mode === key ? ' selected' : ''}>${E(label)}</option>`).join('')}</select></label></div></div>
      <p class="draft-prep-status" id="draft-prep-status" role="status" aria-live="polite">${E(statusText(rows, mode, source.length))}</p>
      <details class="draft-merge-explanation"><summary>So entsteht der Merge Value · 50 % ADP + 50 % FBA</summary><p>(ADP-Rang + FBA-Value-Rang) ÷ 2. Beispiel: Rang 10 und Rang 30 ergeben 20. Niedriger ist besser. Beide Ränge beziehen sich auf die vollständige aktuelle ESPN-Top-150; deine Suche verändert sie nicht.</p><p>Gleiche Ausgangswerte teilen sich den mittleren Rang. Fehlt einer der Werte, bleibt der Merge Value leer und steht bei dieser Sortierung am Ende. Bei gleichem Merge Value entscheidet der niedrigere ADP.</p><p>Der FBA-Rang nutzt den angezeigten FBA-Value und dessen Saisonbasis. Der Merge Value verbindet Draftmarkt und FBA-Profil – er ist keine neue Statistikprognose.</p></details>
      <div id="draft-prep-grid" class="draft-radar">${cardsMarkup(rows, merged)}</div>
      <div id="draft-prep-empty" class="model-note"${rows.length ? ' hidden' : ''}>${E(emptyText(source.length))}</div>
      <div class="draft-radar-foot draft-prep-foot"><span id="draft-prep-basis">${E(valueBasisDescription(rows, maikValueFor))}</span><span>${E(trendText())}</span><span>Quellen und Prüfstand stehen in jeder Analyse. Sortierung und FBA-Value verändern die Auswahl der ESPN-Top-150 nicht.</span></div></section>`;
  }

  function updateView() {
    const doc = root.document, grid = doc && doc.getElementById('draft-prep-grid');
    if (!grid) return;
    const mode = currentSort(), source = draftRadarData(), merged = mergeValues(source, maikValueFor), rows = filterPlayers(sortPlayers(source, mode, maikValueFor, merged), searchQuery);
    const visible = Array.from(grid.querySelectorAll('details[data-draft-player]'));
    const opened = visible.find(node => node.open);
    if (opened) openedPlayer = opened.getAttribute('data-draft-player');
    else if (visible.some(node => node.getAttribute('data-draft-player') === openedPlayer)) openedPlayer = null;
    // Keep both controls in place, including input focus and caret. Analyses
    // retain their state through sorting and temporary removal by a search.
    grid.innerHTML = cardsMarkup(rows, merged);
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

  const api = Object.freeze({sorts: SORTS, normalizeSort, sortPlayers, mergeValues, filterPlayers, readSort, valueBasisDescription});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FBA_DRAFT_PREP = api;
  root.pgDraftPreparation = pgDraftPreparation;
  root.draftPreparationSetSort = draftPreparationSetSort;
  root.draftPreparationSetQuery = draftPreparationSetQuery;
})(typeof globalThis !== 'undefined' ? globalThis : this);
