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

  return Object.freeze({weights, fields, createModel, score});
});
