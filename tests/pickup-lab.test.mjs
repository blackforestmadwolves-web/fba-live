import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import lab from '../pickup-lab.js';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const cats=['PTS','REB','AST','3PM','STL','BLK','FG%','FT%'];
const fields=['PTS','REB','AST','3PM','STL','BLK','FGM','FGA','FTM','FTA'];
function source(name) {
  const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+1);
  assert.ok(start>0 && end>start,name);
  return html.slice(start,end);
}
function harness(extra={}) {
  const profiles=new Map([
    ['1',{overallRank:1,z:{PTS:90,REB:2,AST:-2,'3PM':-1,STL:0,BLK:4,'FG%':1,'FT%':0}}],
    ['2',{overallRank:2,z:{PTS:-90,REB:1,AST:3,'3PM':3,STL:1,BLK:.2,'FG%':0,'FT%':1}}]
  ]);
  const players=[{id:'1',name:'Blockprofil',nba:'SAS'},{id:'2',name:'Assistprofil',nba:'CHA'}];
  const c=vm.createContext({
    window:{FBA_PICKUP_LAB:lab},MONSTER_STATE:{hunts:[],week:1,addId:'',dropId:'',data:{}},
    DRAFT_CATS:cats,MONSTER_PROJECTION_STATS:fields,
    draftValueModel:()=>({byId:profiles,leagueFg:.5,leagueFt:.8,stats:Object.fromEntries(cats.map(p=>[p,{mean:0,sd:1}]))}),
    monsterProjectionEngineState:()=>({ready:false,baselineReady:false}),
    monsterAvailability:()=>1,monsterNbaGames:()=>2,
    monsterProjectionB2bContext:()=>null,monsterPlayer:p=>p,monsterNbaKey:s=>s,
    monsterProjectionEligiblePoolPlayer:()=>true,monsterRoster:()=>[],draftPool:()=>players,
    render:()=>{},E:String,de:(n,d)=>Number(n).toFixed(d).replace('.',','),
    maikValueFormat:n=>(n>0?'+':'')+n.toFixed(2).replace('.',','),
    ...extra
  });
  for(const name of ['monsterHunts','setMonsterHunt','monsterPickupFocusMarkup','monsterB2bHunts','setMonsterB2bHunt','monsterWeeklyContribution','monsterFreeAgents','monsterB2bContribution','monsterB2bFreeAgents','selectMonsterPickup','monsterSimulatorMarkup','monsterSimulation']) vm.runInContext(source(name),c);
  return {c,players,profiles};
}

test('one, two, three and four selected points receive precisely equal weights; unrelated values cannot affect them',()=>{
  const z={BLK:4,AST:-2,REB:1,'3PM':3};
  assert.equal(lab.score(z,['BLK'],1).value,4);
  assert.equal(lab.score(z,['BLK','AST'],1).value,1);
  assert.equal(lab.score(z,['BLK','AST','REB'],1).value,1);
  assert.equal(lab.score(z,['BLK','AST','REB','3PM'],1).value,1.5);
  for(const PTS of [-1e9,1e9,NaN]) assert.equal(lab.score({...z,PTS},['BLK','AST'],1).value,1);
  assert.equal(lab.score(z,['BLK','AST','BLK'],2).value,2);
  assert.equal(lab.score(z,['BLK','AST'],1).weight,.5);
  assert.equal(lab.score(z,['BLK','AST','REB','3PM'],1).weight,.25);
  assert.match(lab.description(['REB','3PM']),/je 50 %/);
  assert.match(lab.description(['REB','3PM','BLK','AST']),/je 25 %/);
});

test('missing selected values and no remaining games produce no recommendation; negative values remain valid',()=>{
  for(const value of [null,undefined,NaN,Infinity,'2']) assert.equal(lab.score({BLK:value},['BLK'],2),null);
  for(const games of [0,-1,NaN,Infinity]) assert.equal(lab.score({BLK:2},['BLK'],games),null);
  assert.equal(lab.score({BLK:-2},['BLK'],2).value,-4);
  assert.equal(lab.score(Object.fromEntries(cats.map(c=>[c,2])),[],2).value,4);
});

test('weekly and B2B rankings share focus, reverse for combined profiles and never use overall rank to break focus ties',()=>{
  const {c,players,profiles}=harness();
  c.setMonsterHunt('BLK');
  assert.equal(c.monsterFreeAgents()[0].id,'1');
  c.setMonsterB2bHunt('AST');
  assert.equal(c.monsterFreeAgents()[0].id,'2');
  assert.deepEqual(Array.from(c.monsterB2bHunts()),['AST','BLK']);
  assert.equal(c.monsterB2bFreeAgents(['SAS','CHA'],c.monsterHunts())[0].id,'2');
  for(const p of players) assert.equal(c.monsterWeeklyContribution(p,c.monsterHunts()).value,c.monsterB2bContribution(p,c.monsterHunts()).value);
  profiles.get('1').z.AST=profiles.get('2').z.AST;profiles.get('1').z.BLK=profiles.get('2').z.BLK;
  profiles.get('1').overallRank=999;
  assert.equal(c.monsterFreeAgents()[0].id,'1','equal focus scores break by stable ID, ignoring other performance');
  c.MONSTER_STATE.addId='2';c.MONSTER_STATE.dropId='owned';
  c.setMonsterHunt('BLK');
  assert.deepEqual(Array.from(c.monsterHunts()),['AST']);
  c.setMonsterHunt('');
  assert.deepEqual(Array.from(c.monsterHunts()),[]);
  assert.equal(c.MONSTER_STATE.addId,'2');assert.equal(c.MONSTER_STATE.dropId,'owned');
  assert.equal((c.monsterPickupFocusMarkup().match(/aria-pressed="true"/g)||[]).length,1);
});

test('current ownership, zero future games, unavailable players and incomplete live baseline are excluded',()=>{
  const {c}=harness({monsterRoster:()=>[{id:'1'}]});
  assert.equal(c.monsterFreeAgents(['BLK']).length,1);
  assert.equal(c.monsterFreeAgents(['BLK'])[0].id,'2');
  c.monsterNbaGames=()=>0;assert.equal(c.monsterFreeAgents(['BLK']).length,0);
  c.monsterNbaGames=()=>2;c.monsterAvailability=()=>0;assert.equal(c.monsterFreeAgents(['BLK']).length,0);
  c.monsterAvailability=()=>1;c.monsterProjectionEngineState=()=>({baselineReady:true,ready:false});
  assert.equal(c.monsterFreeAgents(['BLK']).length,0);
  assert.equal(c.monsterB2bFreeAgents(['CHA'],['BLK']).length,0);
});

test('engine focus uses only future totals, with identical weighting and attempt-aware percentages',()=>{
  let past=100;
  const futureTotals={PTS:10,REB:8,AST:4,'3PM':2,STL:2,BLK:2,FGM:8,FGA:20,FTM:8,FTA:10};
  const {c,players}=harness({
    monsterProjectionEngineState:()=>({ready:true,baselineReady:true,engine:{}}),
    monsterProjectionPlayerRecord:()=>({projectedGp:70}),monsterProjectionRecordIssue:()=>'',
    monsterProjectionScheduleGames:()=>[],monsterProjectionRecordNba:()=> 'SAS',
    monsterProjectionWeeklyPlayer:()=>({remainingGames:2,games:5,actualGames:3,futureTotals,PTS:past,BLK:past}),
    draftProjectionMetrics:(p,fg,ft)=>({...p,'FG%':p.FGM-fg*p.FGA,'FT%':p.FTM-ft*p.FTA})
  });
  const first=c.monsterWeeklyContribution(players[0],['REB','AST']);
  assert.equal(first.value,6);assert.equal(first.effectiveGames,2);
  past=999999;
  assert.equal(c.monsterWeeklyContribution(players[0],['REB','AST']).value,6);
  assert.equal(c.monsterWeeklyContribution(players[0],['FG%']).value,-2);
  assert.equal(c.monsterWeeklyContribution(players[0],['FT%']).value,0);
  c.monsterProjectionB2bContext=()=>({games:2,effectiveGames:2,perGame:Object.fromEntries(fields.map(f=>[f,futureTotals[f]/2]))});
  assert.equal(c.monsterB2bContribution(players[0],['REB','AST']).value,first.value);
  c.monsterProjectionWeeklyPlayer=()=>{throw new Error('Live-Spiel wartet auf ESPN FINAL');};
  assert.equal(c.monsterWeeklyContribution(players[0],['AST']).value,-Infinity);
  assert.equal(c.monsterFreeAgents(['AST']).length,0);
});

test('a B2B transfer preserves the drop and remains selected even outside the first 120 weekly candidates',()=>{
  let rendered=0;
  const {c}=harness({document:{getElementById:()=>null},render:()=>rendered++,maikValuePlayerColor:()=>"rgb(135,147,167)",maikValueText:()=>'+0,00 FBA-Value',monsterRosterFor:()=>[]});
  c.MONSTER_STATE.dropId='owned';c.selectMonsterPickup('2');
  assert.equal(c.MONSTER_STATE.addId,'2');assert.equal(c.MONSTER_STATE.dropId,'owned');assert.equal(rendered,1);
  c.selectMonsterPickup('unknown');assert.equal(rendered,1);
  c.monsterFreeAgents=()=>Array.from({length:150},(_,i)=>({id:String(i+1),name:'Profil '+(i+1)}));
  c.MONSTER_STATE.addId='150';c.monsterWeeklyContribution=()=>({effectiveGames:2,value:1,label:'+1,00 Such-Value'});
  assert.match(c.monsterSimulatorMarkup('Wolves','Pirates',null,null),/<option value="150"[^>]* selected>/);
  assert.match(c.monsterSimulatorMarkup('Wolves','Pirates',null,null),/Profil 150 ist ausgewählt/);
});

test('pickup Lab embeds B2B once with one focus picker; matchup effects still show all eight points',()=>{
  const page=source('pgMonster');
  assert.equal((page.match(/monsterB2bMarkup\(\)/g)||[]).length,1);
  assert.match(page,/<h2>Pickup Lab<\/h2>[\s\S]*monsterPickupFocusMarkup\(\)[\s\S]*pickupBody[\s\S]*monsterB2bMarkup\(\)/);
  assert.doesNotMatch(source('monsterB2bMarkup'),/setMonsterB2bHunt|monster-hunt/);
  assert.doesNotMatch(source('monsterSimulatorMarkup'),/setMonsterHunt|monster-hunt/);
  assert.match(source('monsterB2bPlayersMarkup'),/selectMonsterPickup/);
  const {c,players}=harness();
  c.monsterRosterFor=()=>[players[0]];
  c.MONSTER_STATE.dropId='1';c.MONSTER_STATE.addId='2';c.MONSTER_STATE.hunts=['BLK','AST'];
  const before={cats:cats.map(cat=>({cat,p:.4}))};
  c.monsterForecast=()=>({cats:cats.map(cat=>({cat,p:.6}))});
  const simulation=c.monsterSimulation('A','B',before);
  assert.equal(simulation.delta.length,8);assert.equal(simulation.focusDelta.length,2);
  assert.deepEqual(Array.from(simulation.focusDelta,row=>row.cat),['AST','BLK']);
});
