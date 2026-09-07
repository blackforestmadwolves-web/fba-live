import assert from 'node:assert/strict';
import {test} from 'node:test';
import {nativeFixture} from './draft-projections-v72.test.mjs';
function fixture(){
  const f=nativeFixture(),{c}=f;
  const snapshot={sourceUrl:'https://hashtagbasketball.com/import-v4/fantasy-basketball-projections',heading:'Fantasy Basketball Projections',updatedText:'Updated: 05 September 2026',
    options:Object.fromEntries(Object.entries({DDSHOW:'900',DDGAMES:'0',DropDownList1:'Off',DDPOS:'All',DDTSUM:'All',DDDURATION:'0',DDRANK:'AVG'}).map(([k,value])=>[k,{value,label:k==='DDDURATION'?'2026-27 Rest of Season Projections':value}])),headers:['PLAYER','GP','MPG','FG%','FT%','3PM','PTS','TREB','AST','STL','BLK'],
    rows:Array.from({length:100},(_,i)=>({playerName:i?'Player '+i:'Example Player',playerLink:'/'+(9000+i)+'/player',cells:[i?'Player '+i:'Example Player','72','32','0.500 (10.0/20.0)','0.800 (4.0/5.0)','2','26','10','5','1','1']}))};
  f.set(c.ESPN_PLAYER_HUB_V2.playersSheet,[['season_id','player_id','full_name'],...snapshot.rows.map((r,i)=>[2027,String(i+1),r.playerName])]);
  const enqueue=(s=snapshot,stamp='2026-09-06T22:29:00Z',id='cloud-snapshot-001')=>{
    const {rows,...meta}=s;
    f.set(c.FBA_HASHTAG_CLOUD_V76.sheet,[['snapshot_id','observed_at','metadata_json','row_json','','import_status','','fetch_status'],...rows.map((r,i)=>[i?'':id,i?'':stamp,i?'':JSON.stringify({...meta,rowCount:rows.length}),JSON.stringify(r),'','','',i?'':JSON.stringify({enabled:true,state:'READY',lastAttempt:stamp})])]);
  };
  return {...f,snapshot,enqueue,ack:()=>JSON.parse(f.sheets.get(c.FBA_HASHTAG_CLOUD_V76.sheet).rows[1][5])};
}
test('private cloud inbox activates consensus and acknowledges exactly once without fetching',()=>{
  const f=fixture();f.c.buildDraftProjectionsV72_();f.enqueue();
  const out=f.c.buildDraftProjectionsV72_();assert.equal(out.projectionEngine.players.find(p=>p.id==='1').base.PTS,23);
  const h=out.projectionEngine.consensus.sources.find(s=>s.id==='hashtag');assert.equal(h.refreshMode,'cloud_browser');assert.equal(h.cloudSync.importState,'READY');
  assert.equal(f.ack().mapping.matched,100);const before=f.writes();f.c.buildDraftProjectionsV72_();assert.equal(f.writes(),before);assert.equal(f.fetches(),0);
});
test('bad, stale and incomplete cloud captures retain the current good projections',()=>{
  for(const corrupt of [f=>f.snapshot.options.DDDURATION.label='2025-26',f=>f.snapshot.rows[0].cells[3]='0.500',f=>f.snapshot.rows.pop()]){
    const f=fixture();f.c.importHashtagSnapshotV75_(f.snapshot);const before=JSON.stringify(f.c.sheetObjectsV2_(f.c.FBA_CONSENSUS_V44.inputs));corrupt(f);f.enqueue();f.c.processHashtagCloudInboxV76_();assert.equal(f.ack().state,'REJECTED');assert.equal(JSON.stringify(f.c.sheetObjectsV2_(f.c.FBA_CONSENSUS_V44.inputs)),before);
  }
  const f=fixture();f.enqueue(f.snapshot,'2026-09-01T00:00:00Z');f.c.processHashtagCloudInboxV76_();assert.equal(f.ack().state,'REJECTED');
});
test('older cloud captures cannot overwrite a later bridge import; freeze is preserved',()=>{
  const f=fixture();f.c.importHashtagSnapshotV75_(f.snapshot);f.snapshot.rows[0].cells[6]='99';f.enqueue();f.c.processHashtagCloudInboxV76_();assert.equal(f.ack().state,'SKIPPED');assert.equal(f.c.sheetObjectsV2_(f.c.FBA_CONSENSUS_V44.inputs).find(r=>r.source_id==='hashtag').PTS,26);
  f.enqueue(f.snapshot,'2026-09-06T22:30:00Z','cloud-frozen-002');f.props.set(f.c.FBA_CONSENSUS_V44.freezeKey,'1');f.c.processHashtagCloudInboxV76_();assert.equal(f.ack().state,'FROZEN');
});
test('public request cannot consume inbox; source login failure remains visible with good data intact',()=>{
  const f=fixture();f.enqueue();f.c.monsterJsonResponseV29_=x=>x;assert.equal(f.c.matchupMonsterResponseV30_({monster:'draft_projections'}).locked,true);assert.equal(f.writes(),0);
  f.c.buildDraftProjectionsV72_();f.sheets.get(f.c.FBA_HASHTAG_CLOUD_V76.sheet).rows[1][7]=JSON.stringify({enabled:true,state:'AUTH_REQUIRED',lastAttempt:'2026-09-06T22:30:00Z',message:'Bitte sicher anmelden.'});
  const out=f.c.buildDraftProjectionsV72_();assert.equal(out.projectionEngine.players.find(p=>p.id==='1').base.PTS,23);assert.equal(out.projectionEngine.consensus.sources.find(s=>s.id==='hashtag').cloudSync.state,'AUTH_REQUIRED');
});
