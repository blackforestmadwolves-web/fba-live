import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import prep from '../draft-prep.js';

const source = fs.readFileSync(new URL('../draft-prep.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ids = rows => Array.from(rows, row => row.id);
const players = Object.freeze([
  Object.freeze({id: '1', name: 'Zed', adp: 1.8, rank: 1, fantasyPositions: 'C', nba: 'DEN'}),
  Object.freeze({id: '2', name: 'Anna', adp: 3.1, rank: 2, fantasyPositions: 'PF,C', nba: 'SAS'}),
  Object.freeze({id: '3', name: 'Berta', adp: 4, rank: 3, fantasyPositions: 'SG,SF', nba: 'OKC'})
]);
const valueFor = row => ({primary: {value: ({'1': -0.4, '2': -0.2, '3': 0.1})[row.id], kind: 'history'}});

test('ADP, Maik and name sorts change only display order and keep negative scores ahead of missing values', () => {
  const extra = Object.freeze({id: '4', name: 'Aaron', adp: 1, rank: 4});
  const rows = Object.freeze([...players, extra]);
  const lookup = row => row.id === '4' ? {primary: null} : valueFor(row);
  assert.deepEqual(ids(prep.sortPlayers(rows, 'adp', lookup)), ['4', '1', '2', '3']);
  assert.deepEqual(ids(prep.sortPlayers(rows, 'maik', lookup)), ['3', '2', '1', '4']);
  assert.deepEqual(ids(prep.sortPlayers(rows, 'name', lookup)), ['4', '2', '3', '1']);
  assert.deepEqual(ids(rows), ['1', '2', '3', '4']);
  assert.deepEqual(rows.map(row => row.rank), [1, 2, 3, 4]);
  assert.strictEqual(prep.sortPlayers(rows, 'maik', lookup)[0], players[2]);
});

test('Maik ties are deterministic, invalid values stay last, and the displayed primary value wins', () => {
  const rows = [
    {id: '10', name: 'Ten', adp: 3}, {id: '2', name: 'Two', adp: 3},
    {id: '3', name: 'Three', adp: 2}, {id: '4', name: 'Four', adp: 1},
    {id: '5', name: 'Five', adp: 0.5}, {id: '6', name: 'Six', adp: 0.4},
    {id: '7', name: 'Seven', adp: 9}
  ];
  const values = {'10': -0.2, '2': -0.2, '3': -0.2, '4': '', '5': Infinity, '6': null, '7': 0};
  const lookup = row => ({history: {value: 999}, primary: {value: values[row.id]}});
  const expected = ['7', '3', '2', '10', '6', '5', '4'];
  assert.deepEqual(ids(prep.sortPlayers(rows, 'maik', lookup)), expected);
  assert.deepEqual(ids(prep.sortPlayers([...rows].reverse(), 'maik', lookup)), expected);
  assert.deepEqual(ids(prep.sortPlayers(rows, 'invalid', lookup)), ids(prep.sortPlayers(rows, 'adp', lookup)));
});

test('unavailable or corrupt session preferences use ADP; historical and projected labels remain explicit', () => {
  assert.equal(prep.readSort({getItem: () => 'maik'}), 'maik');
  assert.equal(prep.readSort({getItem: () => 'name'}), 'name');
  for (const value of [null, '', 'corrupt', '__proto__', 'constructor', '<script>']) {
    assert.equal(prep.readSort({getItem: () => value}), 'adp');
  }
  assert.equal(prep.readSort({getItem: () => {throw new Error('Storage disabled');}}), 'adp');
  const mixed = prep.valueBasisDescription(players, row => row.id === '1' ? {primary: {value: 1, kind: 'history'}} : row.id === '2' ? {primary: {value: 0, kind: 'projection'}} : {primary: null});
  assert.match(mixed, /1 × 2025\/26/);
  assert.match(mixed, /1 × Projektion \/ Ist \+ Rest 2026\/27/);
  assert.match(mixed, /1 ohne vollständigen Wert/);
});

function harness(rows = players, savedValue = 'adp') {
  const storage = new Map([['fba-draft-preparation-sort-v1', savedValue]]);
  const context = vm.createContext({
    E: value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]),
    sect: (title, subtitle) => `<div class="secttl"><h1>${title}</h1><span>${subtitle}</span></div>`,
    draftRadarData: () => rows, maikValueFor: valueFor,
    D: {adpTrend: {latestDate: '2026-09-05'}},
    DRAFT_RADAR_EDITORIAL: [{id: '1', report: 'Bestehende ausführliche Analyse', reviewedAt: '05.09.2026', outlook: 'Bestehender Ausblick'}],
    monsterB2bDate: value => value,
    monsterEspnFantasyPositionLabel: player => player.fantasyPositions || 'ESPN-Sync',
    espnPlayerHeadshot: id => `https://example.test/${id}.png`,
    imageFallbackAttr: () => '', playerInitials: name => name.slice(0, 1),
    maikValueMarkup: player => `<span class="maik-value" data-maik-player="${player.id}">${valueFor(player).primary.value}</span>`,
    maikValueDetailsMarkup: () => '<section class="maik-details">Bestehende Statistikdetails</section>',
    sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    fetch: () => {throw new Error('Draft preparation must not fetch data');},
    render: () => {throw new Error('Sorting must not replace the full page');}
  });
  const start = html.indexOf('function draftRadarAdpLabel('), end = html.indexOf('function draftRadarHome(', start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(html.slice(start, end), context);
  vm.runInContext(source, context);
  return {context, storage};
}

test('the new page retains existing card analyses, pictures and positions while keeping list ranks separate', () => {
  const {context} = harness(players, 'name');
  const result = context.pgDraftPreparation();
  assert.match(result, /Name · A–Z<\/option>/);
  assert.match(result, /value="name" selected/);
  assert.ok(result.indexOf('data-draft-player="2"') < result.indexOf('data-draft-player="3"'));
  assert.ok(result.indexOf('data-draft-player="3"') < result.indexOf('data-draft-player="1"'));
  assert.match(result, /data-draft-player="2" data-draft-adp-rank="2"[\s\S]*?Position in dieser angezeigten Liste">#1<\/span>/);
  assert.match(result, /Bestehende ausführliche Analyse/);
  assert.match(result, /Bestehender Ausblick/);
  assert.match(result, /Bestehende Statistikdetails/);
  assert.match(result, /class="draft-radar-photo"/);
  assert.match(result, /ESPN-Fantasy-Positionen">PF,C/);
  assert.match(result, /Top 25 nach ESPN ADP/);
  assert.match(result, /# = Position in dieser Liste/);
  assert.equal((result.match(/<details data-draft-player=/g) || []).length, players.length);
  assert.match(harness([], 'bad-sort').context.pgDraftPreparation(), /id="draft-prep-empty" class="model-note">Die Spieler erscheinen/);
});

test('sort interaction retains the selector and open player, updates only local view, and stores only the chosen sort', () => {
  const {context, storage} = harness();
  let nodes = [{open: true, getAttribute: () => '1'}];
  const grid = {
    querySelectorAll: query => query.includes('[open]') ? nodes.filter(node => node.open) : nodes,
    set innerHTML(markup) {
      this.markup = markup;
      nodes = Array.from(markup.matchAll(/<details data-draft-player="([^"]+)"/g), match => ({open: false, getAttribute: () => match[1]}));
    }
  };
  const select = {value: 'adp'}, elements = new Map([
    ['draft-prep-grid', grid], ['draft-prep-sort', select], ['draft-prep-status', {}], ['draft-prep-basis', {}], ['draft-prep-empty', {}]
  ]);
  context.document = {getElementById: id => elements.get(id), activeElement: select};
  context.draftPreparationSetSort('maik');
  assert.deepEqual(nodes.map(node => node.getAttribute()), ['3', '2', '1']);
  assert.equal(nodes.find(node => node.getAttribute() === '1').open, true);
  assert.strictEqual(context.document.activeElement, select);
  assert.equal(select.value, 'maik');
  assert.match(elements.get('draft-prep-status').textContent, /Maik-Value · höchster zuerst/);
  assert.equal(elements.get('draft-prep-empty').hidden, true);
  assert.deepEqual([...storage], [['fba-draft-preparation-sort-v1', 'maik']]);
  assert.match(context.pgDraftPreparation(), /value="maik" selected/);
});
