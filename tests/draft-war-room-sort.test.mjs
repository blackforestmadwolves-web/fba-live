import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import prep from '../draft-prep.js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const rows = Object.freeze([
  Object.freeze({id: 'a', name: 'Alpha', rank: 1, adp: 20, nba: 'DEN', pos: 'C'}),
  Object.freeze({id: 'b', name: 'Beta', rank: 2, adp: 10, nba: 'DEN', pos: 'PG'}),
  Object.freeze({id: 'c', name: 'Charlie', rank: 3, adp: 30, nba: 'SAS', pos: 'SG'}),
  Object.freeze({id: 'd', name: 'Delta', rank: 4, adp: 5, nba: 'DEN', pos: 'C'})
]);
const lookup = p => ({primary: p.id === 'd' ? null : {value: {a: -1, b: -2, c: 3}[p.id]}});
const ids = rows => Array.from(rows, p => p.id);
function harness() {
  const storage = new Map(), elements = new Map([['draftPlayerSort', {}], ['draftPlayerResults', {}], ['draftSearchClear', {}]]);
  const c = vm.createContext({
    DRAFT_CATS: ['PTS','REB','AST','3PM','STL','BLK','FG%','FT%'], DRAFT_STORAGE_KEY: 'room', DRAFT_MAX_ROUNDS: 13,
    FBA_DRAFT_PREP: prep, draftPool: () => rows, maikValueFor: lookup,
    localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    document: {getElementById: key => elements.get(key), activeElement: elements.get('draftPlayerSort')},
    E: value => String(value ?? ''), de: value => String(value ?? 0),
    espnPlayerHeadshot: id => `${id}.png`, imageFallbackAttr: () => '', playerInitials: name => name[0],
    resetMaikValueContext: () => {}, refreshDraftPage: () => {}, showDraftToast: () => {},
    draftPickMeta: overall => ({overall, round: 1, slot: overall - 1, team: 'Test'}), confirm: () => true
  });
  c.window = c;
  for (const name of ['draftDefaultState', 'loadDraftState', 'saveDraftState', 'resetDraftTest', 'toggleDraftPunt', 'toggleDraftHunt', 'draftNormalize', 'draftPlayerSortMode', 'draftPlayerSortOptions', 'setDraftPlayerSort', 'matchingDraftPlayers', 'draftPlayerStatline', 'draftPlayerResultMarkup', 'draftSearchResultsMarkup', 'draftSearch', 'draftPlayerPoolPanel']) {
    const start = html.indexOf(`function ${name}(`), end = html.indexOf('\nfunction ', start + 1);
    assert.ok(start > 0 && end > start, name);
    vm.runInContext(html.slice(start, end), c);
  }
  c.DRAFT_STATE = c.draftDefaultState();
  c.draftedMap = () => new Map(c.DRAFT_STATE.picks.map(p => [p.playerId, p]));
  c.draftPlayerModeScore = p => ({a: 1, b: 8, c: 4, d: -999})[p.id];
  c.draftPlayerBadges = p => `<span class="maik-value">${lookup(p).primary?.value ?? '–'}</span>`;
  return {c, storage, elements};
}

test('War Room sorts by actual ADP, displayed FBA and full-pool Merge with missing values last', () => {
  const {c} = harness();
  assert.deepEqual(ids(c.matchingDraftPlayers('')), ['d', 'b', 'a', 'c'], 'ADP is not the ESPN rank field');
  c.DRAFT_STATE.sort = 'maik';
  assert.deepEqual(ids(c.matchingDraftPlayers('')), ['c', 'a', 'b', 'd']);
  c.DRAFT_STATE.sort = 'merge';
  assert.deepEqual(ids(c.matchingDraftPlayers('')), ['b', 'a', 'c', 'd'], 'three tied rank means use ADP as tie breaker');
  assert.deepEqual(ids(rows), ['a', 'b', 'c', 'd']);
  assert.deepEqual(rows.map(p => p.rank), [1, 2, 3, 4]);
});

test('search and picks do not shift Merge ranks or mutate other draft state', () => {
  const {c, elements} = harness();
  c.DRAFT_STATE.query = 'DEN';
  c.DRAFT_STATE.picks = [{overall: 1, playerId: 'b'}];
  c.DRAFT_STATE.history = [[{overall: 1, playerId: 'a'}]];
  const before = JSON.stringify({picks: c.DRAFT_STATE.picks, history: c.DRAFT_STATE.history});
  c.setDraftPlayerSort('merge');
  assert.deepEqual(ids(c.matchingDraftPlayers('DEN')), ['a', 'd']);
  const markup = elements.get('draftPlayerResults').innerHTML;
  assert.match(markup, /\(ADP-Rang 3 \+ FBA-Rang 2\) ÷ 2/);
  assert.match(markup, /<b>2,5<\/b><small>Merge Value/);
  assert.match(markup, /selectDraftPlayer\('a'\)/);
  assert.doesNotMatch(markup, /player-result-b/);
  assert.strictEqual(c.document.activeElement, elements.get('draftPlayerSort'));
  assert.equal(c.DRAFT_STATE.query, 'DEN');
  assert.equal(JSON.stringify({picks: c.DRAFT_STATE.picks, history: c.DRAFT_STATE.history}), before);
  assert.equal(elements.get('draftPlayerSort').value, 'merge');
});

test('existing Punt/Hunt strategy remains available and users can explicitly choose another sort', () => {
  const {c} = harness();
  c.toggleDraftPunt('AST');
  assert.equal(c.DRAFT_STATE.sort, 'strategy');
  assert.deepEqual(ids(c.matchingDraftPlayers('')), ['b', 'c', 'a', 'd']);
  c.setDraftPlayerSort('adp');
  assert.deepEqual(ids(c.matchingDraftPlayers('')), ['d', 'b', 'a', 'c']);
  assert.deepEqual(Array.from(c.DRAFT_STATE.punts), ['AST']);
  c.toggleDraftHunt('BLK');
  assert.equal(c.DRAFT_STATE.hunt, 'BLK');
  assert.equal(c.DRAFT_STATE.punts.length, 0);
  assert.equal(c.DRAFT_STATE.sort, 'strategy');
  const markup = c.draftPlayerPoolPanel();
  for (const mode of ['adp','maik','merge','strategy']) assert.match(markup, new RegExp(`value="${mode}"`));
  assert.match(markup, /id="draftPlayerSort"/);
  assert.match(markup, /Vorbereitung hat einen eigenen Top-150-Pool/);
});

test('sort persists with picks, migrates old strategy sessions and resets to ADP', () => {
  const {c, storage} = harness();
  c.DRAFT_STATE.picks = [{overall: 1, playerId: 'b'}];
  c.setDraftPlayerSort('merge');
  const restored = c.loadDraftState();
  assert.equal(restored.sort, 'merge');
  assert.equal(restored.picks[0].playerId, 'b');
  storage.set('room', JSON.stringify({version: 2, picks: [], punts: ['AST']}));
  assert.equal(c.loadDraftState().sort, 'strategy');
  storage.set('room', JSON.stringify({version: 2, picks: [], sort: '<script>'}));
  assert.equal(c.loadDraftState().sort, 'adp');
  assert.equal(c.draftPlayerSortMode({sort: 'constructor'}), 'adp');
  c.resetDraftTest(true);
  assert.equal(c.DRAFT_STATE.sort, 'adp');
  assert.equal(c.DRAFT_STATE.picks.length, 0);
  assert.equal(c.loadDraftState().sort, 'adp');
});
