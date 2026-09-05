/*
 * Maik-Value: a weighted average of eight per-game category z-scores.
 * The caller supplies one explicit, complete reference dataset. This module
 * does not infer a season, treat historical data as a projection, or change
 * fantasy matchup scoring. These are our values, not an exact BBM replica.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FBA_MAIK_VALUE = api;
})(typeof window === "object" ? window : null, function () {
  "use strict";

  const weights = Object.freeze({PTS: 1, "3PM": 0.8, REB: 1, AST: 1, STL: 0.7, BLK: 0.8, "FG%": 0.5, "FT%": 0.5});
  const fields = Object.freeze(["PTS", "3PM", "REB", "AST", "STL", "BLK", "FGM", "FGA", "FTM", "FTA"]);
  const categories = Object.freeze(Object.keys(weights));
  const weightTotal = 6.3;
  const referencePolicy = Object.freeze({version: "fba-104-2025-26-v1", seasonId: 2026, appliesToSeasonId: 2027, teams: 8, rosterSize: 13, minGp: 20, referenceSize: 104});

  function normalize(stats) {
    if (!stats || typeof stats !== "object" || stats.projectionReady === false) return null;
    const normalized = {};
    for (const field of fields) {
      const raw = stats[field];
      if (typeof raw !== "number" && !(typeof raw === "string" && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()))) return null;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) return null;
      normalized[field] = value;
    }
    if (normalized.FGM > normalized.FGA || normalized.FTM > normalized.FTA) return null;
    return normalized;
  }

  function metrics(stats, leagueFg, leagueFt) {
    return {
      PTS: stats.PTS, "3PM": stats["3PM"], REB: stats.REB,
      AST: stats.AST, STL: stats.STL, BLK: stats.BLK,
      "FG%": stats.FGM - leagueFg * stats.FGA,
      "FT%": stats.FTM - leagueFt * stats.FTA
    };
  }

  function score(stats, model) {
    const normalized = normalize(stats);
    if (!normalized || !model || model.ready !== true || !model.categories || !Number.isFinite(model.leagueFg) || !Number.isFinite(model.leagueFt)) return null;
    const values = metrics(normalized, model.leagueFg, model.leagueFt), z = {}, contributions = {};
    let value = 0;
    for (const category of categories) {
      const distribution = model.categories[category];
      if (!distribution || !Number.isFinite(distribution.mean) || !Number.isFinite(distribution.sd) || distribution.sd < 0) return null;
      // A constant reference category has no measured spread; it contributes 0.
      z[category] = distribution.sd > 0 ? (values[category] - distribution.mean) / distribution.sd : 0;
      contributions[category] = weights[category] * z[category] / weightTotal;
      if (!Number.isFinite(contributions[category])) return null;
      value += contributions[category];
    }
    return Number.isFinite(value) ? Object.freeze({value, z: Object.freeze(z), contributions: Object.freeze(contributions)}) : null;
  }

  function createModel(rows) {
    const unique = new Map(), excluded = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
      const rawId = row && row.id;
      const id = typeof rawId === "string" || typeof rawId === "number" && Number.isFinite(rawId) ? String(rawId).trim() : "";
      if (!id) continue;
      const stats = normalize(row);
      if (!stats || !fields.some(field => stats[field] > 0)) { excluded.add(id); continue; }
      const previous = unique.get(id);
      // Equal duplicate rows count once. Conflicting rows never depend on order.
      if (previous && fields.some(field => previous[field] !== stats[field])) excluded.add(id);
      else unique.set(id, stats);
    }
    const reference = Array.from(unique).filter(([id]) => !excluded.has(id)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    const model = {ready: false, count: reference.length, leagueFg: 0, leagueFt: 0, categories: {}, byId: new Map()};
    if (reference.length < 2) return model;
    // Ratios use makes and attempts, not a mean of player percentages. Dividing
    // each term by count before summing is equivalent and reduces overflow risk.
    const average = field => reference.reduce((sum, [, stats]) => sum + stats[field] / reference.length, 0);
    const fga = average("FGA"), fta = average("FTA");
    model.leagueFg = fga ? average("FGM") / fga : 0;
    model.leagueFt = fta ? average("FTM") / fta : 0;
    if (!Number.isFinite(model.leagueFg) || !Number.isFinite(model.leagueFt)) return model;
    const values = reference.map(([, stats]) => metrics(stats, model.leagueFg, model.leagueFt));
    for (const category of categories) {
      const mean = values.reduce((sum, row) => sum + row[category] / values.length, 0);
      const variance = values.reduce((sum, row) => sum + ((row[category] - mean) ** 2) / values.length, 0);
      if (!Number.isFinite(mean) || !Number.isFinite(variance)) return model;
      model.categories[category] = Object.freeze({mean, sd: Math.sqrt(variance)});
    }
    model.categories = Object.freeze(model.categories);
    model.ready = true;
    for (const [id, stats] of reference) {
      const profile = score(stats, model);
      if (!profile) { model.ready = false; model.byId.clear(); return model; }
      model.byId.set(id, Object.freeze(Object.assign({id}, profile)));
    }
    return model;
  }

  // This selection runs against the shipped, completed historical snapshot.
  // Current rosters, ADPs, projections and in-season results are never inputs.
  // The qualifying field supplies a single selection score; the selected 104
  // then define the fixed scale. Do not iterate membership after the refit.
  function createSeasonModel(snapshot) {
    const history = new Map(), referenceIds = [];
    const result = Object.assign(createModel([]), {history, referenceIds, candidateCount: 0, historicalCount: 0, policy: referencePolicy, reason: "Historische Referenz 2025/26 ist nicht eindeutig bestätigt"});
    const source = snapshot && snapshot.source;
    if (!snapshot || snapshot.version !== 1 || snapshot.seasonId !== 2026 || snapshot.seasonType !== 2 || snapshot.statSourceId !== 0 || snapshot.statSplitTypeId !== 0 || snapshot.scoringPeriodId !== 0 || snapshot.final !== true || !Array.isArray(snapshot.players) || !source || source.provider !== "ESPN" || typeof source.url !== "string" || !/^https:\/\/(?:[a-z0-9-]+\.)*espn\.com(?:\/|$)/i.test(source.url) || typeof source.fetchedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(source.fetchedAt) || !Number.isFinite(Date.parse(source.fetchedAt))) return result;
    const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const ended = node => !has(node, "endDate") || typeof node.endDate === "string" && /^\d{4}-\d{2}-\d{2}T/.test(node.endDate) && Number.isFinite(Date.parse(node.endDate)) && Date.parse(node.endDate) <= Date.parse(source.fetchedAt);
    if (!ended(source)) return result;
    if (has(source, "requestedSeason")) {
      const season = source.requestedSeason;
      if (!season || typeof season !== "object" || Array.isArray(season) || has(season, "year") && String(season.year) !== "2026" || !ended(season)) return result;
      if (has(season, "type")) {
        const type = season.type;
        if (!type || typeof type !== "object" || Array.isArray(type) || has(type, "id") && String(type.id) !== "2" || has(type, "type") && String(type.type) !== "2" || !ended(type)) return result;
      }
    }
    const unique = new Map(), excluded = new Set();
    for (const player of snapshot.players) {
      const rawId = player && player.id;
      const id = typeof rawId === "string" || typeof rawId === "number" && Number.isFinite(rawId) ? String(rawId).trim() : "";
      if (!id) continue;
      const totals = player.totals, gp = player.gp;
      const valid = Number.isInteger(gp) && gp > 0 && gp <= 100 && totals && typeof totals === "object" && fields.every(field => Number.isSafeInteger(totals[field]) && totals[field] >= 0) && totals.FGM <= totals.FGA && totals.FTM <= totals.FTA && totals["3PM"] <= totals.FGM && totals.PTS === 2 * totals.FGM + totals["3PM"] + totals.FTM;
      if (!valid) { excluded.add(id); continue; }
      const previous = unique.get(id);
      if (previous && (previous.gp !== gp || fields.some(field => previous.totals[field] !== totals[field]))) excluded.add(id);
      else if (!previous || typeof player.name === "string" && player.name && (typeof previous.name !== "string" || !previous.name || player.name < previous.name)) unique.set(id, player);
    }
    const identities = Array.from(unique).filter(([id]) => !excluded.has(id)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    for (const [id, player] of identities) {
      const row = {id, name: typeof player.name === "string" ? player.name : "", gp: player.gp};
      for (const field of fields) row[field] = player.totals[field] / player.gp;
      history.set(id, Object.freeze(row));
    }
    result.historicalCount = history.size;
    const candidates = Array.from(history.values()).filter(player => player.gp >= referencePolicy.minGp && fields.some(field => player[field] > 0));
    result.candidateCount = candidates.length;
    if (candidates.length < referencePolicy.referenceSize) {
      result.reason = `Historische Referenz unvollständig: ${candidates.length}/${referencePolicy.referenceSize} geeignete Spieler mit mindestens ${referencePolicy.minGp} bestätigten Spielen`;
      return result;
    }
    const selection = createModel(candidates);
    if (!selection.ready || selection.count !== candidates.length) {
      result.reason = "Historische Auswahlwerte sind nicht vollständig berechenbar";
      return result;
    }
    const selected = candidates.slice().sort((a, b) => selection.byId.get(b.id).value - selection.byId.get(a.id).value || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, referencePolicy.referenceSize);
    const model = createModel(selected);
    if (!model.ready || model.count !== referencePolicy.referenceSize) {
      result.reason = "Die 104 festen Referenzspieler sind nicht vollständig berechenbar";
      return result;
    }
    Object.assign(result, model);
    result.referenceIds = Object.freeze(selected.map(player => player.id));
    result.ready = true;
    result.reason = "";
    return result;
  }

  return Object.freeze({weights, fields, createModel, score, referencePolicy, createSeasonModel});
});
