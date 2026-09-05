import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../maik-value.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const poolSource = fs.readFileSync(new URL('../draft-prototype-data.js', import.meta.url), 'utf8');
const cats = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FG%', 'FT%'];
const statsFields = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FGM', 'FGA', 'FTM', 'FTA'];
const wembyId = '5104157';
const base = {PTS: 25, REB: 12, AST: 4, '3PM': 2, STL: 1, BLK: 3, FGM: 9, FGA: 18, FTM: 5, FTA: 6};
const firstGame = {PTS: 10, REB: 10, AST: 2, '3PM': 1, STL: 1, BLK: 2, FGM: 4, FGA: 15, FTM: 1, FTA: 2};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

function functionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} missing`);
  const open = html.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let index = open; index < html.length; index++) {
    const char = html[index];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`${name} incomplete`);
}

function harness({unlocked = false, data = null} = {}) {
  const saved = new Map(unlocked ? [['test-session', 'test-only-authorized-device']] : []);
  const context = vm.createContext({
    window: {FBA_MAIK_VALUE: core},
    MONSTER_STATE: {data}, MONSTER_SESSION_KEY: 'test-session',
    MONSTER_PROJECTION_STATS: statsFields, DRAFT_CATS: cats,
    localStorage: {getItem: key => saved.get(key) || null},
    Date, JSON, Math, Number, String, Array, Object, Map, Set, RegExp, Error
  });
  vm.runInContext(poolSource, context);
  // The shipped pool is frozen; clone it so same-count update behavior can be
  // tested without changing the production asset or relying on another input.
  context.window.FBA_DRAFT_POOL = context.window.FBA_DRAFT_POOL.map(player => ({...player}));
  for (const name of [
    'draftPool', 'monsterToken', 'monsterUnlocked',
    'monsterProjectionFinite', 'monsterProjectionReadyStatus', 'monsterProjectionUsableNode',
    'monsterProjectionRecordId', 'monsterProjectionBase', 'monsterProjectionRecordIssue',
    'monsterProjectionProfilesReady', 'monsterProjectionEngineState', 'monsterProjectionSeasonFinish'
  ]) vm.runInContext(functionSource(name), context, {filename: `${name}.js`});
  const start = html.indexOf('let MAIK_VALUE_MODEL_CACHE='), end = html.indexOf('function draftedMap(', start);
  assert.ok(start >= 0 && end > start, 'shared Maik view helpers missing');
  vm.runInContext(html.match(/^const E = .+$/m)[0], context);
  vm.runInContext(html.match(/^const de = .+$/m)[0], context);
  vm.runInContext(html.slice(start, end), context, {filename: 'maik-value-view.inline.js'});
  return {
    context,
    setData(value) { context.MONSTER_STATE.data = value; },
    unlock() { saved.set('test-session', 'test-only-authorized-device'); },
    logout() { saved.delete('test-session'); }
  };
}

function projectionData({id = wembyId, name = 'Victor Wembanyama', actual = true} = {}) {
  return {projectionEngine: {
    version: 36, active: true, status: 'READY', season: '2026/27',
    baseline: {status: 'READY', seasonId: 2027, source: 'ESPN'},
    profiles: {status: 'READY', teams: {}},
    actual: {coverageReady: true, completeGames: actual ? 1 : 0, completedEventIds: actual ? ['event-1'] : []},
    players: [{id, name, nba: 'SAS', projectedGp: 70, base: {...base}, actual: {gp: actual ? 1 : 0, totals: actual ? {...firstGame} : {}, byWeek: {}}}]
  }};
}

test('historical reference uses all 374 explicit basis profiles and excludes fallback and placeholders', () => {
  const {context: ctx} = harness();
  const context = ctx.maikValueContext();
  assert.equal(context.model.ready, true);
  assert.equal(context.model.count, 374);
  const sources = ctx.window.FBA_DRAFT_POOL;
  const fallback = sources.filter(player => player.source === 'TESTMODELL · ESPN-Fallback');
  const missing = sources.filter(player => player.projectionReady === false);
  assert.equal(fallback.length, 7);
  assert.equal(missing.length, 119);
  for (const player of [...fallback, ...missing]) {
    assert.equal(ctx.maikValueFor(player).history, null, player.name);
    assert.equal(ctx.maikValueFor(player).current, null, player.name);
    assert.equal(context.model.byId.has(String(player.id)), false, player.name);
  }
  const player = ctx.maikValueFor({id: wembyId});
  assert.equal(player.primary.basis, 'Basis 2025/26');
  assert.equal(player.primary.kind, 'history');
  assert.equal(player.current, null);
  assert.strictEqual(player.history, player.primary);
  const badge = ctx.maikValueMarkup({id: wembyId});
  assert.match(badge, /374 Spielern der ESPN-Basis 2025\/26/);
  assert.match(badge, /class="maik-value-basis">2025\/26<\/span>/,
    'historical badges display the season without the redundant Basis prefix');
  assert.match(badge, /title="Basis 2025\/26 ·/,
    'the full source description remains available in the tooltip');
  assert.match(ctx.maikValueText({id: wembyId}), / · 2025\/26$/);
  assert.match(ctx.maikValueDetailsMarkup({id: wembyId}), /<th>Basis 2025\/26<\/th>/,
    'detail tables keep the explicit distinction between historical basis and projections');
  assert.match(ctx.maikValueDetailsMarkup({id: wembyId}), /Projektion 2026\/27 noch nicht verfügbar/);
});

test('every player representation shares one cached value; reset handles same-count in-place stats changes', () => {
  const {context: ctx} = harness();
  const view = ctx.maikValueContext(), originalModel = view.model;
  const player = ctx.maikValueFor({id: wembyId, team: 'Wolves', pos: 'C'});
  assert.strictEqual(ctx.maikValueFor({playerId: wembyId, team: 'Pirates'}), player);
  assert.strictEqual(ctx.maikValueFor({player_id: wembyId, nba: 'Changed'}), player);
  assert.strictEqual(ctx.maikValueFor(' Victor Wembanyama '), player);
  assert.strictEqual(ctx.maikValueContext(), view);
  ctx.resetMaikValueContext();
  assert.notStrictEqual(ctx.maikValueContext(), view);
  assert.strictEqual(ctx.maikValueContext().model, originalModel, 'unchanged stats reuse the distribution');
  const before = ctx.maikValueFor({id: wembyId}).history.value;
  const count = ctx.window.FBA_DRAFT_POOL.length;
  ctx.window.FBA_DRAFT_POOL.find(row => row.id === wembyId).PTS += 5;
  ctx.resetMaikValueContext();
  assert.equal(ctx.window.FBA_DRAFT_POOL.length, count);
  assert.notStrictEqual(ctx.maikValueContext().model, originalModel);
  assert.notEqual(ctx.maikValueFor({id: wembyId}).history.value, before);
  assert.equal(ctx.maikValueContext().model.count, 374);
});

test('authorized season-finish value uses actual plus remaining games and updates after payload replacement', () => {
  const data = projectionData(), {context: ctx, setData} = harness({unlocked: true, data});
  const result = ctx.maikValueFor({id: wembyId}), originalView = ctx.maikValueContext();
  assert.ok(result.history);
  assert.ok(result.current);
  assert.strictEqual(result.primary, result.current);
  assert.equal(result.current.basis, 'Ist + Rest 2026/27');
  assert.equal(result.current.actualGp, 1);
  assert.equal(result.current.remainingGp, 69);
  close(result.current.stats.PTS, (10 + 69 * 25) / 70);
  close(result.current.stats['FG%'], (4 + 69 * 9) / (15 + 69 * 18));
  close(result.current.value, core.score(result.current.stats, originalView.model).value);
  assert.equal(data.projectionEngine.players[0].base.PTS, 25, 'future baseline stays frozen');
  const next = projectionData({actual: false});
  next.projectionEngine.players[0].base.PTS = 30;
  setData(next);
  assert.notStrictEqual(ctx.maikValueContext(), originalView);
  const changed = ctx.maikValueFor({id: wembyId});
  assert.notEqual(changed.current.value, result.current.value);
  assert.equal(changed.current.basis, 'Projektion 2026/27');
  assert.equal(changed.current.stats.PTS, 30);
  assert.equal(changed.history.value, result.history.value);
});

test('wrong seasons, incomplete coverage and invalid records cannot become current Maik-Values', () => {
  const variants = [
    ['previous baseline season', data => { data.projectionEngine.baseline.seasonId = 2026; }],
    ['wrong engine season', data => { data.projectionEngine.season = '2025/26'; }],
    ['wrong record season', data => { data.projectionEngine.players[0].seasonId = 2026; }],
    ['incomplete actual coverage', data => { data.projectionEngine.actual.coverageReady = false; }],
    ['missing baseline stat', data => { delete data.projectionEngine.players[0].base.PTS; }],
    ['missing baseline projected GP', data => { data.projectionEngine.players[0].projectedGp = 0; }],
    ['impossible shooting', data => { data.projectionEngine.players[0].base.FGM = 99; }],
    ['negative actual count hidden by positive rest', data => { data.projectionEngine.players[0].actual.totals.PTS = -10; }]
  ];
  for (const [label, change] of variants) {
    const data = projectionData(); change(data);
    const {context: ctx} = harness({unlocked: true, data});
    const result = ctx.maikValueFor({id: wembyId});
    assert.equal(result.current, null, label);
    assert.equal(result.primary.kind, 'history', label);
    assert.equal(result.primary.basis, 'Basis 2025/26', label);
  }
});

test('later projection entrants can score without historical stats; duplicate IDs and ambiguous names do not guess', () => {
  const data = projectionData({id: 'new-player', name: 'New Player'});
  const {context: ctx} = harness({unlocked: true, data});
  const newcomer = ctx.maikValueFor('New Player');
  assert.equal(newcomer.history, null);
  assert.ok(newcomer.current);
  assert.equal(ctx.maikValueContext().model.byId.has('new-player'), false);
  close(newcomer.current.value, core.score(newcomer.current.stats, ctx.maikValueContext().model).value);
  assert.equal(ctx.maikValueFor('Victor Wembanyam').primary, null, 'no fuzzy identity guesses');
  assert.equal(ctx.maikValueFor({id: 'unknown', name: 'Victor Wembanyama'}).primary, null, 'explicit unknown ID is not replaced by a name guess');
  ctx.window.FBA_DRAFT_POOL.push({...ctx.window.FBA_DRAFT_POOL[0], id: 'different-id', name: 'Victor Wembanyama'});
  ctx.resetMaikValueContext();
  assert.equal(ctx.maikValueFor('Victor Wembanyama').primary, null, 'duplicate names are ambiguous');
  assert.ok(ctx.maikValueFor({id: wembyId}).history, 'explicit IDs still resolve');
  data.projectionEngine.players.push({...data.projectionEngine.players[0], base: {...base, PTS: 30}});
  ctx.resetMaikValueContext();
  assert.equal(ctx.maikValueFor({id: 'new-player'}).current, null, 'duplicate projected identity is blocked');
});

test('logout discards private current values even while the old private payload stays in memory', () => {
  const data = projectionData(), setup = harness({unlocked: true, data}), ctx = setup.context;
  const before = ctx.maikValueFor({id: wembyId});
  assert.ok(before.current);
  setup.logout();
  const after = ctx.maikValueFor({id: wembyId});
  assert.equal(after.current, null);
  assert.equal(after.primary.kind, 'history');
  assert.notStrictEqual(after, before);
  assert.equal(ctx.maikValueContext().data, null);
  assert.equal(ctx.maikValueContext().records.size, 0);
  assert.doesNotMatch(ctx.maikValueMarkup({id: wembyId}), /Ist \+ Rest/);
  setup.unlock();
  assert.ok(ctx.maikValueFor({id: wembyId}).current);
});

test('badges and detail tables show basis, eight categories and escaped data without turnover scoring', () => {
  const data = projectionData(), {context: ctx} = harness({unlocked: true, data});
  const markup = ctx.maikValueMarkup({id: wembyId});
  assert.match(markup, /data-maik-player="5104157"/);
  assert.match(markup, /Maik-Value/);
  assert.match(markup, /class="maik-value-basis">Ist \+ Rest 2026\/27<\/span>/,
    'a season-finish value must remain distinguishable from actual historical stats');
  assert.match(ctx.maikValueText({id: wembyId}), / · Ist \+ Rest 2026\/27$/);
  const details = ctx.maikValueDetailsMarkup({id: wembyId});
  const tbody = details.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  assert.equal((tbody.match(/<tr\b/g) || []).length, 9, 'one value row plus eight categories');
  for (const category of cats) assert.ok(tbody.includes(`<th>${category}</th>`), category);
  assert.doesNotMatch(tbody, /Turnover|<th>TO<\/th>/);
  assert.match(details, /1 bestätigte Spiele \+ 69 erwartete Restspiele/);
  assert.match(details, /24,8/);
  assert.match(details, /geteilt durch 6,3/);
  assert.match(details, /kein identischer BBM-Score/);
  assert.equal(ctx.maikValueFormat(-0.001), '0,00');
  assert.equal(ctx.maikValueFormat(1.234), '+1,23');
  assert.equal(ctx.maikValueFormat(null), '–');
  const attack = 'new" onclick="alert(1)<';
  const badge = ctx.maikValueMarkup({id: attack});
  assert.ok(badge.includes('new&quot; onclick=&quot;alert(1)&lt;'));
  assert.doesNotMatch(badge, /data-maik-player="new" onclick=/);
  data.projectionEngine.players[0].name = '<script>alert(1)</script>';
  delete data.projectionEngine.players[0].base.PTS;
  ctx.resetMaikValueContext();
  const error = ctx.maikValueDetailsMarkup({id: wembyId});
  assert.doesNotMatch(error, /<script>/);
  assert.ok(error.includes('&lt;script&gt;'), 'data-derived validation message is escaped');
});
