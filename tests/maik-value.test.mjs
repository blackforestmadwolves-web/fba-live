import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import maik from '../maik-value.js';

const row = (id, patch = {}) => ({id, PTS: 10, '3PM': 1, REB: 4, AST: 3, STL: 1, BLK: 1, FGM: 4, FGA: 8, FTM: 1, FTA: 2, ...patch});
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('eight fixed category weights, no turnover component, and explicit weighted average', () => {
  assert.deepEqual(maik.weights, {PTS: 1, '3PM': 0.8, REB: 1, AST: 1, STL: 0.7, BLK: 0.8, 'FG%': 0.5, 'FT%': 0.5});
  close(Object.values(maik.weights).reduce((sum, value) => sum + value, 0), 6.3);
  const model = maik.createModel([row('a', {PTS: 8, '3PM': 0, STL: 0}), row('b', {PTS: 12, '3PM': 2, STL: 2})]);
  assert.equal(model.ready, true);
  close(model.categories.PTS.mean, 10);
  close(model.categories.PTS.sd, 2);
  const value = maik.score(row('c', {PTS: 12, '3PM': 2, STL: 2, TO: 1000}), model);
  close(value.value, (1 + 0.8 + 0.7) / 6.3);
  close(value.z.PTS, 1);
  close(value.contributions['3PM'], 0.8 / 6.3);
  close(Object.values(value.contributions).reduce((sum, part) => sum + part, 0), value.value);
  close(maik.score(row('c', {PTS: 12}), model).value, 1 / 6.3);
  close(maik.score(row('c', {'3PM': 2}), model).value, 0.8 / 6.3);
  close(maik.score(row('c', {STL: 2}), model).value, 0.7 / 6.3);
  assert.deepEqual(maik.score(row('c', {TO: 0}), model), maik.score(row('c', {TO: 1000}), model));
});

test('shooting impacts use makes and attempts, with correct low and high volume influence', () => {
  const model = maik.createModel([row('a', {FGM: 1, FGA: 4, FTM: 1, FTA: 4}), row('b', {FGM: 3, FGA: 4, FTM: 3, FTA: 4})]);
  close(model.leagueFg, 0.5);
  close(model.leagueFt, 0.5);
  close(model.categories['FG%'].mean, 0);
  close(model.categories['FG%'].sd, 1);
  const low = maik.score(row('c', {FGM: 3, FGA: 4, FTM: 3, FTA: 4}), model);
  const high = maik.score(row('d', {FGM: 6, FGA: 8, FTM: 6, FTA: 8}), model);
  close(high.z['FG%'], 2 * low.z['FG%']);
  close(high.z['FT%'], 2 * low.z['FT%']);
  close(high.value, 2 / 6.3);
  const weightedPool = maik.createModel([row('a', {FGM: 1, FGA: 2, FTM: 1, FTA: 2}), row('b', {FGM: 9, FGA: 10, FTM: 9, FTA: 10})]);
  close(weightedPool.leagueFg, 10 / 12);
  close(weightedPool.leagueFt, 10 / 12);
  assert.notEqual(weightedPool.leagueFg, (0.5 + 0.9) / 2);
});

test('strict complete inputs reject missing, invalid and false-ready data, but allow legitimate zero stats', () => {
  const model = maik.createModel([row('a', {PTS: 8}), row('b', {PTS: 12})]);
  for (const field of maik.fields) {
    for (const invalid of [null, undefined, '', ' ', false, true, -1, '-1', NaN, Infinity, 'NaN', 'Infinity', '0x10', {}, []]) {
      assert.equal(maik.score(row('c', {[field]: invalid}), model), null, `${field}: ${String(invalid)}`);
    }
  }
  assert.equal(maik.score(row('c', {FGM: 9, FGA: 8}), model), null);
  assert.equal(maik.score(row('c', {FTM: 3, FTA: 2}), model), null);
  assert.equal(maik.score(row('c', {projectionReady: false}), model), null);
  assert.equal(maik.score({stats: row('c')}, model), null);
  assert.equal(maik.score(row('c'), {ready: false}), null);
  assert.equal(maik.score(row('c'), null), null);
  assert.deepEqual(maik.score(row('c', {PTS: ' 10.0 ', '3PM': '1e0'}), model), maik.score(row('c'), model));
  const zeros = Object.fromEntries(maik.fields.map(field => [field, 0]));
  assert.ok(maik.score(zeros, model));
  assert.equal(maik.createModel([{id: 'zero', ...zeros}, row('a')]).ready, false);
  assert.equal(maik.createModel([row('a'), row('b', {projectionReady: false})]).ready, false);
  assert.equal(maik.createModel([row('a')]).ready, false);
  assert.equal(maik.createModel([]).ready, false);
});

test('one reference distribution ignores order, ADP, names and ownership; newcomers use the same model', () => {
  const rows = [row('a', {PTS: 8, rank: 1, adp: 1, team: 'Wolves'}), row('b', {PTS: 12, rank: 100, adp: 100, team: ''})];
  const original = JSON.stringify(rows), model = maik.createModel(rows);
  const reordered = maik.createModel(rows.slice().reverse().map(player => ({...player, rank: 999, adp: 999, name: 'Changed', team: 'Pirates'})));
  assert.deepEqual(reordered, model);
  assert.equal(JSON.stringify(rows), original);
  assert.equal(model.byId.has('newcomer'), false);
  close(maik.score(row('newcomer', {PTS: 14}), model).value, 2 / 6.3);
  assert.equal(model.count, 2);
  assert.equal(model.byId.size, 2);
  const many = Array.from({length: 400}, (_, index) => row(String(index), {PTS: index + 1}));
  assert.equal(maik.createModel(many).count, 400, 'no hidden first-360 limit');
  assert.deepEqual(maik.createModel(many).categories, maik.createModel(many.slice().reverse()).categories);
});

test('duplicate IDs are deterministic: equal stats count once; contradictions exclude the identity', () => {
  const a = row('a', {PTS: 8}), b = row('b', {PTS: 12}), c = row('c', {PTS: 10});
  assert.deepEqual(maik.createModel([a, b, {...a, name: 'Alias', PTS: '8'}]), maik.createModel([a, b]));
  const contradictory = [a, b, c, {...a, PTS: 20}];
  const model = maik.createModel(contradictory);
  assert.equal(model.count, 2);
  assert.equal(model.byId.has('a'), false);
  assert.deepEqual(model, maik.createModel(contradictory.slice().reverse()));
  assert.deepEqual(model, maik.createModel([b, c]));
  assert.equal(maik.createModel([a, b, {...a, PTS: null}]).ready, false);
});

test('zero reference variance contributes zero and browser export matches the Node API', () => {
  const model = maik.createModel([row('a'), row('b')]);
  assert.equal(model.ready, true);
  assert.ok(Object.values(model.categories).every(category => category.sd === 0));
  assert.equal(maik.score(row('other', {PTS: 99}), model).value, 0);
  const context = vm.createContext({window: {}});
  vm.runInContext(fs.readFileSync(new URL('../maik-value.js', import.meta.url), 'utf8'), context);
  const api = context.window.FBA_MAIK_VALUE;
  assert.equal(typeof api.createModel, 'function');
  assert.equal(typeof api.score, 'function');
  const reference = [row('a', {PTS: 8}), row('b', {PTS: 12})];
  close(api.score(row('c', {PTS: 14}), api.createModel(reference)).value, maik.score(row('c', {PTS: 14}), maik.createModel(reference)).value);
});
