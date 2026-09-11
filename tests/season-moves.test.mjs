import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const moduleSource = fs.readFileSync(new URL('../season-moves.js', import.meta.url), 'utf8');
const stats = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FGM', 'FGA', 'FTM', 'FTA'];
const cats = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FG%', 'FT%'];
const nba = ['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'];
const clone = value => JSON.parse(JSON.stringify(value));
const c = vm.createContext({ console, setTimeout, MONSTER_PROJECTION_STATS: stats, DRAFT_CATS: cats,
  MONSTER_PROFILE_PRIOR_WEIGHT: 20, MONSTER_SEASON_MODEL: 'Fixture',
  E: value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
  T: team => ({s:team}), de: (n,d) => Number(n).toFixed(d).replace('.',','),
  monsterSeasonDelta: (n,d) => (n>0?'+':'') + n.toFixed(d),
  monsterSeasonImpactTone: n => n>0?'good':n<0?'bad':'',
  MONSTER_STATE: {teamA:'T0',data:{}}, DRAFT_STATE:{picks:[]},
  MONSTER_SEASON_PROJECTION_STATE: {status:'ready',fingerprint:'fixture'},
  draftPool: () => [], monsterSeasonProjectionFingerprint: () => 'fixture'
});
vm.runInContext(html.match(/function monsterNbaKey\(value\)\{[^\n]+/)[0], c);
vm.runInContext(html.slice(html.indexOf('function monsterProjectionFinite('), html.indexOf('function monsterEspnPoolPlayer(')), c);
vm.runInContext(html.slice(html.indexOf('function monsterSeasonProjectionCalculate(input){'), html.indexOf('function monsterSeasonProjectionInputs(')), c);
vm.runInContext(moduleSource, c);

function fixture() {
  const teams = Array.from({length:8},(_,i)=>`T${i}`), games = [], matchups = [], roster = [];
  for (let week=1; week<=18; week++) {
    const start=week===1?Date.UTC(2026,9,20):Date.UTC(2026,9,26)+(week-2)*604800000;
    for (let round=0; round<(week<=8?5:4); round++) for (let pair=0;pair<15;pair++) {
      games.push({id:`G${games.length}`,date:new Date(start+round*86400000).toISOString().slice(0,10),away:nba[(pair*2+round)%30],home:nba[(pair*2+round+1)%30],status:'SCHEDULED'});
    }
    for (let pair=0;pair<4;pair++) matchups.push({week,away:teams[pair*2],home:teams[pair*2+1]});
  }
  teams.forEach((team,i)=>{
    for (let slot=0;slot<13;slot++) {
      const s=i*.1+slot*.015;
      const base={PTS:12+s,REB:4+s,AST:3+s,'3PM':1+s,STL:.7+s,BLK:.5+s,FGM:4+s,FGA:10,FTM:2+s,FTA:4};
      const record={id:`P${i}-${slot}`,name:`Player ${i}-${slot}`,nba:nba[(i*13+slot)%30],projectedGp:70,base,actual:{gp:0,byWeek:{},totals:{}}};
      roster.push({id:record.id,name:record.name,team,nba:record.nba,stats:base,projectionReady:true,engineProjection:record});
    }
  });
  const engine={active:true,status:'READY',baseline:{status:'READY',season:'2026/27'},profiles:{},actual:{},players:roster.map(row=>row.engineProjection)};
  return {teams,conferences:{East:teams.slice(0,4),West:teams.slice(4)},roster,matchups,nbaSeasonSchedule:{games},projectionEngine:engine};
}
function addPlayer(input,id,scale=1,gp=70) {
  const base=Object.fromEntries(stats.map(field=>[field,input.roster[0].stats[field]*scale]));
  const record={id,name:`FA ${id}`,nba:'ATL',projectedGp:gp,base,actual:{gp:0,totals:{},byWeek:{}}};
  input.projectionEngine.players.push(record);
  return {id,name:record.name};
}
const calc = input => c.monsterSeasonProjectionCalculate(input);

test('Roto shares tied ranks and uses total attempts, not average percentages',()=>{
  const week=(made,attempts)=>({...Object.fromEntries(stats.map(field=>[field,1])),FGM:made,FGA:attempts,FTM:made,FTA:attempts});
  const result={rows:Array.from({length:8},(_,i)=>({team:`T${i}`})),weekly:{}};
  result.rows.forEach(({team})=>{result.weekly[team]={1:week(3,4),2:week(3,4)};});
  result.weekly.T0={1:week(1,2),2:week(9,10)};
  const rows=c.monsterMoveRoto(result), first=rows[0];
  assert.equal(first['FG%'],10/12);
  assert.equal(first.points['FG%'],8);
  assert.equal(rows[1].points['FG%'],4);
  for (const cat of cats) assert.equal(rows.reduce((sum,row)=>sum+row.points[cat],0),36);
});

test('individual projected GP can outweigh higher per-game production',()=>{
  const input=fixture(), highAverage=addPlayer(input,'high-average',2,20), durable=addPlayer(input,'durable',1.3,70);
  const {candidates}=c.monsterMoveCandidateRows(input,[highAverage,durable]), drop=input.roster[0];
  const low=calc(c.monsterMoveInput(input,'T0',drop,candidates[0],1,{}));
  const high=calc(c.monsterMoveInput(input,'T0',drop,candidates[1],1,{}));
  const total=result=>Object.values(result.weekly.T0).reduce((sum,week)=>sum+week.PTS,0);
  assert.ok(total(low)<total(calc(input)));
  assert.ok(total(high)>total(calc(input)));
});

test('all legal single swaps are scored with the actual full-season engine; inputs stay unchanged',async()=>{
  const input=fixture(), pool=[addPlayer(input,'a',2),addPlayer(input,'b',1.4),addPlayer(input,'low-gp',3,15),{id:'missing',name:'Missing'}, {id:input.roster[0].id,name:'Owned'}];
  pool.push(pool[0]);
  const before=JSON.stringify(input), base=calc(input);
  const result=await c.monsterMoveSearch(input,base,'T0',pool,1);
  assert.equal(result.tested,39); assert.equal(result.candidates,3); assert.equal(result.skipped.length,1);
  assert.equal(JSON.stringify(input),before);
  assert.ok(result.season.length>0);
  for (const mode of ['season','roto']) {
    assert.equal(new Set(result[mode].map(row=>row.add.id)).size,result[mode].length);
    for (const move of result[mode]) {
      const direct=calc(c.monsterMoveInput(input,'T0',move.drop,move.add,1));
      assert.deepEqual(clone(move.result),clone(direct));
      assert.equal(move.fbaDelta,direct.rows[0].fbaFor-base.rows[0].fbaFor);
      assert.equal(move.weeks.reduce((sum,week)=>sum+week.delta,0),move.fbaDelta);
    }
  }
});

test('a Roto gain need not change scheduled matchup points',()=>{
  const input=fixture(), values={PTS:10,REB:4,AST:3,'3PM':2,STL:1,BLK:1,FGM:4,FGA:8,FTM:2,FTA:4};
  input.roster.forEach(row=>{
    const team=Number(row.team.slice(1)), multiplier=team===0?2:team===1?1:2+(team-1)/16;
    row.stats=Object.fromEntries(stats.map(field=>[field,values[field]*multiplier]));
    row.engineProjection.base=row.stats; row.engineProjection.projectedGp=80;
  });
  const pool=[addPlayer(input,'stronger',2,80)], candidate=c.monsterMoveCandidateRows(input,pool).candidates[0];
  const base=calc(input), changed=calc(c.monsterMoveInput(input,'T0',input.roster[0],candidate,1));
  const move=c.monsterMoveSummary(base,changed,'T0');
  assert.ok(move.rotoDelta>0); assert.equal(move.fbaDelta,0);
});

test('future pickup preserves past ownership and completed matchup results',()=>{
  const input=fixture(), pool=[addPlayer(input,'new-owner',3)], engine=input.projectionEngine;
  input.nbaSeasonSchedule.games.filter(game=>game.date<='2026-10-25').forEach(game=>{game.status='STATUS_FINAL';});
  const actualStats=Object.fromEntries(stats.map(field=>[field,2]));
  engine.actual={ownershipAtGameReady:true,fbaResultsReady:true,currentMatchupPeriod:2,teamActualsByWeek:{},completedFbaMatchups:input.matchups.filter(game=>game.week===1).map(game=>({...game,awayPoints:3,homePoints:5}))};
  input.teams.forEach(team=>{engine.actual.teamActualsByWeek[team]={1:{gp:5,stats:actualStats,players:{}},2:{gp:1,stats:actualStats,players:{}}};});
  engine.players.forEach(record=>{record.actual={gp:5,totals:actualStats,byWeek:{1:{gp:5,stats:actualStats}}};});
  // An incoming player's already-earned points must not move to the new owner.
  const addRecord=engine.players.at(-1);
  addRecord.actual={gp:6,totals:Object.fromEntries(stats.map(field=>[field,2000])),byWeek:{1:{gp:5,stats:actualStats},2:{gp:1,stats:actualStats}}};
  const base=calc(input), candidate=c.monsterMoveCandidateRows(input,pool).candidates[0];
  const after=calc(c.monsterMoveInput(input,'T0',input.roster[0],candidate,2,{}));
  assert.deepEqual(clone(after.weekly.T0[1]),clone(base.weekly.T0[1]));
  assert.deepEqual(clone(after.matchupResults.filter(row=>row.seeded)),clone(base.matchupResults.filter(row=>row.seeded)));
  const games=c.monsterProjectionScheduleGames({nbaSeasonSchedule:input.nbaSeasonSchedule,projectionEngine:engine});
  const dropped=c.monsterProjectionWeeklyPlayer(input.roster[0].engineProjection,2,games,engine,input.roster[0].nba,{});
  const added=c.monsterProjectionWeeklyPlayer(candidate.engineProjection,2,games,engine,candidate.nba,{});
  assert.ok(Math.abs(after.weekly.T0[2].PTS-(base.weekly.T0[2].PTS-dropped.futureTotals.PTS+added.futureTotals.PTS))<1e-8);
});

test('cache resets for a different engine or schedule snapshot',()=>{
  const input=fixture(), pool=[addPlayer(input,'swap',2)], candidate=c.monsterMoveCandidateRows(input,pool).candidates[0], cache={};
  calc(c.monsterMoveInput(input,'T0',input.roster[0],candidate,1,cache));
  const changed=clone(input); changed.roster[0].engineProjection.projectedGp=35;
  assert.deepEqual(clone(calc({...changed,moveSearchCache:cache})),clone(calc(changed)));
});

test('cancel, empty pool, missing GP and ended season never invent recommendations',async()=>{
  const input=fixture(), base=calc(input), pool=[addPlayer(input,'candidate',2)];
  assert.equal(await c.monsterMoveSearch(input,base,'T0',pool,1,{cancelled:()=>true}),null);
  const empty=await c.monsterMoveSearch(input,base,'T0',[],1); assert.equal(empty.tested,0); assert.equal(empty.season.length,0);
  await assert.rejects(c.monsterMoveSearch(input,{...base,projectionMode:'preseason'},'T0',pool,1),/projected GP/);
  await assert.rejects(c.monsterMoveSearch(input,base,'T0',pool,19),/beendet/);
  input.projectionEngine.players.at(-1).projectedGp=null;
  const missing=await c.monsterMoveSearch(input,base,'T0',pool,1); assert.equal(missing.tested,0); assert.equal(missing.skipped.length,1);
});

test('UI shows both outcomes, escapes names and handles waiting data',()=>{
  const input=fixture(), base=calc(input), candidate=c.monsterMoveCandidateRows(input,[addPlayer(input,'<script>',2)]).candidates[0], drop=input.roster[0];
  const result=calc(c.monsterMoveInput(input,'T0',drop,candidate,1));
  const markup=c.monsterMoveCard({...c.monsterMoveSummary(base,result,'T0'),add:candidate,drop},0);
  assert.match(markup,/Saisonpunkte W1–18/); assert.match(markup,/Roto-Wertung W1–18/);
  assert.match(markup,/&lt;script&gt;/); assert.doesNotMatch(markup,/<script>/);
  c.monsterSeasonProjectionLifecycle=()=>({engineAllowed:false});
  assert.match(c.monsterSeasonMovesMarkup(base),/individuellen projected GP/);
  c.monsterSeasonProjectionLifecycle=()=>({engineAllowed:true});
  assert.match(c.monsterSeasonMovesMarkup(base),/Moves finden/);
  assert.match(html,/<script src="season-moves.js"><\/script>/);
});
