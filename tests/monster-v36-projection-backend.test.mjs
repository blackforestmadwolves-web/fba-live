import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const code=fs.readFileSync(new URL("../apps-script/Code.js",import.meta.url),"utf8");
const context={console,Date,JSON,Math,Number,String,Array,Object,Map,Set,RegExp,Error};
vm.createContext(context);
vm.runInContext(code,context,{filename:"apps-script/Code.js"});

assert.equal(context.FBA_PROJECTION_ENGINE_V36.version,36);
assert.equal(context.FBA_PROJECTION_ENGINE_V36.projectionStatIds.GP,42);
assert.deepEqual(Array.from(context.FBA_PROJECTION_ENGINE_V36.projectionStats),
  ["PTS","REB","AST","3PM","STL","BLK","FGM","FGA","FTM","FTA"]);
assert.equal(Array.from(context.ESPN_DAILY_HEADERS_V2).at(-1),"ownership_captured",
  "Das additive Daily-Schema muss historische Besitzer-Snapshots eindeutig kennzeichnen");
assert.equal(Array.from(context.ESPN_PLAYER_HEADERS_V2).at(-1),"fantasy_positions",
  "Ligaabhängige ESPN-Positionen müssen als additives Feld rechts angehängt werden");

const espnEligible=context.normalizeFantasyPlayerV2_({playerPoolEntry:{player:{
  id:99,fullName:"ESPN Dual Guard",proTeamId:1,defaultPositionId:1,
  eligibleSlots:[0,1,5,6,7,8,9,10,13]
}}});
assert.equal(espnEligible.primaryPosition,"PG");
assert.equal(espnEligible.fantasyPositions,"PG,SG",
  "Nur die echten, ligaabhängigen ESPN-Positionen dürfen erscheinen; G/F/UTIL/BE/IR bleiben Slottypen");
const espnFallback=context.normalizeFantasyPlayerV2_({player:{
  id:100,fullName:"ESPN Center",proTeamId:2,defaultPositionId:5,eligibleSlots:[7,8,9]
}});
assert.equal(espnFallback.fantasyPositions,"C",
  "Fehlen die fünf Kern-Slots, darf ausschließlich ESPNs eigene Hauptposition als Fallback dienen");
const poolSlotFallback=context.normalizeFantasyPlayerV2_({playerPoolEntry:{eligibleSlots:[2,3,6,7],player:{
  id:101,fullName:"ESPN Forward",proTeamId:3,defaultPositionId:3,eligibleSlots:[]
}}});
assert.equal(poolSlotFallback.fantasyPositions,"SF,PF",
  "Liefert ESPN die Ligaberechtigungen am Pool-Eintrag, müssen auch diese unverändert ausgewertet werden");
const eligibleRows=context.collectFantasyPlayersV2_({players:[{playerPoolEntry:{player:{
  id:99,fullName:"ESPN Dual Guard",proTeamId:1,defaultPositionId:1,eligibleSlots:[0,1,5,7]
}}}],teams:[]},"2026-09-04T12:00:00.000Z");
const playerHeaders=Array.from(context.ESPN_PLAYER_HEADERS_V2);
assert.equal(eligibleRows[0][playerHeaders.indexOf("fantasy_positions")],"PG,SG",
  "Der ESPN-Vollsync muss die exakten Fantasy-Positionen bis in ESPN_Players schreiben");
assert.match(String(context.buildProjectionEnginePayloadV36_),/fantasyPositions:String\(meta\.fantasy_positions \|\| position/,
  "Auch die Projection Engine muss ESPNs ligaabhängige Positionen transportieren");
assert.match(String(context.buildMonsterPayloadV30_),/espnFantasyPositions:fantasyPositions/,
  "Der Monster-Payload muss die Positionen des vollständigen ESPN-Spielerpools und nicht nur des Kaders liefern");

function applyDailyUpsert(existing,incoming){
  let written=null;
  context.ensureEspnDailySheetV38_=()=>({
    getLastRow:()=>2,getMaxRows:()=>100,insertRowsAfter:()=>{},
    getRange:()=>({getValues:()=>[existing.slice()],setValues:rows=>{written=rows.map(row=>row.slice())}})
  });
  context.upsertEspnDailyRowsV36_([incoming.slice()]);
  return written[0];
}
const dailyHeader=Array.from(context.ESPN_DAILY_HEADERS_V2),dailyIndex=key=>dailyHeader.indexOf(key),capturedDaily=Array(dailyHeader.length).fill("");
Object.assign(capturedDaily,{[dailyIndex("season_id")]:2027,[dailyIndex("nba_date")]:"2026-10-20",[dailyIndex("event_id")]:"G1",[dailyIndex("player_id")]:"P1",
  [dailyIndex("owner_team_id")]:"7",[dailyIndex("owner_team")]:"Wolves",[dailyIndex("lineup_slot_id")]:4,[dailyIndex("active_lineup")]:true,[dailyIndex("PTS")]:10,[dailyIndex("ownership_captured")]:true});
const laterDaily=capturedDaily.slice();laterDaily[dailyIndex("owner_team_id")]="5";laterDaily[dailyIndex("owner_team")]="Pirates";laterDaily[dailyIndex("PTS")]=12;
const preservedDaily=applyDailyUpsert(capturedDaily,laterDaily);
assert.equal(preservedDaily[dailyIndex("owner_team")],"Wolves","Ein späterer Trade darf den ersten bestätigten Besitzer am Spieltag nicht überschreiben");
assert.equal(preservedDaily[dailyIndex("PTS")],12,"Offizielle ESPN-Statkorrekturen müssen trotz eingefrorenem Besitzer aktualisiert werden");
const legacyDaily=capturedDaily.slice();legacyDaily[dailyIndex("owner_team_id")]="";legacyDaily[dailyIndex("owner_team")]="";legacyDaily[dailyIndex("ownership_captured")]=false;
const upgradedDaily=applyDailyUpsert(legacyDaily,laterDaily);
assert.equal(upgradedDaily[dailyIndex("owner_team")],"Pirates","Ein alter unbestätigter Backfill darf durch einen frischen Spieltag-Snapshot repariert werden");
assert.equal(upgradedDaily[dailyIndex("ownership_captured")],true);

function espnTotals({gp=70,pts=1750}={}){
  return {
    0:pts,1:210,2:70,3:350,6:840,13:630,14:1260,15:350,16:420,17:140,42:gp
  };
}

const currentProjection={seasonId:2027,statSourceId:1,statSplitTypeId:0,stats:espnTotals()};
const league={players:[{playerPoolEntry:{player:{
  id:1,fullName:"Victor Wembanyama",proTeamId:24,defaultPositionId:5,
  stats:[
    {seasonId:2026,statSourceId:1,statSplitTypeId:0,stats:espnTotals({pts:7000})},
    {seasonId:2027,statSourceId:0,statSplitTypeId:0,stats:espnTotals({pts:6000})},
    {seasonId:2027,statSourceId:1,statSplitTypeId:1,stats:espnTotals({pts:5000})},
    currentProjection
  ]
}}}]};
const rows=context.parseEspnProjectionRowsV36_(league,"2026-09-04T12:00:00.000Z");
assert.equal(rows.length,1);
const row=rows[0],header=Array.from(context.ESPN_PROJECTION_HEADERS_V36),value=key=>row[header.indexOf(key)];
assert.equal(value("season_id"),2027);
assert.equal(value("player_id"),"1");
assert.equal(value("primary_position"),"C");
assert.equal(value("projected_gp"),70);
assert.equal(value("PTS_total"),1750,
  "Nur seasonId=2027, statSourceId=1 und statSplitTypeId=0 darf die Baseline liefern");
assert.equal(value("PTS_pg"),25);
assert.equal(value("REB_pg"),12);
assert.equal(value("stat_source_id"),1);
assert.equal(value("stat_split_type_id"),0);
assert.equal(value("source"),"ESPN kona_player_info");

const oldOnly={players:[{playerPoolEntry:{player:{
  id:2,fullName:"Alte Saison",proTeamId:1,defaultPositionId:1,
  stats:[{seasonId:2026,statSourceId:1,statSplitTypeId:0,stats:espnTotals()}]
}}}]};
assert.deepEqual(Array.from(context.parseEspnProjectionRowsV36_(oldOnly,"now")),[],
  "Eine gueltige ESPN-Projektion aus 2025/26 darf niemals als 2026/27-Fallback einspringen");

const wrongSource={players:[{player:{
  id:3,fullName:"Ist statt Projection",proTeamId:2,defaultPositionId:2,
  stats:[{seasonId:2027,statSourceId:0,statSplitTypeId:0,stats:espnTotals()}]
}}]};
assert.deepEqual(Array.from(context.parseEspnProjectionRowsV36_(wrongSource,"now")),[]);

assert.equal(context.validateProjectionTotalsV36_(70,{PTS:1750,REB:840,AST:350,"3PM":140,STL:70,BLK:210,FGM:630,FGA:1260,FTM:350,FTA:420}),true);
assert.equal(context.validateProjectionTotalsV36_(0,{PTS:0,REB:0,AST:0,"3PM":0,STL:0,BLK:0,FGM:0,FGA:0,FTM:0,FTA:0}),false,
  "projectedGp=0 ist keine belastbare ESPN-Saisonprojektion");
assert.equal(context.validateProjectionTotalsV36_(83,{PTS:1750,REB:840,AST:350,"3PM":140,STL:70,BLK:210,FGM:630,FGA:1260,FTM:350,FTA:420}),false,
  "projectedGp ist fuer eine regulaere NBA-Saison bei 82 gedeckelt");
assert.equal(context.validateProjectionTotalsV36_(70,{PTS:1750,REB:840,AST:350,"3PM":700,STL:70,BLK:210,FGM:630,FGA:1260,FTM:350,FTA:420}),false,
  "Dreier-Treffer duerfen nicht ueber allen Feldtreffern liegen");

const officialTeams=Object.entries(context.NBA_OFFICIAL_TEAM_ABBREVIATIONS_V36);
assert.equal(officialTeams.length,30);
const advancedPayload={resultSets:[{name:"LeagueDashTeamStats",headers:["TEAM_ID","TEAM_NAME","GP","PACE","DEF_RATING","POSS"],rowSet:
  officialTeams.map(([teamId,abbreviation],index)=>[Number(teamId),`Team ${abbreviation}`,82,98+index/10,108+index/10,8000+index])
}]};
const parsedAdvanced=context.parseNbaTeamProfileResponseV36_(advancedPayload,"2025-26","Advanced","stamp");
assert.equal(parsedAdvanced.length,30);
assert.equal(parsedAdvanced.find(team=>team.teamId==="1610612737").nbaTeam,"ATL",
  "NBA Team-ID muss auch ohne optionale TEAM_ABBREVIATION-Spalte stabil auf das Kuerzel abgebildet werden");

assert.equal(typeof context.replaceProjectionWithActualsV36_,"function",
  "Der Backend-Payload braucht denselben reinen Ist-ersetzt-Projection-Rechner wie das Frontend");
const base={PTS:25,REB:12,AST:4,"3PM":2,STL:1,BLK:3,FGM:9,FGA:18,FTM:5,FTA:6};
const actual={PTS:10,REB:10,AST:2,"3PM":1,STL:1,BLK:2,FGM:4,FGA:15,FTM:1,FTA:2};
const blended=context.replaceProjectionWithActualsV36_(70,base,1,actual);
assert.equal(blended.projectedGp,70);
assert.equal(blended.actualGp,1);
assert.equal(blended.remainingProjectedGames,69);
assert.equal(blended.games,70);
assert.equal(blended.totals.PTS,1735);
assert.ok(Math.abs(blended.perGame.PTS-24.785714285714285)<1e-12);
assert.ok(Math.abs(blended.perGame["FG%"]-(4+69*9)/(15+69*18))<1e-12,
  "Backend muss FG% aus FGM/FGA und nicht aus gemittelten Prozenten bilden");
assert.ok(Math.abs(blended.perGame["FT%"]-(1+69*5)/(2+69*6))<1e-12);

const completed=context.replaceProjectionWithActualsV36_(70,base,71,
  Object.fromEntries(Object.entries(base).map(([key,value])=>[key,value*71])));
assert.equal(completed.actualGp,71);
assert.equal(completed.remainingProjectedGames,0);
assert.equal(completed.games,71,"Ist-GP oberhalb projectedGp bleibt autoritativ und wird nicht abgeschnitten");

const completeKey="FBA_NBA_EVENT_DONE_2027_final-1";
context.espnPropertiesV1_=()=>({getProperties:()=>({[completeKey]:"1"})});
const dailyBase={season_id:2027,nba_date:"2026-10-20",matchup_period:1,player_id:"wemby",player_name:"Victor Wembanyama",nba_team:"SAS",owner_team_id:"7",owner_team:"BlackForest Mad Wolves",active_lineup:true,ownership_captured:true,...actual};
const actualAggregate=context.aggregateProjectionActualsV36_([
  {...dailyBase,event_id:"final-1",event_status:"FINAL"},
  {...dailyBase,event_id:"final-1",event_status:"FINAL"}, // duplicate fetch / stat correction, same game
  {...dailyBase,event_id:"live-1",event_status:"IN_PROGRESS",PTS:7},
  {...dailyBase,event_id:"unconfirmed-final",event_status:"FINAL",PTS:9}
]);
assert.equal(actualAggregate.byPlayer.wemby.gp,1,"Nur ein bestaetigter, vollstaendiger FINAL-Boxscore darf Ist-GP erhoehen");
assert.equal(actualAggregate.byPlayer.wemby.totals.PTS,10,"Doppelte ESPN-Zeilen derselben Event-/Spieler-ID duerfen nicht doppelt zaehlen");
assert.equal(actualAggregate.byPlayer.wemby.byWeek["1"].gp,1);
assert.equal(actualAggregate.completeGames,1);
assert.equal(actualAggregate.ownershipAtGameReady,true,
  "Ein eingefrorener Besitzer-/Aufstellungsstand muss die In-Season-Rechnung freigeben");
assert.equal(actualAggregate.byTeamWeek["BlackForest Mad Wolves"]["1"].gp,1);
assert.equal(actualAggregate.byTeamWeek["BlackForest Mad Wolves"]["1"].stats.PTS,10,
  "Finale Montag-/Dienstag-Werte müssen exakt dem damaligen FBA-Team zugerechnet werden");
assert.equal(actualAggregate.inProgressRows,1,"IN_PROGRESS wird als wartend ausgewiesen und nicht in Ist-Werte gemischt");
assert.equal(actualAggregate.excludedFinalRows,1,"Ein noch nicht als vollstaendig bestaetigtes FINAL bleibt ausgeschlossen");
assert.equal(actualAggregate.byPlayer.dnp,undefined,"Ein Spieler ohne finale Boxscore-Zeile wird nicht als Null-Stat-Ist-Spiel erfunden");
const ownershipMissing=context.aggregateProjectionActualsV36_([
  {...dailyBase,event_id:"final-1",event_status:"FINAL",ownership_captured:false}
]);
assert.equal(ownershipMissing.ownershipAtGameReady,false);
assert.deepEqual(Array.from(ownershipMissing.ownershipMissingEventIds),["final-1"],
  "Ein alter Boxscore ohne damaligen Besitzer darf nicht dem heutigen Kader zugeschlagen werden");

const completedSchedule=Array.from({length:4},(_,index)=>({week:1,away_team:`Away ${index+1}`,home_team:`Home ${index+1}`}));
const completedStats=completedSchedule.map((game,index)=>({Woche:1,"Team A":game.away_team,"Team B":game.home_team,
  PTS_A:100+index,PTS_B:90,REB_A:40,REB_B:45,AST_A:30,AST_B:20,"3PM_A":12,"3PM_B":10,
  STL_A:8,STL_B:7,BLK_A:4,BLK_B:6,"FG%_A":.51,"FG%_B":.49,"FT%_A":.78,"FT%_B":.82}));
const completedResults=completedSchedule.map((game,index)=>({Week:1,Away:game.away_team,Home:game.home_team,
  "Away Cats":5,"Home Cats":3}));
const fbaSeeds=context.projectionFbaActualSeedsV38_(completedResults,completedStats,completedSchedule,2,true);
assert.equal(fbaSeeds.ready,true);
assert.equal(fbaSeeds.completedThroughWeek,1);
assert.equal(fbaSeeds.completedFbaMatchups.length,4,
  "Sobald ESPN auf W2 steht, müssen alle vier finalen W1-Ergebnisse feste Saison-Seeds werden");
assert.equal(fbaSeeds.completedFbaMatchups[0].categories.length,8);
assert.equal(context.projectionFbaActualSeedsV38_([],[],completedSchedule,1,true).ready,true,
  "In der laufenden W1 sind null abgeschlossene FBA-Wochen ein vollständiger und gültiger Seed-Stand");
const incompleteSeeds=context.projectionFbaActualSeedsV38_(completedResults.slice(0,3),completedStats,completedSchedule,2,true);
assert.equal(incompleteSeeds.ready,false,"Drei von vier W1-Ergebnissen dürfen die Endtabelle nicht teilweise einfrieren");

const syncPropertyWrites={};
const scoreboardFailureSync=vm.runInNewContext(`(${context.syncEspnPlayerHubV2_.toString()})`,{
  ensureEspnPlayerHubSheetsV2_:()=>{},
  fetchEspnFantasyHubV2_:()=>({}),
  sheetObjectsV2_:()=>[],objectRowsToArraysV36_:()=>[],
  collectFantasyPlayersV2_:()=>[[2027,"P1"]],
  collectFantasyRosterV2_:()=>{const roster=Array(13).fill("");roster[5]="P1";return [roster]},
  collectFantasyTransactionsV2_:()=>[],validateRosterSnapshotV36_:()=>({ok:true}),
  uniquePlayerIdsFromRosterRowsV36_:()=>["P1"],replaceEspnRowsV2_:()=>{},saveRosterHistoryV2_:()=>{},appendUniqueEspnRowsV2_:()=>{},
  syncNbaTeamProfilesV36_:()=>({status:"READY"}),
  fetchNbaDailyRowsV2_:()=>{throw new Error("ESPN Scoreboard HTTP 503")},upsertEspnDailyRowsV36_:()=>{},
  syncEspnProjectionBaselineV36_:()=>({status:"READY"}),
  espnPropertiesV1_:()=>({
    setProperties:values=>Object.assign(syncPropertyWrites,values),
    setProperty:(key,value)=>{syncPropertyWrites[key]=value},deleteProperty:key=>{delete syncPropertyWrites[key]}
  }),
  ESPN_PLAYER_HUB_V2:context.ESPN_PLAYER_HUB_V2,
  ESPN_PLAYER_HEADERS_V2:context.ESPN_PLAYER_HEADERS_V2,
  ESPN_ROSTER_HEADERS_V2:context.ESPN_ROSTER_HEADERS_V2,
  ESPN_TRANSACTION_HEADERS_V2:context.ESPN_TRANSACTION_HEADERS_V2,
  String,Number,Array,Object,Error
});
const scoreboardFailure=scoreboardFailureSync("2026-10-20T12:00:00.000Z",{});
assert.equal(scoreboardFailure.dailyStatus,"PARTIAL");
assert.equal(scoreboardFailure.status,"TEILERFOLG");
assert.match(scoreboardFailure.error,/NBA-Boxscores.*Scoreboard HTTP 503/,
  "Ein Scoreboard-Fehler muss den Daily-Feed sichtbar auf PARTIAL setzen");
assert.equal(syncPropertyWrites.FBA_ESPN_DAILY_STATUS_V36,"PARTIAL",
  "Der PARTIAL-Status muss fuer den Projection-Payload persistent werden");

const buildPartialActualEngine=vm.runInNewContext(`(${context.buildProjectionEnginePayloadV36_.toString()})`,{
  sheetObjectsV2_:()=>[],unavailableProjectionEventsV36_:()=>({}),
  aggregateProjectionActualsV36_:()=>({byPlayer:{},revision:"actual-empty",completeGames:0,completedEventIds:[],
    inProgressEventIds:[],excludedFinalEventIds:[],throughDate:null,inProgressRows:0,excludedFinalRows:0,
    neutralizedRows:0,neutralizedEventIds:[]}),
  projectionBaselineStatusV36_:()=>({status:"READY",active:true,lastSuccess:"baseline-ready"}),
  projectionProfilesPayloadV36_:()=>({status:"READY",active:true,lastSuccess:"profiles-ready",teams:{}}),
  projectionActualCompletenessV36_:()=>({ready:true,allPendingEventIds:[],pendingEventIds:[]}),
  projectionFbaActualSeedsV38_:()=>({ready:true,status:"READY",currentMatchupPeriod:0,completedThroughWeek:0,completedFbaMatchups:[],issue:""}),
  espnPropertiesV1_:()=>({getProperty:key=>key==="FBA_ESPN_DAILY_STATUS_V36"?"PARTIAL":""}),
  FBA_PROJECTION_ENGINE_V36:context.FBA_PROJECTION_ENGINE_V36,
  ESPN_PLAYER_HUB_V2:context.ESPN_PLAYER_HUB_V2,ESPN_SYNC_V1:context.ESPN_SYNC_V1,
  String,Number,Object,Array,Math
});
const partialActualEngine=buildPartialActualEngine({games:[]},{games:[]});
assert.equal(partialActualEngine.actual.dailyFeedStatus,"PARTIAL");
assert.equal(partialActualEngine.actual.status,"PARTIAL");
assert.equal(partialActualEngine.actual.reason,"ESPN_DAILY_SYNC_PARTIAL");
assert.equal(partialActualEngine.actual.ready,false);
assert.equal(partialActualEngine.actual.coverageReady,false,
  "Auch ohne offene Event-ID darf ein fehlgeschlagener Scoreboard-/Daily-Sync keine vollstaendige Ist-Abdeckung behaupten");

const postponedWeek={games:[{id:"stale-live",date:"2026-10-23",teams:["SAS","HOU"],status:"STATUS_POSTPONED"}]};
const staleSeason={games:[{gameId:"stale-live",date:"2026-10-23",away:"SAS",home:"HOU",status:"STATUS_SCHEDULED"}]};
const unavailable=context.unavailableProjectionEventsV36_(postponedWeek,staleSeason);
assert.equal(unavailable["stale-live"],"STATUS_POSTPONED");
const neutralized=context.aggregateProjectionActualsV36_([
  {...dailyBase,event_id:"stale-live",event_status:"IN_PROGRESS",PTS:7}
],unavailable);
assert.equal(neutralized.inProgressRows,0,"POSTPONED muss eine alte Live-Zeile aus der Ist-Abdeckung entfernen");
assert.equal(neutralized.neutralizedRows,1);
assert.deepEqual(Array.from(neutralized.neutralizedEventIds),["stale-live"]);
context.overlayProjectionEventStatusV36_(postponedWeek,staleSeason,{actual:{inProgressEventIds:["stale-live"]}});
assert.equal(postponedWeek.games[0].status,"STATUS_POSTPONED");
assert.equal(staleSeason.games[0].status,"STATUS_POSTPONED",
  "Ein autoritativ verschobenes Spiel darf durch eine stale IN_PROGRESS-ID nicht wiederauferstehen");
assert.equal(staleSeason.games[0].actualUnavailable,true);
assert.match(context.buildMonsterPayloadV30_.toString(),/buildProjectionEnginePayloadV36_\(nbaSchedule,nbaSeasonSchedule\)/,
  "Der Engine-Build muss beide aktuellen Spielplaene fuer die POSTPONED-Neutralisierung erhalten");

const existingRoster=Array.from({length:8},(_,teamIndex)=>Array.from({length:13},(_,playerIndex)=>{
  const row=Array(13).fill("");row[3]=String(teamIndex+1);row[5]=`P${teamIndex+1}-${playerIndex+1}`;return row;
})).flat();
const shellLeague={teams:Array.from({length:8},(_,index)=>({id:index+1}))};
const rejectedShell=context.validateRosterSnapshotV36_(shellLeague,[],existingRoster);
assert.equal(rejectedShell.ok,false);
assert.equal(rejectedShell.missingStructure.length,8,
  "ESPN-Teamhuellen ohne roster.entries duerfen den bestaetigten 104er-Kader nicht leeren");
const completeLeague={teams:Array.from({length:8},(_,teamIndex)=>({id:teamIndex+1,roster:{entries:Array.from({length:13},(_,playerIndex)=>({playerId:`P${teamIndex+1}-${playerIndex+1}`}))}}))};
assert.equal(context.validateRosterSnapshotV36_(completeLeague,existingRoster,existingRoster).ok,true);
assert.match(context.syncEspnPlayerHubV2_.toString(),/validateRosterSnapshotV36_[\s\S]*if \(!rosterValidation\.ok\)[\s\S]*criticalRosterError = true/,
  "Der produktive Sync muss den Snapshot pruefen, bevor er aktuelle Kaderdaten ersetzt");

const payloadSource=context.buildMonsterPayloadV30_.toString();
assert.match(payloadSource,/id:'fantasypros'[^\n}]*active:false/i);
assert.match(payloadSource,/id:'hashtag'[^\n}]*active:false/i);
assert.match(payloadSource,/keine erfundenen Positions-\/Defender-Effekte/i,
  "Die Quellenzeile muss die Grenzen der Gegnerprofile offen benennen");

console.log("PASS · FBA Projection Engine v36 backend tests");
