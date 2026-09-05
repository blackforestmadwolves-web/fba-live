import test from 'node:test';
import assert from 'node:assert/strict';
import punt from '../draft-punt.js';
import value from '../maik-value.js';

const profile = overrides => Object.freeze({value: 1, z: Object.freeze(Object.fromEntries(punt.categories.map(cat => [cat, overrides[cat] ?? -1])))});
const fit = (z, punts) => punt.evaluate(profile(z), punts, value.weights);

test('a specialist loses fit when its strongest category is punted; punting a weakness does not dim it', () => {
  const result = fit({AST: 3, PTS: 1}, ['AST']);
  assert.equal(result.mismatch, true);
  assert.equal(result.share, .75);
  assert.deepEqual(result.lostCategories, ['AST']);
  assert.deepEqual(result.keptStrengths, ['PTS']);
  assert.equal(fit({AST: 3, PTS: 1}, ['FT%']).mismatch, false);
  assert.equal(fit({AST: 3, PTS: 1}, []).share, 0);
});

test('remaining strengths protect versatile players and multiple punts combine their impact', () => {
  const strong = Object.fromEntries(punt.categories.map(cat => [cat, 1]));
  assert.equal(fit(strong, ['AST']).mismatch, false);
  assert.equal(fit({AST: 2, REB: 2, PTS: 3}, ['AST']).mismatch, false);
  assert.equal(fit({AST: 2, REB: 2, PTS: 3}, ['AST', 'REB']).mismatch, true);
  assert.equal(fit({AST: 1, REB: 1}, ['AST']).mismatch, true, 'exactly half meets the disclosed threshold');
  assert.equal(fit({AST: 1, 'FT%': 1}, ['FT%']).mismatch, false, 'FBA category weights, not a count of categories');
});

test('missing profiles stay unknown, genuine zero is valid and all-negative profiles have no strengths to lose', () => {
  for (const bad of [null, undefined, {}, {value: NaN, z: profile({}).z}, {value: 1, z: {AST: 3}}]) {
    assert.equal(punt.evaluate(bad, ['AST'], value.weights), null);
  }
  assert.equal(punt.evaluate(profile({AST: Infinity}), ['AST'], value.weights), null);
  assert.equal(punt.evaluate(profile({AST: 2}), ['AST'], {}), null);
  assert.equal(punt.evaluate({...profile({AST: 2}), value: 0}, ['AST'], value.weights).mismatch, true);
  assert.equal(fit({}, ['AST']).share, 0);
  assert.equal(fit({}, ['AST']).mismatch, false);
});

test('punts validate, deduplicate and leave one category active without mutating inputs', () => {
  const selected = Object.freeze(['AST', 'AST', '<script>', ...punt.categories]);
  assert.deepEqual(punt.normalizePunts(selected), ['AST', 'PTS', 'REB', '3PM', 'STL', 'BLK', 'FG%']);
  assert.deepEqual(punt.normalizePunts('AST'), []);
  const player = profile({AST: 3}), before = JSON.stringify(player);
  punt.evaluate(player, selected, value.weights);
  assert.equal(JSON.stringify(player), before);
});
