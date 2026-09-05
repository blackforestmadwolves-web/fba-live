import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../maik-value.js';
import history from '../maik-history-2025-26.js';
import catalog from '../draft-player-catalog.js';
import pool from '../draft-radar-pool.js';

const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html = read('index.html');
const fixture = JSON.parse(read('tests/fixtures/draft-radar-20260905.json'));
const model = core.createSeasonModel(history);
function harness() {
  const prototypePool=[];
  const c = vm.createContext({
    D:JSON.parse(JSON.stringify(fixture)),FBA_MAIK_VALUE:core,FBA_MAIK_HISTORY:history,
    FBA_DRAFT_PLAYER_CATALOG:catalog,FBA_DRAFT_RADAR_POOL:pool,
    DRAFT_CATS:['PTS','REB','AST','3PM','STL','BLK','FG%','FT%'],
    MONSTER_STATE:{data:null},monsterUnlocked:()=>false,draftPool:()=>prototypePool,
    monsterProjectionEngineState:()=>({ready:false,players:[]}),
    sessionStorage:{getItem:()=>null,setItem:()=>{}},
    sect:(title,subtitle)=>`<h2>${title}</h2><small>${subtitle}</small>`,
    monsterEspnFantasyPositionLabel:p=>p.fantasyPositions||'ESPN-Sync',
    monsterB2bDate:date=>date,espnPlayerHeadshot:id=>`https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`,
    imageFallbackAttr:()=>'',playerInitials:name=>name.slice(0,2),
    fetch:()=>{throw new Error('Viewing and sorting 100 cards must not fetch another feed');}
  });
  c.window=c;
  vm.runInContext(html.match(/^const E = .+$/m)[0],c);
  vm.runInContext(html.match(/^const de = .+$/m)[0],c);
  const originalStart=html.indexOf('const DRAFT_RADAR_EDITORIAL = Object.freeze([');
  const originalEnd=html.indexOf('\n]);',originalStart)+4;
  assert.ok(originalStart>0 && originalEnd>originalStart);
  vm.runInContext(html.slice(originalStart,originalEnd),c);
  const valueStart=html.indexOf('let MAIK_VALUE_MODEL_CACHE='),valueEnd=html.indexOf('function draftedMap(',valueStart);
  vm.runInContext(html.slice(valueStart,valueEnd),c);
  const radarStart=html.indexOf('function draftRadarData(){'),radarEnd=html.indexOf('function draftRadarHome(){',radarStart);
  vm.runInContext(html.slice(radarStart,radarEnd),c);
  vm.runInContext(read('draft-editorial-100.js'),c);
  vm.runInContext(read('draft-prep.js'),c);
  return c;
}

test('the existing public API response supplies 100 positioned cards and 100 substantive editorial reports',()=>{
  const c=harness(),rows=c.draftRadarData();
  assert.equal(fixture.draftTop25.length,25,'captured backend remains compatible');
  assert.equal(rows.length,100);
  assert.equal(new Set(rows.map(row=>row.id)).size,100);
  assert.equal(rows[0].id,'3112335');assert.equal(rows[99].id,'4433627');
  assert.ok(rows.every(row=>row.fantasyPositions && row.fantasyPositions.split(',').every(p=>['PG','SG','SF','PF','C'].includes(p))));
  assert.ok(rows.every(row=>row.adpDate===fixture.adpTrend.latestDate));
  const reportFor=id=>c.FBA_DRAFT_EDITORIAL_V53.find(r=>r.id===id)||vm.runInContext('DRAFT_RADAR_EDITORIAL',c).find(r=>r.id===id);
  for (const row of rows) {
    const report=reportFor(row.id);
    assert.ok(report,`Editorial missing: ${row.name}`);
    for (const key of ['reason','report','outlook','strengths','risk','fit','draftPlan','reviewedAt']) assert.ok(typeof report[key]==='string' && report[key].trim(),`${row.name}/${key}`);
    assert.ok(['report','outlook','strengths','risk','fit','draftPlan'].map(k=>report[k]).join(' ').split(/\s+/).length>=130,`${row.name}: complete analysis`);
    assert.ok((report.sources?.length?report.sources:[{url:report.sourceUrl}]).every(s=>/^https:\/\//.test(s.url)));
  }
  const markup=c.pgDraftPreparation();
  assert.equal((markup.match(/<details data-draft-player=/g)||[]).length,100);
  assert.equal((markup.match(/class="draft-radar-editorial"/g)||[]).length,100);
  assert.equal((markup.match(/>Dein Draft-Plan<\/h4>/g)||[]).length,100);
  assert.match(markup,/Top 100 nach ESPN ADP · 100 Spieler verfügbar/);
  assert.doesNotMatch(markup,/Maik-Value/);
  assert.doesNotMatch(markup,/ADP bedeutet durchschnittlicher Draft-Pick/);
  assert.match(markup,/>#100<\/span>/);
  c.draftPreparationSetQuery('Lillard');
  const search=c.pgDraftPreparation();
  assert.equal((search.match(/<details data-draft-player=/g)||[]).length,1);
  assert.match(search,/data-draft-player="6606"/);
  assert.match(search,/Damian Lillard/);
  assert.match(search,/1 von 100 Spielern gefunden/);
  assert.match(search,/>Dein Draft-Plan<\/h4>/);
  assert.match(search,/Statistikbezug: 2024\/25/);
  c.draftPreparationSetQuery('');
  assert.equal((c.pgDraftPreparation().match(/<details data-draft-player=/g)||[]).length,100);
});

test('no 2025/26 NBA history stays missing even when an older-season or college report exists',()=>{
  const c=harness();
  for(const id of ['4396993','6606','6442','5142718']) {
    const row=c.draftRadarData().find(p=>p.id===id);
    assert.ok(row);
    assert.equal(c.maikValueFor(row).history,null);
    const card=c.draftRadarCard(row,row.rank-1);
    assert.match(card,/<strong>–<\/strong><span class="maik-value-label">FBA-Value<\/span><span class="maik-value-basis">Statistik fehlt/);
    assert.match(card,/Statistikbezug: (?:2024\/25|College 2025\/26|Keine NBA-Spiele 2025\/26)/);
    assert.doesNotMatch(card,/Statistikbezug: 2025\/26 ·/);
  }
});

test('expanding the radar and sorting by FBA-Value cannot refit the 104-player reference',()=>{
  const c=harness(),reference=c.maikValueContext().model,rows=c.draftRadarData();
  assert.equal(reference.count,104);
  const jokicBefore=c.maikValueFor(rows[0]).primary.value;
  c.FBA_DRAFT_PREP.sortPlayers(rows,'maik',c.maikValueFor);
  c.D.draftTop25=[];
  const expanded=c.draftRadarData();
  assert.equal(expanded.length,100);
  assert.strictEqual(c.maikValueContext().model,reference);
  assert.equal(c.maikValueFor({id:'3112335'}).primary.value,jokicBefore);
  assert.ok(Math.abs(jokicBefore-core.score(model.history.get('3112335'),model).value)<1e-12);
});

test('the shipped catalog contains only public identities, confirmed positions and source metadata',()=>{
  assert.equal(catalog.seasonId,2027);assert.equal(catalog.players.length,1095);
  assert.equal(new Set(catalog.players.map(p=>p.id)).size,catalog.players.length);
  assert.ok(Object.isFrozen(catalog) && catalog.players.every(Object.isFrozen));
  for(const player of catalog.players) assert.ok(Object.keys(player).every(key=>['id','name','nba','primaryPosition','fantasyPositions','active'].includes(key)));
  for(const name of ['draft-player-catalog.js','draft-radar-pool.js','draft-editorial-100.js']) {
    const position=html.indexOf(`src="${name}"`);
    assert.ok(position>0 && position<html.indexOf('<script>'));
  }
});
