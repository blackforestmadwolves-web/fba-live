import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const backend=fs.readFileSync(new URL('../apps-script/Code.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const cats=['PTS','REB','AST','3PM','STL','BLK','FG%','FT%'];
const names=['Wolves','Pirates','Eagles','Lions','Bears','Rhinos','Unicorns','Snipers'];
const clone=x=>JSON.parse(JSON.stringify(x));
function server(){
  const props={};
  const c=vm.createContext({console});vm.runInContext(backend,c);
  c.espnPropertiesV1_=()=>({getProperties:()=>props,getProperty:k=>props[k]??null});
  return {c,props};
}
function fixtures(){
  const schedule=Array.from({length:4},(_,i)=>({season_id:'2026/27',week:1,matchup_id:`W1-${i+1}`,away_team:names[i*2],home_team:names[i*2+1]}));
  const stats=schedule.map(r=>({Woche:1,'Team A':r.away_team,'Team B':r.home_team,...Object.fromEntries(cats.flatMap(k=>[[k+'_A',k.includes('%')?.5:10],[k+'_B',k.includes('%')?.5:10]]))}));
  const results=schedule.map(r=>({Week:1,Away:r.away_team,Home:r.home_team,'Away Cats':0,'Home Cats':8}));
  return {schedule,stats,results};
}
function run(c,f,daily=[],current=1,phase='REGULAR_SEASON'){return c.matchupHomeWeekV77_(1,f.schedule,f.stats,f.results,daily,current,phase)}

test('schedule must have four distinct matches, eight teams and the exact season',()=>{
  const {c}=server(),f=fixtures();assert.equal(run(c,f).status,'READY');
  for(const change of [g=>g.schedule.pop(),g=>g.schedule[0].home_team='Wolves',g=>g.schedule[0].season_id='2025/26',g=>g.stats[0]['Team A']='Pirates']){
    const g=clone(f);change(g);const result=run(c,g);assert.equal(result.status,'DATA_ISSUE');assert.equal(result.matches.length,0);
  }
  assert.equal(run(c,{schedule:[],stats:[],results:[]}).status,'WAITING');
});
test('no fabricated zero score before tip-off, missing data is not zero',()=>{
  const {c}=server(),f=fixtures();f.stats.forEach(r=>cats.forEach(k=>{r[k+'_A']=r[k+'_B']=0}));
  for(const m of run(c,f).matches){assert.equal(m.score,null);assert.equal(m.status,'SCHEDULED')}
  f.stats[0].PTS_A=null;assert.equal(run(c,f).matches[0].status,'DATA_ISSUE');
  f.stats=[];assert.equal(run(c,f,[],2).matches[0].status,'DATA_ISSUE');
});
test('ties go home and final scores must match Results independently',()=>{
  const {c}=server(),f=fixtures();let m=run(c,f,[],2).matches[0];assert.deepEqual(clone(m.score),[0,8]);assert.equal(m.status,'FINAL');
  f.stats[0].PTS_A=11;m=run(c,f,[],2).matches[0];assert.equal(m.status,'DATA_ISSUE');
  f.results[0]['Away Cats']=1;f.results[0]['Home Cats']=7;
  assert.deepEqual(clone(run(c,f,[],2).matches[0].score),[1,7]);
  assert.equal(run(c,f,[],1,'PRESEASON').matches[0].score,null);
  f.stats.push({...f.stats[0]});assert.equal(run(c,f).matches[0].status,'DATA_ISSUE');
});
function dailyFixture(c,props){
  const f=fixtures(),daily=[];
  for(let i=0;i<4;i++){
    const id='p'+i,event='event'+i;props[c.nbaEventDoneKeyV36_(event)]='1';
    daily.push({season_id:2027,matchup_period:1,event_id:event,event_status:'FINAL',player_id:id,player_name:'Player '+i,nba_date:'2026-10-21',
      ownership_captured:true,active_lineup:true,owner_team:i<3?'Wolves':'Pirates',PTS:10,REB:5,AST:3,'3PM':2,STL:1,BLK:1,FGM:3,FGA:6,FTM:2,FTA:4});
  }
  cats.forEach(k=>{const value=k==='FG%'||k==='FT%'?.5:daily[0][k];f.stats[0][k+'_A']=k.includes('%')?value:value*3;f.stats[0][k+'_B']=value});
  return {f,daily};
}
test('three versus one actual appearances is described without inventing overperformance',()=>{
  const {c,props}=server(),{f,daily}=dailyFixture(c,props),m=run(c,f,daily).matches[0];
  assert.deepEqual(clone(m.score),[6,2]);assert.deepEqual(clone(m.gp),[3,1]);
  assert.ok(m.report.text.includes('30 PTS aus 3 Einsätzen'));assert.ok(m.report.text.includes('10 PTS aus 1 Einsatz'));
  assert.ok(m.report.text.includes('unterschiedliche Zahl an Einsätzen'));assert.ok(m.report.text.includes('daraus allein noch nicht ableiten'));
  assert.ok(!/Kategorie/i.test(JSON.stringify(m.report)));assert.equal(m.report.throughDate,'2026-10-21');
});
test('partial, duplicate, unknown ownership, wrong totals and live rows block the report',()=>{
  for(const change of [d=>d[0].ownership_captured=false,d=>d[0].event_status='IN_PROGRESS',d=>d.push({...d[0]}),d=>d[0].PTS=99,d=>d[0].active_lineup=false]){
    const {c,props}=server(),{f,daily}=dailyFixture(c,props);change(daily);const m=run(c,f,daily).matches[0];assert.equal(m.report,null);assert.equal(m.gp,null);
  }
  const {c,props}=server(),{f,daily}=dailyFixture(c,props);delete props[c.nbaEventDoneKeyV36_('event0')];assert.equal(run(c,f,daily).matches[0].report,null);
});
test('valid refreshed data changes the report and uses frozen ownership, not current rosters',()=>{
  const {c,props}=server(),{f,daily}=dailyFixture(c,props),before=run(c,f,daily).matches[0].report.text;
  daily[0].PTS+=2;daily[0].FGM+=1;f.stats[0].PTS_A+=2;f.stats[0]['FG%_A']=10/18;
  const after=run(c,f,daily).matches[0].report.text;assert.notEqual(after,before);assert.ok(after.includes('32 PTS'));assert.ok(after.includes('Player 0'));
});
test('percentages are aggregated from attempts, never averaged per player',()=>{
  const {c,props}=server(),{f,daily}=dailyFixture(c,props);daily[0].FGA=12;f.stats[0]['FG%_A']=9/24;
  assert.ok(run(c,f,daily).matches[0].report);
  f.stats[0]['FG%_A']=(.25+.5+.5)/3;assert.equal(run(c,f,daily).matches[0].report,null);
});
test('public builder is pinned to the configured season rather than stale analytics',()=>{
  const {c,props}=server(),f=fixtures();props.FBA_ESPN_CURRENT_MATCHUP_PERIOD_V38='1';props.FBA_ESPN_LAST_SUCCESS='2026-10-22T09:00:00+02:00';
  c.sheetObjectsV2_=name=>name==='S26_27 Schedule'?f.schedule:name==='S26_27 StatsRaw'?f.stats:name==='S26_27 Results'?f.results:[];
  const p=c.buildMatchupHomeV77_({seasonCode:'S26_27',phase:'REGULAR_SEASON'});assert.equal(p.schema,1);assert.equal(p.weeks.length,1);assert.equal(p.updatedAt,props.FBA_ESPN_LAST_SUCCESS);
  assert.equal(c.buildMatchupHomeV77_({seasonCode:'S27_28'}).weeks.length,0);
});
test('home shows four safe slots, rejects wrong season, places matchups before preseason',()=>{
  const c=vm.createContext({console,Date,Set,Number,D:{appConfig:{seasonCode:'S26_27',currentSeason:'2026/27'}},PUBLIC_PENDING:false,
    E:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),T:n=>({s:n}),chip:n=>`<span>${n}</span>`,
    de:(n,d)=>Number(n).toFixed(d),activePhase:()=> 'PRESEASON',pgDraftOverview:()=>'<div>PRESEASON_CONTENT</div>'});
  vm.runInContext(html.slice(html.indexOf('let MATCHUP_HOME_SELECTION'),html.indexOf('function pgSeasonOverview')),c);
  let output=c.pgOverview();assert.equal((output.match(/class="matchup-home-score"/g)||[]).length,4);assert.ok(output.indexOf('>Matchups<')<output.indexOf('PRESEASON_CONTENT'));assert.ok(!output.includes('0 : 8'));
  c.D.matchupHome={schema:1,seasonCode:'S25_26',currentWeek:18,weeks:[]};assert.equal(c.matchupHomePayload(),null);
  c.D.matchupHome={schema:1,seasonCode:'S26_27',currentWeek:1,weeks:[{week:1,status:'READY',matches:[{away:'Wolves',home:'Pirates',score:[6,2],status:'IN_PROGRESS',report:{title:'<script>',text:'Safe & tested',throughDate:'2026-10-21'}}]}]};
  output=c.pgOverview();assert.ok(output.includes('&lt;script>'));assert.ok(output.includes('6 : 2'));assert.ok(output.includes('Safe &amp; tested'));
});

test('all inline scripts parse after integration',()=>{
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(/\bsrc=|application\/(?:ld\+)?json/i.test(match[1])||!match[2].trim())continue;
    new vm.Script(match[2]);
  }
});
