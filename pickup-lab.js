/* Shared focus for weekly pickups and B2B. Only selected point z-values
 * enter the mean; the global, weighted FBA-Value is a separate player badge. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FBA_PICKUP_LAB = api;
})(typeof window === 'object' ? window : null, function() {
  'use strict';
  const points = Object.freeze(['PTS','REB','AST','3PM','STL','BLK','FG%','FT%']);
  function normalize(input) {
    const requested = Array.isArray(input) ? input : [input];
    return points.filter(point => requested.includes(point));
  }
  function toggle(input, point) {
    if (!points.includes(point)) return [];
    const selected = normalize(input);
    return points.filter(key => key === point ? !selected.includes(key) : selected.includes(key));
  }
  function score(z, input, games) {
    const selected = normalize(input), active = selected.length ? selected : points;
    if (!Number.isFinite(games) || games <= 0 || !z) return null;
    const values = active.map(point => z[point]);
    if (!values.every(value => typeof value === 'number' && Number.isFinite(value))) return null;
    const average = values.reduce((sum, value) => sum + value, 0) / active.length;
    return {average, value:average * games, points:active, weight:1 / active.length};
  }
  function description(input) {
    const selected = normalize(input), active = selected.length ? selected : points;
    const percentage = (100 / active.length).toLocaleString('de-DE', {maximumFractionDigits:2});
    return `${selected.length ? selected.join(' + ') : 'Alle acht FBA-Punkte'} · je ${percentage} %`;
  }
  return Object.freeze({normalize, toggle, score, description});
});
