/* Punt fit describes which positive FBA strengths a build gives up.
   It never changes the fixed FBA model, projections, ranks or player pool. */
(function (root) {
  'use strict';
  const categories = Object.freeze(['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FG%', 'FT%']);
  function normalizePunts(values) {
    return [...new Set((Array.isArray(values) ? values : []).filter(c => categories.includes(c)))].slice(0, 7);
  }
  function evaluate(primary, punts, weights) {
    if (!primary || !Number.isFinite(primary.value)) return null;
    const selected = normalizePunts(punts), strengths = {};
    for (const cat of categories) {
      if (!Number.isFinite(primary.z?.[cat]) || !Number.isFinite(weights?.[cat]) || weights[cat] <= 0) return null;
      strengths[cat] = Math.max(0, primary.z[cat] * weights[cat]);
    }
    const total = categories.reduce((sum, cat) => sum + strengths[cat], 0);
    const lost = selected.reduce((sum, cat) => sum + strengths[cat], 0);
    const share = total > 0 ? lost / total : 0;
    const byStrength = (a, b) => strengths[b] - strengths[a] || categories.indexOf(a) - categories.indexOf(b);
    return Object.freeze({share, mismatch: lost > 0 && share >= 0.5 - 1e-12,
      lostCategories: Object.freeze(selected.filter(cat => strengths[cat] > 0).sort(byStrength)),
      keptStrengths: Object.freeze(categories.filter(cat => !selected.includes(cat) && strengths[cat] > 0).sort(byStrength))});
  }
  const api = Object.freeze({categories, normalizePunts, evaluate});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FBA_DRAFT_PUNT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
