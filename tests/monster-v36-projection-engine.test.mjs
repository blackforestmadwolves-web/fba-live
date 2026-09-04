import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const inline=html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
assert.ok(inline,"Das vollstaendige Inline-Frontend muss vorhanden sein");
new vm.Script(inline[1],{filename:"index.inline.js"});

function functionSource(name){
  const start=inline[1].indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`Funktion ${name} fehlt`);
  const open=inline[1].indexOf("{",start);
  let depth=0,quote="",escaped=false;
  for(let index=open;index<inline[1].length;index++){
    const char=inline[1][index];
    if(quote){
      if(escaped){escaped=false;continue}
      if(char==="\\"){escaped=true;continue}
      if(char===quote)quote="";
      continue;
    }
    if(char==='"'||char==="'"||char==='`'){quote=char;continue}
    if(char==="{")depth++;
    if(char==="}"&&--depth===0)return inline[1].slice(start,index+1);
  }
  throw new Error(`Funktion ${name} ist unvollstaendig`);
}

const projectionStats=["PTS","REB","AST","3PM","STL","BLK","FGM","FGA","FTM","FTA"];
const context={
  console,Date,JSON,Math,Number,String,Array,Object,Map,Set,RegExp,Error,
  MONSTER_PROJECTION_STATS:projectionStats,
  MONSTER_PROFILE_PRIOR_WEIGHT:20,
  DRAFT_CATS:["PTS","REB","AST","3PM","STL","BLK","FG%","FT%"],
  MONSTER_STATE:{data:null},
  PHASE_SNAPSHOT_CONFIG:{phase:"PRESEASON",effectivePhase:"PRESEASON"},
  activePhase:()=>"PRESEASON"
};
vm.createContext(context);
[
  "monsterNbaKey",
  "monsterProjectionFinite","monsterProjectionReadyStatus","monsterProjectionUsableNode","monsterProjectionRecordId","monsterProjectionRecordNba",
  "monsterProjectionBase","monsterProjectionPlayerRecord","monsterProjectionRecordIssue","monsterProjectionProfilesReady","monsterProjectionEngineState",
  "monsterProjectionSeasonFinish","monsterProjectionWeekForDate","monsterProjectionGameTeams","monsterProjectionGameKey",
  "monsterProjectionFinal","monsterProjectionUnavailableGame","monsterProjectionFutureGame","monsterProjectionLiveGame","monsterProjectionScheduleGames",
  "monsterProjectionSeasonScheduleIssue","monsterProjectionOwnershipReady","monsterProjectionFbaSeedReady","monsterProjectionOpponent","monsterProjectionProfileRatio",
  "monsterProjectionRawFactor","monsterProjectionNormalizedFactors","monsterProjectionWeekActual",
  "monsterProjectionWeeklyPlayer","monsterAvailability","monsterProjectionCategoryFactor","monsterProjectionB2bContext",
  "monsterScheduledWeekGames","monsterProjectionBasisIssue"
].forEach(name=>vm.runInContext(functionSource(name),context,{filename:`${name}.js`}));

const base={PTS:25,REB:12,AST:4,"3PM":2,STL:1,BLK:3,FGM:9,FGA:18,FTM:5,FTA:6};
const firstGame={PTS:10,REB:10,AST:2,"3PM":1,STL:1,BLK:2,FGM:4,FGA:15,FTM:1,FTA:2};
const wemby={
  id:"wemby",name:"Victor Wembanyama",nba:"SAS",projectedGp:70,base,
  actual:{gp:1,totals:firstGame,byWeek:{1:{gp:1,stats:firstGame}}}
};

const finish=context.monsterProjectionSeasonFinish(wemby);
assert.equal(finish.projectedGp,70);
assert.equal(finish.actualGp,1);
assert.equal(finish.remainingGp,69,"Ein echtes Spiel ersetzt exakt eines der 70 ESPN-Projektionsspiele");
assert.equal(finish.finishGp,70);
assert.ok(Math.abs(finish.perGame.PTS-24.785714285714285)<1e-12,
  "10 echte Punkte plus 69 mal 25 ESPN-Punkte muessen exakt 24,785714... ergeben");
assert.equal(finish.totals.PTS,1735);
assert.equal(finish.totals.FGM,625);
assert.equal(finish.totals.FGA,1257);
assert.ok(Math.abs(finish.perGame["FG%"]-625/1257)<1e-12,
  "FG% muss aus summierten Treffern und Versuchen entstehen");
assert.ok(Math.abs(finish.perGame["FT%"]-(1+69*5)/(2+69*6))<1e-12,
  "FT% muss aus summierten Treffern und Versuchen entstehen");
assert.notEqual(finish.perGame["FG%"],((4/15)+69*(9/18))/70,
  "Quoten duerfen nicht als ungewichteter Durchschnitt von Spielprozentsaetzen entstehen");

const beyondProjection={...wemby,actual:{gp:71,totals:Object.fromEntries(projectionStats.map(field=>[field,Number(base[field])*71])),byWeek:{}}};
const exhausted=context.monsterProjectionSeasonFinish(beyondProjection);
assert.equal(exhausted.actualGp,71,"Tatsaechlich absolvierte Spiele duerfen nicht auf projectedGp zurueckgeschnitten werden");
assert.equal(exhausted.remainingGp,0,"projectedGp-actualGp wird bei null gedeckelt");
assert.equal(exhausted.finishGp,71);

assert.throws(()=>context.monsterProjectionSeasonFinish({...wemby,projectedGp:0}),/projectedGp|0|ungueltig|ungültig/i,
  "projectedGp=0 darf nicht als echte ESPN-Projektion durchlaufen");
assert.throws(()=>context.monsterProjectionSeasonFinish({...wemby,projectedGp:83}),/projectedGp|82/i,
  "ESPN projectedGp oberhalb einer regulaeren 82-Spiele-Saison darf nicht still akzeptiert werden");

const normalizedGames=context.monsterProjectionScheduleGames({nbaSeasonSchedule:{games:[
  {gameId:"final-okc",date:"2026-10-20",away:"OKC",home:"SAS",status:"STATUS_FINAL"},
  {gameId:"future-hou",date:"2026-10-23",away:"HOU",home:"SAS",status:"STATUS_SCHEDULED"},
  {gameId:"future-dal",date:"2026-10-24",away:"SAS",home:"DAL",status:"STATUS_SCHEDULED"}
]}});
const postponedGames=context.monsterProjectionScheduleGames({
  nbaSeasonSchedule:{games:[{gameId:"postponed-live",date:"2026-10-23",away:"SAS",home:"HOU",status:"STATUS_SCHEDULED"}]},
  nbaSchedule:{matchupWeek:1,games:[{gameId:"postponed-live",date:"2026-10-23",away:"SAS",home:"HOU",status:"STATUS_POSTPONED"}]},
  projectionEngine:{actual:{inProgressEventIds:["postponed-live"]}}
});
assert.equal(postponedGames.length,1);
assert.equal(postponedGames[0].status,"STATUS_POSTPONED",
  "Ein frisch bestaetigtes POSTPONED muss eine stale IN_PROGRESS-ID auch im Frontend ueberschreiben");
assert.equal(context.monsterProjectionUnavailableGame(postponedGames[0]),true);
assert.equal(context.monsterProjectionLiveGame(postponedGames[0]),false);
assert.equal(context.monsterProjectionFutureGame(postponedGames[0]),false,
  "Ein verschobenes Spiel darf weder als Live-Ist noch als offenes Projektionsspiel zaehlen");
const weekly=context.monsterProjectionWeeklyPlayer(wemby,1,normalizedGames,{profiles:{status:"READY",teams:{}}},"SAS");
assert.equal(weekly.actualGames,1);
assert.equal(weekly.scheduledRemainingGames,2);
assert.equal(weekly.remainingGames,2);
assert.equal(weekly.games,3);
assert.equal(weekly.PTS,60,
  "Die Woche muss das echte Final-Spiel plus zwei Zukunftsspiele enthalten, ohne das Final-Spiel erneut zu projizieren");
assert.equal(weekly.FGM,22);
assert.equal(weekly.FGA,51);
assert.ok(Math.abs(weekly["FG%"]-22/51)<1e-12);

const noActual={id:"dnp",name:"DNP",nba:"SAS",projectedGp:70,base,actual:{gp:0,totals:{},byWeek:{}}};
const dnpWeek=context.monsterProjectionWeeklyPlayer(noActual,1,normalizedGames.filter(game=>game._projectionKey==="final-okc"),{profiles:{teams:{}}},"SAS");
assert.equal(dnpWeek.actualGames,0);
assert.equal(dnpWeek.remainingGames,0);
assert.equal(dnpWeek.PTS,0,
  "Ein finales NBA-Spiel ohne Spielerzeile ist ein DNP: weder Ist-GP noch nachtraegliches Projektionsspiel");
const inProgressGame=context.monsterProjectionScheduleGames({nbaSeasonSchedule:{games:[
  {gameId:"live",date:"2026-10-23",away:"SAS",home:"HOU",status:"STATUS_IN_PROGRESS"}
]}});
assert.equal(context.monsterProjectionFutureGame(inProgressGame[0]),false,"Ein laufendes Spiel darf nicht noch einmal voll projiziert werden");
assert.throws(()=>context.monsterProjectionWeeklyPlayer(noActual,1,inProgressGame,{profiles:{teams:{}}},"SAS"),/Live-Spiel|FINAL/i,
  "Ein laufendes Spiel muss bis ESPN FINAL transparent blockieren, statt Teil-Ist oder ein volles Restspiel zu erfinden");

const neutralGames=context.monsterProjectionScheduleGames({nbaSeasonSchedule:{games:[
  {gameId:"neutral-1",date:"2026-10-23",away:"HOU",home:"SAS",status:"SCHEDULED"},
  {gameId:"neutral-2",date:"2026-10-24",away:"SAS",home:"DAL",status:"SCHEDULED"}
]}});
const neutral=context.monsterProjectionNormalizedFactors(noActual,neutralGames,{profiles:{status:"WAITING",teams:{}}},"SAS");
assert.equal(neutral.size,2);
for(const factors of neutral.values())for(const field of projectionStats)assert.equal(factors[field],1,
  `Ohne belastbares Gegnerprofil muss ${field} neutral bleiben`);

const nbaTeams=["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"];
const profileTeams=Object.fromEntries(nbaTeams.map(team=>[team,{factors:Object.fromEntries(projectionStats.map(field=>[field,1]))}]));
profileTeams.OKC.factors={...profileTeams.OKC.factors,PTS:.7,REB:.8};
profileTeams.UTA.factors={...profileTeams.UTA.factors,PTS:1.1,REB:1.2};
const opponentEngine={profiles:{status:"READY",active:true,teams:profileTeams}};
const opponentGames=context.monsterProjectionScheduleGames({nbaSeasonSchedule:{games:[
  {gameId:"strong",date:"2026-10-23",away:"SAS",home:"OKC",status:"SCHEDULED"},
  {gameId:"weak",date:"2026-10-24",away:"UTA",home:"SAS",status:"SCHEDULED"}
]}});
const adjusted=context.monsterProjectionNormalizedFactors(noActual,opponentGames,opponentEngine,"SAS"),strong=adjusted.get("strong"),weak=adjusted.get("weak");
assert.ok(strong.PTS<1&&weak.PTS>1,"Starker und schwacher Gegner muessen dieselbe Kategorie in verschiedene Richtungen bewegen");
assert.ok(Math.abs((strong.PTS+weak.PTS)/2-1)<1e-12,
  "Die Gegnerfaktoren muessen ueber den verbleibenden individuellen Spielplan auf 1 normalisiert werden");
assert.ok(Math.abs((strong.REB+weak.REB)/2-1)<1e-12);
const adjustedWeek=context.monsterProjectionWeeklyPlayer({...noActual,projectedGp:2},1,opponentGames,opponentEngine,"SAS");
assert.ok(Math.abs(adjustedWeek.PTS-2*base.PTS)<1e-12,
  "Daily Matchup Factors duerfen den ESPN-Rest-Saisontotal nicht aufblasen oder vernichten");
assert.ok(Math.abs(adjustedWeek.REB-2*base.REB)<1e-12);
assert.equal(adjustedWeek.profileAdjusted,true);

const engineRecord={...noActual,projectedGp:70};
const readyEngine={
  version:36,revision:"rev-a",active:true,status:"READY",
  baseline:{status:"READY",seasonId:2027,source:"ESPN"},
  profiles:{status:"READY",teams:{}},actual:{
    ownershipAtGameReady:true,
    fbaResultsReady:true,
    completedFbaMatchups:[{week:1,away:"Pirates",home:"Wolves",awayPoints:3,homePoints:5}]
  },players:[engineRecord]
};
assert.equal(context.monsterProjectionEngineState({projectionEngine:readyEngine},[{id:"dnp"}]).ready,true);
const partialCoverage=context.monsterProjectionEngineState({projectionEngine:{...readyEngine,actual:{
  ...readyEngine.actual,status:"PARTIAL",reason:"ESPN_DAILY_SYNC_PARTIAL",dailyFeedStatus:"PARTIAL",
  ready:false,coverageReady:false,message:"ESPN Daily-/Scoreboard-Sync ist PARTIAL."
}}},[{id:"dnp"}]);
assert.equal(partialCoverage.ready,false);
assert.match(partialCoverage.issue,/Daily|Scoreboard|PARTIAL|Ist-Abdeckung/i,
  "Ein partieller ESPN-Daily-/Scoreboard-Sync muss die Ist-Projektion transparent blockieren");
const waitingState=context.monsterProjectionEngineState({projectionEngine:{
  version:36,revision:"waiting-a",active:false,status:"WAITING_ESPN_PROJECTIONS",
  baseline:{status:"WAITING_ESPN_PROJECTIONS",message:"ESPN-Projektionen fuer 2027 stehen noch aus."},players:[]
}});
assert.equal(waitingState.ready,false);
assert.match(waitingState.issue,/ESPN|Projektion/i,"Wartende ESPN-Daten muessen transparent benannt werden");

// Lifecycle and fingerprint are loaded last because these functions intentionally
// consume the current global Monster state.
const lifecyclePlayers=Array.from({length:104},(_,index)=>({...noActual,id:`roster-${index}`,name:`Roster ${index}`}));
const lifecycleEngine={...readyEngine,players:lifecyclePlayers};
const lifecycleGames=Array.from({length:1200},(_,index)=>({
  gameId:`season-${index+1}`,date:"2026-10-20",away:"SAS",home:"OKC",status:index===0?"STATUS_FINAL":"STATUS_SCHEDULED"
}));
const lifecycleSchedule={complete:true,gameCount:1200,games:lifecycleGames};
context.monsterRoster=()=>lifecyclePlayers.map(record=>({id:record.id,nba:record.nba}));
vm.runInContext(functionSource("monsterSeasonProjectionLifecycle"),context,{filename:"monsterSeasonProjectionLifecycle.js"});
context.activePhase=()=>"REGULAR_SEASON";
context.MONSTER_STATE.data={phase:"REGULAR_SEASON",projectionEngine:lifecycleEngine,nbaSeasonSchedule:lifecycleSchedule};
const liveReady=context.monsterSeasonProjectionLifecycle();
assert.equal(liveReady.seasonRunning,true);
assert.equal(liveReady.allowed,true,"Ist + Restspiel-Modell muss die Saisonprojektion nach Saisonstart freischalten");

context.MONSTER_STATE.data={phase:"REGULAR_SEASON",projectionEngine:{...lifecycleEngine,actual:{ownershipAtGameReady:false}},nbaSeasonSchedule:lifecycleSchedule};
const ownershipWaiting=context.monsterSeasonProjectionLifecycle();
assert.equal(ownershipWaiting.allowed,false,
  "Die Endtabelle darf vergangene Wochen nicht mit dem heutigen Kader rueckwirkend umschreiben");
assert.match(String(ownershipWaiting.engineIssue||""),/Ownership|Besitzer|Kader.*Spiel|historisch/i,
  "Der fehlende Ownership-at-game-Snapshot muss als Blockgrund sichtbar sein");

const playerActualLifecyclePlayers=lifecyclePlayers.map((record,index)=>index?record:{...record,actual:{
  gp:1,totals:firstGame,byWeek:{1:{gp:1,stats:firstGame}}
}});
const playerActualEngine={...lifecycleEngine,players:playerActualLifecyclePlayers,actual:{
  coverageReady:true,completeGames:0,ownershipAtGameReady:false,fbaResultsReady:false,completedFbaMatchups:[]
}};
const scheduledLifecycle={...lifecycleSchedule,games:lifecycleGames.map(game=>({...game,status:"STATUS_SCHEDULED"}))};
context.MONSTER_STATE.data={phase:"REGULAR_SEASON",projectionEngine:playerActualEngine,nbaSeasonSchedule:scheduledLifecycle};
context.MONSTER_STATE.week=1;context.MONSTER_STATE.teamA="Wolves";context.MONSTER_STATE.teamB="Pirates";
const playerActualOwnershipWaiting=context.monsterSeasonProjectionLifecycle();
assert.equal(playerActualOwnershipWaiting.seasonRunning,true,
  "Ein echter Spieler-Ist-GP muss den Saisonstart auch bei einem noch stale SCHEDULED-Kalender erkennen");
assert.equal(playerActualOwnershipWaiting.allowed,false);
assert.equal(playerActualOwnershipWaiting.ownershipReady,false);
assert.match(String(playerActualOwnershipWaiting.engineIssue||""),/Ownership|Besitzer|Kader.*Spiel|historisch/i);
const metaRosterA=playerActualLifecyclePlayers.slice(0,13).map(record=>({id:record.id,name:record.name,nba:record.nba}));
const metaRosterB=playerActualLifecyclePlayers.slice(13,26).map(record=>({id:record.id,name:record.name,nba:record.nba}));
const ownershipBasisIssue=context.monsterProjectionBasisIssue({
  matchupWeek:1,rangeStart:"2026-10-20",rangeEnd:"2026-10-25",
  games:[{gameId:"week-open",date:"2026-10-23",teams:["SAS","OKC"],status:"STATUS_SCHEDULED"}]
},metaRosterA,metaRosterB);
assert.match(ownershipBasisIssue,/Ownership-at-game|Besitzer zum Spielzeitpunkt/i,
  "Derselbe Ownership-Block muss Meta Projection und Pickup Impact Lab vor einer Rueckrechnung mit heutigen Kadern schuetzen");
assert.match(functionSource("pgMonster"),/basisIssue[\s\S]*ready=!basisIssue[\s\S]*if\(!ready\)[\s\S]*Prognose bewusst blockiert/);
assert.match(functionSource("pgMonster"),/pickupBody=ready\?monsterSimulatorMarkup[\s\S]*Pickup Impact Lab zeigt deshalb keine erfundenen Auswirkungen/);

context.MONSTER_STATE.data={phase:"REGULAR_SEASON",projectionEngine:{...lifecycleEngine,actual:{
  ownershipAtGameReady:true,fbaResultsReady:false,completedFbaMatchups:[]
}},nbaSeasonSchedule:lifecycleSchedule};
const fbaSeedWaiting=context.monsterSeasonProjectionLifecycle();
assert.equal(fbaSeedWaiting.allowed,false,
  "Eine laufende Saison darf ohne echte abgeschlossene FBA-Matchup-Ergebnisse keine Endtabelle projizieren");
assert.match(String(fbaSeedWaiting.engineIssue||""),/FBA|Matchup|Ist-Seed|Ergebnis/i,
  "Der fehlende unveraenderliche FBA-Ergebnis-Seed muss als Blockgrund sichtbar sein");

context.MONSTER_STATE.data={phase:"REGULAR_SEASON",projectionEngine:{
  version:36,revision:"waiting-a",active:false,status:"WAITING_ESPN_PROJECTIONS",
  baseline:{status:"WAITING_ESPN_PROJECTIONS",message:"ESPN-Projektionen fuer 2027 stehen noch aus."},actual:{
    ownershipAtGameReady:true,fbaResultsReady:true,
    completedFbaMatchups:[{week:1,away:"Pirates",home:"Wolves",awayPoints:3,homePoints:5}]
  },players:[]
},nbaSeasonSchedule:lifecycleSchedule};
const liveWaiting=context.monsterSeasonProjectionLifecycle();
assert.equal(liveWaiting.allowed,false);
assert.match(String(liveWaiting.engineIssue||liveWaiting.issue||liveWaiting.reason||""),/ESPN|Projektion|wart/i,
  "Bei fehlender ESPN-Baseline muss der Saison-Lifecycle den Blockgrund liefern");

context.monsterSeasonProjectionInputs=()=>({
  rosterMode:"espn",roster:[{team:"Wolves",id:"dnp",nba:"SAS",stats:base,engineProjection:noActual}],
  matchups:[],nbaSeasonSchedule:{games:[]},projectionEngine:context.MONSTER_STATE.data.projectionEngine
});
vm.runInContext(functionSource("monsterSeasonProjectionFingerprint"),context,{filename:"monsterSeasonProjectionFingerprint.js"});
context.MONSTER_STATE.data={phase:"REGULAR_SEASON",projectionEngine:readyEngine,nbaSeasonSchedule:{games:[]}};
const fingerprintA=context.monsterSeasonProjectionFingerprint();
context.MONSTER_STATE.data.projectionEngine={...readyEngine,revision:"rev-b"};
const fingerprintB=context.monsterSeasonProjectionFingerprint();
assert.notEqual(fingerprintA,fingerprintB,"Eine neue Projection-Revision muss gespeicherte Simulationen sicher stale machen");

const b2bGroup={first:"2026-10-23",second:"2026-10-24",teams:["SAS"]};
const b2bGames={games:[
  {gameId:"b2b-1",date:"2026-10-23",away:"HOU",home:"SAS",status:"STATUS_SCHEDULED"},
  {gameId:"b2b-2",date:"2026-10-24",away:"SAS",home:"DAL",status:"STATUS_SCHEDULED"}
]};
const b2bRecord={...noActual,id:"b2b-v36",name:"B2B v36",nba:"SAS",injuryStatus:"OUT",base:{...base,PTS:25}};
context.MONSTER_STATE.data={projectionEngine:{...readyEngine,players:[b2bRecord]},nbaSeasonSchedule:b2bGames};
const currentOutB2b=context.monsterProjectionB2bContext({
  id:"b2b-v36",name:"Legacy B2B",nba:"LAL",injuryStatus:"ACTIVE",PTS:999
},b2bGroup,["PTS"],{});
assert.equal(currentOutB2b.perGame.PTS,25,
  "B2B muss die v36-ESPN-Baseline und niemals den Legacy-PTS-Wert verwenden");
assert.deepEqual(Array.from(currentOutB2b.opponents),["HOU","DAL"],
  "Auch das aktuelle NBA-Team muss aus dem v36-Spielerrecord kommen");
assert.equal(currentOutB2b.probability,0,
  "Der aktuelle v36-Verletzungsstatus OUT muss einen veralteten gesunden Legacy-Status ueberstimmen");
assert.equal(currentOutB2b.effectiveGames,0);

const activeB2bRecord={...b2bRecord,injuryStatus:"ACTIVE"};
context.MONSTER_STATE.data={projectionEngine:{...readyEngine,players:[activeB2bRecord]},nbaSeasonSchedule:b2bGames};
const currentActiveB2b=context.monsterProjectionB2bContext({
  id:"b2b-v36",name:"Legacy B2B",nba:"LAL",injuryStatus:"OUT",PTS:999
},b2bGroup,["PTS"],{});
assert.equal(currentActiveB2b.probability,1,
  "Ein aktueller aktiver v36-Status darf nicht von einem veralteten Legacy-OUT blockiert werden");
assert.equal(currentActiveB2b.effectiveGames,2);
assert.equal(currentActiveB2b.perGame.PTS,25);

assert.match(html,/ESPN Projection 2026\/27|ESPN-Projektion(?:en)? 2026\/27/,
  "Die aktive Datenquelle muss als ESPN-Projektion 2026/27 benannt werden");
assert.match(html,/Kein Fake-Consensus/i,
  "Die Projektionsquellen muessen den fehlenden Mehrquellen-Consensus ausdruecklich offenlegen");
assert.match(html,/FantasyPros[^\n]+vorbereitet|FantasyPros[^\n]+Adapter/i);
assert.match(html,/Hashtag[^\n]+vorbereitet|Hashtag[^\n]+Adapter/i);
assert.match(functionSource("monsterSourcesMarkup"),/FantasyPros API vorbereitet["'],active:false/i,
  "FantasyPros muss bis zum lizenzierten Zugang technisch inaktiv bleiben");
assert.match(functionSource("monsterSourcesMarkup"),/Hashtag Export vorbereitet["'],active:false/i,
  "Hashtag muss bis zum lizenzierten Zugang technisch inaktiv bleiben");

console.log("PASS · FBA Projection Engine v36 frontend tests");
