import assert from 'node:assert/strict';
import test from 'node:test';
import core from '../maik-value.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-11, `${actual} != ${expected}`);
const snapshot = players => ({
  version: 1, seasonId: 2026, seasonType: 2, statSourceId: 0,
  statSplitTypeId: 0, scoringPeriodId: 0, final: true,
  source: {provider: 'ESPN', url: 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2026/players', fetchedAt: '2026-09-05T12:00:00Z'},
  players
});
const row = (id, gp = 30) => ({id, name: `Player ${id}`, gp, totals: {
  PTS: 11 * gp, '3PM': gp, REB: 4 * gp, AST: 3 * gp,
  STL: gp, BLK: gp, FGM: 4 * gp, FGA: 8 * gp, FTM: 2 * gp, FTA: 3 * gp
}});
const uniform = count => Array.from({length: count}, (_, index) => row(String(index).padStart(3, '0')));
function varied() {
  let seed = 47;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  return Array.from({length: 145}, (_, index) => {
    const FGM = Math.floor(random() * 11), FGA = FGM + Math.floor(random() * 12) + 1;
    const FTM = Math.floor(random() * 7), FTA = FTM + Math.floor(random() * 5);
    const threes = Math.floor(random() * (FGM + 1));
    return {id: String(index).padStart(3, '0'), name: `Player ${index}`, gp: 30, totals: {
      PTS: (2 * FGM + threes + FTM) * 30, '3PM': threes * 30,
      REB: Math.floor(random() * 13) * 30, AST: Math.floor(random() * 11) * 30,
      STL: Math.floor(random() * 4) * 30, BLK: Math.floor(random() * 4) * 30,
      FGM: FGM * 30, FGA: FGA * 30, FTM: FTM * 30, FTA: FTA * 30
    }};
  });
}

test('fixed 8 × 13 reference is fit once; final values retain the shared weighted scale', () => {
  const input = snapshot(varied()), original = JSON.stringify(input), model = core.createSeasonModel(input);
  assert.equal(model.ready, true);
  assert.equal(model.count, 104);
  assert.equal(model.candidateCount, 145);
  assert.equal(model.historicalCount, 145);
  assert.equal(model.history.size, 145);
  assert.equal(model.byId.size, 104);
  assert.deepEqual(model.policy, {version: 'fba-104-2025-26-v1', seasonId: 2026, appliesToSeasonId: 2027, teams: 8, rosterSize: 13, minGp: 20, referenceSize: 104});
  assert.ok(Object.isFrozen(model.policy));
  assert.ok(Object.isFrozen(model.referenceIds));
  close(Array.from(model.byId.values()).reduce((sum, profile) => sum + profile.value, 0) / 104, 0);
  const first = model.history.get('004'), profile = core.score(first, model);
  close(profile.value, Object.keys(core.weights).reduce((sum, category) => sum + core.weights[category] * profile.z[category], 0) / 6.3);
  assert.ok(model.referenceIds.includes('015'), 'the one-pass selection includes this boundary player');
  assert.ok(!model.referenceIds.includes('058'), 'the one-pass selection excludes this boundary player');
  const finalRanking = Array.from(model.history.values()).sort((a, b) => core.score(b, model).value - core.score(a, model).value || (a.id < b.id ? -1 : 1)).slice(0, 104).map(player => player.id);
  assert.ok(finalRanking.includes('058') && !finalRanking.includes('015'), 'a refit changes this boundary: membership must not be iterated');
  assert.equal(JSON.stringify(input), original, 'the source snapshot is never mutated');
});

test('the 20-game requirement affects selection, while small samples and genuine zeros remain evaluable', () => {
  const players = varied(), small = row('small', 19), zero = row('zero', 1);
  for (const field of core.fields) zero.totals[field] = 0;
  const twenty = row('twenty', 20), eightyThree = row('traded', 83);
  const model = core.createSeasonModel(snapshot([...players, small, zero, twenty, eightyThree]));
  assert.equal(model.ready, true);
  assert.equal(model.historicalCount, 149);
  assert.equal(model.candidateCount, 147);
  assert.ok(model.history.has('small'));
  assert.ok(model.history.has('zero'));
  assert.ok(model.history.has('traded'), 'regular-season trades can produce more than 82 player appearances');
  assert.ok(!model.referenceIds.includes('small') && !model.referenceIds.includes('zero'));
  assert.ok(core.score(model.history.get('small'), model));
  assert.ok(core.score(model.history.get('zero'), model));
  const unchanged = core.createSeasonModel(snapshot([...players, small, zero]));
  assert.deepEqual(unchanged.referenceIds, core.createSeasonModel(snapshot(players)).referenceIds);
  assert.deepEqual(unchanged.categories, core.createSeasonModel(snapshot(players)).categories);
});

test('missing GP, invalid totals and contradictory identities never enter history or selection', () => {
  const invalid = [
    ['missing-gp', player => { delete player.gp; }],
    ['zero-gp', player => { player.gp = 0; }],
    ['text-gp', player => { player.gp = '30'; }],
    ['negative-gp', player => { player.gp = -1; }],
    ['fractional-gp', player => { player.gp = 1.5; }],
    ['implausible-gp', player => { player.gp = 101; }],
    ['missing-total', player => { delete player.totals.AST; }],
    ['fractional-total', player => { player.totals.AST = 1.5; }],
    ['text-total', player => { player.totals.AST = '30'; }],
    ['negative-total', player => { player.totals.AST = -1; }],
    ['impossible-fg', player => { player.totals.FGA = player.totals.FGM - 1; }],
    ['impossible-ft', player => { player.totals.FTA = player.totals.FTM - 1; }],
    ['impossible-threes', player => { player.totals['3PM'] = player.totals.FGM + 1; }],
    ['inconsistent-points', player => { player.totals.PTS++; }]
  ].map(([id, edit]) => { const player = row(id); edit(player); return player; });
  const players = varied(), gpConflict = {...players[0], gp: 29};
  const totalsConflict = {...players[1], totals: {...players[1].totals, AST: players[1].totals.AST + 1}};
  const malformedDuplicate = {...players[2], gp: null};
  const input = snapshot([...players, ...invalid, gpConflict, totalsConflict, malformedDuplicate]);
  const model = core.createSeasonModel(input);
  assert.equal(model.ready, true);
  assert.equal(model.historicalCount, 142);
  for (const id of [...invalid.map(player => player.id), '000', '001', '002']) {
    assert.equal(model.history.has(id), false, id);
    assert.equal(model.referenceIds.includes(id), false, id);
  }
  assert.deepEqual(core.createSeasonModel({...input, players: input.players.slice().reverse()}), model);
});

test('all historical scope fields must explicitly describe completed 2025/26 regular-season actuals', () => {
  const changes = [
    input => { delete input.version; }, input => { input.version = 2; },
    input => { input.seasonId = 2027; }, input => { input.seasonId = '2026'; },
    input => { input.seasonType = 3; }, input => { delete input.seasonType; },
    input => { input.statSourceId = 1; }, input => { delete input.statSourceId; },
    input => { input.statSplitTypeId = 1; }, input => { delete input.statSplitTypeId; },
    input => { input.scoringPeriodId = 1; }, input => { delete input.scoringPeriodId; },
    input => { input.final = false; }, input => { delete input.final; },
    input => { input.source.provider = 'Unknown'; }, input => { delete input.source; },
    input => { input.source.url = 'https://espn.com.example.org/'; },
    input => { input.source.fetchedAt = 'not-a-date'; }
  ];
  for (const edit of changes) {
    const input = snapshot(varied()); edit(input);
    const model = core.createSeasonModel(input);
    assert.equal(model.ready, false);
    assert.equal(model.history.size, 0);
    assert.equal(model.referenceIds.length, 0);
    assert.match(model.reason, /nicht eindeutig bestätigt/);
  }
});

test('optional ESPN requested-season evidence cannot contradict canonical scope or claim a future season end', () => {
  const input = snapshot(varied());
  input.source.requestedSeason = {year: 2026, endDate: '2026-06-27T06:59:00.000+00:00', type: {id: '2', type: 2, endDate: '2026-04-13T06:59:00.000+00:00'}};
  assert.equal(core.createSeasonModel(input).ready, true);
  const changes = [
    source => { source.requestedSeason.year = 2027; },
    source => { source.requestedSeason.type.id = '3'; },
    source => { source.requestedSeason.type.type = 3; },
    source => { source.requestedSeason = null; },
    source => { source.requestedSeason.type = null; },
    source => { source.requestedSeason.endDate = 'not-a-date'; },
    source => { source.requestedSeason.endDate = '2026-09-06T00:00:00Z'; },
    source => { source.requestedSeason.type.endDate = 'not-a-date'; },
    source => { source.requestedSeason.type.endDate = '2026-09-06T00:00:00Z'; },
    source => { source.endDate = '2026-09-06T00:00:00Z'; }
  ];
  for (const edit of changes) {
    const changed = JSON.parse(JSON.stringify(input)); edit(changed.source);
    const model = core.createSeasonModel(changed);
    assert.equal(model.ready, false);
    assert.equal(model.history.size, 0);
    assert.match(model.reason, /nicht eindeutig bestätigt/);
  }
  input.source.requestedSeason.type.endDate = input.source.fetchedAt;
  assert.equal(core.createSeasonModel(input).ready, true, 'a season already ended at retrieval is admissible');
});

test('ties use stable identities; input order, ADP, owner and projected data cannot select the reference', () => {
  const players = uniform(110), extra = {...players[0], name: 'Alias', rank: 1, adp: 1};
  const model = core.createSeasonModel(snapshot([...players, extra]));
  assert.equal(model.candidateCount, 110, 'identical statistical duplicates count once');
  assert.deepEqual(model.referenceIds, uniform(104).map(player => player.id));
  const changed = players.slice().reverse().map((player, index) => ({...player, adp: 999 - index, rank: 999 - index, owner: 'Pirates', team: 'Wolves', projection: {PTS: 1000}}));
  assert.deepEqual(core.createSeasonModel(snapshot([extra, ...changed])), model);
  const serialized = JSON.stringify({categories: model.categories, ids: model.referenceIds});
  core.score({...model.history.get('000'), PTS: 50}, model);
  assert.equal(JSON.stringify({categories: model.categories, ids: model.referenceIds}), serialized, 'evaluating later performances does not move the fixed scale');
});

test('103 eligible players block the reference instead of silently shrinking it', () => {
  const players = uniform(103), model = core.createSeasonModel(snapshot([...players, row('small', 19)]));
  assert.equal(model.ready, false);
  assert.equal(model.candidateCount, 103);
  assert.equal(model.historicalCount, 104);
  assert.equal(model.referenceIds.length, 0);
  assert.match(model.reason, /103\/104/);
  assert.equal(core.score(model.history.get('small'), model), null);
  assert.equal(core.createSeasonModel(snapshot([...players, row('qualified', 20)])).ready, true);
});
