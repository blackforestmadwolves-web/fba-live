import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../espn-mock-core.js';
import {harness} from './helpers/draft-frontend-harness.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const raw=JSON.parse(read('tests/fixtures/espn-mock-room-20260905.json'));
const clone=o=>JSON.parse(JSON.stringify(o));
const meta=core.metadata(raw,core.room(String(raw.id)));
const teams=['A','B','C','D','E','Wolves','G','H'];
const config={...meta,ownSlot:2,ownTeam:'Wolves',fbaTeams:core.teamOrder(teams,'Wolves',2)};
const pool=Array.from({length:104},(_,i)=>({id:String(100+i),name:i?'Test Player '+i:'Nikola Jokić'}));
const snapshot=(n,cfg=config,players=pool)=>({protocol:1,leagueId:cfg.leagueId,seasonId:cfg.seasonId,teamId:cfg.teams[cfg.ownSlot-1].id,observedAt:Date.now(),ready:true,picks:players.slice(0,n).map((p,i)=>({overall:i+1,playerId:p.id,name:p.name,team:cfg.teams[core.slotFor(i+1)-1].name}))});

test('real public ESPN room metadata is checked, credentials in pasted URLs are discarded',()=>{
 const room=core.room(`https://fantasy.espn.com/basketball/draft?leagueId=${raw.id}&seasonId=2027&teamId=2&memberId=DO-NOT-STORE`);
 assert.deepEqual(room,{leagueId:String(raw.id),seasonId:2027,teamId:2});
 assert.equal(meta.teams.length,8);assert.deepEqual(config.fbaTeams,['A','Wolves','B','C','D','E','G','H']);
 for(const url of ['https://evil.test/basketball/draft?leagueId=1','https://fantasy.espn.com/football/draft?leagueId=1','javascript:alert(1)','0'])assert.throws(()=>core.room(url));
 for(const mutate of [r=>r.settings.size=10,r=>r.settings.draftSettings.type='AUCTION',r=>r.settings.isPublic=false,r=>r.settings.draftSettings.leagueSubType='STANDARD',r=>r.settings.draftSettings.pickOrder[0]=2,r=>r.teams[0].name=r.teams[1].name,r=>r.seasonId=2026,r=>r.draftDetail.picks[8].teamId=1,r=>r.draftDetail.picks.pop()]){
  const data=clone(raw);mutate(data);assert.throws(()=>core.metadata(data,core.room(String(raw.id))));
 }
});

test('all 104 picks keep ESPN snake ownership, IDs and exact normalized names resolve without guesses',()=>{
 const data=snapshot(104),before=JSON.stringify(data),out=core.picks(data,config,pool);
 assert.equal(out.length,104);assert.equal(out[1].team,'Wolves');assert.equal(out[14].team,'Wolves');assert.equal(out[8].team,'H');
 assert.equal(out.filter(p=>p.team==='Wolves').length,13);assert.equal(JSON.stringify(data),before);
 const names=snapshot(1);names.picks[0].playerId=null;names.picks[0].name='Nikola Jokic';assert.equal(core.picks(names,config,pool)[0].playerId,'100');
 names.picks[0].name='N. Jokic';assert.throws(()=>core.picks(names,config,pool),/nicht eindeutig/);
 const unknown=snapshot(1);unknown.picks[0].playerId='99999999';assert.throws(()=>core.picks(unknown,config,pool),/nicht eindeutig/);
});

test('partial, duplicate, conflicting and foreign snapshots fail; valid corrections require a separate decision',()=>{
 for(const mutate of [s=>s.picks.splice(1,1),s=>s.picks[1].playerId=s.picks[0].playerId,s=>s.picks[0].team='Other',s=>s.leagueId='987654',s=>s.seasonId=2026,s=>s.picks[0].overall=1.5,s=>s.ready=false]){
  const data=snapshot(12);mutate(data);assert.throws(()=>core.picks(data,config,pool));
 }
 const duplicated=snapshot(2);duplicated.picks.push(clone(duplicated.picks[0]));assert.equal(core.picks(duplicated,config,pool).length,2);
 duplicated.picks.at(-1).playerId='105';assert.throws(()=>core.picks(duplicated,config,pool),/widersprüchlich/);
 const old=core.picks(snapshot(10),config,pool),more=core.picks(snapshot(11),config,pool),less=core.picks(snapshot(9),config,pool);
 assert.equal(core.changed(old,more),false);assert.equal(core.changed(old,less),true);
});

function frontend(count=16){
 const {c,storage,elements}=harness(count),sent=[];
 c.FBA_ESPN_MOCK_CORE=core;c.URL=URL;c.AbortController=AbortController;c.setTimeout=setTimeout;c.clearTimeout=clearTimeout;
 c.setInterval=()=>0;c.addEventListener=()=>{};c.location={origin:'https://fba-control-center.netlify.app'};c.postMessage=packet=>sent.push(clone(packet));
 c.fetch=async()=>({ok:true,json:async()=>clone(raw)});
 elements.set('espnMockStatus',{textContent:'',dataset:{}});
 vm.runInContext(read('espn-mock.js'),c);
 const roomConfig=()=>({...meta,ownSlot:2,ownTeam:'BlackForest Mad Wolves',fbaTeams:Array.from(c.draftTeams())});
 function deliver(data,overrides={}){
  c.mockIncoming={type:'FBA_MOCK_RESPONSE',protocol:1,nonce:sent.at(-1).nonce,response:clone(data),...overrides};
  vm.runInContext('FBA_ESPN_MOCK.receive({source:window,origin:location.origin,data:mockIncoming})',c);
 }
 return {c,storage,elements,sent,roomConfig,deliver};
}

test('mock session imports live snapshots, guards manual actions, retains all strategy features and restores the local draft',async()=>{
 const {c,storage,roomConfig,deliver}=frontend();c.saveDraftState();
 const old=JSON.stringify(c.DRAFT_STATE),stored=storage.get('test-draft');
 assert.equal(await c.FBA_ESPN_MOCK.connect(String(raw.id),2),true);
 assert.equal(c.draftTeams()[1],'BlackForest Mad Wolves');assert.equal(c.DRAFT_STATE.picks.length,0);
 deliver(snapshot(24,roomConfig(),c.draftPool()));assert.equal(c.DRAFT_STATE.picks.length,24);
 assert.equal(c.DRAFT_STATE.picks[1].team,'BlackForest Mad Wolves');
 const frozen=JSON.stringify(c.DRAFT_STATE.picks);
 c.selectDraftPlayer(c.draftPool()[30].id);c.removeDraftPick(1);c.undoDraftPick();c.resetDraftTest(true);
 assert.equal(JSON.stringify(c.DRAFT_STATE.picks),frozen);
 c.setDraftCoachGoal('punt');c.toggleDraftPunt('AST');c.setDraftPlayerSort('merge');
 assert.equal(c.DRAFT_STATE.sort,'merge');assert.ok(c.draftCoachContext().tiles.find(t=>t.cat==='AST').punted);
 const next=c.draftCoachContext().recommendations[0].player;c.showDraftCoachPreview(next.id);
 assert.equal(JSON.stringify(c.DRAFT_STATE.picks),frozen);assert.match(c.draftCoachPreviewMarkup(),/disabled>Pick erfolgt in ESPN/);
 assert.match(c.pgDraftRoom(),/disabled>Pick erfolgt in ESPN/);
 assert.equal(storage.get('test-draft'),stored,'manual storage is isolated');
 assert.equal(JSON.parse(storage.get('fba_espn_mock_v1')).state.picks.length,24);
 c.FBA_ESPN_MOCK.disconnect();assert.equal(JSON.stringify(c.DRAFT_STATE),old);assert.equal(c.espnDraftReadOnly(),false);
 assert.equal(await c.FBA_ESPN_MOCK.connect(String(raw.id),2),true);assert.equal(c.DRAFT_STATE.picks.length,24);
 c.FBA_ESPN_MOCK.disconnect();
});

test('wrong source, stale packets, replays and partial reads cannot change the mock; corrections are explicit',async()=>{
 const {c,roomConfig,deliver,elements}=frontend();await c.FBA_ESPN_MOCK.connect(String(raw.id),2);
 deliver(snapshot(16,roomConfig(),c.draftPool()),{nonce:'wrong'});assert.equal(c.DRAFT_STATE.picks.length,0);
 deliver(snapshot(16,roomConfig(),c.draftPool()));assert.equal(c.DRAFT_STATE.picks.length,16);
 c.FBA_ESPN_MOCK.tick();const incomplete=snapshot(17,roomConfig(),c.draftPool());incomplete.picks.splice(3,1);deliver(incomplete);
 assert.equal(c.DRAFT_STATE.picks.length,16);assert.match(elements.get('espnMockStatus').textContent,/fehlen Picks/);
 c.FBA_ESPN_MOCK.tick();const stale=snapshot(17,roomConfig(),c.draftPool());stale.observedAt=0;deliver(stale);assert.equal(c.DRAFT_STATE.picks.length,16);
 c.FBA_ESPN_MOCK.tick();deliver(snapshot(15,roomConfig(),c.draftPool()));assert.equal(c.DRAFT_STATE.picks.length,16);
 assert.match(c.FBA_ESPN_MOCK.markup(),/Geänderten ESPN-Stand übernehmen/);c.FBA_ESPN_MOCK.acceptCorrection();assert.equal(c.DRAFT_STATE.picks.length,15);
 c.FBA_ESPN_MOCK.tick();c.FBA_ESPN_MOCK.togglePause();deliver(snapshot(17,roomConfig(),c.draftPool()));assert.equal(c.DRAFT_STATE.picks.length,15);
 c.FBA_ESPN_MOCK.disconnect();deliver(snapshot(18,roomConfig(),c.draftPool()));assert.equal(c.DRAFT_STATE.picks.length,16);
});

test('incompatible ESPN room or failed metadata leaves manual state untouched and team ID in URL maps own slot',async()=>{
 const {c}=frontend();const before=JSON.stringify(c.DRAFT_STATE);
 c.fetch=async()=>({ok:false});assert.equal(await c.FBA_ESPN_MOCK.connect(String(raw.id),2),false);assert.equal(JSON.stringify(c.DRAFT_STATE),before);
 c.fetch=async()=>({ok:true,json:async()=>({...clone(raw),gameId:1})});assert.equal(await c.FBA_ESPN_MOCK.connect(String(raw.id),2),false);assert.equal(JSON.stringify(c.DRAFT_STATE),before);
 c.fetch=async()=>({ok:true,json:async()=>clone(raw)});
 assert.equal(await c.FBA_ESPN_MOCK.connect(`https://fantasy.espn.com/basketball/draft?leagueId=${raw.id}&teamId=4`,2),true);
 assert.equal(c.draftTeams()[3],'BlackForest Mad Wolves');c.FBA_ESPN_MOCK.disconnect();
});
