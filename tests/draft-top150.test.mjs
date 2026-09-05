import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../maik-value.js';
import history from '../maik-history-2025-26.js';
import catalog from '../draft-player-catalog.js';
import pool from '../draft-radar-pool.js';
import editorial from '../draft-editorial-150.js';
import news from '../draft-news-context.js';

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
    fetch:()=>{throw new Error('Viewing and sorting 150 cards must not fetch another feed');}
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
  vm.runInContext(read('draft-editorial-150.js'),c);
  vm.runInContext(read('draft-news-context.js'),c);
  vm.runInContext(read('draft-punt.js'),c);
  vm.runInContext(read('draft-prep.js'),c);
  return c;
}

test('the existing public API response supplies 150 positioned cards and 150 substantive editorial reports',()=>{
  const c=harness(),rows=c.draftRadarData();
  assert.equal(fixture.draftTop25.length,25,'captured backend remains compatible');
  assert.equal(rows.length,150);
  assert.equal(new Set(rows.map(row=>row.id)).size,150);
  assert.equal(rows[0].id,'3112335');assert.equal(rows[149].id,'3133603');
  assert.ok(rows.every(row=>row.fantasyPositions && row.fantasyPositions.split(',').every(p=>['PG','SG','SF','PF','C'].includes(p))));
  assert.ok(rows.every(row=>row.adpDate===fixture.adpTrend.latestDate));
  const reportFor=id=>c.FBA_DRAFT_EDITORIAL_V56.find(r=>r.id===id)||vm.runInContext('DRAFT_RADAR_EDITORIAL',c).find(r=>r.id===id);
  for (const row of rows) {
    const report=reportFor(row.id);
    assert.ok(report,`Editorial missing: ${row.name}`);
    for (const key of ['reason','report','outlook','strengths','risk','fit','draftPlan','reviewedAt']) assert.ok(typeof report[key]==='string' && report[key].trim(),`${row.name}/${key}`);
    assert.ok(['report','outlook','strengths','risk','fit','draftPlan'].map(k=>report[k]).join(' ').split(/\s+/).length>=130,`${row.name}: complete analysis`);
    assert.ok((report.sources?.length?report.sources:[{url:report.sourceUrl}]).every(s=>/^https:\/\//.test(s.url)));
  }
  const markup=c.pgDraftPreparation();
  assert.equal((markup.match(/<details data-draft-player=/g)||[]).length,150);
  assert.equal((markup.match(/class="draft-radar-editorial"/g)||[]).length,150);
  assert.equal((markup.match(/>Dein Draft-Plan<\/h4>/g)||[]).length,150);
  assert.match(markup,/Top 150 nach ESPN ADP · 150 Spieler verfügbar/);
  assert.doesNotMatch(markup,/Maik-Value/);
  assert.doesNotMatch(markup,/ADP bedeutet durchschnittlicher Draft-Pick/);
  assert.match(markup,/>#150<\/span>/);
  c.draftPreparationSetQuery('Lillard');
  const search=c.pgDraftPreparation();
  assert.equal((search.match(/<details data-draft-player=/g)||[]).length,1);
  assert.match(search,/data-draft-player="6606"/);
  assert.match(search,/Damian Lillard/);
  assert.match(search,/1 von 150 Spielern gefunden/);
  assert.match(search,/>Dein Draft-Plan<\/h4>/);
  assert.match(search,/Statistikbezug: 2024\/25/);
  c.draftPreparationSetQuery('');
  assert.equal((c.pgDraftPreparation().match(/<details data-draft-player=/g)||[]).length,150);
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
  assert.equal(expanded.length,150);
  assert.strictEqual(c.maikValueContext().model,reference);
  assert.equal(c.maikValueFor({id:'3112335'}).primary.value,jokicBefore);
  assert.ok(Math.abs(jokicBefore-core.score(model.history.get('3112335'),model).value)<1e-12);
});

test('the shipped catalog contains only public identities, confirmed positions and source metadata',()=>{
  assert.equal(catalog.seasonId,2027);assert.equal(catalog.players.length,1095);
  assert.equal(new Set(catalog.players.map(p=>p.id)).size,catalog.players.length);
  assert.ok(Object.isFrozen(catalog) && catalog.players.every(Object.isFrozen));
  for(const player of catalog.players) assert.ok(Object.keys(player).every(key=>['id','name','nba','primaryPosition','fantasyPositions','active'].includes(key)));
  for(const name of ['draft-player-catalog.js','draft-radar-pool.js','draft-editorial-150.js','draft-news-context.js']) {
    const position=html.indexOf(`src="${name}"`);
    assert.ok(position>0 && position<html.indexOf('<script>'));
  }
});

test('news review covers all 150 reports and links direct trades to affected teammates across all participating teams',()=>{
  const c=harness(),rows=c.draftRadarData(),ids=new Set(rows.map(r=>r.id));
  assert.equal(editorial.length,150);
  assert.equal(ids.has('2779'),false,'retired Chris Paul must not displace the 150th report');
  assert.equal(new Set(news.events.flatMap(e=>e.teams)).size,30);
  assert.equal(new Set(news.events.map(e=>e.id)).size,news.events.length);
  for(const note of editorial){
    assert.equal(note.checkedAt,'2026-09-05');
    assert.equal(note.changedAt,'2026-09-05');
    for(const id of note.newsEventIds){
      const event=news.events.find(e=>e.id===id);
      assert.ok(event?.affectedPlayerIds.includes(note.id),`${note.id}: dangling or mismatched event ${id}`);
    }
  }
  const trade=news.events.find(e=>e.id==='ball-randle-reid-claxton');
  for(const id of ['4432816','3064514','4396971','4278067','4594268','3032976','4431671','4871145','5061575','4278104']){
    assert.ok(trade.affectedPlayerIds.includes(id),`Missing direct/indirect player ${id}`);
    assert.ok(editorial.find(n=>n.id===id).newsEventIds.includes(trade.id));
  }
  assert.match(editorial.find(n=>n.id==='4594268').outlook,/Ball.*Randle.*Reid/);
  assert.match(editorial.find(n=>n.id==='3032976').outlook,/Ball.*Gobert/s);
  for(const event of news.events){
    assert.ok(['confirmed','reported','pending'].includes(event.status));
    assert.ok(!event.eventDate||/^2026-\d\d-\d\d$/.test(event.eventDate));
    assert.ok(!event.eventDate||event.eventDate<=news.checkedAt);
    assert.ok(event.sources.length&&event.sources.every(s=>/^https:\/\//.test(s.url)));
    assert.ok(event.affectedPlayerIds.every(id=>ids.has(id)));
  }
});

test('pending moves cannot rewrite team identities; severe injuries change the actual draft recommendation',()=>{
  const c=harness(),rows=c.draftRadarData();
  assert.equal(news.events.find(e=>e.id==='leonard-ingram').status,'pending');
  assert.equal(news.events.find(e=>e.id==='mathurin-new-orleans').status,'reported');
  assert.equal(rows.find(r=>r.id==='6450').nba,'LAC');
  assert.equal(rows.find(r=>r.id==='3913176').nba,'TOR');
  assert.equal(rows.find(r=>r.id==='4683634').nba,'LAC');
  for(const id of ['4914336','3934673']){
    const note=editorial.find(n=>n.id===id),card=c.draftRadarCard(rows.find(r=>r.id===id),0);
    assert.match(note.draftPlan,/Saisonstart keine Produktion/);
    assert.match(note.risk,/keine Einsatzfreigabe/);
    assert.match(card,/Nachrichten hinter der Einschätzung/);
  }
  assert.match(c.draftRadarCard(rows.find(r=>r.id==='6450'),0),/Abschluss offen/);
  assert.match(c.draftRadarCard(rows.find(r=>r.id==='4683634'),0),/Gemeldet/);
});

test('opening a report never advances its editorial date and news content is escaped',()=>{
  const c=harness(),before=JSON.stringify(c.FBA_DRAFT_EDITORIAL_V56);
  c.pgDraftPreparation();c.draftPreparationSetSort('name');c.draftPreparationSetQuery('Edwards');
  assert.equal(JSON.stringify(c.FBA_DRAFT_EDITORIAL_V56),before);
  c.FBA_DRAFT_NEWS={checkedAt:'2026-09-05',events:[{id:'unsafe',status:'confirmed',fact:'<img src=x onerror=alert(1)>',sources:[{url:'javascript:alert(1)',label:'bad'},{url:'https://example.com',label:'<script>x</script>'}]}]};
  const markup=c.draftRadarNewsMarkup({newsEventIds:['unsafe'],changedAt:'2026-09-01'});
  assert.match(markup,/&lt;img/);assert.match(markup,/&lt;script/);
  assert.doesNotMatch(markup,/href="javascript:|<img|<script/);
  assert.match(markup,/Bericht geändert: 2026-09-01/);
});

test('real Top 150 FBA profiles support multi-punt evaluation without changing values, population or reports',()=>{
  const c=harness(), rows=c.draftRadarData();
  const before=rows.map(p=>({id:p.id,value:c.maikValueFor(p).primary?.value}));
  const available=rows.map(p=>({p,fit:c.FBA_DRAFT_PUNT.evaluate(c.maikValueFor(p).primary,['AST'],core.weights)})).filter(x=>x.fit);
  assert.ok(available.length>100,'real category contributions are available, not just mocked FBA totals');
  assert.equal(available.find(x=>x.p.id==='3112335').fit.mismatch,false,'Jokic keeps multiple other strengths when AST alone is punted');
  c.draftPreparationTogglePunt('AST');c.draftPreparationTogglePunt('REB');
  const markup=c.pgDraftPreparation();
  const expected=rows.filter(p=>c.FBA_DRAFT_PUNT.evaluate(c.maikValueFor(p).primary,['AST','REB'],core.weights)?.mismatch).length;
  assert.ok(expected>0 && expected<150);
  assert.equal((markup.match(/class="draft-radar-card punt-mismatch"/g)||[]).length,expected);
  assert.equal((markup.match(/<details data-draft-player=/g)||[]).length,150);
  assert.equal((markup.match(/class="draft-radar-editorial"/g)||[]).length,150);
  assert.deepEqual(c.draftRadarData().map(p=>({id:p.id,value:c.maikValueFor(p).primary?.value})),before);
});
