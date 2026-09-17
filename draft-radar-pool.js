/* Public draft pool: current ESPN ADPs joined to a reviewed, same-season
 * metadata catalog. This module never fetches data or calculates player value.
 * A missing catalog leaves the existing backend radar usable. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FBA_DRAFT_RADAR_POOL = api;
})(typeof window === 'object' ? window : null, function () {
  'use strict';

  const POSITIONS = Object.freeze(['PG', 'SG', 'SF', 'PF', 'C']);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const string = value => typeof value === 'string' ? value.trim() : '';

  function identifier(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? String(value) : '';
    return string(value);
  }

  function number(value) {
    if (typeof value !== 'number' && !(typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const time = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : '';
  }

  function season(value) {
    if (typeof value === 'number') return Number.isInteger(value) && value >= 2000 && value <= 2200 ? value : null;
    const raw = string(value);
    if (/^20\d{2}$/.test(raw)) return Number(raw);
    let match = /^S(\d{2})_(\d{2})$/.exec(raw);
    if (match && Number(match[2]) === Number(match[1]) + 1) return 2000 + Number(match[2]);
    match = /^(20\d{2})[/-](\d{2}|20\d{2})$/.exec(raw);
    if (!match) return null;
    const start = Number(match[1]), end = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
    return end === start + 1 ? end : null;
  }

  function sameSeason(payload, catalog) {
    if (!record(catalog) || !Array.isArray(catalog.players) || !catalog.players.length) return false;
    const target = season(catalog.seasonId);
    if (!target) return false;
    const config = record(payload.appConfig) ? payload.appConfig : {};
    const indicators = [config.seasonId, config.seasonCode, config.currentSeason,
      payload.seasonId, payload.seasonCode, payload.currentSeason,
      record(payload.adpTrend) ? payload.adpTrend.seasonId : null]
      .filter(value => value != null && value !== '');
    // Missing or contradictory season context must not silently mix a catalog
    // into another season. The backend's original radar remains the fallback.
    return indicators.length > 0 && indicators.every(value => season(value) === target);
  }

  function positions(value) {
    const candidates = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s/|]+/) : [];
    const confirmed = new Set(candidates.filter(item => typeof item === 'string').map(item => item.trim().toUpperCase()));
    return POSITIONS.filter(position => confirmed.has(position));
  }

  function metadata(row, metadataDate) {
    if (!record(row)) return null;
    const id = identifier(row.id != null ? row.id : row.playerId), name = string(row.name);
    if (!id || !name) return null;
    const primary = string(row.primaryPosition).toUpperCase();
    let fantasy = positions(row.fantasyPositions);
    if (!fantasy.length && POSITIONS.includes(primary)) fantasy = [primary];
    return {id, name, nba: string(row.nba).toUpperCase(),
      primaryPosition: POSITIONS.includes(primary) ? primary : fantasy[0] || '',
      fantasyPositions: fantasy.join(','), active: row.active !== false,
      metadataDate: date(metadataDate)};
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (record(value)) return Object.fromEntries(Object.keys(value).map(key => [key, clone(value[key])]));
    return value;
  }

  function signature(value) {
    if (Array.isArray(value)) return '[' + value.map(signature).join(',') + ']';
    if (record(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signature(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }

  function uniqueRows(rows, normalize) {
    const byId = new Map(), conflicts = new Set();
    for (const raw of rows) {
      const id = record(raw) ? identifier(raw.id != null ? raw.id : raw.playerId) : '';
      if (!id) continue;
      const value = normalize(raw);
      if (!value) { conflicts.add(id); continue; }
      const previous = byId.get(id);
      if (previous && signature(previous) !== signature(value)) conflicts.add(id);
      else byId.set(id, value);
    }
    for (const id of conflicts) byId.delete(id);
    return {byId, conflicts};
  }

  function compare(a, b) {
    return a.adp - b.adp || a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id, 'en', {numeric: true});
  }

  function ranked(rows, limit) {
    const requested = number(limit);
    const maximum = requested === null ? 150 : Math.max(0, Math.min(150, Math.floor(requested)));
    return rows.sort(compare).slice(0, maximum).map((row, index) => Object.assign({}, row, {rank: index + 1}));
  }

  function legacy(payload, limit) {
    const rows = Array.isArray(payload.draftTop25) ? payload.draftTop25 : [];
    const normalized = uniqueRows(rows, row => {
      const meta = metadata(row, row.metadataDate || row.adpDate), adp = number(row.adp);
      if (!meta || adp === null || adp <= 0) return null;
      return Object.assign(meta, {adp, adpDate: date(row.adpDate), adpTrend: record(row.adpTrend) ? clone(row.adpTrend) : null});
    });
    return ranked(Array.from(normalized.byId.values()).filter(row => row.active), limit);
  }

  function build(payload, catalog, limit = 150) {
    const source = record(payload) ? payload : {};
    const trendPayload = record(source.adpTrend) ? source.adpTrend : {};
    const latestDate = date(trendPayload.latestDate);
    if (!sameSeason(source, catalog) || !latestDate || !record(trendPayload.players) || !Object.keys(trendPayload.players).length) return legacy(source, limit);

    const catalogRows = uniqueRows(catalog.players, row => metadata(row, catalog.reviewedAt));
    const freshRows = uniqueRows((Array.isArray(source.draftTop25) ? source.draftTop25 : [])
      .filter(row => record(row) && row.adpDate === latestDate), row => metadata(row, row.metadataDate || row.adpDate));
    const conflicts = new Set([...catalogRows.conflicts, ...freshRows.conflicts]);
    const metadataById = new Map(catalogRows.byId);
    for (const [id, fresh] of freshRows.byId) {
      const reviewed = metadataById.get(id);
      // An explicit inactive flag must not be undone by the legacy backend's
      // default active:true. Current known fields may refresh reviewed metadata.
      metadataById.set(id, Object.assign({}, reviewed || {}, fresh, {
        nba: fresh.nba || reviewed && reviewed.nba || '',
        primaryPosition: fresh.primaryPosition || reviewed && reviewed.primaryPosition || '',
        fantasyPositions: fresh.fantasyPositions || reviewed && reviewed.fantasyPositions || '',
        active: fresh.active && (!reviewed || reviewed.active)
      }));
    }

    const trendRows = uniqueRows(Object.keys(trendPayload.players).map(key => ({id: key, trend: trendPayload.players[key]})), row => {
      const trend = row.trend, adp = record(trend) ? number(trend.current) : null;
      if (!record(trend) || trend.currentDate !== latestDate || adp === null || adp <= 0) return null;
      return {id: identifier(row.id), adp, adpDate: latestDate, adpTrend: Object.assign(clone(trend), {current: adp})};
    });
    const output = [];
    for (const [id, trend] of trendRows.byId) {
      const meta = metadataById.get(id);
      if (!meta || !meta.active || conflicts.has(id)) continue;
      output.push(Object.assign({}, meta, trend));
    }
    return ranked(output, limit);
  }

  return Object.freeze({build});
});
