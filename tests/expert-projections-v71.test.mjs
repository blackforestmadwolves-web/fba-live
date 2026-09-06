import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
const code=fs.readFileSync(new URL('../apps-script/Code.js',import.meta.url),'utf8');
const now='2026-09-06T12:00:00Z';
const stats={PTS:20,REB:8,AST:4,'3PM':2,STL:1,BLK:1,FGM:7,FGA:14,FTM:4,FTA:5};
export function fixture(){
  const c={console,Date,JSON};vm.createContext(c);vm.runInContext(code,c);
  const sheets=new Map(),props=new Map();let actualGames=0,fetches=0,writes=0;
  c.Date=class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return Date.parse(now);}};
  c.espnPropertiesV1_=()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)});
  c.sheetObjectsV2_=n=>sheets.get(n)||[];c.ensureSimpleEspnSheetV1_=()=>({});
  c.writeConsensusRowsV44_=(n,headers,rows)=>{writes++;sheets.set(n,rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]]))));};
  c.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
  c.aggregateProjectionActualsV36_=()=>({completeGames:actualGames});c.stableHashV36_=v=>createHash('sha256').update(v).digest('hex');
  c.fetchEspnFantasyHubV2_=()=>{fetches++;throw Error('Unexpected provider fetch');};
  c.UrlFetchApp={fetch:()=>{fetches++;throw Error('Unexpected provider fetch');}};
  const metadata=[{player_id:'1',full_name:'Test Player',season_id:2027}];
  const input=(source='cbs',changes={})=>({source_id:source,season_id:2027,player_id:'1',full_name:'Test Player',basis:'per_game',projected_gp:70,snapshot_date:'2026-09-06',...stats,...changes});
  sheets.set(c.ESPN_PLAYER_HUB_V2.playersSheet,metadata);sheets.set(c.FBA_CONSENSUS_V44.inputs,[input()]);
  const engine=()=>({version:36,season:2027,active:true,status:'READY',baseline:{season:2027,active:true,status:'READY'},revision:'qa',players:[{id:'1',base:{...stats,PTS:60},projectedGp:82,actual:{gp:0,totals:{},byWeek:{}}},{id:'2',base:{...stats,PTS:70},projectedGp:82,actual:{gp:0,totals:{},byWeek:{}}}],actual:{completeGames:actualGames,coverageReady:true}});
  return {c,sheets,props,input,engine,stats,fetches:()=>fetches,writes:()=>writes,setActual:n=>actualGames=n};
}
test('first private load activates confirmed CBS imports, excludes archived Yahoo and requires no extra refresh',()=>{
  const f=fixture(),{c,sheets}=f,index=c.consensusIdentityIndexV44_(sheets.get(c.ESPN_PLAYER_HUB_V2.playersSheet));
  const archived=c.normalizeConsensusRowV44_(f.input('yahoo',{PTS:40}),index,now).row;
  sheets.set(c.FBA_CONSENSUS_V44.snapshots,[{season_id:2027,payload_json:JSON.stringify(archived)}]);
  const engine=f.engine(),actual=engine.actual,out=c.applyProjectionConsensusV44_(engine);
  assert.equal(out.active,true);assert.equal(out.players[0].base.PTS,20);assert.equal(out.players[1].base,null);
  assert.deepEqual(Array.from(out.players[0].consensus.sourceIds),['cbs']);assert.equal(out.actual,actual);
  assert.equal(out.consensus.sources.find(s=>s.id==='yahoo').state,'WAITING_CONFIRMATION');
  assert.equal(sheets.get(c.FBA_CONSENSUS_V44.snapshots).length,2,'Archive retained without contributing');
  assert.equal(f.fetches(),0);const writes=f.writes();c.applyProjectionConsensusV44_(f.engine());assert.equal(f.writes(),writes,'Migration runs once');
});
test('a later confirmed independent source merges raw stats and shooting volume',()=>{
  const f=fixture(),{c,sheets}=f;c.FBA_EXPERT_POLICY_V71.confirmedSources.push('espn');
  sheets.set(c.FBA_CONSENSUS_V44.inputs,[f.input(),f.input('espn',{PTS:30,FGM:9,FGA:24,projected_gp:80})]);
  const p=c.applyProjectionConsensusV44_(f.engine()).players[0];
  assert.equal(p.base.PTS,25);assert.equal(p.base.FGM,8);assert.equal(p.base.FGA,19);assert.equal(p.projectedGp,75);assert.equal(p.consensus.sourceCount,2);
  assert.notEqual(p.base.FGM/p.base.FGA,(.5+9/24)/2,'Ratios come from merged shot volume');assert.equal(f.fetches(),0);
});
test('missing, stale and wrong-season imports do not activate a historical or unconfirmed forecast',()=>{
  for(const inputs of [[],[{snapshot_date:'2026-07-01'}],[{season_id:2026}],[{FGA:null}]]){
    const f=fixture();f.sheets.set(f.c.FBA_CONSENSUS_V44.inputs,inputs.map(row=>f.input('cbs',row)));
    const out=f.c.applyProjectionConsensusV44_(f.engine());assert.equal(out.active,false);assert.equal(out.consensus.appliedPlayers,0);assert.equal(out.players[0].base,null);
  }
});
test('first-load import never replaces a frozen baseline after actual games begin',()=>{
  const f=fixture();f.setActual(1);const out=f.c.applyProjectionConsensusV44_(f.engine());
  assert.equal(out.consensus.frozen,true);assert.equal(out.consensus.appliedPlayers,0);assert.equal(f.writes(),0);
});
test('public and unauthenticated dispatch cannot activate or expose private imports',()=>{
  const f=fixture();f.c.validMonsterDeviceV29_=()=>false;f.c.monsterJsonResponseV29_=x=>x;
  for(const monster of ['data','projections_refresh'])assert.equal(f.c.matchupMonsterResponseV30_({monster,token:'bad'}).locked,true);
  assert.equal(f.writes(),0);assert.equal(f.fetches(),0);assert.doesNotMatch(String(f.c.buildData),/FBA_Projection|applyProjectionConsensus|expertSnapshot|consensusStoredRows/);
});
