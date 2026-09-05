import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const code=fs.readFileSync(new URL('../apps-script/Code.js',import.meta.url),'utf8');
const c={console,Date,JSON,Math,Number,String,Array,Object,Map,Set,RegExp,Error};vm.createContext(c);vm.runInContext(code,c);
const now='2026-09-05T12:00:00Z',stats={PTS:25,REB:12,AST:4,'3PM':2,STL:1,BLK:3,FGM:9,FGA:18,FTM:5,FTA:6};
const index=c.consensusIdentityIndexV44_([{player_id:'1',full_name:'Victor Wembanyama',season_id:2027},{player_id:'2',full_name:'Nikola Jokić',season_id:2027}]);
const input=(source='espn',changes={})=>({source_id:source,season_id:2027,player_id:'1',full_name:'Victor Wembanyama',basis:'per_game',projected_gp:70,snapshot_date:'2026-09-05',source_url:'https://example.test/projections',...stats,...changes});
const norm=(source,changes)=>c.normalizeConsensusRowV44_(input(source,changes),index,now);
assert.equal(c.FBA_CONSENSUS_V44.sources.length,8);
for(const value of [null,undefined,'',' ','U','—','NaN',-1])assert.equal(c.consensusNumberV44_(value),null);
assert.equal(c.consensusNumberV44_('1,750'),1750);assert.equal(c.consensusNumberV44_('25,6'),25.6);assert.equal(c.consensusNumberV44_(0),0);
assert.equal(norm('espn',{season_id:2026}).reason,'WRONG_SEASON');
assert.equal(norm('espn',{player_id:'99'}).reason,'UNKNOWN_PLAYER_ID');
assert.equal(norm('espn',{full_name:'Nikola Jokić'}).reason,'PLAYER_ID_NAME_CONFLICT');
assert.equal(norm('espn',{snapshot_date:'2026-09-06'}).reason,'STALE_OR_INVALID_DATE');
assert.equal(norm('espn',{snapshot_date:'2026-02-30'}).reason,'STALE_OR_INVALID_DATE');
assert.equal(norm('espn',{snapshot_date:'2025-09-05'}).reason,'STALE_OR_INVALID_DATE');
assert.equal(norm('espn',{projected_gp:0}).reason,'INVALID_GP');
assert.equal(norm('espn',{projected_gp:83}).reason,'INVALID_GP');
assert.equal(norm('espn',{FGM:20}).reason,'INVALID_SHOOTING');
assert.equal(norm('espn',{PTS:999}).reason,'IMPLAUSIBLE_PER_GAME');
assert.equal(norm('fantasypros').reason,'UNKNOWN_LINEAGE');
assert.equal(norm('basketballreference',{basis:'per_36'}).reason,'MISSING_PROJECTED_MINUTES');
assert.equal(norm('basketballreference',{basis:'per_36',projected_mpg:30}).row.base.PTS,25*30/36);
assert.equal(norm('espn',{basis:'totals',PTS:1750,projected_gp:70}).row.base.PTS,25);
assert.equal(norm('espn',{FGA:''}).row.base.FGM,null,'Fehlende Versuche dürfen nicht erfunden werden');
const ambiguous=c.consensusIdentityIndexV44_([{id:'a',fullName:'Same Name'},{id:'b',fullName:'Same Name'}]);
assert.equal(c.normalizeConsensusRowV44_(input('espn',{player_id:'',full_name:'Same Name'}),ambiguous,now).reason,'AMBIGUOUS_PLAYER');
const oldSeason=c.consensusIdentityIndexV44_([{player_id:'3',full_name:'Old Player',season_id:2026}]);assert.equal(Object.keys(oldSeason.ids).length,0);
const a=norm('espn').row,b=norm('yahoo',{PTS:22,FGM:8,FGA:20,FTM:4,FTA:5}).row,d=norm('lineupexperts',{PTS:24,FGM:8,FGA:19,FTM:6,FTA:7}).row;
const merged=c.mergeConsensusV44_([a,b,d])[0];assert.equal(merged.sourceCount,3);assert.equal(merged.independentCount,3);assert.equal(merged.base.PTS,71/3);assert.equal(merged.projectedGp,70);assert.equal(merged.complete,true);
const duplicate=norm('fantasypros',{origin_family:'rotowire',PTS:99}).row;
assert.equal(duplicate,undefined,'Unplausible Eingabe muss vor dem Mittelwert blockieren');
const duplicateValid=norm('fantasypros',{origin_family:'rotowire',PTS:30}).row;
const dedup=c.mergeConsensusV44_([a,b,duplicateValid])[0];assert.equal(dedup.independentCount,2);assert.equal(dedup.base.PTS,23.5,'Yahoo und derselbe RotoWire-Ursprung zählen nur einmal');
const partial=norm('yahoo',{FGM:'',FGA:'',FTM:'',FTA:''}).row;
assert.equal(c.mergeConsensusV44_([partial])[0].complete,false);
const mix=c.mergeConsensusV44_([a,partial])[0];assert.equal(mix.fields.PTS.length,2);assert.equal(mix.fields.FGA.length,1);assert.equal(mix.base.FGA,18);
assert.equal(c.mergeConsensusV44_([norm('espn',{projected_gp:70}).row,norm('yahoo',{projected_gp:67}).row])[0].meanProjectedGp,68.5);
assert.equal(c.mergeConsensusV44_([norm('espn',{projected_gp:70}).row,norm('yahoo',{projected_gp:67}).row])[0].projectedGp,69);
const finish=c.replaceProjectionWithActualsV36_(70,merged.base,10,{PTS:200,REB:100,AST:30,'3PM':10,STL:10,BLK:20,FGM:70,FGA:150,FTM:50,FTA:60});
assert.ok(Math.abs(finish.perGame.PTS-23.142857142857142)<1e-12);
assert.equal(finish.totals.FGM/finish.totals.FGA,finish.perGame['FG%']);
assert.equal(a.base.PTS,25,'Das Wemby-System darf keine Baseline zurücküberschreiben');

// Yahoo's real table structure: two action cells, title with full name,
// six counting stats, GP, but no shot-volume columns. All numbers synthetic.
const yahoo='<option value="S_PSR" selected>Remaining Games (proj)</option><option value="S_S_2026">Season (total)</option><option>2026-27</option><table><tr><th></th><th></th><th>Players</th><th>GP*</th><th>PTS</th><th>REB</th><th>AST</th><th>3PTM</th><th>ST</th><th>BLK</th></tr><tr><td>x</td><td>x</td><td><a class="name" title="Victor Wembanyama">V. Wembanyama</a></td><td>70</td><td>1,750</td><td>840</td><td>280</td><td>140</td><td>70</td><td>210</td></tr></table>';
const parsed=c.parseYahooConsensusV44_(yahoo,now);assert.equal(parsed.rows.length,1);assert.equal(parsed.rows[0].full_name,'Victor Wembanyama');
const yr=c.normalizeConsensusRowV44_(parsed.rows[0],index,now);assert.equal(yr.ok,true);assert.equal(yr.row.base.PTS,25);assert.equal(yr.row.base.FGA,null);
assert.equal(c.parseYahooConsensusV44_(yahoo.replace('S_PSR" selected','S_S_2026" selected'),now).status,'WRONG_VIEW');
assert.equal(c.parseYahooConsensusV44_(yahoo.replace('2026-27','2025-26'),now).status,'WRONG_SEASON');

// Native Google Sheets dates use the spreadsheet timezone, not UTC.
c.book=()=>({getSpreadsheetTimeZone:()=> 'America/Los_Angeles'});
c.Utilities={formatDate:(_date,tz,format)=>{assert.equal(tz,'America/Los_Angeles');assert.equal(format,'yyyy-MM-dd');return '2026-09-04';}};
assert.equal(c.consensusDateV44_(new Date('2026-09-05T02:00:00Z')),'2026-09-04');

// In-memory integration: imports, source outage, freezing and private dispatch.
const sheets=new Map(),props=new Map();let actualGames=0;
c.espnPropertiesV1_=()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)});
c.sheetObjectsV2_=name=>sheets.get(name)||[];
c.ensureSimpleEspnSheetV1_=()=>({});c.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
c.aggregateProjectionActualsV36_=()=>({completeGames:actualGames});
c.stableHashV36_=v=>createHash('sha256').update(v).digest('hex');
c.writeConsensusRowsV44_=(name,headers,rows)=>sheets.set(name,rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]]))));
c.fetchEspnFantasyHubV2_=()=>({seasonId:2027,players:[{player:{id:1,fullName:'Victor Wembanyama'}}]});
c.UrlFetchApp={fetch:()=>({getResponseCode:()=>403,getContentText:()=>''})};
// Set a fixed clock to make age validation deterministic.
c.Date=class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return Date.parse(now);}};
sheets.set(c.ESPN_PLAYER_HUB_V2.playersSheet,[{player_id:'1',full_name:'Victor Wembanyama',nba_team_id:24,season_id:2027}]);
sheets.set(c.FBA_CONSENSUS_V44.inputs,[input('lineupexperts')]);
let status=c.refreshProjectionConsensusV44_(true);assert.equal(status.completePlayers,1);assert.equal(status.sources.find(s=>s.id==='yahoo').state,'FETCH_BLOCKED');
assert.equal(status.sources.find(s=>s.id==='lineupexperts').state,'READY');
const snapshot=sheets.get(c.FBA_CONSENSUS_V44.baseline)[0].payload_json;
// A complete actual game's ownership and final markers survive overlay unchanged.
const engine={version:36,active:false,status:'WAITING',baseline:{},revision:'v36',players:[{id:'1',name:'Victor Wembanyama',actual:{gp:1,totals:{...stats,PTS:10},byWeek:{1:{gp:1,stats:{...stats,PTS:10}}}}}],actual:{completeGames:1,coverageReady:false,ownershipAtGameReady:false,completedFbaMatchups:[{week:1,awayPoints:5,homePoints:3}]}};
const actualRef=engine.actual,out=c.applyProjectionConsensusV44_(engine);assert.equal(out.version,36);assert.equal(out.actual,actualRef);assert.equal(out.actual.coverageReady,false);assert.equal(out.actual.ownershipAtGameReady,false);assert.equal(out.players[0].actual.byWeek[1].stats.PTS,10);assert.equal(out.players[0].base.PTS,25);assert.equal(out.consensus.frozen,true);
actualGames=1;sheets.set(c.FBA_CONSENSUS_V44.inputs,[input('lineupexperts',{PTS:40})]);
props.delete(c.FBA_CONSENSUS_V44.statusKey);status=c.refreshProjectionConsensusV44_(true);assert.equal(status.frozen,true);assert.equal(sheets.get(c.FBA_CONSENSUS_V44.baseline)[0].payload_json,snapshot);
let touched=false;c.validMonsterDeviceV29_=()=>false;c.refreshProjectionConsensusV44_=()=>{touched=true;};c.monsterJsonResponseV29_=x=>x;
assert.equal(c.matchupMonsterResponseV30_({monster:'projections_refresh',token:'bad'}).locked,true);assert.equal(touched,false);
assert.doesNotMatch(String(c.buildData),/Consensus|consensus/,'Keine neuen Projektionsdaten im öffentlichen Payload');
console.log('PASS · v44 source normalization, independent consensus, dates, partial coverage, real-game replacement, freeze and private access');

// A fuller export can replace a partial live row from the same snapshot.
assert.equal(c.consensusPreferRowV44_(b,partial),true);
assert.equal(c.consensusPreferRowV44_(partial,b),false);
assert.equal(c.consensusPreferRowV44_({...b,snapshotDate:'2026-09-06'},b),true);
// Freezing must never reactivate a baseline already stale at season start.
const stale={...merged,sourceDates:merged.sourceDates.map(s=>({...s,date:'2026-07-01'}))};
sheets.set(c.FBA_CONSENSUS_V44.baseline,[{season_id:2027,payload_json:JSON.stringify(stale)}]);
props.set(c.FBA_CONSENSUS_V44.statusKey,JSON.stringify({frozen:false}));
const blocked=c.applyProjectionConsensusV44_({version:36,players:[],actual:{completeGames:1},baseline:{},revision:'test'});
assert.equal(blocked.consensus.appliedPlayers,0);
assert.equal(blocked.consensus.frozen,true);
