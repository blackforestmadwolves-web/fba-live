import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import pool from '../draft-radar-pool.js';

const latestDate = '2026-09-05';
const metadata = id => ({id: String(id), name: `Player ${String(id).padStart(3, '0')}`, nba: 'DEN', primaryPosition: 'PF', fantasyPositions: 'PF,C', active: true});
const trend = (current, currentDate = latestDate) => ({current, currentDate, previousAverage: current + 1, change: 1, ready: true, sampleDays: 4});
function fixture(count = 182) {
  const players = Array.from({length: count}, (_, index) => metadata(index + 1));
  return {
    payload: {
      appConfig: {seasonCode: 'S26_27', currentSeason: '2026/27'},
      adpTrend: {latestDate, players: Object.fromEntries(players.map(row => [row.id, trend(Number(row.id) + 0.25)]))},
      draftTop25: players.slice(0, 25).map(row => ({...row, adp: Number(row.id) + 0.25, adpDate: latestDate, adpTrend: trend(Number(row.id) + 0.25)}))
    },
    catalog: {seasonId: 2027, reviewedAt: '2026-09-04', source: {url: 'https://example.invalid/fixture'}, players}
  };
}

test('joins the latest full ADP snapshot to 150 unique reviewed players in actual ADP order', () => {
  const {payload, catalog} = fixture();
  payload.adpTrend.players['132'] = trend(0.75);
  catalog.players.reverse();
  const rows = pool.build(payload, catalog);
  assert.equal(rows.length, 150);
  assert.equal(rows[0].id, '132');
  assert.equal(rows[0].adp, 0.75);
  assert.equal(rows[149].id, '150');
  assert.equal(new Set(rows.map(row => row.id)).size, 150);
  assert.ok(rows.every((row, index) => row.rank === index + 1 && row.adpDate === latestDate));
  assert.ok(rows.every(row => row.fantasyPositions === 'PF,C'));
  assert.equal(rows[0].metadataDate, '2026-09-04');
});

test('rejects stale snapshots, missing or nonnumeric ADPs and inactive players without inventing replacements', () => {
  const {payload, catalog} = fixture(14);
  payload.draftTop25 = [];
  payload.adpTrend.players['1'].currentDate = '2026-09-04';
  for (const [index, invalid] of [true, false, '', ' ', null, undefined, NaN, Infinity, 0, -2].entries()) {
    payload.adpTrend.players[String(index + 2)].current = invalid;
  }
  catalog.players.find(row => row.id === '12').active = false;
  delete payload.adpTrend.players['13'];
  payload.adpTrend.players['14'].current = ' 14.25 ';
  const rows = pool.build(payload, catalog);
  assert.deepEqual(rows.map(row => row.id), ['14']);
  assert.equal(rows[0].adp, 14.25);
  assert.equal(rows[0].adpTrend.current, 14.25);
});

test('keeps valid legacy cards when the catalog, explicit season agreement or usable trend payload is absent', () => {
  const {payload, catalog} = fixture();
  assert.equal(pool.build(payload).length, 25);
  assert.equal(pool.build(payload, {...catalog, players: []}).length, 25);
  assert.equal(pool.build(payload, {...catalog, seasonId: 2026}).length, 25);
  assert.equal(pool.build({...payload, appConfig: {seasonCode: 'S25_26', currentSeason: '2025/26'}}, catalog).length, 25);
  assert.equal(pool.build({...payload, appConfig: {seasonCode: 'S26_27', currentSeason: '2025/26'}}, catalog).length, 25);
  assert.equal(pool.build({...payload, adpTrend: {...payload.adpTrend, seasonId: 2026}}, catalog).length, 25);
  assert.equal(pool.build({...payload, appConfig: {}}, catalog).length, 25);
  assert.equal(pool.build({...payload, adpTrend: null}, catalog).length, 25);
  assert.equal(pool.build({...payload, adpTrend: {latestDate, players: []}}, catalog).length, 25);
  assert.equal(pool.build({...payload, adpTrend: {latestDate, players: {}}}, catalog).length, 25);
  assert.equal(pool.build({...payload, adpTrend: {...payload.adpTrend, latestDate: '2026-02-30'}}, catalog).length, 25);
  assert.deepEqual(pool.build(null, catalog), []);
  assert.deepEqual(pool.build({}, null), []);
});

test('only confirmed fantasy positions are exposed and mixed legacy slot IDs are ignored', () => {
  const {payload, catalog} = fixture(5);
  payload.draftTop25 = [];
  Object.assign(catalog.players[0], {fantasyPositions: 'SG,SF,G,F,UTIL,BE,IR', primaryPosition: 'SG'});
  Object.assign(catalog.players[1], {fantasyPositions: ['PG', 'C', 'UTIL', 0, 5], primaryPosition: 'PG'});
  Object.assign(catalog.players[2], {fantasyPositions: '', primaryPosition: '', positions: [0, 1, 2, 3, 4, 5, 6]});
  Object.assign(catalog.players[3], {fantasyPositions: 'pg / SG / pg', primaryPosition: 'PG'});
  Object.assign(catalog.players[4], {fantasyPositions: 'G,F,BE,IR', primaryPosition: 'PF'});
  const rows = pool.build(payload, catalog);
  assert.deepEqual(rows.map(row => row.fantasyPositions), ['SG,SF', 'PG,C', '', 'PG,SG', 'PF']);
  assert.equal(rows[2].primaryPosition, '');
  assert.ok(rows.every(row => !Object.hasOwn(row, 'positions')));
});

test('current legacy metadata can refresh catalog fields without replacing the full current ADP snapshot', () => {
  const {payload, catalog} = fixture(4);
  Object.assign(payload.draftTop25[0], {nba: 'LAL', name: 'Refreshed Player', fantasyPositions: 'PG,SG', primaryPosition: 'PG', adp: 99});
  Object.assign(payload.draftTop25[1], {nba: 'MIA', fantasyPositions: '', primaryPosition: ''});
  Object.assign(payload.draftTop25[2], {nba: 'NYK', adpDate: '2026-09-03'});
  catalog.players[3].active = false;
  const rows = pool.build(payload, catalog);
  assert.deepEqual(rows.map(row => row.id), ['1', '2', '3']);
  assert.equal(rows[0].nba, 'LAL');
  assert.equal(rows[0].name, 'Refreshed Player');
  assert.equal(rows[0].fantasyPositions, 'PG,SG');
  assert.equal(rows[0].adp, 1.25);
  assert.equal(rows[0].metadataDate, latestDate);
  assert.equal(rows[1].nba, 'MIA');
  assert.equal(rows[1].fantasyPositions, 'PF,C');
  assert.equal(rows[2].nba, 'DEN');
  assert.equal(rows[2].metadataDate, '2026-09-04');
});

test('identical duplicates count once; conflicting identities, metadata and ADPs are excluded independent of input order', () => {
  const {payload, catalog} = fixture(5);
  payload.draftTop25 = [];
  catalog.players.push({...catalog.players[0]});
  catalog.players.push({...catalog.players[1], name: 'Wrong Identity'});
  catalog.players.push({...catalog.players[2], active: false});
  payload.adpTrend.players[' 4 '] = trend(44);
  assert.deepEqual(pool.build(payload, catalog).map(row => row.id), ['1', '5']);
  catalog.players.reverse();
  assert.deepEqual(pool.build(payload, catalog).map(row => row.id), ['1', '5']);
  payload.draftTop25 = [metadata(5), {...metadata(5), name: 'Conflicting Fresh Name'}]
    .map(row => ({...row, adp: 5.25, adpDate: latestDate}));
  assert.deepEqual(pool.build(payload, catalog).map(row => row.id), ['1']);
  const legacy = {draftTop25: [
    {...metadata(1), adp: 9}, {...metadata(1), adp: 9},
    {...metadata(2), adp: 3}, {...metadata(2), adp: 4},
    {...metadata(3), adp: true}, {...metadata(4), adp: 1, active: false}
  ]};
  assert.deepEqual(pool.build(legacy).map(row => row.id), ['1']);
  legacy.draftTop25.reverse();
  assert.deepEqual(pool.build(legacy).map(row => row.id), ['1']);
});

test('the public builder caps size at 150, supports smaller requests and never mutates or aliases inputs', () => {
  const {payload, catalog} = fixture();
  const before = JSON.stringify({payload, catalog});
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  freeze(payload); freeze(catalog);
  assert.equal(pool.build(payload, catalog, 8).length, 8);
  assert.equal(pool.build(payload, catalog, 500).length, 150);
  assert.equal(pool.build(payload, catalog, 0).length, 0);
  assert.equal(pool.build(payload, catalog, 'nonsense').length, 150);
  const rows = pool.build(payload, catalog);
  rows[0].adpTrend.current = 1000;
  rows[0].name = 'Changed Output';
  assert.equal(JSON.stringify({payload, catalog}), before);
  assert.equal(pool.build(payload, catalog)[0].adpTrend.current, 1.25);
  const fallback = pool.build(payload);
  fallback[0].adpTrend.current = -500;
  assert.equal(payload.draftTop25[0].adpTrend.current, 1.25);
});

test('browser registration exposes the same pure API without network or private state', () => {
  const context = {window: {}};
  vm.runInNewContext(readFileSync(new URL('../draft-radar-pool.js', import.meta.url), 'utf8'), context);
  assert.equal(typeof context.window.FBA_DRAFT_RADAR_POOL.build, 'function');
  const {payload, catalog} = fixture();
  assert.equal(context.window.FBA_DRAFT_RADAR_POOL.build(payload, catalog).length, 150);
  assert.ok(Object.isFrozen(context.window.FBA_DRAFT_RADAR_POOL));
});
