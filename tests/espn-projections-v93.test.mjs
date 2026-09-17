import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {nativeFixture} from './draft-projections-v72.test.mjs';
const perGame={PTS:30,REB:10,AST:8,'3PM':2,STL:1,BLK:1,FGM:10,FGA:20,FTM:8,FTA:10};
function setup(){
 const f=nativeFixture(),c=f.c;
 c.FBA_EXPERT_POLICY_V71.confirmedSources=['espn','cbs','lineupexperts','hashtag'];
 c.stableHashV36_=value=>String(value.length);
 const espn=(id='1',changes={})=>({player:{id,fullName:id==='1'?'Example Player':'ESPN Only',proTeamId:1,defaultPositionId:1,stats:[{seasonId:2027,statSourceId:1,statSplitTypeId:0,stats:{42:80,...Object.fromEntries(Object.entries(perGame).map(([key,value])=>[c.FBA_PROJECTION_ENGINE_V36.projectionStatIds[key],value*80])),...changes}}]}});
 let requests=0,hub={seasonId:2027,players:[espn(),espn('2')]};
 c.fetchEspnFantasyHubV2_=()=>{requests++;return hub;};
 return {...f,espn,requests:()=>requests,setHub:value=>hub=value};
}
test('first private load imports ESPN and merges all four independent sources',()=>{
 const f=setup(),{c}=f;
 const headers=Array.from(c.FBA_CONSENSUS_INPUT_HEADERS_V44);
 const rows=f.sheets.get(c.FBA_CONSENSUS_V44.inputs).rows;
 const extra=(id,pts)=>headers.map(h=>({source_id:id,season_id:2027,player_id:'1',full_name:'Example Player',basis:'per_game',projected_gp:60,snapshot_date:'2026-09-06',...perGame,PTS:pts,...(id==='lineupexperts'?{FGM:'',FGA:'',FTM:'',FTA:''}:{})})[h]??'');
 rows.push(extra('hashtag',22),extra('lineupexperts',24));
 const out=c.buildDraftProjectionsV72_(),engine=out.projectionEngine,p=engine.players.find(p=>p.id==='1');
 assert.deepEqual(Array.from(p.consensus.sourceIds),['cbs','espn','hashtag','lineupexperts']);
 assert.equal(p.base.PTS,(20+30+22+24)/4);
 assert.equal(p.base.FGM,9);assert.equal(p.base.FGA,18);assert.equal(p.projectedGp,68);
 assert.equal(p.consensus.fields.PTS.length,4);assert.equal(p.consensus.fields.FGA.length,3);
 assert.equal(engine.players.find(p=>p.id==='2').base.PTS,30);
 assert.equal(f.requests(),1);c.buildDraftProjectionsV72_();assert.equal(f.requests(),1,'No repeated migration fetch');
 const source=engine.consensus.sources.find(s=>s.id==='espn');
 assert.equal(source.rows,2);assert.equal(source.contributing,true);assert.equal(source.refreshMode,'native');assert.ok(source.lastChecked);
 assert.equal(engine.consensus.rosReady,false);assert.equal(engine.consensus.projectionHorizon,'season');
});
test('missing stats, wrong season/source/split and invalid shooting are rejected without zero filling',()=>{
 const {c,espn}=setup();
 for(const field of Object.keys(perGame)){
  const p=espn().player;delete p.stats[0].stats[c.FBA_PROJECTION_ENGINE_V36.projectionStatIds[field]];
  assert.equal(c.projectionRowForPlayerV36_(p,'2026-09-06'),null,field);
 }
 for(const change of [{seasonId:2026},{statSourceId:0},{statSplitTypeId:1}]){
  const p=espn().player;Object.assign(p.stats[0],change);assert.equal(c.projectionRowForPlayerV36_(p,'2026-09-06'),null);
 }
 assert.equal(c.projectionRowForPlayerV36_(espn('1',{13:9000}).player,'2026-09-06'),null);
 assert.equal(c.projectionRowForPlayerV36_(espn('1',{1:0}).player,'2026-09-06')[11],0,'A genuine zero is valid');
});
test('partial ESPN refresh updates present players and keeps missing players with original dates',()=>{
 const f=setup(),{c}=f;c.buildDraftProjectionsV72_();
 f.setHub({seasonId:2027,players:[f.espn('1',{0:3200})]});
 f.props.delete(c.FBA_CONSENSUS_V44.statusKey);
 c.refreshProjectionConsensusV44_(true,true);
 const rows=c.consensusStoredRowsV44_(c.FBA_CONSENSUS_V44.snapshots).filter(r=>r.sourceId==='espn');
 assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id==='1').base.PTS,40);assert.equal(rows.find(r=>r.id==='2').base.PTS,30);
 assert.equal(c.consensusStatusV44_().sources.find(s=>s.id==='espn').retainedPlayers,1);
});
test('wrong-season ESPN response does not remove a valid CBS consensus',()=>{
 const f=setup();f.setHub({seasonId:2026,players:[f.espn()]});
 const engine=f.c.buildDraftProjectionsV72_().projectionEngine;
 assert.deepEqual(Array.from(engine.players[0].consensus.sourceIds),['cbs']);
 assert.equal(engine.consensus.sources.find(s=>s.id==='espn').contributing,false);
});
test('draft can use season consensus while ROS consumers are explicitly blocked',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const start=html.indexOf('function monsterProjectionEngineState('),end=html.indexOf('function monsterExpertSourceLabel(',start);
 const c={console,Date,monsterProjectionUsableNode:()=>true,monsterProjectionProfilesReady:()=>false};
 vm.createContext(c);vm.runInContext(html.slice(start,end),c);
 const engine={season:2027,active:true,status:'READY',baseline:{season:2027,status:'READY'},actual:{coverageReady:true},players:[{id:'1',actual:{gp:0}}],consensus:{appliedPlayers:1,preseason:true,projectionHorizon:'season',rosReady:false,rosIssue:'ROS required'}};
 assert.equal(c.monsterProjectionEngineState({projectionEngine:engine},null,{purpose:'draft'}).ready,true);
 assert.equal(c.monsterProjectionEngineState({projectionEngine:engine}).ready,false);
 assert.equal(c.monsterExpertProjectionState({projectionEngine:engine}).issue,'ROS required');
});
