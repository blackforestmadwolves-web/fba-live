// Rebuild only from a reviewed, complete ESPN 2025/26 regular-season response.
// This is an offline release step, never a browser or automatic season refresh.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import core from '../maik-value.js';

const [input, output, fetchedAt] = process.argv.slice(2);
assert.ok(input && output && fetchedAt, 'Usage: node scripts/build-maik-history.mjs RAW.json OUTPUT.js FETCHED_AT_ISO');
assert.ok(Number.isFinite(Date.parse(fetchedAt)), 'Explicit retrieval date required');
const rawBytes = fs.readFileSync(input), raw = JSON.parse(rawBytes);
assert.equal(raw.requestedSeason?.year, 2026);
assert.equal(Number(raw.requestedSeason?.type?.id), 2);
assert.equal(raw.requestedSeason?.type?.type, 2);
assert.ok(Number.isFinite(Date.parse(raw.requestedSeason.type.endDate)));
assert.ok(Date.parse(raw.requestedSeason.type.endDate) < Date.parse(fetchedAt), 'Season must be completed');
assert.equal(raw.pagination?.pages, 1, 'Need a complete single-page response');
assert.equal(raw.pagination.count, raw.athletes.length, 'Truncated response');
const names = new Map();
for (const category of raw.categories) {
  assert.ok(!names.has(category.name), 'Duplicate stat category');
  assert.equal(new Set(category.names).size, category.names.length);
  names.set(category.name, category.names);
}
const fieldMap = {
  PTS: ['offensive', 'points'], '3PM': ['offensive', 'threePointFieldGoalsMade'],
  REB: ['general', 'rebounds'], AST: ['offensive', 'assists'],
  STL: ['defensive', 'steals'], BLK: ['defensive', 'blocks'],
  FGM: ['offensive', 'fieldGoalsMade'], FGA: ['offensive', 'fieldGoalsAttempted'],
  FTM: ['offensive', 'freeThrowsMade'], FTA: ['offensive', 'freeThrowsAttempted']
};
const seen = new Set();
const players = raw.athletes.map(entry => {
  const id = String(entry.athlete.id), name = entry.athlete.displayName;
  assert.ok(id && typeof name === 'string' && name.trim());
  assert.ok(!seen.has(id), `Duplicate ESPN ID ${id}`); seen.add(id);
  const values = new Map();
  for (const category of entry.categories) {
    assert.ok(!values.has(category.name), `Duplicate player category ${id}`);
    assert.equal(category.values.length, names.get(category.name)?.length);
    values.set(category.name, category.values);
  }
  const stat = (category, field) => {
    const index = names.get(category)?.indexOf(field);
    assert.ok(index >= 0, `Unknown stat ${category}.${field}`);
    const value = values.get(category)?.[index];
    assert.ok(Number.isSafeInteger(value) && value >= 0, `Invalid actual count ${id}/${field}`);
    return value;
  };
  return {id, name, gp: stat('general', 'gamesPlayed'), totals: Object.fromEntries(
    Object.entries(fieldMap).map(([field, path]) => [field, stat(...path)])
  )};
}).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const snapshot = {
  seasonId: 2026, seasonType: 2, statSourceId: 0, statSplitTypeId: 0, scoringPeriodId: 0,
  final: true, version: 1, revision: 'fba-104-2025-26-v1',
  source: {
    provider: 'ESPN',
    url: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&limit=1000&season=2026&seasontype=2&sort=offensive.avgPoints:desc',
    fetchedAt, requestedSeason: raw.requestedSeason,
    rawSha256: crypto.createHash('sha256').update(rawBytes).digest('hex'),
    normalizationNotes: [
      'Season and regular-season type confirmed by requestedSeason; all pages required.',
      'statSourceId/statSplitTypeId/scoringPeriodId=0 are application tags for actual full-season totals, not native fields in this NBA response.',
      'final=true is a reviewed application tag: regular-season end precedes retrieval.',
      'Numeric category.values mapped through category.names; displayed rounded strings ignored.',
      'Per-game stats use complete integer totals divided by actual games played.',
      'No ownership, current team, injury status or future projection inferred.'
    ], count: raw.pagination.count
  }, players
};
const model = core.createSeasonModel(snapshot);
assert.equal(model.ready, true, model.reason);
assert.equal(model.history.size, players.length, 'Invalid row rejected: do not publish partial history');
const payload = JSON.stringify(snapshot);
const asset = `/* Reviewed ESPN actual regular-season totals 2025/26. Fixed Maik reference input; never a 2026/27 projection. */
(function (root) {
  "use strict";
  const snapshot = ${payload};
  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  const data = freeze(snapshot);
  if (typeof module === "object" && module.exports) module.exports = data;
  if (root) root.FBA_MAIK_HISTORY = data;
})(typeof window === "object" ? window : null);
`;
fs.writeFileSync(output, asset);
console.log(JSON.stringify({output, players: players.length, candidates: model.candidateCount, reference: model.count}));
