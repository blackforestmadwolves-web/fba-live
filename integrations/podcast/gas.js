/* Installed alongside the current application, never replacing its other files.
 * Uses its existing spreadsheet, ESPN reader and verified BBM import store.
 * No voice generation, new credentials, public BBM feed or new OAuth scopes.
 */
function installFbaPodcast132() {
  var result=refreshFbaPodcast132();
  if(!result.ok)throw Error('Podcast-Daten zuerst erfolgreich prüfen.');
  var handler='refreshFbaPodcast132';
  if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()===handler;}))
    ScriptApp.newTrigger(handler).timeBased().everyMinutes(30).create();
  return verifyFbaPodcast132();
}
function verifyFbaPodcast132() {
  var p=podcastRead132_(),summary=podcastSummary132_(p);
  summary.scheduler=ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='refreshFbaPodcast132';});
  if(!p||p.teams.length!==8||p.matchups.length!==4)throw Error('Podcast-Daten fehlen.');
  var denied=JSON.parse(fbaPodcastResponse132_({}).getContent());
  if(denied.ok||denied.error!=='DEVICE_AUTH_REQUIRED')throw Error('Podcast-Zugriffsschutz fehlt.');
  summary.anonymousAccess='blocked';Logger.log(JSON.stringify(summary));return summary;
}
var FBA_PODCAST132={sheet:'FBA_Podcast_Quellen_v132',index:'FBA_PODCAST132_INDEX',previous:'FBA_PODCAST132_PREVIOUS',error:'FBA_PODCAST132_ERROR',chunk:20000,slots:350,maxAgeMs:90*60000};
function podcastMeta132_(key) {
  try{var m=JSON.parse(espnPropertiesV1_().getProperty(key)||'null');
    return m&&m.schema===132&&(m.slot===0||m.slot===1)&&Number.isInteger(m.count)&&m.count>0&&m.count<=FBA_PODCAST132.slots&&typeof m.hash==='string'?m:null;
  }catch(e){return null;}
}
function podcastStored132_(m) {
  if(!m)return null;
  try{
    var sh=book().getSheetByName(FBA_PODCAST132.sheet);if(!sh)return null;
    var rows=sh.getRange(2+m.slot*FBA_PODCAST132.slots,1,m.count,1).getValues();
    if(!rows.every(function(r){return typeof r[0]==='string'&&r[0][0]==='J';}))return null;
    var text=rows.map(function(r){return r[0].slice(1);}).join('');
    if(stableHashV36_(text)!==m.hash)return null;
    var p=JSON.parse(text);return p.schema===132&&p.ok&&p.season===2027&&p.scope==='private_podcast_sources'?p:null;
  }catch(e){return null;}
}
function podcastRead132_() {
  return podcastStored132_(podcastMeta132_(FBA_PODCAST132.index))||podcastStored132_(podcastMeta132_(FBA_PODCAST132.previous));
}
function podcastWrite132_(packet) {
  // Caller holds the script lock. A failed write never changes the active pointer.
  var text=JSON.stringify(packet),count=Math.ceil(text.length/FBA_PODCAST132.chunk);
  if(count<1||count>FBA_PODCAST132.slots)throw Error('Podcast-Speichergrenze erreicht.');
  var before=podcastMeta132_(FBA_PODCAST132.index);
  if(!podcastStored132_(before))before=podcastMeta132_(FBA_PODCAST132.previous);
  if(!podcastStored132_(before))before=null;
  var slot=before?1-before.slot:0,ss=book(),sh=ss.getSheetByName(FBA_PODCAST132.sheet);
  if(!sh){sh=ss.insertSheet(FBA_PODCAST132.sheet);sh.getRange(1,1).setValue('PRIVATE_PODCAST_SOURCE_STATE');sh.hideSheet();}
  var required=2*FBA_PODCAST132.slots+1;if(sh.getMaxRows()<required)sh.insertRowsAfter(sh.getMaxRows(),required-sh.getMaxRows());
  var range=sh.getRange(2+slot*FBA_PODCAST132.slots,1,count,1);
  range.setNumberFormat('@').setValues(Array.from({length:count},function(_,i){return ['J'+text.substr(i*FBA_PODCAST132.chunk,FBA_PODCAST132.chunk)];}));
  SpreadsheetApp.flush();
  var check=range.getValues().map(function(r){return String(r[0]).slice(1);}).join('');
  if(check!==text)throw Error('Podcast-Daten konnten nicht vollständig gespeichert werden.');
  var updates={},meta={schema:132,slot:slot,count:count,hash:stableHashV36_(text),asOf:packet.created_at};
  if(before)updates[FBA_PODCAST132.previous]=JSON.stringify(before);
  updates[FBA_PODCAST132.index]=JSON.stringify(meta);espnPropertiesV1_().setProperties(updates);
}
function podcastLeagueUrl132_() {
  return 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/'+ESPN_SYNC_V1.seasonId+'/segments/0/leagues/'+ESPN_SYNC_V1.leagueId;
}
function podcastTransactions132_(raw,prior) {
  var current=Number(raw.scoringPeriodId||raw.status.latestScoringPeriod||1),first=Number(raw.status.firstScoringPeriod||1);
  var old=prior&&prior.sources&&prior.sources.espn.transaction_coverage||{},cursor=Math.max(first-1,Number(old.through_scoring_period)||0);
  if(cursor>current)throw Error('ESPN-Spieltag läuft rückwärts.');
  var tx=raw.transactions;if(!Array.isArray(tx))throw Error('ESPN-Transaktionsantwort fehlt.');
  var through=Math.min(current,cursor+7),periods=[];
  for(var day=cursor+1;day<=through;day++)periods.push(day);
  // Re-read recent periods so late status updates and accepted trades are not lost.
  [current-1,current].forEach(function(d){if(d>=first&&periods.indexOf(d)<0)periods.push(d);});
  periods.forEach(function(d){if(d===current)return;
    var r=fetchEspnJsonV2_(podcastLeagueUrl132_()+'?view=mTransactions2&scoringPeriodId='+d);
    if(String(r.id)!==String(ESPN_SYNC_V1.leagueId)||r.seasonId!==2027||!Array.isArray(r.transactions))throw Error('Unvollständige ESPN-Transaktionshistorie.');
    tx=tx.concat(r.transactions);
  });
  return {transactions:tx,coverage:{complete:through===current,from_scoring_period:first,through_scoring_period:through,current_scoring_period:current,
    scope:'ESPN mTransactions2: angefragte Spieltage, einschließlich erneuter Prüfung der letzten zwei; redigierte Trade-Spieler separat markiert'}};
}
function podcastNight132_(now,league) {
  var date=Utilities.formatDate(new Date(Date.parse(now)-86400000),'America/New_York','yyyy-MM-dd');
  var result={date:date,timezone:'America/New_York',status:'unavailable',games:[],performances:[],source_refs:['espn:scoreboard:'+date]};
  if(date<'2026-10-20'){result.status='out_of_season';return result;}
  var board=fetchEspnJsonV2_(nbaScoreboardUrlV2_(date.replace(/-/g,'')));
  if(!Array.isArray(board.events))return result;
  result.games=board.events.map(function(e){var comp=(e.competitions||[])[0]||{},st=(e.status||comp.status||{}).type||{};
    return {event_id:String(e.id),name:e.name||'',completed:st.completed===true,status:st.name||'',teams:(comp.competitors||[]).map(function(c){return {name:c.team&&c.team.displayName,score:c.score};})};});
  if(!result.games.length){result.status='no_games';return result;}
  var gameIds=result.games.map(function(g){return g.event_id;}),props=espnPropertiesV1_().getProperties();
  result.status=result.games.every(function(g){return g.completed&&props[nbaEventDoneKeyV36_(g.event_id)]==='1';})?'complete':'pending_games_or_boxscores';
  result.performances=sheetObjectsV2_(ESPN_PLAYER_HUB_V2.dailySheet).filter(function(r){
    return Number(r.season_id)===2027&&gameIds.indexOf(String(r.event_id))>=0&&Number(r.owner_team_id)>0&&/FINAL|STATUS_FINAL/.test(String(r.event_status))&&(r.ownership_captured===true||String(r.ownership_captured).toLowerCase()==='true');
  }).map(function(r){var stats={};['PTS','REB','AST','3PM','STL','BLK','FGM','FGA','FTM','FTA'].forEach(function(k){stats[k]=Number(r[k]);});
    return {player_id:String(r.player_id),player_name:r.player_name,owner_team_id:String(r.owner_team_id),event_id:String(r.event_id),active_lineup:r.active_lineup===true||String(r.active_lineup).toLowerCase()==='true',stats:stats,source_ref:'espn:boxscore:'+r.event_id};});
  return result;
}
function refreshFbaPodcast132() {
  // The existing global lock prevents overlap with ESPN imports and BBM writes.
  var lock=LockService.getScriptLock();if(!lock.tryLock(0))return {ok:false,busy:true};
  var props=espnPropertiesV1_();
  try{
    var now=new Date().toISOString(),prior=podcastRead132_(),raw=fetchEspnJsonV2_(podcastLeagueUrl132_()+'?view=mTeam&view=mRoster&view=mTransactions2&view=mSettings&view=mMatchup&view=mMatchupScore');
    var tx=podcastTransactions132_(raw,prior),draft=buildDraftProjectionsV72_(),engine=draft&&draft.ok?draft.projectionEngine:null;
    var horizons=readProjectionHorizons126_(engine),packet=FBA_PODCAST_CORE132.build({now:now,league:raw,teamNames:ESPN_TEAM_ID_MAP_V1,
      transactions:tx.transactions,transactionCoverage:tx.coverage,horizons:horizons,schedule:monsterFbaScheduleV30_(),night:podcastNight132_(now,raw)},prior);
    packet.sources.app={status:'connected',backend:'existing_fba_apps_script',as_of:draft&&draft.snapshot108&&draft.snapshot108.asOf||null,
      snapshot_stale:!draft||!draft.ok||!draft.snapshot108||draft.snapshot108.stale===true,projection_status:engine&&engine.status||'unavailable',
      forecast_status:'no_persisted_matchup_forecast',bbm_import_status:horizons.status,bbm_revision:horizons.revision};
    packet.sources.bbm.availability=horizons.availability127||null;
    packet.player_events=podcastPlayerEvents132_(prior,packet);
    packet.memory=podcastMemory132_(prior,packet);
    podcastWrite132_(packet);props.deleteProperty(FBA_PODCAST132.error);
    var summary=podcastSummary132_(packet);Logger.log(JSON.stringify(summary));return summary;
  }catch(e){props.setProperty(FBA_PODCAST132.error,JSON.stringify({at:new Date().toISOString(),status:'SOURCE_REFRESH_FAILED'}));
    console.error('Podcast-Quellen: '+String(e.message||e).slice(0,200));throw e;
  }finally{lock.releaseLock();}
}
function podcastPlayerEvents132_(before,after) {
  var old={};if(!before)return [];
  before.teams.forEach(function(t){t.roster.forEach(function(p){old[p.player_id]=p;});});
  var changes=[];after.teams.forEach(function(t){t.roster.forEach(function(p){var b=old[p.player_id];if(b&&b.injury_status!==p.injury_status)
    changes.push({type:'injury_status_changed',player_id:p.player_id,name:p.name,team_id:t.id,previous:b.injury_status,current:p.injury_status,observed_at:after.created_at,source_ref:'espn:league:'+after.created_at});});});
  return changes;
}
function podcastMemory132_(before,after) {
  var memory=before&&before.memory||[],date=Utilities.formatDate(new Date(after.created_at),'America/New_York','yyyy-MM-dd');
  var row={date:date,as_of:after.created_at,week:after.week,matchups:after.matchups,standings:after.teams.map(function(t){return {team_id:t.id,record:t.standing};}),
    player_events:after.player_events,mandatory_trade_ids:after.mandatory_trade_ids,bbm_as_of:after.sources.bbm.as_of};
  var today=memory.find(function(x){return x.date===date;}),events=(today&&today.player_events||[]).concat(row.player_events),seen={};
  row.player_events=events.filter(function(e){var key=JSON.stringify(e);if(seen[key])return false;seen[key]=1;return true;});
  return memory.filter(function(x){return x.date!==date;}).concat([row]).slice(-240);
}
function podcastSummary132_(p) {
  if(!p)return {ok:false,schema:132,status:'WAITING'};
  return {ok:true,schema:132,asOf:p.created_at,teams:p.teams.length,players:p.teams.reduce(function(n,t){return n+t.roster.length;},0),matchups:p.matchups.length,
    transactions:p.transactions.length,mandatoryTrades:p.mandatory_trade_ids.length,unresolvedTrades:p.unresolved_trade_ids.length,
    bbm:p.sources.bbm.status,bbmAsOf:p.sources.bbm.as_of,night:p.nba_night.status,memoryDays:p.memory&&p.memory.length||0,readiness:p.readiness};
}
function fbaPodcastResponse132_(p) {
  // Deliberately excluded from public_data and public_projections.
  if(!validMonsterDeviceV29_(p.token||''))return monsterJsonResponseV29_({ok:false,schema:132,error:'DEVICE_AUTH_REQUIRED'},'');
  var data=podcastRead132_();if(!data)return monsterJsonResponseV29_({ok:false,schema:132,error:'SOURCE_SNAPSHOT_PENDING'},'');
  var failure=espnPropertiesV1_().getProperty(FBA_PODCAST132.error),age=Date.now()-Date.parse(data.created_at);
  data.delivery={stale:!!failure||!Number.isFinite(age)||age>FBA_PODCAST132.maxAgeMs,age_ms:age,last_refresh_failed:!!failure};
  if(data.delivery.stale){data.readiness.can_generate_daily=false;data.limitations.push('Gespeicherter Quellenstand veraltet; letzter guter Stand bleibt erhalten.');}
  return monsterJsonResponseV29_(data,'');
}
