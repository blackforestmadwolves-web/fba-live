import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import prep from '../draft-prep.js';
import punt from '../draft-punt.js';
import core from '../maik-value.js';

const source = fs.readFileSync(new URL('../draft-prep.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ids = rows => Array.from(rows, row => row.id);
const players = Object.freeze([
  Object.freeze({id: '1', name: 'Zed', adp: 1.8, rank: 1, fantasyPositions: 'C', nba: 'DEN'}),
  Object.freeze({id: '2', name: 'Anna', adp: 3.1, rank: 2, fantasyPositions: 'PF,C', nba: 'SAS'}),
  Object.freeze({id: '3', name: 'Berta', adp: 4, rank: 3, fantasyPositions: 'SG,SF', nba: 'OKC'})
]);
const valueFor = row => ({primary: {value: ({'1': -0.4, '2': -0.2, '3': 0.1})[row.id], kind: 'history'}});

test('Merge Value is a 50/50 rank mean, not a blend of raw scales; missing values stay unranked and last',()=>{
  const rows=Object.freeze([
    Object.freeze({id:'a',adp:10}),Object.freeze({id:'b',adp:20}),
    Object.freeze({id:'c',adp:30}),Object.freeze({id:'d',adp:40}),
    Object.freeze({id:'missing',adp:5})
  ]);
  const lookup=p=>({primary:{value:({a:0.5,b:1,c:-2,d:0})[p.id]}});
  const scores=prep.mergeValues(rows,lookup);
  assert.deepEqual(scores.get('a'),{adp:10,fba:0.5,adpRank:2,fbaRank:2,value:2});
  assert.deepEqual(scores.get('b'),{adp:20,fba:1,adpRank:3,fbaRank:1,value:2});
  assert.equal(scores.get('d').value,4,'a genuine zero remains ranked');
  assert.equal(scores.get('missing').adpRank,1);
  assert.equal(scores.get('missing').fbaRank,null);
  assert.equal(scores.get('missing').value,null);
  assert.deepEqual(ids(prep.sortPlayers(rows,'merge',lookup)),['a','b','c','d','missing']);
  assert.deepEqual(ids(prep.sortPlayers([...rows].reverse(),'merge',lookup)),['a','b','c','d','missing']);
  assert.strictEqual(prep.sortPlayers(rows,'merge',lookup)[0],rows[0]);
  for(const bad of [null,undefined,'',false,NaN,Infinity]){
    assert.equal(prep.mergeValues([{id:'x',adp:1}],()=>({primary:{value:bad}})).get('x').value,null);
    assert.equal(prep.mergeValues([{id:'x',adp:bad}],()=>({primary:{value:1}})).get('x').value,null);
  }
});

test('tied raw ADPs and FBA values share the average occupied rank without rounding the underlying scores',()=>{
  const rows=[{id:'a',adp:1},{id:'b',adp:2},{id:'c',adp:2},{id:'d',adp:4}];
  const lookup=p=>({primary:{value:({a:1,b:0,c:0,d:-1})[p.id]}});
  const scores=prep.mergeValues(rows,lookup);
  assert.equal(scores.get('a').value,1);
  assert.equal(scores.get('b').adpRank,2.5);assert.equal(scores.get('b').fbaRank,2.5);
  assert.equal(scores.get('c').value,2.5);assert.equal(scores.get('d').value,4);
  assert.equal(prep.mergeValues([{id:'a',adp:1},{id:'b',adp:2}],p=>({primary:{value:p.id==='a'?0.001:0.002}})).get('b').fbaRank,1);
  assert.equal(prep.readSort({getItem:()=> 'merge'}),'merge');
});

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

test('player search matches partial names, accents and common punctuation without changing input data', () => {
  const rows = Object.freeze([
    Object.freeze({id: 'lillard', name: 'Damian Lillard'}),
    Object.freeze({id: 'jokic', name: 'Nikola Jokić'}),
    Object.freeze({id: 'russell', name: 'D’Angelo Russell'}),
    Object.freeze({id: 'sga', name: 'Shai Gilgeous-Alexander'})
  ]);
  assert.deepEqual(ids(prep.filterPlayers(rows, ' LILLARD  dam ')), ['lillard']);
  assert.deepEqual(ids(prep.filterPlayers(rows, 'jokic')), ['jokic']);
  assert.deepEqual(ids(prep.filterPlayers(rows, 'dangelo')), ['russell']);
  assert.deepEqual(ids(prep.filterPlayers(rows, 'gilgeous alex')), ['sga']);
  assert.deepEqual(ids(prep.filterPlayers(rows, 'not a player')), []);
  assert.deepEqual(ids(prep.filterPlayers(rows, ' \t ')), ids(rows));
  assert.strictEqual(prep.filterPlayers(rows, 'lillard')[0], rows[0]);
});

function harness(rows = players, savedValue = 'adp') {
  const storage = new Map([['fba-draft-preparation-sort-v1', savedValue]]);
  const context = vm.createContext({
    FBA_DRAFT_PUNT: punt, FBA_MAIK_VALUE: core,
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
  assert.match(result, /Top 150 nach ESPN ADP/);
  assert.match(result, /for="draft-prep-search">Spieler suchen<input[^>]+type="search"/);
  assert.doesNotMatch(result, /ADP bedeutet durchschnittlicher Draft-Pick/);
  assert.match(result, /# = Position in dieser Liste/);
  assert.equal((result.match(/<details data-draft-player=/g) || []).length, players.length);
  assert.match(harness([], 'bad-sort').context.pgDraftPreparation(), /id="draft-prep-empty" class="model-note">Die Spieler erscheinen/);
});

test('merge display uses the full pool before filtering and preserves its exact formula across search',()=>{
  const {context}=harness(players,'merge');
  const all=context.pgDraftPreparation();
  assert.match(all,/value="merge" selected/);
  assert.equal((all.match(/class="draft-merge-value"/g)||[]).length,3);
  assert.match(all,/\(ADP-Rang 2 \+ FBA-Rang 2\) ÷ 2/);
  context.draftPreparationSetQuery('Anna');
  const filtered=context.pgDraftPreparation();
  assert.equal((filtered.match(/<details data-draft-player=/g)||[]).length,1);
  assert.match(filtered,/\(ADP-Rang 2 \+ FBA-Rang 2\) ÷ 2/);
  assert.match(filtered,/Merge Value: \(2 ADP-Rang \+ 2 FBA-Rang\) ÷ 2 = 2/);
  assert.doesNotMatch(filtered,/\(ADP-Rang 1 \+ FBA-Rang 1\)/);
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
  assert.match(elements.get('draft-prep-status').textContent, /FBA-Value · höchster zuerst/);
  assert.equal(elements.get('draft-prep-empty').hidden, true);
  assert.deepEqual([...storage], [['fba-draft-preparation-sort-v1', 'maik']]);
  assert.match(context.pgDraftPreparation(), /value="maik" selected/);
});

test('search retains input focus, chosen sorting and open reports through no matches and clearing', () => {
  const {context, storage} = harness();
  let nodes = [{open: true, getAttribute: () => '1'}];
  const grid = {
    querySelectorAll: () => nodes,
    set innerHTML(markup) {
      nodes = Array.from(markup.matchAll(/<details data-draft-player="([^"]+)"/g), match => ({open: false, getAttribute: () => match[1]}));
    }
  };
  const input = {value: 'a', selectionStart: 1}, select = {value: 'adp'};
  const elements = new Map([
    ['draft-prep-grid', grid], ['draft-prep-search', input], ['draft-prep-sort', select],
    ['draft-prep-status', {}], ['draft-prep-basis', {}], ['draft-prep-empty', {}]
  ]);
  context.document = {getElementById: id => elements.get(id), activeElement: input};
  context.draftPreparationSetQuery('a');
  assert.deepEqual(nodes.map(node => node.getAttribute()), ['2', '3']);
  assert.match(elements.get('draft-prep-status').textContent, /2 von 3 Spielern gefunden/);
  context.draftPreparationSetSort('maik');
  assert.deepEqual(nodes.map(node => node.getAttribute()), ['3', '2']);
  context.draftPreparationSetQuery('no match');
  assert.equal(nodes.length, 0);
  assert.equal(elements.get('draft-prep-empty').hidden, false);
  assert.match(elements.get('draft-prep-empty').textContent, /Kein Spieler gefunden/);
  assert.doesNotMatch(elements.get('draft-prep-empty').textContent, /sobald aktuelle ESPN-ADPs/);
  assert.match(elements.get('draft-prep-status').textContent, /0 von 3 Spielern gefunden/);
  context.draftPreparationSetQuery('');
  assert.deepEqual(nodes.map(node => node.getAttribute()), ['3', '2', '1']);
  assert.equal(nodes.find(node => node.getAttribute() === '1').open, true);
  assert.equal(elements.get('draft-prep-empty').hidden, true);
  assert.strictEqual(context.document.activeElement, input);
  assert.equal(input.selectionStart, 1);
  assert.equal(select.value, 'maik');
  assert.deepEqual([...storage], [['fba-draft-preparation-sort-v1', 'maik']]);
  // Opening a different report while searching supersedes the hidden one,
  // matching the existing native details accordion (one open report).
  context.draftPreparationSetQuery('a');
  nodes.find(node => node.getAttribute() === '2').open = true;
  context.draftPreparationSetQuery('');
  assert.equal(nodes.find(node => node.getAttribute() === '1').open, false);
  assert.equal(nodes.find(node => node.getAttribute() === '2').open, true);
  // A report explicitly closed by the user must stay closed after searching.
  nodes.find(node => node.getAttribute() === '2').open = false;
  context.draftPreparationSetQuery('a');
  context.draftPreparationSetQuery('');
  assert.equal(nodes.find(node => node.getAttribute() === '2').open, false);
  context.draftPreparationSetQuery('\"<script>');
  assert.match(context.pgDraftPreparation(), /value="&quot;&lt;script&gt;"/);
});

test('multi-punt controls mark dependent players, keep reports and values, and persist separately from War Room', () => {
  const {context, storage} = harness();
  const z = overrides => Object.fromEntries(punt.categories.map(cat => [cat, overrides[cat] ?? -1]));
  context.maikValueFor = row => ({primary: {value: valueFor(row).primary.value, kind: 'history', z: row.id === '1' ? z({AST: 3, PTS: 1}) : row.id === '2' ? z({AST: 2, REB: 2, PTS: 3}) : null}});
  context.DRAFT_STATE = {punts: ['BLK'], sort: 'merge', picks: [{playerId: 'x'}]};
  const originalRoom = JSON.stringify(context.DRAFT_STATE);
  const initial = context.pgDraftPreparation();
  assert.equal((initial.match(/type="checkbox"/g) || []).length, 8);
  assert.doesNotMatch(initial, /class="draft-radar-card punt-mismatch"/);
  context.draftPreparationTogglePunt('AST');
  const single = context.pgDraftPreparation();
  assert.match(single, /data-draft-player="1"[^>]*class="draft-radar-card punt-mismatch"/);
  assert.match(single, /data-draft-player="2"[^>]*class="draft-radar-card"/);
  assert.match(single, /Passt nicht gut zum AST-Punt-Build/);
  assert.match(single, /Punt-Fit offen · Stärkenprofil fehlt/);
  assert.match(single, /Bestehende ausführliche Analyse/);
  assert.match(single, /75 % der positiv bewerteten Stärken/);
  assert.match(single, /Verbleibende Stärken: PTS/);
  context.draftPreparationTogglePunt('REB');
  const multiple = context.pgDraftPreparation();
  assert.match(multiple, /data-draft-player="2"[^>]*class="draft-radar-card punt-mismatch"/);
  assert.match(multiple, /AST \+ REB-Punt-Build/);
  assert.deepEqual([...multiple.matchAll(/class="draft-merge-value[^>]*>[\s\S]*?<strong>([^<]*)/g)].map(m => m[1]), [...initial.matchAll(/class="draft-merge-value[^>]*>[\s\S]*?<strong>([^<]*)/g)].map(m => m[1]));
  assert.equal(JSON.stringify(context.DRAFT_STATE), originalRoom);
  assert.equal(storage.get('fba-draft-preparation-punts-v1'), '["AST","REB"]');
  // A new script instance simulates re-entering the app in this tab.
  vm.runInContext(source, context);
  assert.match(context.pgDraftPreparation(), /value="AST" checked/);
  context.draftPreparationClearPunts();
  assert.doesNotMatch(context.pgDraftPreparation(), /class="draft-radar-card punt-mismatch"/);
  assert.equal(storage.get('fba-draft-preparation-punts-v1'), '[]');
});

test('punt interaction preserves the focused checkbox, open report, search and sort; seven is the limit', () => {
  const {context} = harness(players, 'merge');
  let nodes = [{open: true, getAttribute: () => '1'}];
  const grid = {querySelectorAll: () => nodes, set innerHTML(markup) {
    nodes = Array.from(markup.matchAll(/<details data-draft-player="([^"]+)"/g), m => ({open: false, getAttribute: () => m[1]}));
  }};
  const boxes = punt.categories.map(() => ({}));
  const elements = new Map([['draft-prep-grid', grid], ['draft-prep-sort', {}], ['draft-prep-punt-status', {}], ['draft-prep-punt-clear', {}], ...boxes.map((box, i) => [`draft-prep-punt-${i}`, box])]);
  context.document = {getElementById: id => elements.get(id), activeElement: boxes[2]};
  context.draftPreparationTogglePunt('AST');
  assert.strictEqual(context.document.activeElement, boxes[2]);
  assert.equal(boxes[2].checked, true);
  assert.equal(nodes.find(node => node.getAttribute() === '1').open, true);
  assert.equal(elements.get('draft-prep-sort').value, 'merge');
  context.draftPreparationSetQuery('Zed');
  context.draftPreparationTogglePunt('REB');
  assert.deepEqual(nodes.map(node => node.getAttribute()), ['1']);
  assert.equal(nodes[0].open, true);
  for (const cat of punt.categories) context.draftPreparationTogglePunt(cat);
  // Toggle until exactly seven distinct categories are selected.
  context.draftPreparationClearPunts();
  for (const cat of punt.categories) context.draftPreparationTogglePunt(cat);
  assert.equal(boxes.filter(box => box.checked).length, 7);
  assert.equal(boxes[7].disabled, true);
  assert.equal(boxes[0].disabled, false);
  assert.match(elements.get('draft-prep-punt-status').textContent, /Mindestens eine Kategorie/);
  context.draftPreparationClearPunts();
  assert.ok(boxes.every(box => !box.checked && !box.disabled));
  assert.equal(elements.get('draft-prep-punt-clear').disabled, true);
});

test('invalid or inaccessible stored punt choices fall back to an unmarked view', () => {
  const {context, storage} = harness();
  storage.set('fba-draft-preparation-punts-v1', '{invalid JSON');
  assert.match(context.pgDraftPreparation(), /Alle Kategorien aktiv/);
  context.sessionStorage = {getItem: () => {throw Error('blocked');}, setItem: () => {throw Error('blocked');}};
  vm.runInContext(source, context);
  assert.match(context.pgDraftPreparation(), /Alle Kategorien aktiv/);
  context.draftPreparationTogglePunt('AST');
  assert.match(context.pgDraftPreparation(), /value="AST" checked/);
});
