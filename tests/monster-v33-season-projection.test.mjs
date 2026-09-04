import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const inline=html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
assert.ok(inline,"Das vollständige Inline-Frontend muss vorhanden sein");
new vm.Script(inline[1],{filename:"index.inline.js"});

const start=inline[1].indexOf("function monsterSeasonProjectionCalculate(input){");
const end=inline[1].indexOf("\nfunction monsterSeasonProjectionInputs(",start);
assert.ok(start>=0&&end>start,"Der reine v39-Saisonprognose-Rechner muss vorhanden sein");
const model="ESPN-Spielplan 2026/27 × ESPN-Statistikbasis 2025/26 · Kader eingefroren · keine Garantie";
const calculatorSource=inline[1].slice(start,end);
const calculate=vm.runInNewContext(`(${calculatorSource})`,{MONSTER_SEASON_MODEL:model},{filename:"monster-season-projection.js"});

const teams=Array.from({length:8},(_,index)=>`Team ${index+1}`);
const nbaTeams=["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"];

function isoDateForWeek(week,dayOffset=0){
  const start=week===1?Date.UTC(2026,9,20):Date.UTC(2026,9,26)+(week-2)*7*86400000;
  return new Date(start+dayOffset*86400000).toISOString().slice(0,10);
}

function makeNbaGames(count=1200,status="SCHEDULED"){
  const games=[];let gameId=1;
  for(let week=1;week<=18&&games.length<count;week++){
    const rounds=4+(week<=8?1:0);
    for(let round=0;round<rounds&&games.length<count;round++){
      for(let pair=0;pair<15&&games.length<count;pair++){
        games.push({
          gameId:`G${gameId++}`,
          date:isoDateForWeek(week,Math.min(round,week===1?5:6)),
          away:nbaTeams[(pair*2+round)%30],
          home:nbaTeams[(pair*2+round+1)%30],
          status,
          scoringPeriod:week===1?18:1
        });
      }
    }
  }
  while(games.length<count){
    const offset=games.length-1200,pair=offset%15,dayOffset=Math.floor(offset/15);
    games.push({
      gameId:`G${gameId++}`,
      date:new Date(Date.UTC(2027,1,22)+dayOffset*86400000).toISOString().slice(0,10),
      away:nbaTeams[pair*2],
      home:nbaTeams[pair*2+1],
      status,
      scoringPeriod:19
    });
  }
  assert.equal(games.length,count,"NBA-Fixture muss die angeforderte Spielzahl erreichen");
  return games;
}

function makeRoster(equal=false){
  const rows=[];
  teams.forEach((team,teamIndex)=>{
    for(let playerIndex=0;playerIndex<13;playerIndex++){
      const strength=equal?0:teamIndex*.12;
      rows.push({
        team,
        id:`P${teamIndex+1}-${playerIndex+1}`,
        name:`Spieler ${teamIndex+1}-${playerIndex+1}`,
        nba:nbaTeams[(teamIndex*13+playerIndex)%30],
        projectionReady:true,
        stats:{PTS:10+strength,REB:4+strength,AST:3+strength,"3PM":1+strength,STL:.7+strength,BLK:.5+strength,FGM:4+strength,FGA:8,FTM:3+strength,FTA:4}
      });
    }
  });
  return rows;
}

function makeMatchups(){
  const rows=[];
  for(let week=1;week<=18;week++)for(let pair=0;pair<4;pair++)rows.push({week,away:teams[pair*2],home:teams[pair*2+1],start:isoDateForWeek(week),end:isoDateForWeek(week,week===1?5:6)});
  rows.push({week:19,away:teams[0],home:teams[2]},{week:19,away:teams[4],home:teams[6]},{week:20,away:null,home:null},{week:20,away:null,home:null});
  return rows;
}

function fixture(overrides={}){
  return Object.assign({
    teams:[...teams],
    conferences:{East:teams.slice(0,4),West:teams.slice(4)},
    roster:makeRoster(),
    rosterMode:"testdraft",
    matchups:makeMatchups(),
    nbaSeasonSchedule:{games:makeNbaGames()}
  },overrides);
}

assert.match(html,/data-testid="monster-season-project"[^>]*onclick="runMonsterSeasonProjection\(\)"/,
  "Die private Prognose braucht den Button Jetzt durchrechnen");
assert.match(html,/Jetzt durchrechnen/);
assert.match(html,/Privat · nur Monster/);
assert.match(html,/Kalenderabdeckung 1\.200\/1\.230 · 30 NBA-Cup-Flexspiele noch offen und nicht erfunden/);
assert.match(html,/FG% und FT% sind über Treffer und Versuche volumenbereinigt/);
assert.match(html,/Exakter FBA-Punkt-Gleichstand geht im echten Matchup an das Heimteam/);
const tableStart=inline[1].indexOf("function monsterSeasonProjectionTable(");
const tableEnd=inline[1].indexOf("\nfunction monsterSeasonImpactTone(",tableStart);
assert.ok(tableStart>=0&&tableEnd>tableStart,"Die Conference-Tabellenfunktion muss vorhanden sein");
const tableSource=inline[1].slice(tableStart,tableEnd);
assert.match(tableSource,/<th title="Gewonnene FBA-Punkte">W<\/th><th title="Verlorene FBA-Punkte">L<\/th><th>WIN%<\/th><th>S–N–U<\/th>/,
  "Die Conference-Tabelle braucht die kompakte Reihenfolge W, L, WIN% und S–N–U");
assert.doesNotMatch(tableSource,/>Diff<|>All-Play<|>AP%</,
  "Diff, All-Play und AP% dürfen in der Conference-Tabelle keinen Platz mehr verbrauchen");
assert.match(tableSource,/monsterSeasonPercentage\(row\.fbaWinPct\)/,
  "WIN% muss aus dem Verhältnis der gewonnenen und verlorenen FBA-Punkte kommen");
const pctStart=inline[1].indexOf("function monsterSeasonPercentage(");
const pctEnd=inline[1].indexOf("\nfunction monsterSeasonScore(",pctStart);
const formatPct=vm.runInNewContext(`(${inline[1].slice(pctStart,pctEnd)})`,{Math,Number});
assert.equal(formatPct(.5833333333),".583");
assert.equal(formatPct(.5),".500");
assert.match(html,new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));

const result=calculate(fixture());
assert.equal(result.modelLabel,model);
assert.equal(result.calendarGames,1200);
assert.equal(result.matchupCount,72,"W19+ aus einem 76-Zeilen-Payload darf nicht zur Regular Season zählen");
assert.equal(result.conferences.East.length,4);
assert.equal(result.conferences.West.length,4);
assert.equal(result.coverageLabel,"Kalenderabdeckung 1.200/1.230 · 30 NBA-Cup-Flexspiele noch offen und nicht erfunden");
assert.equal(Object.keys(result.weeklyPlayers).length,8,"Die Season Journey braucht Spieler-Einsätze für alle acht Teams");
for(const team of teams)for(let week=1;week<=18;week++){
  const playerWeeks=result.weeklyPlayers[team][week];
  assert.equal(playerWeeks.length,13,`${team} W${week}: Die Season Journey braucht alle 13 Kaderspieler`);
  assert.ok(Math.abs(playerWeeks.reduce((sum,row)=>sum+row.games,0)-result.weekly[team][week].games)<1e-9,
    `${team} W${week}: Spieler-Einsätze und Teamprojektion müssen identisch sein`);
  assert.ok(Math.abs(playerWeeks.reduce((sum,row)=>sum+row.scheduledGames,0)-result.weekly[team][week].scheduledGames)<1e-9,
    `${team} W${week}: Die sichtbaren Schedule-Slots dürfen nicht von der Wochenrechnung abweichen`);
}
assert.ok(result.matchupResults.every(game=>game.categories.length===8),"Jede Journey-Woche braucht alle acht Kategorieentscheidungen");
assert.equal(result.matchupResults[0].start,isoDateForWeek(1));
assert.equal(result.matchupResults[0].end,isoDateForWeek(1,5));
for(const row of result.rows){
  assert.equal(row.w+row.l+row.t,18,`${row.team} braucht 18 echte Matchups`);
  assert.equal(row.allPlayW+row.allPlayL+row.allPlayT,126,`${row.team} braucht 18 × 7 All-Play-Vergleiche`);
  assert.equal(row.diff,row.fbaFor-row.fbaAgainst);
  assert.equal(row.fbaWinPct,row.fbaFor/(row.fbaFor+row.fbaAgainst),
    `${row.team}: Conference-WIN% muss ausschließlich W/(W+L) sein`);
}
assert.ok(result.matchupResults.every(game=>game.awayPoints+game.homePoints===8),"Jedes echte Matchup muss exakt acht FBA-Punkte vergeben");
assert.equal(result.rows.reduce((sum,row)=>sum+row.fbaFor,0),576,"72 Matchups × 8 FBA-Punkte müssen ligaweit vergeben werden");
assert.equal(result.rows.reduce((sum,row)=>sum+row.fbaAgainst,0),576);
assert.equal(result.rows.reduce((sum,row)=>sum+row.w,0),result.rows.reduce((sum,row)=>sum+row.l,0));
assert.equal(result.rows.reduce((sum,row)=>sum+row.allPlayFor,0),4032,"18 Wochen × 28 Paarungen × 8 Punkte müssen im All-Play vergeben werden");
assert.equal(result.rows.reduce((sum,row)=>sum+row.allPlayAgainst,0),4032);

const scheduleSensitiveGames=makeNbaGames(),scheduleTargetNba=makeRoster()[0].nba,scheduleTargetRows=scheduleSensitiveGames.filter(game=>game.date>=isoDateForWeek(1)&&game.date<=isoDateForWeek(1,5)&&(game.away===scheduleTargetNba||game.home===scheduleTargetNba));
assert.ok(scheduleTargetRows.length>2,"Das Test-NBA-Team braucht zunächst mehr als zwei Spiele in W1");
scheduleTargetRows.slice(2).forEach((game,index)=>{game.date=`2027-04-${String(20+index).padStart(2,"0")}`});
const scheduleSensitiveResult=calculate(fixture({nbaSeasonSchedule:{games:scheduleSensitiveGames}})),targetPlayer=scheduleSensitiveResult.weeklyPlayers[teams[0]][1].find(player=>player.id==="P1-1");
assert.equal(targetPlayer.scheduledGames,2,"Ein 2-Spiele-Star darf in seiner FBA-Woche nur zwei Schedule-Slots erhalten");
assert.ok(scheduleSensitiveResult.weekly[teams[0]][1].scheduledGames<=result.weekly[teams[0]][1].scheduledGames-(scheduleTargetRows.length-2),
  "Weniger NBA-Spiele eines Kaderspielers müssen das exakte Wochenvolumen des FBA-Teams reduzieren");

const pickupRoster=makeRoster(),dropIndex=pickupRoster.findIndex(player=>player.team===teams[0]);
pickupRoster[dropIndex]={team:teams[0],id:"FREE-AGENT-1",name:"Pickup Upgrade",nba:pickupRoster[dropIndex].nba,projectionReady:true,stats:{PTS:45,REB:18,AST:14,"3PM":7,STL:4,BLK:4,FGM:16,FGA:25,FTM:9,FTA:10}};
const pickupResult=calculate(fixture({roster:pickupRoster})),beforePickup=result.rows.find(row=>row.team===teams[0]),afterPickup=pickupResult.rows.find(row=>row.team===teams[0]);
assert.ok(afterPickup.fbaFor>beforePickup.fbaFor,"Ein belastbarer Pickup muss die komplette 18-Wochen-Endtabelle neu berechnen können");
assert.notDeepEqual(JSON.parse(JSON.stringify(afterPickup)),JSON.parse(JSON.stringify(beforePickup)),"Season Impact darf nicht nur das aktuelle Wochen-Matchup verändern");

for(const conference of [result.conferences.East,result.conferences.West])for(let index=1;index<conference.length;index++){
  const before=conference[index-1],after=conference[index];
  assert.ok(before.fbaFor>after.fbaFor||before.fbaFor===after.fbaFor&&(before.winPct>after.winPct||before.winPct===after.winPct&&(before.diff>after.diff||before.diff===after.diff&&before.team.localeCompare(after.team)<=0)),
    "Conference-Reihenfolge muss FBA-Punkte, Win% und Diff priorisieren");
}

const tieResult=calculate(fixture({roster:makeRoster(true)}));
assert.ok(tieResult.matchupResults.every(game=>game.awayPoints===0&&game.homePoints===8),
  "Bei exakt gleichen FBA-Punkten müssen alle acht Punkte an das Heimteam gehen");
assert.ok(tieResult.rows.every(row=>row.allPlayT===126&&row.allPlayW===0&&row.allPlayL===0),
  "All-Play hat kein Heimteam und muss identische Kader fair als 4:4-Tie behandeln");

const splitRoster=makeRoster(true);
for(const player of splitRoster.filter(row=>row.team===teams[0]))Object.assign(player.stats,{PTS:11,REB:5,AST:4,"3PM":2,STL:.6,BLK:.4,FGM:3,FGA:8,FTM:2,FTA:4});
const splitResult=calculate(fixture({roster:splitRoster})),splitGames=splitResult.matchupResults.filter(game=>game.away===teams[0]&&game.home===teams[1]);
assert.ok(splitGames.every(game=>game.awayPoints===4&&game.homePoints===4),"Vier gewonnene FBA-Punkte je Team müssen ein echtes 4:4 ergeben");
assert.equal(splitResult.rows.find(row=>row.team===teams[0]).t,18);
assert.equal(splitResult.rows.find(row=>row.team===teams[1]).t,18);

const volumeRoster=makeRoster(true);
for(const player of volumeRoster.filter(row=>row.team===teams[0])){
  const first=player.id.endsWith("-1");player.stats.FGM=first?1:49;player.stats.FGA=first?1:100;player.stats.FTM=first?1:79;player.stats.FTA=first?1:100;
}
for(const player of volumeRoster.filter(row=>row.team===teams[1])){player.stats.FGM=50;player.stats.FGA=100;player.stats.FTM=80;player.stats.FTA=100}
const volumeResult=calculate(fixture({roster:volumeRoster}));
assert.ok(Math.abs(volumeResult.weekly[teams[0]][1]["FG%"]-589/1201)<1e-12,"FG% muss ΣFGM/ΣFGA sein");
assert.ok(Math.abs(volumeResult.weekly[teams[0]][1]["FT%"]-949/1201)<1e-12,"FT% muss ΣFTM/ΣFTA sein");
assert.ok(volumeResult.weekly[teams[0]][1]["FG%"]<volumeResult.weekly[teams[1]][1]["FG%"]);
assert.ok(volumeResult.weekly[teams[0]][1]["FT%"]<volumeResult.weekly[teams[1]][1]["FT%"]);

const finalResult=calculate(fixture({nbaSeasonSchedule:{games:makeNbaGames(1200,"STATUS_FINAL")}}));
assert.deepEqual(JSON.parse(JSON.stringify(finalResult.rows)),JSON.parse(JSON.stringify(result.rows)),
  "Bereits finale NBA-Spiele bleiben Teil der 18-Wochen-Endprojektion");
const interruptedGames=makeNbaGames(),filteredStatuses=["STATUS_POSTPONED","STATUS_SUSPENDED","STATUS_CANCELLED","STATUS_CANCELED","STATUS_REMOVED"];
filteredStatuses.forEach((status,index)=>{interruptedGames[index].status=status});
const interruptedResult=calculate(fixture({nbaSeasonSchedule:{games:interruptedGames}}));
assert.equal(interruptedResult.calendarGames,1195,"Unterbrochene oder abgesagte Spiele zählen bis zu einem neuen ESPN-Termin nicht als bekannte Spiele");

const cupFlexGames=makeNbaGames();
let cupMoveIndex=0;
for(const game of cupFlexGames){
  if(game.date>=isoDateForWeek(8)&&game.date<=isoDateForWeek(8,6)&&(game.away==="DAL"||game.home==="DAL"||game.away==="LAL"||game.home==="LAL")){
    game.date=new Date(Date.UTC(2027,2,1+cupMoveIndex++)).toISOString().slice(0,10);
  }
}
const cupFlexResult=calculate(fixture({nbaSeasonSchedule:{games:cupFlexGames}}));
assert.deepEqual(JSON.parse(JSON.stringify(cupFlexResult.scheduleGaps)),[{week:8,teams:["DAL","LAL"]}],
  "Noch offene NBA-Cup-Flextermine für DAL/LAL dürfen die 1.200-Spiele-Prognose nicht blockieren");
assert.match(cupFlexResult.scheduleGapsLabel,/W8 DAL, LAL/);
assert.match(cupFlexResult.scheduleGapsLabel,/keine Spiele ergänzt/,
  "Offene Cup-Slots müssen sichtbar bleiben und dürfen nicht durch erfundene Spiele ersetzt werden");

assert.throws(()=>calculate(fixture({roster:makeRoster().slice(0,103)})),/103\/104/);
const imbalanced=makeRoster();imbalanced[103].team=teams[0];
assert.throws(()=>calculate(fixture({roster:imbalanced})),/Kaderverteilung unvollständig/);
const duplicate=makeRoster();duplicate[1].id=duplicate[0].id;
assert.throws(()=>calculate(fixture({roster:duplicate})),/Doppelter Spieler/);
const missingNbaRoster=makeRoster();missingNbaRoster[0].nba="";
assert.throws(()=>calculate(fixture({roster:missingNbaRoster})),/gültiges NBA-Team fehlt/);
const unreliable=makeRoster();unreliable[0].projectionReady=false;
assert.throws(()=>calculate(fixture({roster:unreliable})),/nicht als belastbar markiert/);
const missingStat=makeRoster();delete missingStat[0].stats.FTA;
assert.throws(()=>calculate(fixture({roster:missingStat})),/Statistikfelder fehlen \(FTA\)/);
for(const invalidValue of ["   ",false,[]]){
  const invalidNumeric=makeRoster();invalidNumeric[0].stats.PTS=invalidValue;
  assert.throws(()=>calculate(fixture({roster:invalidNumeric})),/Statistikfelder fehlen \(PTS\)/,"Whitespace, Boolean und Array dürfen nicht still als 0 gelten");
}
const numericString=makeRoster();numericString[0].stats.PTS="10.5";
assert.doesNotThrow(()=>calculate(fixture({roster:numericString})),"Ein nichtleerer endlicher numerischer String bleibt zulässig");
const impossibleShooting=makeRoster();impossibleShooting[0].stats.FGM=9;
assert.throws(()=>calculate(fixture({roster:impossibleShooting})),/Treffer übersteigen Versuche/);

const shortFba=makeMatchups();shortFba.splice(0,1);
assert.throws(()=>calculate(fixture({matchups:shortFba})),/71\/72/);
const duplicateFba=makeMatchups();duplicateFba[1]=Object.assign({},duplicateFba[0]);
assert.throws(()=>calculate(fixture({matchups:duplicateFba})),/ist doppelt/);
const repeatedTeam=makeMatchups();repeatedTeam[1]={week:1,away:teams[0],home:teams[3]};
assert.throws(()=>calculate(fixture({matchups:repeatedTeam})),/Nicht jedes der acht Teams spielt genau einmal/);

assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:makeNbaGames(1199)}})),/1\.199\/1\.200 eindeutige ESPN-Spiel-IDs/);
const completeGames=makeNbaGames(1230);completeGames[1229].date="2027-04-30";
const completeResult=calculate(fixture({nbaSeasonSchedule:{games:completeGames}}));
assert.equal(completeResult.calendarGames,1230);
assert.equal(completeResult.coverageLabel,"Kalenderabdeckung 1.230/1.230 · alle Regular-Season-Spiele terminiert");
assert.deepEqual(JSON.parse(JSON.stringify(completeResult.weekly)),JSON.parse(JSON.stringify(result.weekly)),"Spiele nach W18 zählen zur Coverage, aber nicht in die W1–18-Projektion");
assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:makeNbaGames(1231)}})),/maximal 1\.230/);
const duplicateAt1200=makeNbaGames(1200);duplicateAt1200[1199]=Object.assign({},duplicateAt1200[0]);
assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:duplicateAt1200}})),/1\.199\/1\.200 eindeutige ESPN-Spiel-IDs/);
const duplicateFixture=makeNbaGames(1200),firstFixture=duplicateFixture[0];
duplicateFixture[1199]=Object.assign({},duplicateFixture[1199],{date:firstFixture.date,away:firstFixture.away,home:firstFixture.home});
assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:duplicateFixture}})),/denselben Termin.*verschiedenen Event-IDs/,
  "Derselbe NBA-Termin darf auch mit zwei eindeutigen ESPN-IDs nicht doppelt gerechnet werden");
const only29=makeNbaGames().map(game=>{let away=game.away==="WAS"?"ATL":game.away,home=game.home==="WAS"?"ATL":game.home;if(away===home)home=away==="BOS"?"ATL":"BOS";return Object.assign({},game,{away,home})});
assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:only29}})),/29\/30 NBA-Teams/);
let movedWeek18=0;
const noWeek18=makeNbaGames().map(game=>game.date>="2027-02-15"?Object.assign({},game,{date:new Date(Date.UTC(2027,2,1+movedWeek18++)).toISOString().slice(0,10)}):game);
assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:noWeek18}})),/FBA-Woche 18/);
const invalidCalendarDate=makeNbaGames();invalidCalendarDate[0].date="2026-02-31";
assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:invalidCalendarDate}})),/unvollständige Spielzeile/);
const ambiguousCalendarDate=makeNbaGames();ambiguousCalendarDate[0].date="10/20/2026";
assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:ambiguousCalendarDate}})),/unvollständige Spielzeile/);
const beforeSeason=makeNbaGames();beforeSeason[0].date="2026-10-19";
assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:beforeSeason}})),/unvollständige Spielzeile/);
const outsideSeason=makeNbaGames();outsideSeason[0].date="2027-05-01";
assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:outsideSeason}})),/unvollständige Spielzeile/);
const conflictingWeek=makeNbaGames();conflictingWeek[0].week=18;
assert.throws(()=>calculate(fixture({nbaSeasonSchedule:{games:conflictingWeek}})),/widersprüchliche FBA-Woche/);
const explicitOnly=makeNbaGames();delete explicitOnly[0].date;explicitOnly[0].fbaWeek="1";
const explicitOnlyResult=calculate(fixture({nbaSeasonSchedule:{games:explicitOnly}}));
assert.deepEqual(JSON.parse(JSON.stringify(explicitOnlyResult.weekly)),JSON.parse(JSON.stringify(result.weekly)),"Eine explizite FBA-Woche darf nur den fehlenden Termin ersetzen");

const boundaryGames=makeNbaGames(),boundaryGame=boundaryGames[0];
boundaryGame.date="2026-10-26T00:30:00Z";
const boundaryResult=calculate(fixture({nbaSeasonSchedule:{games:boundaryGames}}));
const boundaryTeam=makeRoster().find(player=>player.nba===boundaryGame.away).team;
assert.equal(boundaryResult.weekly[boundaryTeam][1].games,result.weekly[boundaryTeam][1].games,
  "00:30 UTC am 26. Oktober ist in New York noch W1; scoringPeriod darf nicht als Woche dienen");

// In-season contract: a completed FBA week is an immutable result seed. In the
// active week, captured owner-at-game stats are fixed and only open NBA games
// are projected. A later pickup must never inherit or rewrite the old games.
const liveStatFields=["PTS","REB","AST","3PM","STL","BLK","FGM","FGA","FTM","FTA"];
const zeroLiveStats=()=>Object.fromEntries(liveStatFields.map(field=>[field,0]));
const liveCalculate=vm.runInNewContext(`(${calculatorSource})`,{
  MONSTER_SEASON_MODEL:model,
  canonicalTeamName:value=>String(value||""),
  monsterProjectionUsableNode:node=>Boolean(node&&node.status==="READY"),
  monsterProjectionPlayerRecord:(id,engine)=>(engine.players||[]).find(row=>String(row.id)===String(id))||null,
  monsterProjectionBase:record=>record&&record.base||{},
  monsterProjectionRecordIssue:record=>record?"":"ESPN-Projektion fehlt.",
  monsterProjectionRecordNba:record=>String(record&&record.nba||""),
  monsterProjectionWeeklyPlayer:(record,week,games,engine,nba)=>{
    const future=(games||[]).filter(game=>Number(game.week)===Number(week)&&(game.away===nba||game.home===nba)&&!/FINAL|POST_GAME|IN[_ -]?PROGRESS|HALFTIME|END_PERIOD|POSTPONED|SUSPENDED|CANCELLED|CANCELED|REMOVED/i.test(String(game.status||"")));
    const futureTotals=zeroLiveStats();liveStatFields.forEach(field=>futureTotals[field]=Number(record.base[field]||0)*future.length);
    return {games:future.length,actualGames:0,remainingGames:future.length,scheduledRemainingGames:future.length,actualTotals:zeroLiveStats(),futureTotals,totals:Object.assign({},futureTotals)};
  }
},{filename:"monster-season-projection-live.js"});

const liveGames=makeNbaGames(),completedEventIds=liveGames.filter(game=>game.date<=isoDateForWeek(2,1)).map(game=>game.gameId);
const liveRoster=makeRoster(),engineRecords=liveRoster.map(row=>({id:row.id,name:row.name,nba:row.nba,projectedGp:70,base:Object.assign({},row.stats),actual:{gp:0,totals:zeroLiveStats(),byWeek:{}}}));
const awayWeekStats={PTS:120,REB:50,AST:30,"3PM":15,STL:10,BLK:4,FGM:50,FGA:100,FTM:70,FTA:100};
const homeWeekStats={PTS:100,REB:40,AST:20,"3PM":10,STL:8,BLK:6,FGM:55,FGA:100,FTM:80,FTA:100};
const teamActualsByWeek={};
teams.forEach((team,teamIndex)=>{
  const stats=Object.assign({},teamIndex%2===0?awayWeekStats:homeWeekStats),players={};
  liveRoster.filter(row=>row.team===team).forEach(row=>{players[row.id]={id:row.id,name:row.name,nba:row.nba,gp:1,stats:Object.fromEntries(liveStatFields.map(field=>[field,stats[field]/13]))}});
  teamActualsByWeek[team]={"1":{gp:13,stats,players}};
});
const w2Actual={PTS:25,REB:10,AST:7,"3PM":3,STL:2,BLK:1,FGM:10,FGA:22,FTM:2,FTA:3};
teamActualsByWeek[teams[0]]["2"]={gp:2,stats:w2Actual,players:{
  "P1-1":{id:"P1-1",name:"Spieler 1-1",nba:liveRoster[0].nba,gp:1,stats:{PTS:10,REB:4,AST:3,"3PM":1,STL:1,BLK:0,FGM:4,FGA:10,FTM:1,FTA:1}},
  "P1-2":{id:"P1-2",name:"Spieler 1-2",nba:liveRoster[1].nba,gp:1,stats:{PTS:15,REB:6,AST:4,"3PM":2,STL:1,BLK:1,FGM:6,FGA:12,FTM:1,FTA:2}}
}};
const seedValue=(stats,cat)=>cat==="FG%"?stats.FGM/stats.FGA:cat==="FT%"?stats.FTM/stats.FTA:stats[cat];
const completedFbaMatchups=makeMatchups().filter(game=>game.week===1).map(game=>{
  const left=teamActualsByWeek[game.away]["1"].stats,right=teamActualsByWeek[game.home]["1"].stats,categories=["PTS","REB","AST","3PM","STL","BLK","FG%","FT%"].map(cat=>({cat,left:seedValue(left,cat),right:seedValue(right,cat),winner:seedValue(left,cat)>seedValue(right,cat)?"left":"right",homeTie:seedValue(left,cat)===seedValue(right,cat)}));
  return {week:1,away:game.away,home:game.home,awayPoints:5,homePoints:3,categories};
});
const liveEngine={active:true,status:"READY",season:"2027",baseline:{status:"READY",season:"2027"},players:engineRecords,actual:{ownershipAtGameReady:true,fbaResultsReady:true,currentMatchupPeriod:2,completedThroughWeek:1,completedEventIds,completedFbaMatchups,teamActualsByWeek}};
const liveResult=liveCalculate(fixture({roster:liveRoster,nbaSeasonSchedule:{games:liveGames},projectionEngine:liveEngine}));
assert.equal(liveResult.seededMatchups,4,"Nach Beginn von W2 müssen alle vier W1-Matchups als echte Ergebnisse fixiert sein");
assert.ok(liveResult.matchupResults.filter(game=>game.week===1).every(game=>game.seeded&&game.awayPoints===5&&game.homePoints===3),
  "Die Endtabelle muss die vier bestätigten W1-Ergebnisse statt einer Rückprojektion verwenden");
assert.equal(liveResult.weekly[teams[0]][1].PTS,awayWeekStats.PTS,"W1-Istwerte dürfen nicht erneut aus dem heutigen Kader berechnet werden");
assert.equal(liveResult.weekly[teams[0]][2].actualGames,2,"Die abgeschlossenen Tage der laufenden Woche müssen absolut in der Wochenbasis stehen");
assert.ok(liveResult.weekly[teams[0]][2].PTS>w2Actual.PTS,"Zur laufenden W2 dürfen ausschließlich die noch offenen Tage hinzukommen");

const livePickupRoster=liveRoster.map(row=>Object.assign({},row)),pickupEngineRecords=engineRecords.map(row=>Object.assign({},row,{base:Object.assign({},row.base)}));
livePickupRoster[0]=Object.assign({},livePickupRoster[0],{id:"NEW-P1",name:"Mittwochs-Pickup"});
pickupEngineRecords.push({id:"NEW-P1",name:"Mittwochs-Pickup",nba:livePickupRoster[0].nba,projectedGp:70,base:Object.assign({},livePickupRoster[0].stats,{PTS:60}),actual:{gp:0,totals:zeroLiveStats(),byWeek:{}}});
const pickupEngine=Object.assign({},liveEngine,{players:pickupEngineRecords});
const pickupLiveResult=liveCalculate(fixture({roster:livePickupRoster,nbaSeasonSchedule:{games:liveGames},projectionEngine:pickupEngine}));
assert.deepEqual(JSON.parse(JSON.stringify(pickupLiveResult.weekly[teams[0]][1])),JSON.parse(JSON.stringify(liveResult.weekly[teams[0]][1])),
  "Ein Pickup in W2 darf die bestätigten Team-Istwerte aus W1 niemals rückwirkend verändern");
assert.deepEqual(JSON.parse(JSON.stringify(pickupLiveResult.matchupResults.filter(game=>game.week===1))),JSON.parse(JSON.stringify(liveResult.matchupResults.filter(game=>game.week===1))),
  "Ein Pickup in W2 darf die vier bestätigten W1-Matchups niemals rückwirkend verändern");
assert.ok(pickupLiveResult.weekly[teams[0]][2].PTS>liveResult.weekly[teams[0]][2].PTS,
  "Der neue Spieler darf ab den offenen W2-Tagen sehr wohl die Restprojektion verändern");
assert.equal(pickupLiveResult.weekly[teams[0]][2].actualGames,2,"Montag und Dienstag müssen auch nach dem Pickup unverändert bleiben");
assert.ok(pickupLiveResult.weeklyPlayers[teams[0]][2].some(row=>row.id==="P1-1"&&row.actualOnly===true),
  "Der vor dem Pickup aktive Spieler muss als historischer W2-Ist-Beitrag erhalten bleiben");

console.log("PASS · Matchup Monster v39 season projection frontend tests");
