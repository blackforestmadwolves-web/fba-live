import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
const code=fs.readFileSync(new URL('../apps-script/Code.js',import.meta.url),'utf8');
const now='2026-09-06T12:00:00Z';
const stat={PTS:1400,REB:420,AST:280,'3PM':140,STL:70,BLK:35,FGM:490,FGA:980,FTM:280,FTA:350};
const players=[{player_id:'1',full_name:'Al Horford',season_id:2027},{player_id:'2',full_name:'Gary Trent Jr.',season_id:2027}];
const ctx=()=>{const c={console,Date,JSON};vm.createContext(c);vm.runInContext(code,c);return c;};
function table(position='PG',{name='Al Horford',id='101',stats=stat,gp=70,year=2026}={}){
  const labels={PG:'Point Guard',SG:'Shooting Guard',SF:'Small Forward',PF:'Power Forward',C:'Center'};
  // Reordered columns with tooltip text, and a shorter full name than abbreviation.
  const headers=['player','gp','blk','pts','mpg','reb','ast','3pm','stl','fgm','fga','ftm','fta'];
  const values={player:`<span class="CellPlayerName--short"><a href="/nba/players/${id}/qa/fantasy/">A. Horford</a></span><span class="CellPlayerName--long"><span><a href="/nba/players/${id}/qa/fantasy/">${name}</a></span></span>`,gp,mpg:30,...Object.fromEntries(Object.entries(stats).map(([k,v])=>[k.toLowerCase(),v]))};
  return `<h1>${year} Projections Fantasy Basketball ${labels[position]} Stats</h1><table><thead><tr>${headers.map(k=>`<th><a>${k}</a><div>Long tooltip description</div></th>`).join('')}</tr></thead><tbody><tr>${headers.map(k=>`<td>${values[k]}</td>`).join('')}</tr></tbody></table>`;
}
test('CBS table parser verifies season/position and uses named headers, raw totals and full player names',()=>{
  const c=ctx(),parsed=c.parseCbsProjectionPageV70_(table(),'PG',now);
  assert.equal(parsed.ok,true);assert.equal(parsed.rows[0].full_name,'Al Horford');assert.equal(parsed.rows[0].BLK,'35');
  const index=c.consensusIdentityIndexV44_(players),mapped=c.mapCbsPlayersV70_(parsed.rows,index,[],now);
  const row=c.normalizeConsensusRowV44_(mapped.rows[0],index,now).row;
  assert.equal(row.base.PTS,20);assert.equal(row.base.BLK,.5);assert.equal(row.base.FGM/row.base.FGA,.5);assert.equal(row.providerPlayerId,'101');
  for(const html of [table('PG',{year:2025}),table().replace('Projections','YTD'),table('SG'),table().replace('<a>fta</a>','<a>missing</a>'),table().replace('<td>70</td>','')])assert.equal(c.parseCbsProjectionPageV70_(html,'PG',now).ok,false);
  const zero=c.parseCbsProjectionPageV70_(table('PG',{gp:0}),'PG',now);
  assert.equal(c.mapCbsPlayersV70_(zero.rows,index,[],now).audit.rejected.INVALID_GP,1);
});
test('multi-position players count once; conflicting stats never enter consensus',()=>{
  const c=ctx(),pages=['PG','SG'].map(p=>c.parseCbsProjectionPageV70_(table(p),p,now));
  const merged=c.mergeCbsPositionsV70_(pages);assert.equal(merged.rows.length,1);assert.equal(merged.duplicates,1);assert.deepEqual(Array.from(merged.rows[0].position_lists),['PG','SG']);
  pages[1].rows[0].PTS='1800';const conflict=c.mergeCbsPositionsV70_(pages);assert.equal(conflict.rows.length,0);assert.deepEqual(Array.from(conflict.conflicts),['101']);
});
test('persistent CBS IDs survive changed projections; ambiguous or conflicting identities stay pending',()=>{
  const c=ctx(),index=c.consensusIdentityIndexV44_(players),raw=c.parseCbsProjectionPageV70_(table(),'PG',now).rows;
  const first=c.mapCbsPlayersV70_(raw,index,[],now);raw[0].PTS='1750';
  const next=c.mapCbsPlayersV70_(raw,index,first.mappings,now);assert.equal(next.rows[0].player_id,'1');assert.equal(next.rows[0].PTS,'1750');
  raw[0].provider_name='Gary Trent';assert.equal(c.mapCbsPlayersV70_(raw,index,first.mappings,now).audit.rejected.PROVIDER_NAME_CHANGED,1);
  const suffix=c.mapCbsPlayersV70_(raw,index,[],now);assert.equal(suffix.rows[0].player_id,'2');
  const ambiguous=c.consensusIdentityIndexV44_([...players,{player_id:'3',full_name:'Gary Trent',season_id:2027}]);
  raw[0].provider_name='Gary Trent II';assert.equal(c.mapCbsPlayersV70_(raw,ambiguous,[],now).rows.length,0);
  raw[0].provider_name='Al Horford';assert.equal(c.mapCbsPlayersV70_([raw[0],{...raw[0],provider_player_id:'202'}],index,[],now).audit.rejected.MULTIPLE_PROVIDER_IDS,2);
});
test('all-five refresh is atomic on HTTP errors; later updates retain missing players without freezing everyone',()=>{
  const c=ctx(),sheets=new Map(),props=new Map();let blocked=false,omitSecond=false,points=1400,clock=Date.parse(now);
  c.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
  c.espnPropertiesV1_=()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)});
  c.sheetObjectsV2_=n=>sheets.get(n)||[];c.ensureSimpleEspnSheetV1_=()=>({});
  c.writeConsensusRowsV44_=(n,headers,rows)=>sheets.set(n,rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]]))));
  c.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
  c.aggregateProjectionActualsV36_=()=>({completeGames:0});c.stableHashV36_=v=>createHash('sha256').update(v).digest('hex');
  c.fetchEspnFantasyHubV2_=()=>({seasonId:2027,players:[]});sheets.set(c.ESPN_PLAYER_HUB_V2.playersSheet,players);
  c.UrlFetchApp={fetch:url=>{
    const pos=/\/stats\/(PG|SG|SF|PF|C)\//.exec(url)?.[1];
    const second=pos==='C'&&!omitSecond;
    return {getResponseCode:()=>!pos||blocked&&pos==='SF'?403:200,getContentText:()=>table(pos||'PG',second?{name:'Gary Trent',id:'102'}:{stats:{...stat,PTS:points}})};
  }};
  let status=c.refreshProjectionConsensusV44_(true);assert.equal(status.sources.find(s=>s.id==='cbs').mapping.matched,2);
  const read=()=>sheets.get(c.FBA_CONSENSUS_V44.baseline).map(r=>JSON.parse(r.payload_json));
  assert.equal(read().find(p=>p.id==='1').base.PTS,20);
  blocked=true;points=2100;clock+=16*60000;const oldMap=JSON.stringify(sheets.get(c.FBA_CBS_V70.mapSheet));
  status=c.refreshProjectionConsensusV44_(true);assert.equal(status.sources.find(s=>s.id==='cbs').state,'LAST_GOOD');assert.equal(read().find(p=>p.id==='1').base.PTS,20);assert.equal(JSON.stringify(sheets.get(c.FBA_CBS_V70.mapSheet)),oldMap);
  blocked=false;omitSecond=true;clock+=16*60000;
  status=c.refreshProjectionConsensusV44_(true);assert.equal(read().find(p=>p.id==='1').base.PTS,30);assert.equal(read().find(p=>p.id==='2').base.PTS,20);assert.equal(status.sources.find(s=>s.id==='cbs').retainedPlayers,1);
});

test('explicit CBS name variants require the exact provider ID, provider name and canonical ESPN name',()=>{
  const c=ctx();
  for(const [providerId,variant] of Object.entries(c.FBA_CBS_NAME_VARIANTS_V70)){
    const index=c.consensusIdentityIndexV44_([{id:variant.id,fullName:variant.espn,season_id:2027}]);
    const raw=c.parseCbsProjectionPageV70_(table('PG',{id:providerId,name:variant.name}),'PG',now).rows;
    assert.equal(c.mapCbsPlayersV70_(raw,index,[],now).rows[0].player_id,variant.id);
    raw[0].provider_player_id='999';assert.equal(c.mapCbsPlayersV70_(raw,index,[],now).rows.length,0);
  }
});
