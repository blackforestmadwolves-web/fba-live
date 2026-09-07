import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {nativeFixture} from './draft-projections-v72.test.mjs';
const stamp='2026-09-06T22:30:00Z';
const headers=['PLAYER','GP','MPG','FG%','FT%','3PM','PTS','TREB','AST','STL','BLK'];
function snapshot(){return {sourceUrl:'https://hashtagbasketball.com/import-v4/fantasy-basketball-projections',heading:'Fantasy Basketball Projections',updatedText:'Updated: 05 September 2026',
  options:Object.fromEntries(Object.entries({DDSHOW:'900',DDGAMES:'0',DropDownList1:'Off',DDPOS:'All',DDTSUM:'All',DDDURATION:'0',DDRANK:'AVG'}).map(([k,value])=>[k,{value,label:k==='DDDURATION'?'2026-27 Rest of Season Projections':value}])),headers,
  rows:Array.from({length:100},(_,i)=>({playerName:i?'Player '+i:'Example Player',playerLink:'/'+(9000+i)+'/player',cells:[i?'Player '+i:'Example Player','72','32','0.500 (10.0/20.0)','0.800 (4.0/5.0)','2','26','10','5','1','1']}))};}
function fixture(){const f=nativeFixture();f.set(f.c.ESPN_PLAYER_HUB_V2.playersSheet,[['season_id','player_id','full_name'],...snapshot().rows.map((r,i)=>[2027,String(i+1),r.playerName])]);return f;}
test('source parser requires complete unblended 2026/27 averages and real shot volume',()=>{
  const {c}=fixture(),s=snapshot(),rows=c.parseHashtagSnapshotV75_(s,stamp);
  assert.equal(rows.length,100);assert.equal(rows[0].FGM,10);assert.equal(rows[0].FGA,20);assert.equal(rows[0].provider_updated_at,'2026-09-05');
  for(const change of [x=>x.options.DDDURATION.label='2025-26 Rest of Season Projections',x=>x.options.DDRANK.value='TOT',x=>x.options.DDSHOW.value='200',x=>x.rows.pop(),x=>x.rows[0].cells[3]='0.500',x=>x.rows[1]=x.rows[0],x=>x.updatedText='Updated: 31 February 2026']){
    const copy=snapshot();change(copy);assert.throws(()=>c.parseHashtagSnapshotV75_(copy,stamp));
  }
});
test('authenticated import persists bindings, preserves other sources and recalculates even under throttle',()=>{
  const f=fixture(),{c,props}=f;const before=c.buildDraftProjectionsV72_().projectionEngine.players.find(p=>p.id==='1');assert.equal(before.base.PTS,20);
  const r=c.importHashtagSnapshotV75_(snapshot());assert.equal(r.mapping.matched,100);
  assert.equal(JSON.parse(props.get(c.FBA_CONSENSUS_V44.statusKey)).importsDirty,true);
  const out=c.buildDraftProjectionsV72_(),p=out.projectionEngine.players.find(p=>p.id==='1');
  assert.equal(p.base.PTS,23);assert.equal(p.consensus.fields.FGA.length,2);assert.equal(p.base.FGA,17);assert.equal(p.projectedGp,71);
  assert.equal(c.sheetObjectsV2_(c.FBA_CONSENSUS_V44.inputs).filter(r=>r.source_id==='cbs').length,1);
  assert.equal(c.sheetObjectsV2_(c.FBA_HASHTAG_V75.mapSheet).length,100);
  const status=out.projectionEngine.consensus.sources.find(s=>s.id==='hashtag');assert.equal(status.refreshMode,'browser_bridge');assert.equal(status.providerUpdatedAt,'2026-09-05');
  const next=snapshot();next.rows[0].cells[6]='30';c.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-09-06T22:31:00Z']));}};
  c.importHashtagSnapshotV75_(next);const after=c.buildDraftProjectionsV72_().projectionEngine.players.find(p=>p.id==='1');
  assert.equal(after.base.PTS,25);assert.equal(after.consensus.sourceCount,2);
  assert.equal(c.sheetObjectsV2_(c.FBA_CONSENSUS_V44.inputs).filter(r=>r.source_id==='hashtag').length,100);
  assert.equal(f.fetches(),0);
});
test('identity conflicts and shortened snapshots cannot overwrite the last valid data',()=>{
  const f=fixture(),{c}=f;c.importHashtagSnapshotV75_(snapshot());const prior=JSON.stringify(c.sheetObjectsV2_(c.FBA_CONSENSUS_V44.inputs));
  const bad=snapshot();bad.rows[0].playerName='Wrong Person';const rows=c.parseHashtagSnapshotV75_(bad,stamp),map=c.mapHashtagPlayersV75_(rows,c.consensusIdentityIndexV44_(c.sheetObjectsV2_(c.ESPN_PLAYER_HUB_V2.playersSheet)),c.sheetObjectsV2_(c.FBA_HASHTAG_V75.mapSheet),stamp);
  assert.equal(map.audit.issues[0].reason,'PROVIDER_NAME_CHANGED');
  const short=snapshot();short.rows.pop();assert.throws(()=>c.importHashtagSnapshotV75_(short));
  assert.equal(JSON.stringify(c.sheetObjectsV2_(c.FBA_CONSENSUS_V44.inputs)),prior);
});
test('HTTP import refuses unauthenticated and frozen writes',()=>{
  const f=fixture(),{c}=f;c.monsterJsonResponseV29_=x=>x;c.validMonsterDeviceV29_=()=>false;
  const p={action:'hashtag_import',token:'fixture-token',snapshot:snapshot()};
  assert.equal(c.doPost({postData:{contents:JSON.stringify(p)}}).locked,true);assert.equal(f.writes(),0);
  c.validMonsterDeviceV29_=()=>true;f.props.set(c.FBA_CONSENSUS_V44.freezeKey,'1');
  const result=c.doPost({postData:{contents:JSON.stringify(p)}});assert.equal(result.ok,false);assert.match(result.error,/eingefroren/);assert.equal(f.writes(),0);
});
test('bridge allows only FBA origin, reloads Hashtag and posts to the fixed authenticated backend',async()=>{
  const listeners=[],posts=[],navigations=[];let reads=0;const data=snapshot();
  const c={URL,Date,Promise,setTimeout:f=>f(),chrome:{runtime:{id:'bridge-id',onMessage:{addListener:fn=>listeners.push(fn)}},tabs:{query:async()=>[{id:4,url:data.sourceUrl+'#fba-sync'}],reload:async id=>navigations.push(id),get:async()=>({status:'complete',url:data.sourceUrl+'#fba-sync'}),sendMessage:async()=>{reads++;return {ready:true,loadedAt:Date.now()+1,snapshot:data};}}},fetch:async(url,opts)=>{posts.push({url,opts});return {ok:true,json:async()=>({ok:true,lastChecked:stamp,mapping:{matched:100}})};}};
  vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../extensions/fba-bridge/hashtag-background.js',import.meta.url),'utf8'),c);
  const fn=listeners[0],request={type:'FBA_HASHTAG_SYNC',token:'fixture-token'},sender={id:'bridge-id',tab:{id:1},frameId:0,url:'https://fba-control-center.netlify.app/'};
  let answered=false;fn(request,{...sender,url:'https://evil.example/'},()=>answered=true);assert.equal(answered,false);assert.equal(posts.length,0);
  const result=await new Promise(resolve=>fn(request,sender,resolve));assert.equal(result.ok,true);assert.deepEqual(navigations,[4]);assert.equal(reads,1);
  assert.match(posts[0].url,/^https:\/\/script.google.com\/macros\/s\//);assert.equal(posts[0].opts.credentials,'omit');assert.equal(JSON.parse(posts[0].opts.body).token,'fixture-token');assert.ok(!JSON.stringify(result).includes('fixture-token'));
});
