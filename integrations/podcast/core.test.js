const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('./core');
const now='2026-09-29T14:00:00.000Z';
function fixture(){
  const names={}, teams=Array.from({length:8},(_,i)=>{const id=i+1;names[id]='Team '+id;return {id,roster:{entries:Array.from({length:13},(_,j)=>({playerId:id*100+j,playerPoolEntry:{player:{id:id*100+j,fullName:'Player '+id+' '+j}}}))},record:{overall:{wins:0,losses:0,ties:0}}};});
  const side=id=>({teamId:id,gamesPlayed:0,cumulativeScore:{wins:8,losses:0,scoreByStat:{}}});
  return {now,teamNames:names,league:{id:1152091056,seasonId:2027,status:{currentMatchupPeriod:1},teams,settings:{scoringSettings:{scoringType:'H2H_CATEGORY',scoringItems:[0,6,3,17,2,1,19,20].map(statId=>({statId}))}},schedule:[1,3,5,7].map(id=>({id,matchupPeriodId:1,away:side(id),home:side(id+1)}))},transactions:[],transactionCoverage:{complete:true},night:{status:'out_of_season'}};
}
function trade(items=[]){return {id:'trade-1',type:'TRADE_ACCEPT',status:'EXECUTED',isPending:false,items,proposedDate:1790672616119};}
function horizon(teams){return {snapshots:[{schema:126,seasonId:2027,sourceId:'bbm',horizon:'ros',kind:'provider_projection',basis:'remaining_per_game',asOf:now,rows:teams.flatMap(t=>t.roster.map(p=>({playerId:p.player_id,remainingGp:60,perGame:{PTS:10,REB:5,AST:4,'3PM':1,STL:1,BLK:1,FGM:4,FGA:10,FTM:1,FTA:2}})))}]};}
test('eight current rosters, four matchups; preseason does not report ESPN dummy 8–0',()=>{
  const p=core.build(fixture());assert.equal(p.teams.flatMap(t=>t.roster).length,104);assert.equal(p.matchups.length,4);
  p.matchups.forEach(m=>assert.deepEqual(m.current_points,{away:0,home:0}));assert.equal(p.readiness.can_generate_daily,false);
});
test('wrong season and unknown category fail before publishing',()=>{
  const f=fixture();f.league.seasonId=2026;assert.throws(()=>core.build(f));f.league.seasonId=2027;f.league.settings.scoringSettings.scoringItems.push({statId:11});assert.throws(()=>core.build(f));
});
test('executed decline is not a trade; accepted redacted trade remains mandatory',()=>{
  const f=fixture();f.transactions=[trade(),{...trade(),id:'decline',type:'TRADE_DECLINE'}];const p=core.build(f);
  assert.deepEqual(p.mandatory_trade_ids,['trade-1']);assert.deepEqual(p.unresolved_trade_ids,['trade-1']);assert.equal(p.transactions[1].is_completed_trade,true);
  assert.equal(p.transactions.find(t=>t.id==='trade-1').completed_at,null);
});
test('coverage acknowledgement and complete legs survive later redaction',()=>{
  const legs=[{playerId:100,fromTeamId:1,toTeamId:2},{playerId:200,fromTeamId:2,toTeamId:1}];
  const first=core.transactions([trade(legs)],[],now);first[0].covered_episode_ids=['published-episode'];
  const merged=core.transactions([trade()],first,now);assert.equal(merged[0].details_status,'complete');assert.deepEqual(merged[0].covered_episode_ids,['published-episode']);
});
test('BBM percentages use shot volume and stale knowledge cannot become current',()=>{
  const f=fixture(),teams=core.league(f.league,f.teamNames,now).teams,h=horizon(teams);
  h.snapshots[0].rows[0].perGame.FGM=9;h.snapshots[0].rows[0].perGame.FGA=30;
  const p=core.bbm(h,teams,now);assert.equal(p.status,'ready');assert.equal(p.teams[0].projected_remaining_totals['FG%'],57/150);
  assert.equal(core.bbm(h,teams,'2026-10-04T14:00:00.000Z').status,'stale');
  delete h.snapshots[0].rows[0].perGame.FTM;assert.throws(()=>core.bbm(h,teams,now));
});
test('reverse trade copies current roster and refuses missing or ambiguous players',()=>{
  const f=fixture(),teams=core.league(f.league,f.teamNames,now).teams,tx=core.transactions([trade([{playerId:100,fromTeamId:2,toTeamId:1},{playerId:200,fromTeamId:1,toTeamId:2}])],[],now)[0];
  const before=core.reverseTrade(teams,tx);assert.equal(before[0].roster.at(-1).player_id,'200');assert.equal(teams[0].roster[0].player_id,'100');
  tx.movements[0].player_id='999';assert.throws(()=>core.reverseTrade(teams,tx));
});
test('anonymous endpoint never reads private storage; stale snapshot cannot authorize audio',()=>{
  const ctx={console,Logger:{log(){}},Date,validMonsterDeviceV29_:()=>false,monsterJsonResponseV29_:p=>p};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/gas.js','utf8'),ctx);
  ctx.podcastRead132_=()=>{throw Error('private read attempted');};assert.equal(ctx.fbaPodcastResponse132_({}).error,'DEVICE_AUTH_REQUIRED');
  ctx.validMonsterDeviceV29_=()=>true;ctx.podcastRead132_=()=>core.build(fixture());ctx.espnPropertiesV1_=()=>({getProperty:()=>'{"status":"SOURCE_REFRESH_FAILED"}'});
  const r=ctx.fbaPodcastResponse132_({token:'test'});assert.equal(r.delivery.stale,true);assert.equal(r.readiness.can_generate_daily,false);
});
test('failed durable readback leaves committed pointer untouched',()=>{
  let commits=0;const range={setNumberFormat(){return this;},setValues(){return this;},getValues(){return [['Jcorrupt']];}};
  const sheet={getMaxRows:()=>701,getRange:()=>range};
  const ctx={console,Date,Logger:{log(){}},espnPropertiesV1_:()=>({getProperty:()=>null,setProperties:()=>commits++}),book:()=>({getSheetByName:()=>sheet}),SpreadsheetApp:{flush(){}},stableHashV36_:s=>String(s.length)};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/gas.js','utf8'),ctx);
  assert.throws(()=>ctx.podcastWrite132_(core.build(fixture())),/vollständig/);assert.equal(commits,0);
});
