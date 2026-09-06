import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

// Exercise the real sheet reader/writer, aggregator, consensus and draft payload.
// Only Google service boundaries are emulated; no projection helper is replaced.
export function nativeFixture(){
  const sheets=new Map(),props=new Map();let fetches=0,writes=0;
  function sheet(rows=[]){
    const s={rows:rows.map(r=>r.slice()),maxRows:1000,getLastRow(){return this.rows.length;},getMaxRows(){return this.maxRows;},insertRowsAfter(_,count){this.maxRows+=count;},setFrozenRows(){},getDataRange(){return this.getRange(1,1,Math.max(1,this.rows.length),Math.max(1,...this.rows.map(r=>r.length)));},getRange(r,c,n=1,m=1){
      const range={getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>s.rows[r+i-1]?.[c+j-1]??'')),getValue:()=>s.rows[r-1]?.[c-1]??'',setValues(values){assert.equal(values.length,n);writes++;values.forEach((row,i)=>{assert.equal(row.length,m);s.rows[r+i-1]??=[];row.forEach((v,j)=>s.rows[r+i-1][c+j-1]=v);});return range;},setFontWeight:()=>range,setBackground:()=>range};return range;
    }};return s;
  }
  const book={getSheetByName:n=>sheets.get(n)||null,insertSheet(n){const s=sheet();sheets.set(n,s);return s;},getSpreadsheetTimeZone:()=> 'America/Los_Angeles'};
  const properties={getProperty:k=>props.get(k)||null,getProperties:()=>Object.fromEntries(props),setProperty(k,v){props.set(k,v);return properties;},deleteProperty:k=>props.delete(k)};
  const c={console,JSON,Date:class extends Date{constructor(...args){super(...(args.length?args:['2026-09-06T22:30:00Z']));}static now(){return Date.parse('2026-09-06T22:30:00Z');}},SpreadsheetApp:{getActive:()=>book},PropertiesService:{getScriptProperties:()=>properties},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},Utilities:{formatDate:(date)=>date.toISOString().slice(0,10)},UrlFetchApp:{fetch(){fetches++;throw Error('ESPN unavailable');}}};
  vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.js',import.meta.url),'utf8'),c);
  const set=(name,rows)=>sheets.set(name,sheet(rows));
  set(c.ESPN_PLAYER_HUB_V2.playersSheet,[['season_id','player_id','full_name'],[2027,'1','Example Player']]);
  set(c.FBA_CONSENSUS_V44.inputs,[Array.from(c.FBA_CONSENSUS_INPUT_HEADERS_V44),['cbs',2027,'1','Example Player','per_game',70,'','2026-09-06','https://www.cbssports.com/','',20,8,4,2,1,1,7,14,4,5]]);
  set(c.FBA_CONSENSUS_V44.baseline,[Array.from(c.FBA_CONSENSUS_BASELINE_HEADERS_V44)]);
  return {c,sheets,props,set,fetches:()=>fetches,writes:()=>writes};
}

test('native sheet round trip activates CBS without any external request',()=>{
  const f=nativeFixture(),out=f.c.buildDraftProjectionsV72_();
  assert.equal(out.version,72);assert.equal(out.scope,'draft-projections');assert.equal(out.projectionEngine.consensus.appliedPlayers,1);
  assert.equal(out.projectionEngine.players[0].base.PTS,20);assert.equal(out.projectionEngine.players[0].base['3PM'],2);
  assert.equal(f.fetches(),0);assert.equal(f.sheets.get(f.c.FBA_CONSENSUS_V44.baseline).rows.length,2);
  assert.equal(out.projectionEngine.consensus.preseason,true);assert.equal(out.projectionEngine.actual.coverageReady,false,'Existing Monster actual-data gate stays unchanged');
});
test('a previous v71 empty migration retries prepared inputs despite the provider throttle',()=>{
  const f=nativeFixture();f.props.set(f.c.FBA_CONSENSUS_V44.statusKey,JSON.stringify({policyVersion:71,lastAttempt:'2026-09-06T22:29:59Z',status:'PARTIAL'}));
  assert.equal(f.c.buildDraftProjectionsV72_().projectionEngine.consensus.appliedPlayers,1);assert.equal(f.fetches(),0);
});
test('frozen baseline policy still prevents initialization',()=>{
  const f=nativeFixture();f.props.set(f.c.FBA_CONSENSUS_V44.freezeKey,'1');const out=f.c.buildDraftProjectionsV72_();
  assert.equal(out.projectionEngine.consensus.appliedPlayers,0);assert.equal(out.projectionEngine.consensus.frozen,true);
  assert.equal(f.sheets.get(f.c.FBA_CONSENSUS_V44.baseline).rows.length,1);
});
test('new private route rejects an unauthenticated caller before any sheet access or import',()=>{
  const f=nativeFixture();f.c.monsterJsonResponseV29_=x=>x;
  const out=f.c.matchupMonsterResponseV30_({monster:'draft_projections'});
  assert.equal(out.locked,true);assert.equal(f.writes(),0);assert.equal(f.fetches(),0);
});
test('scheduled projection refresh still runs if ESPN sync throws',()=>{
  const f=nativeFixture();let checked=0;f.c.syncEspnIfStale_=()=>{throw Error('ESPN failed');};f.c.refreshProjectionConsensusV44_=()=>checked++;
  assert.throws(()=>f.c.syncEspnScheduled(),/ESPN failed/);assert.equal(checked,1);
});
