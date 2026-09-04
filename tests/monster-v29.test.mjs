import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const cacheData=new Map();
const propertyData=new Map();
const cache={
  get:key=>cacheData.get(key)||null,
  put:(key,value)=>cacheData.set(key,String(value)),
  remove:key=>cacheData.delete(key),
  putAll:values=>Object.entries(values).forEach(([key,value])=>cacheData.set(key,String(value))),
  getAll:keys=>Object.fromEntries(keys.filter(key=>cacheData.has(key)).map(key=>[key,cacheData.get(key)]))
};
const properties={
  getProperty:key=>propertyData.get(key)||null,
  setProperty:(key,value)=>propertyData.set(key,String(value)),
  setProperties:values=>Object.entries(values).forEach(([key,value])=>propertyData.set(key,String(value))),
  deleteProperty:key=>propertyData.delete(key)
};
const lockEvents=[];
let scriptLockAvailable=true;
const scriptLock={
  tryLock:waitMs=>{lockEvents.push(`script:try:${waitMs}`);return scriptLockAvailable;},
  releaseLock:()=>lockEvents.push("script:release")
};
const context={
  console,
  CacheService:{getScriptCache:()=>cache},
  PropertiesService:{getScriptProperties:()=>properties},
  Utilities:{
    Charset:{UTF_8:"UTF_8"},
    DigestAlgorithm:{SHA_256:"SHA_256"},
    computeDigest:(_algorithm,value)=>Array.from(crypto.createHash("sha256").update(String(value)).digest(),byte=>byte>127?byte-256:byte),
    getUuid:()=>crypto.randomUUID(),
    formatDate:date=>new Date(date).toISOString().slice(0,10)
  },
  SpreadsheetApp:{getActive:()=>null},
  LockService:{getScriptLock:()=>scriptLock},
  ContentService:{MimeType:{JSON:"JSON",JAVASCRIPT:"JAVASCRIPT"}},
  HtmlService:{},
  Session:{},
  ScriptApp:{},
  DriveApp:{},
  UrlFetchApp:{},
  Date,
  JSON,
  Math
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../apps-script/Code.js",import.meta.url),"utf8"),context);

class MemoryRange {
  constructor(sheet,row,column,numRows=1,numColumns=1){Object.assign(this,{sheet,row,column,numRows,numColumns});}
  getValues(){return Array.from({length:this.numRows},(_,r)=>Array.from({length:this.numColumns},(_,c)=>this.sheet.rows[this.row-1+r]?.[this.column-1+c]??""));}
  setValues(values){values.forEach((line,r)=>line.forEach((value,c)=>{while(this.sheet.rows.length<this.row+r)this.sheet.rows.push([]);const target=this.sheet.rows[this.row-1+r]||(this.sheet.rows[this.row-1+r]=[]);target[this.column-1+c]=value;}));return this;}
  clearContent(){for(let r=0;r<this.numRows;r++)for(let c=0;c<this.numColumns;c++){if(this.sheet.rows[this.row-1+r])this.sheet.rows[this.row-1+r][this.column-1+c]="";}return this;}
  getValue(){return this.getValues()[0][0];}
  setValue(value){return this.setValues([[value]]);}
  setFontWeight(){return this;} setBackground(){return this;} setHorizontalAlignment(){return this;}
  setNumberFormat(format){for(let r=0;r<this.numRows;r++)for(let c=0;c<this.numColumns;c++)this.sheet.formats.set(`${this.row+r}:${this.column+c}`,format);return this;}
}
class MemorySheet {
  constructor(name,rows=[]){this.name=name;this.rows=rows.map(row=>row.slice());this.maxRows=Math.max(1000,this.rows.length);this.formats=new Map();}
  getLastRow(){let last=0;this.rows.forEach((row,index)=>{if(row.some(value=>value!==""&&value!==null&&value!==undefined))last=index+1;});return last;}
  getLastColumn(){return this.rows.reduce((max,row)=>Math.max(max,row.length),0);}
  getRange(row,column,numRows=1,numColumns=1){return new MemoryRange(this,row,column,numRows,numColumns);}
  getDataRange(){return this.getRange(1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn()));}
  getMaxRows(){return this.maxRows;}
  insertRowsAfter(_after,count){this.maxRows+=count;return this;}
  setFrozenRows(){return this;}
  appendRow(row){this.rows.push(row.slice());return this;}
}
class MemoryBook {
  constructor(){this.sheets=new Map();}
  add(name,rows=[]){const sheet=new MemorySheet(name,rows);this.sheets.set(name,sheet);return sheet;}
  getSheetByName(name){return this.sheets.get(name)||null;}
  insertSheet(name){return this.add(name);}
}

const sheetValues=[
  ["SAISON","WOCHE","MATCHUP","START","STATUS","AWAY","HOME"],
  ["2026/27",1,"W1-1","","","East Bay Pirates","BlackForest Mad Wolves"],
  ["2026/27",1,"W1-2","","","Balingen Lions","Karlsruhe Unicorns"]
];
const workbook=new MemoryBook();
workbook.add(context.ESPN_SYNC_V1.scheduleSheet,sheetValues);
context.book=()=>workbook;
const schedule=context.monsterFbaScheduleV30_();
assert.equal(schedule.length,2);
assert.equal(schedule[0].week,1);
assert.equal(schedule[0].away,"East Bay Pirates");
assert.equal(schedule[0].home,"BlackForest Mad Wolves");
assert.equal(schedule[0].start,"2026-10-20","FBA-Woche 1 muss am NBA-Opening-Day starten");
assert.equal(schedule[0].end,"2026-10-25","FBA-Woche 1 endet am ersten Sonntag");

assert.deepEqual(JSON.parse(JSON.stringify(context.fantasyWeekWindowV30_(2))),{
  week:2,start:"2026-10-26",end:"2026-11-01",lookaheadEnd:"2026-11-02"
});
assert.deepEqual(JSON.parse(JSON.stringify(context.fantasyWeekWindowV30_(4))),{
  week:4,start:"2026-11-09",end:"2026-11-15",lookaheadEnd:"2026-11-16"
});
assert.match(context.espnTeamScheduleGamesV30_.toString(),/seasontype=2/,"ESPN-Team-Schedule muss ausdrücklich die Regular Season anfordern");

function fullEspnSeasonPayload(gameCount=1200){
  const proTeams=Array.from({length:30},(_,index)=>({id:index+1,proGamesByScoringPeriod:{}}));
  const overrides=[
    {away:25,home:24,date:"2026-10-20T23:00:00Z"},
    {away:10,home:24,date:"2026-10-23T23:00:00Z"},
    {away:24,home:6,date:"2026-10-24T23:00:00Z"},
    {away:23,home:24,date:"2026-10-27T23:00:00Z"}
  ];
  const games=[];
  for(let index=0;index<gameCount;index++){
    const special=overrides[index];
    const away=special?.away||(index%30)+1,home=special?.home||(away%30)+1;
    const date=special?.date||new Date(Date.UTC(2026,9,20+Math.floor(index/6),20)).toISOString();
    const scoringPeriodId=Math.floor(index/6)+1;
    games.push({id:`season-${index}`,date:Date.parse(date),awayProTeamId:away,homeProTeamId:home,scoringPeriodId});
  }
  const targetGamesPerTeam=gameCount*2/30;
  if(Number.isInteger(targetGamesPerTeam)){
    const counts=Array(31).fill(0);games.forEach(game=>{counts[game.awayProTeamId]++;counts[game.homeProTeamId]++});
    for(let deficit=1;deficit<=30;deficit++)while(counts[deficit]<targetGamesPerTeam){
      const game=games.slice(4).find(candidate=>{
        const awayExcess=counts[candidate.awayProTeamId]>targetGamesPerTeam&&candidate.homeProTeamId!==deficit;
        const homeExcess=counts[candidate.homeProTeamId]>targetGamesPerTeam&&candidate.awayProTeamId!==deficit;
        return awayExcess||homeExcess;
      });
      assert.ok(game,"NBA-Testfixture muss auf gleiche Team-Spielzahlen ausbalancierbar sein");
      if(counts[game.awayProTeamId]>targetGamesPerTeam&&game.homeProTeamId!==deficit){counts[game.awayProTeamId]--;game.awayProTeamId=deficit}
      else{counts[game.homeProTeamId]--;game.homeProTeamId=deficit}
      counts[deficit]++;
    }
    assert.ok(counts.slice(1).every(count=>count===targetGamesPerTeam),"NBA-Testfixture braucht 80 beziehungsweise 82 Spiele pro Team");
  }
  for(const game of games){
    for(const teamId of [game.awayProTeamId,game.homeProTeamId]){
      const periods=proTeams[teamId-1].proGamesByScoringPeriod;
      (periods[game.scoringPeriodId]||(periods[game.scoringPeriodId]=[])).push(game);
    }
  }
  return {settings:{proTeams}};
}

const rawSeason=fullEspnSeasonPayload();
const parsedSeason=context.parseEspnFantasyNbaScheduleV33_(rawSeason);
assert.equal(parsedSeason.teamCount,30,"ESPN proTeamSchedules_wl muss alle 30 NBA-Teams enthalten");
assert.equal(parsedSeason.games.length,1200,"doppelt je Team gelistete ESPN-Spiele werden strikt über die Event-ID dedupliziert");
assert.equal(new Set(parsedSeason.games.map(game=>game.id)).size,1200,"jede Event-ID kommt nur einmal vor");
assert.doesNotThrow(()=>context.validateEspnFantasyNbaScheduleV33_(parsedSeason));
assert.throws(()=>context.validateEspnFantasyNbaScheduleV33_({...parsedSeason,teamCount:29}),/unvollständig/);
assert.throws(()=>context.validateEspnFantasyNbaScheduleV33_({...parsedSeason,games:parsedSeason.games.slice(0,1199)}),/unvollständig/);
const conflictingDuplicate=JSON.parse(JSON.stringify(rawSeason));
const duplicateOccurrences=[];
conflictingDuplicate.settings.proTeams.forEach(team=>Object.values(team.proGamesByScoringPeriod).forEach(games=>games.forEach(game=>{
  if(game.id==="season-0")duplicateOccurrences.push(game);
})));
assert.equal(duplicateOccurrences.length,2,"ESPN listet dieselbe Event-ID in beiden Team-Schedules");
duplicateOccurrences[1].date+=86400000;
assert.throws(()=>context.parseEspnFantasyNbaScheduleV33_(conflictingDuplicate),/widersprüchlich.*season-0/,
  "abweichende Daten derselben ESPN-Event-ID dürfen nicht stillschweigend dedupliziert werden");
const missingActualTeam=JSON.parse(JSON.stringify(rawSeason));
missingActualTeam.settings.proTeams.forEach(team=>Object.keys(team.proGamesByScoringPeriod).forEach(period=>{
  team.proGamesByScoringPeriod[period]=team.proGamesByScoringPeriod[period].filter(game=>game.awayProTeamId!==30&&game.homeProTeamId!==30);
}));
const missingActualTeamSnapshot=context.parseEspnFantasyNbaScheduleV33_(missingActualTeam);
assert.equal(missingActualTeamSnapshot.proTeamCount,30,"Fixture behält alle 30 proTeams-Objekte");
assert.equal(missingActualTeamSnapshot.teamCount,29,"Team-Vollständigkeit wird aus den tatsächlich vorkommenden Spielteams ermittelt");
assert.throws(()=>context.validateEspnFantasyNbaScheduleV33_(missingActualTeamSnapshot),/29\/30 Teams/);
const inconsistentCount=JSON.parse(JSON.stringify(parsedSeason));
inconsistentCount.gameCount=1199;
assert.throws(()=>context.validateEspnFantasyNbaScheduleV33_(inconsistentCount),/gameCount/,
  "deklarierter gameCount und eindeutige Event-IDs müssen übereinstimmen");
const invalidTeam=JSON.parse(JSON.stringify(parsedSeason));
invalidTeam.games[0].awayTeam="XXX";invalidTeam.games[0].teams[0]="XXX";
assert.throws(()=>context.validateEspnFantasyNbaScheduleV33_(invalidTeam),/unbekanntes NBA-Team/);
const impossibleDate=JSON.parse(JSON.stringify(parsedSeason));
impossibleDate.games[0].date="2027-02-30";
assert.throws(()=>context.validateEspnFantasyNbaScheduleV33_(impossibleDate),/NBA-Datum außerhalb/);
const outOfSeason=JSON.parse(JSON.stringify(parsedSeason));
outOfSeason.games[0].date="2027-07-01";
assert.throws(()=>context.validateEspnFantasyNbaScheduleV33_(outOfSeason),/NBA-Datum außerhalb/);
const sameTeam=JSON.parse(JSON.stringify(parsedSeason));
sameTeam.games[0].homeTeam=sameTeam.games[0].awayTeam;sameTeam.games[0].teams[1]=sameTeam.games[0].awayTeam;
assert.throws(()=>context.validateEspnFantasyNbaScheduleV33_(sameTeam),/identisch/);
const duplicateFixtureId=JSON.parse(JSON.stringify(parsedSeason));
duplicateFixtureId.games[1199].date=duplicateFixtureId.games[0].date;
duplicateFixtureId.games[1199].awayTeam=duplicateFixtureId.games[0].awayTeam;
duplicateFixtureId.games[1199].homeTeam=duplicateFixtureId.games[0].homeTeam;
duplicateFixtureId.games[1199].teams=duplicateFixtureId.games[0].teams.slice();
assert.throws(()=>context.validateEspnFantasyNbaScheduleV33_(duplicateFixtureId),/derselbe NBA-Termin.*verschiedenen Event-IDs/,
  "derselbe NBA-Termin darf auch bei verschiedenen ESPN-IDs nur einmal vorkommen");
const implausibleTeamLoad=JSON.parse(JSON.stringify(parsedSeason));
let movedAtlGames=0;
for(const game of implausibleTeamLoad.games){
  if(movedAtlGames>=8)break;
  const atlIndex=game.teams.indexOf("ATL");
  if(atlIndex<0||game.teams.includes("BOS"))continue;
  game.teams[atlIndex]="BOS";
  if(game.awayTeam==="ATL")game.awayTeam="BOS";else game.homeTeam="BOS";
  movedAtlGames++;
}
assert.equal(movedAtlGames,8);
assert.throws(()=>context.validateEspnFantasyNbaScheduleV33_(implausibleTeamLoad),/unplausibel/,
  "unplausible NBA-Spieleanzahlen pro Team werden verworfen");
assert.equal(context.espnFantasyNbaStatusV33_({postponed:true}),"STATUS_POSTPONED");
assert.equal(context.espnFantasyNbaStatusV33_({suspended:true}),"STATUS_SUSPENDED");
assert.equal(context.espnFantasyNbaStatusV33_({startTimeTBD:true}),"STATUS_TIME_TBD");
assert.deepEqual(Array.from([0,1,2,3],index=>parsedSeason.games.find(game=>game.id===`season-${index}`).date),["2026-10-20","2026-10-23","2026-10-24","2026-10-27"],"ESPN-Saisonplan enthält Wembanyamas bestätigte Opening-Dates in ET");

let seasonUrl="";
context.UrlFetchApp.fetch=url=>{seasonUrl=String(url);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(rawSeason)};};
assert.equal(context.fetchEspnFantasyNbaScheduleV33_().games.length,1200);
assert.match(seasonUrl,/seasons\/2027\?view=proTeamSchedules_wl$/,"ESPN Fantasy proTeamSchedules_wl ist die primäre Saisonquelle");

const persisted=context.persistEspnNbaScheduleV33_(parsedSeason);
const nbaSheet=workbook.getSheetByName(context.ESPN_SYNC_V1.nbaScheduleSheet);
assert.equal(nbaSheet.getLastRow(),1201,"der vollständige validierte Saisonplan wird dediziert persistiert");
assert.ok(nbaSheet.getMaxRows()>=1201,"das neue Sheet wird vor dem Schreiben über das 1000-Zeilen-Standardraster erweitert");
assert.deepEqual(nbaSheet.rows[0],Array.from(context.ESPN_NBA_SCHEDULE_HEADER_V33),"Schedule-Sheet enthält source/last_seen/last_changed");
assert.equal(nbaSheet.formats.get("2:2"),"@","event_id wird als Text persistiert");
assert.equal(nbaSheet.formats.get("2:3"),"@","nba_date bleibt als ISO-Text erhalten und kann keinen UTC-Tagesversatz bekommen");
assert.equal(context.readPersistedEspnNbaScheduleV33_().games.length,1200,"der persistierte Last-known-good-Stand ist vollständig lesbar");
const unchangedId=persisted.games[10].id;
const unchangedBefore=nbaSheet.rows.find(row=>row[1]===unchangedId)[9];
context.persistEspnNbaScheduleV33_(persisted);
assert.equal(nbaSheet.rows.find(row=>row[1]===unchangedId)[9],unchangedBefore,"last_changed bleibt bei identischen ESPN-Daten stabil");
const changedId=persisted.games[persisted.games.length-1].id;
nbaSheet.rows.find(row=>row[1]===changedId)[9]="2000-01-01T00:00:00.000Z";
const rescheduled=JSON.parse(JSON.stringify(persisted));
rescheduled.games.find(game=>game.id===changedId).date="2027-05-15";
context.persistEspnNbaScheduleV33_(rescheduled);
assert.notEqual(nbaSheet.rows.find(row=>row[1]===changedId)[9],"2000-01-01T00:00:00.000Z","Reschedule aktualisiert last_changed");

const compact=context.compactEspnNbaSeasonScheduleV33_(context.readPersistedEspnNbaScheduleV33_(),"");
assert.equal(compact.complete,true);
assert.equal(compact.gameCount,1200);
assert.deepEqual(Object.keys(compact.games[0]),["gameId","date","away","home","status","scoringPeriod"],"Monster-Payload liefert den kompakten vollständigen Saisonplan");

let seasonFetchCount=0;
propertyData.set(context.MATCHUP_MONSTER_V30.nbaScheduleLastSuccessKey,new Date().toISOString());
context.UrlFetchApp.fetch=()=>{seasonFetchCount++;throw new Error("darf vor Ablauf eines Tages nicht laden");};
lockEvents.length=0;
assert.equal(context.refreshEspnNbaScheduleV33_(false).games.length,1200);
assert.equal(seasonFetchCount,0,"automatische ESPN-Synchronisierung lädt den Saisonplan höchstens täglich");
assert.deepEqual(lockEvents,["script:try:5000","script:release"],
  "der NBA-Saisonplan schützt Lesen, Fetch und Persistenz mit dem Script-Lock und gibt ihn zuverlässig frei");
scriptLockAvailable=false;
const lockFallback=context.refreshEspnNbaScheduleV33_(true);
scriptLockAvailable=true;
assert.equal(lockFallback.persistedFallback,true,"bei Lock-Konkurrenz bleibt der validierte LKG lesbar");
assert.match(lockFallback.error,/parallel aktualisiert/);
assert.equal(seasonFetchCount,0,"ohne exklusiven Schedule-Lock wird weder geladen noch persistiert");
assert.match(context.syncEspnData.toString(),/refreshEspnNbaScheduleV33_\(false, true\)/,
  "der bereits gesperrte Komplett-Sync signalisiert den gehaltenen Script-Lock und darf nicht deadlocken");
const beforeIncomplete=JSON.stringify(nbaSheet.rows);
context.UrlFetchApp.fetch=()=>{seasonFetchCount++;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({settings:{proTeams:[]}})};};
const lastGood=context.refreshEspnNbaScheduleV33_(true);
assert.equal(lastGood.persistedFallback,true,"Live-Refresh nutzt bei unvollständiger ESPN-Antwort den letzten gültigen Stand");
assert.equal(JSON.stringify(nbaSheet.rows),beforeIncomplete,"eine unvollständige Live-Antwort überschreibt das Schedule-Sheet nicht");
assert.equal(seasonFetchCount,1,"Live neu laden umgeht den täglichen Saisonplan-Cache");
const expandedSeason=context.parseEspnFantasyNbaScheduleV33_(fullEspnSeasonPayload(1230));
context.persistEspnNbaScheduleV33_(expandedSeason);
const beforeShrink=JSON.stringify(nbaSheet.rows);
context.UrlFetchApp.fetch=()=>{seasonFetchCount++;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(fullEspnSeasonPayload(1200))};};
const smallerLastGood=context.refreshEspnNbaScheduleV33_(true);
assert.equal(smallerLastGood.games.length,1230,"ein formal vollständiger, aber geschrumpfter Live-Plan ersetzt den umfangreicheren Last-known-good-Stand nicht");
assert.match(smallerLastGood.error,/geschrumpft/);
assert.equal(JSON.stringify(nbaSheet.rows),beforeShrink,"auch ein auf 1200 Spiele geschrumpfter Live-Plan überschreibt nichts");

const staleFbaRows=[Array.from(context.ESPN_SCHEDULE_HEADER_V1),...Array.from({length:76},(_,index)=>["2026/27",Math.floor(index/4)+1,`ALT-${index+1}`,"","",`Away ${index}`,`Home ${index}`])];
workbook.sheets.set(context.ESPN_SYNC_V1.scheduleSheet,new MemorySheet(context.ESPN_SYNC_V1.scheduleSheet,staleFbaRows));
assert.equal(context.monsterFbaScheduleV30_().length,72,
  "der geschützte Read-Pfad blendet stale W19/20 sofort aus und liefert nur W1–18");
const leagueSchedule={teams:Array.from({length:8},(_,index)=>({id:index+1})),schedule:[]};
for(let week=1;week<=19;week++)for(let game=0;game<4;game++)leagueSchedule.schedule.push({id:week*10+game,matchupPeriodId:week,away:{teamId:game*2+1},home:{teamId:game*2+2}});
const regularSeasonRows=context.buildEspnScheduleRowsV1_(leagueSchedule);
assert.equal(regularSeasonRows.length,72,"nur die 18 FBA-Regular-Season-Wochen werden übernommen");
context.upsertEspnScheduleRowsV1_(regularSeasonRows);
assert.equal(workbook.getSheetByName(context.ESPN_SYNC_V1.scheduleSheet).getLastRow(),73,"72 aktuelle Matchups ersetzen 76 veraltete Zeilen vollständig");
const validFbaLastKnownGood=JSON.stringify(workbook.getSheetByName(context.ESPN_SYNC_V1.scheduleSheet).rows);
assert.throws(()=>context.upsertEspnScheduleRowsV1_(regularSeasonRows.slice(0,71)),/exakt 72/,
  "ein partieller ESPN-FBA-Spielplan wird vor dem Schreiben abgewiesen");
assert.equal(JSON.stringify(workbook.getSheetByName(context.ESPN_SYNC_V1.scheduleSheet).rows),validFbaLastKnownGood,
  "ein partieller ESPN-Abruf darf den gültigen 72er-Stand nicht überschreiben");
const malformedFbaRows=JSON.parse(JSON.stringify(regularSeasonRows));
malformedFbaRows[1][5]=malformedFbaRows[0][5];
assert.throws(()=>context.upsertEspnScheduleRowsV1_(malformedFbaRows),/mehrfach angesetzt/,
  "jede FBA-Woche muss aus vier Paarungen mit acht eindeutigen Teams bestehen");
assert.equal(JSON.stringify(workbook.getSheetByName(context.ESPN_SYNC_V1.scheduleSheet).rows),validFbaLastKnownGood,
  "auch ein formal 72 Zeilen langer, aber fehlerhafter ESPN-Plan darf das LKG nicht überschreiben");

cacheData.clear();
const primaryWeek1=context.nbaWeekScheduleV30_(1,true);
assert.match(primaryWeek1.source,/ESPN Fantasy proTeamSchedules_wl/,"die ausgewählte Woche nutzt zuerst den validierten ESPN-Fantasy-Saisonplan");
assert.ok(primaryWeek1.games.length>0&&primaryWeek1.teamGames.SAS>0,"Team-Spielzahlen stammen aus dem vollständigen Saisonplan");
assert.ok(primaryWeek1.backToBack.some(row=>row.team==="SAS"&&row.first==="2026-10-23"&&row.second==="2026-10-24"),"B2B-Radar erkennt den ESPN-Terminplan");

let requestedScoreboardUrl="";
context.UrlFetchApp.fetch=url=>{
  requestedScoreboardUrl=String(url);
  return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({events:[{
    id:"opening-night",date:"2026-10-20T23:00:00Z",competitions:[{date:"2026-10-20T23:00:00Z",competitors:[{team:{abbreviation:"BOS"}},{team:{abbreviation:"DET"}}]}]
  }]})};
};
const liveScoreboard=context.espnScoreboardGamesV30_(context.fantasyWeekWindowV30_(1));
assert.match(requestedScoreboardUrl,/limit=500&dates=20261020-20261026/,"ESPN-Scoreboard wird als eine vollständige Wochenbereichsabfrage geladen");
assert.equal(liveScoreboard.length,1,"ESPN-Bereichsantwort wird geparst");
workbook.sheets.delete(context.ESPN_SYNC_V1.nbaScheduleSheet);
propertyData.delete(context.MATCHUP_MONSTER_V30.nbaScheduleLastSuccessKey);
cacheData.clear();
context.UrlFetchApp={};

const officialWeek1=context.nbaWeekScheduleV30_(1,true);
assert.equal(officialWeek1.games.length,52,"Woche 1 braucht 43 Spiele plus neun Spiele am Montag-Lookahead");
assert.equal(officialWeek1.games.filter(game=>game.date<=officialWeek1.rangeEnd).length,43,"NBA-Woche 1 umfasst 43 offizielle Spiele");
assert.equal(officialWeek1.teamGames.PHI,4,"Philadelphia spielt in Woche 1 viermal");
assert.equal(officialWeek1.teamGames.BOS,2,"Boston spielt in Woche 1 zweimal");
assert.equal(officialWeek1.officialFallback,true,"Bei nicht erreichbaren Live-Feeds greift der verifizierte NBA.com-Testplan");
assert.deepEqual(Array.from(officialWeek1.backToBack.filter(row=>row.crossWeek),row=>row.team),["IND","MEM","MIN","OKC","UTA"],"Sonntag-zu-Montag-B2Bs von Woche 1 stimmen");
cache.put(context.MATCHUP_MONSTER_V30.scheduleCacheKey+"1",JSON.stringify({games:["alt"]}));
assert.equal(context.nbaWeekScheduleV30_(1,false).games[0],"alt","Normaler Abruf darf den gültigen Schedule-Cache verwenden");
assert.equal(context.nbaWeekScheduleV30_(1,true).games.length,52,"Live neu laden umgeht den Schedule-Cache vollständig");

const officialWeek2=context.nbaWeekScheduleV30_(2,true);
assert.equal(officialWeek2.games.length,64,"Woche 2 braucht 49 Spiele plus 15 Spiele am Montag-Lookahead");
assert.equal(officialWeek2.games.filter(game=>game.date<=officialWeek2.rangeEnd).length,49,"NBA-Woche 2 umfasst 49 offizielle Spiele");
assert.equal(officialWeek2.teamGames.PHX,2,"Phoenix spielt in Woche 2 zweimal");
assert.equal(officialWeek2.teamGames.BOS,4,"Boston spielt in Woche 2 viermal");
assert.deepEqual(Array.from(officialWeek2.backToBack.filter(row=>row.crossWeek),row=>row.team),["BKN","BOS","GSW","IND","LAC","LAL","ORL","TOR"],"Sonntag-zu-Montag-B2Bs von Woche 2 stimmen");
const unavailableWeek3=context.nbaWeekScheduleV30_(3,true);
assert.equal(unavailableWeek3.games.length,0,"Der Zwei-Wochen-Testfallback darf niemals als unvollständiger Spielplan für Woche 3 dienen");
assert.ok(unavailableWeek3.dataIssue,"Ohne Live-Daten muss eine spätere Woche transparent als nicht verfügbar markiert sein");

const b2b=context.monsterBackToBackV30_([
  {id:"1",date:"2026-10-24",teams:["BOS","NYK"]},
  {id:"2",date:"2026-10-25",teams:["BOS","LAL"]},
  {id:"3",date:"2026-10-26",teams:["BOS","MIA"]}
],"2026-10-25");
assert.equal(b2b.length,2,"normales und Sonntag-zu-Montag-B2B werden erkannt");
assert.equal(b2b[1].crossWeek,true,"der Montag nach der FBA-Woche wird als Cross-Week markiert");
const unavailableB2b=context.monsterBackToBackV30_([
  {id:"p1",date:"2026-11-04",teams:["SAS","HOU"],status:"STATUS_POSTPONED"},
  {id:"p2",date:"2026-11-05",teams:["SAS","DAL"],status:"STATUS_SCHEDULED"}
],"2026-11-05");
assert.equal(unavailableB2b.length,0,"verschobene oder ausgesetzte Spiele dürfen kein falsches B2B erzeugen");

cache.put(context.MATCHUP_MONSTER_V29.pinCacheKey,context.monsterHashV29_("123456"));
const token=context.createMonsterDeviceV29_("123456");
assert.ok(token&&token.length>40);
cacheData.clear();
assert.equal(context.validMonsterDeviceV29_(token),true,"Gerätefreigabe muss einen Cache-Neustart überstehen");
assert.equal(context.validMonsterDeviceV29_("falsch"),false);

assert.equal(context.buildMonsterPayloadV30_.toString().includes("version:34"),true,"Backend-Payload muss den v34-Schedule-Stand kennzeichnen");
assert.equal(context.buildMonsterPayloadV30_.toString().includes("nbaSeasonSchedule:nbaSeasonSchedule"),true,"geschützter Monster-Payload enthält den vollständigen Saisonplan");
assert.equal(context.ESPN_PLAYER_HUB_V2.dayIntervalMinutes,60,"Tagsüber soll die ESPN-Basis stündlich statt zweistündlich geprüft werden");
assert.equal(context.ESPN_PLAYER_HUB_V2.nightIntervalMinutes,30,"Während des NBA-Fensters bleibt der sichere 30-Minuten-Takt erhalten");
assert.match(context.installEspnSync.toString(),/everyMinutes\(30\)/,"Der Trigger muss eng genug für den 30-Minuten-Spielbetrieb laufen");
assert.doesNotMatch(context.installEspnSync.toString(),/everyMinutes\([123]\)/,"Ein riskanter Vollsync im Ein- bis Drei-Minuten-Takt darf nicht aktiviert werden");

console.log("PASS · Matchup Monster v34 backend tests");
