import assert from "node:assert/strict";
// v39 regression suite: Monster loading, live reset, navigation, responsive layout and pickup tools.
import fs from "node:fs";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const inline=html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
const projectRoot=new URL("../",import.meta.url);

assert.ok(inline,"Das vollständige Inline-Frontend muss vorhanden sein");
new vm.Script(inline[1],{filename:"index.inline.js"});

const localResources=new Set([
  ...[...html.matchAll(/(?:src|href)="([^"${}]+\.(?:js|png|webp|webmanifest))"/g)].map(match=>match[1]),
  ...[...html.matchAll(/"((?:logos|managers)\/[^"]+\.(?:png|webp))"/g)].map(match=>match[1])
]);
for(const resource of localResources){
  if(/^https?:/i.test(resource))continue;
  assert.equal(fs.existsSync(new URL(resource,projectRoot)),true,`Lokale Produktionsdatei fehlt: ${resource}`);
}
const manifest=JSON.parse(fs.readFileSync(new URL("manifest.webmanifest",projectRoot),"utf8"));
assert.match(manifest.start_url,/war-room-monster-v39-20260904/);
for(const icon of manifest.icons||[]){
  assert.equal(fs.existsSync(new URL(icon.src,projectRoot)),true,`Manifest-Icon fehlt: ${icon.src}`);
}

function functionSource(name){
  const start=inline[1].indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`Funktion ${name} fehlt`);
  const open=inline[1].indexOf("{",start);
  let depth=0,quote="",escaped=false;
  for(let i=open;i<inline[1].length;i++){
    const char=inline[1][i];
    if(quote){
      if(escaped){escaped=false;continue}
      if(char==="\\"){escaped=true;continue}
      if(char===quote)quote="";
      continue;
    }
    if(char==='"'||char==="'"||char==='`'){quote=char;continue}
    if(char==="{")depth++;
    if(char==="}"&&--depth===0)return inline[1].slice(start,i+1);
  }
  throw new Error(`Funktion ${name} ist unvollständig`);
}

function loadFunction(name,context={}){
  return vm.runInNewContext(`(${functionSource(name)})`,context,{filename:`${name}.js`});
}
function loadAsyncFunction(name,context={}){
  return vm.runInNewContext(`(async ${functionSource(name)})`,context,{filename:`${name}.js`});
}

assert.match(html,/war-room-monster-v39-20260904/,"Produktions-Build muss v39 ausweisen");
assert.match(html,/function navigatePage\(key\)[\s\S]*openMonsterGate\(\)/,
  "Der sichtbare Monster-Tab muss den geschützten Datensatz laden");
assert.match(html,/onclick="navigatePage\('\$\{k\}'\)"/,
  "Die Navigation muss zentral über navigatePage laufen");
assert.match(html,/const rows=MONSTER_STATE\.data\?backend:local/,
  "Nach dem Monster-Ladevorgang darf kein historischer öffentlicher Spielplan einspringen");
assert.match(html,/Keine Nullwerte angezeigt/,
  "Fehlende geschützte Daten müssen sichtbar blockieren statt 0 und 50\/50 auszugeben");
assert.match(html,/FBA-Matchups · ESPN/,
  "FBA-Matchups und NBA-Spiele müssen in der Quellenzeile eindeutig getrennt sein");
assert.match(html,/NBA-Spiele ·/,
  "Die ausgewählte Woche muss ihre echte Zahl an NBA-Spielen zeigen");
assert.match(html,/@media\(min-width:1280px\)[\s\S]*monster-points-v30[\s\S]*repeat\(2,minmax\(0,1fr\)\)/,
  "Desktop muss alle acht FBA-Punkte als kompaktes 2×4-Raster zeigen");
assert.match(html,/data-testid="monster-analysis-team"/,"Das Analyse-Team braucht einen eindeutigen Selektor");
assert.match(html,/data-testid="monster-week"/,"Die eindeutige Wochenwahl muss vorhanden sein");
assert.match(html,/data-testid="monster-opponent"/,"Der freie Vergleichsgegner muss erhalten bleiben");
assert.match(html,/function monsterWeeks\(\)[\s\S]*new Map\(\)/,"Vier Spielplanzeilen pro Woche müssen zu einer Wochenoption verdichtet werden");
assert.match(html,/function setMonsterWeek\(value\)[\s\S]*monsterScheduledOpponent/,
  "Ein Wochenwechsel muss den echten Gegner des Analyse-Teams vorauswählen");
assert.match(html,/function loadMonsterData\(force,fullSync\)[\s\S]*queuedWeek=requestedWeek[\s\S]*requestedWeek!==currentWeek[\s\S]*await loadMonsterData\(followupForce,followupFullSync\)/,
  "Ein Wochenwechsel während eines ESPN-Abrufs muss die neueste Woche nachladen und die alte Antwort verwerfen");
assert.match(html,/weekPinned:false/);
assert.match(functionSource("loadMonsterData"),/currentMatchupPeriod[\s\S]*!MONSTER_STATE\.weekPinned[\s\S]*MONSTER_STATE\.week=liveWeek[\s\S]*queuedWeek=liveWeek/,
  "Beim ersten Öffnen muss das Monster ESPNs aktuelle FBA-Woche erkennen und genau diese Woche nachladen");
assert.match(functionSource("setMonsterWeek"),/weekPinned=true/,
  "Eine bewusste manuelle Wochenwahl darf nicht sofort wieder vom Auto-Fokus überschrieben werden");
assert.match(html,/MONSTER_TEAM_KEY="fba_monster_analysis_team_v32"/,
  "Das gewählte Analyse-Team muss auf dem Gerät erhalten bleiben");

assert.match(html,/function monsterB2bGroups\(list\)/,"B2B-Einträge müssen nach Tagespaar gruppiert werden");
assert.match(html,/monsterWeekdayPair\(group\.first,group\.second\)/,"Der Wochentag muss im Radar vor den NBA-Teams stehen");
assert.match(html,/toggleMonsterB2b\('\$\{E\(group\.key\)\}'\)/,"B2B-Zeilen müssen aufklappbar sein");
assert.match(html,/function monsterB2bFreeAgents\(teams,points\)/,"Aufgeklappte B2B-Zeilen brauchen freie Spieler der betroffenen NBA-Teams");
assert.match(html,/b2bHunts:\[\]/,"Das B2B-Radar muss mit einer leeren Mehrfachauswahl starten");
assert.match(functionSource("setMonsterB2bHunt"),/selected\.splice[\s\S]*selected\.push[\s\S]*DRAFT_CATS\.filter/,
  "Mehrere FBA-Punkte müssen unabhängig an- und abwählbar sein");
assert.match(functionSource("monsterB2bContribution"),/values\.reduce\([\s\S]*\/values\.length/,
  "Kombinierte B2B-Sortierung muss den gleichgewichteten z-Score-Durchschnitt bilden");
assert.match(html,/FBA-Punkte kombinieren · mehrere wählbar/);
assert.match(html,/monsterB2bDate\(group\.first\)[\s\S]* auf [\s\S]*monsterB2bDate\(group\.second\)/,
  "Das Radar braucht das kompakte numerische Datum unter dem Tagespaar");
assert.doesNotMatch(functionSource("monsterB2bMarkup"),/Atlanta Hawks|Chicago Bulls|MONSTER_NBA_NAMES/,
  "Die B2B-Teamzeile darf Kürzel und ausgeschriebenen Namen nicht doppelt zeigen");
assert.match(html,/\.monster-b2b-player\{[^}]*grid-template-columns:88px[^}]*min-height:104px[^}]*overflow:hidden/,
  "B2B-Spielerkarten müssen dem Portrait sichtbar mehr Kartenhöhe geben");
assert.match(html,/\.monster-b2b-player-art img\{[^}]*width:142px[^}]*height:104px[^}]*object-fit:contain[^}]*drop-shadow/,
  "B2B-Portraits müssen bei gleicher Höhe die vollständige Schulter als 3D-Layer zeigen");
assert.match(html,/\.monster-b2b-player-copy\{[^}]*z-index:3[^}]*padding-left:36px/,
  "Der Spielertext muss lesbar vor dem überlappenden Schulter-Layer liegen");
assert.match(functionSource("monsterPlayer"),/espnFantasyPositions[\s\S]*positionMap\[id\][\s\S]*fantasyPositions/,
  "Auch freie Spieler müssen ihre ligaabhängigen ESPN-Positionen aus dem vollständigen Spielerpool erhalten");
assert.match(functionSource("monsterB2bPlayersMarkup"),/monster-b2b-player-art[\s\S]*monster-b2b-player-team[\s\S]*monster-b2b-player-position[\s\S]*monsterEspnFantasyPositionLabel/,
  "Die ESPN-Position muss im B2B-Feld direkt unter dem NBA-Teamkürzel stehen");
const espnPositionLabel=loadFunction("monsterEspnFantasyPositionLabel",{Set});
assert.equal(espnPositionLabel({fantasyPositions:"SG,PG,UTIL,BE"}),"PG, SG",
  "ESPN-Mehrfachberechtigungen müssen in fester Basketball-Reihenfolge erscheinen; Flex und Bank bleiben draußen");
assert.equal(espnPositionLabel({fantasyPositions:"4,7,8"}),"ESPN-Position offen",
  "Historische numerische Slotwerte dürfen nicht als vermeintlich exakte ESPN-Position ausgegeben werden");

assert.match(html,/hunt:null/,"Das Pickup Impact Lab muss ohne ausgewählten FBA-Punkt starten");
assert.match(html,/setMonsterHunt\(''\).*GESAMT/,
  "Das Pickup Impact Lab braucht eine Gesamtprofil-Auswahl");
assert.match(html,/function monsterSimulation\(teamA,teamB,baseForecast\)/,
  "Drop und Add müssen ein gemeinsames Vorher-Nachher-Szenario erzeugen");
assert.match(html,/Alle acht FBA-Punkte zeigen jetzt Vorher → Nachher/,
  "Das ausgewählte Pickup-Szenario muss oberhalb der acht Balken sichtbar werden");
assert.match(html,/monster-point-impact \$\{impact\}/,
  "Jeder FBA-Punkt braucht einen farbigen Gewinn-/Verlust-Hinweis");
assert.match(html,/Kein bekannter verbleibender ESPN-Termin/,
  "Spieler ohne bekannten verbleibenden NBA-Termin müssen die Wochenprognose blockieren");
assert.match(html,/Keine verbleibenden NBA-Spiele/,
  "Ein Kader ohne verbleibende NBA-Spiele darf keine Nullwert-Prognose auslösen");

assert.match(html,/<h2>Vorsaison-Simulation<\/h2>/,"Die geheime Conference-Rechnung muss klar als Vorsaison-Simulation bezeichnet sein");
assert.match(html,/<h2>Meta Projection<\/h2>/,"Die Matchup-Karte muss Meta Projection heißen");
assert.doesNotMatch(html,/Wahrscheinlichstes Szenario|Ein Balance-Balken je FBA-Punkt/,
  "Doppelte Meta-Erklärungen müssen aus der kompakten Ansicht entfernt sein");
assert.match(html,/monster-vs-v30">:<\/div>/,"Der Score trennt beide Teams platzsparend mit einem Doppelpunkt");
assert.match(html,/data-testid="monster-season-pickup-impact"/,
  "Ein gewählter Pickup muss einen eigenen Season-Impact-Vergleich erhalten");
assert.match(functionSource("monsterSeasonProjectionPickupImpact"),/monsterSeasonProjectionCalculate\(monsterSeasonProjectionInputs\(pickup\)\)/,
  "Season Impact muss die vollständige Saisonprojektion mit dem Tausch neu berechnen");
assert.match(functionSource("monsterSeasonProjectionMarkup"),/impact\.result[\s\S]*highlightTeam/,
  "Die Conference-Tabellen müssen das neue Pickup-Szenario anzeigen und markieren");
assert.match(functionSource("monsterSeasonProjectionMarkup"),/monsterSeasonJourneyMarkup\(result,MONSTER_STATE\.teamA\)/,
  "Die berechnete Saison muss als Wochenpfad des ausgewählten Analyse-Teams sichtbar werden");
assert.match(html,/data-testid="monster-season-journey"/,
  "Der Season Simulator braucht eine eigene Season Journey");
assert.match(html,/\.monster-season-category-grid\{[^}]*repeat\(4,minmax\(0,1fr\)\)/,
  "Desktop muss die acht Kategorien einer Woche als kompaktes 4×2-Raster zeigen");
assert.match(html,/\.monster-season-week summary\{[^}]*grid-template-columns:132px/,
  "Woche und Datum brauchen eine feste, vom ersten Teamlogo getrennte Spalte");
assert.match(html,/\.monster-season-fixture-score \.away,\.monster-season-fixture-score \.home\{color:inherit\}/,
  "Das Ergebnis in der Mitte muss neutral weiß statt in Teamfarben erscheinen");
assert.match(html,/\.monster-season-category\{[^}]*text-align:center/);
assert.match(html,/\.monster-season-category-head\{[^}]*justify-content:center/,
  "Der Name des FBA-Punkts muss mittig im Detailfeld stehen");
const journeyMarkup=loadFunction("monsterSeasonJourneyMarkup",{
  T:team=>({s:team,c:team==="Pirates"?"#7657ef":"#b21f35"}),
  E:value=>String(value),
  chip:team=>`[${team}]`,
  monsterSeasonScore:value=>String(value),
  monsterSeasonCategoryValue:(cat,value)=>String(value),
  monsterSeasonScheduleWatchMarkup:team=>`<span>${team} watch</span>`,
  monsterFallbackWeekDates:()=>({start:"2026-10-20",end:"2026-10-25"}),
  monsterWeekLabel:()=>"20. Okt. – 25. Okt. 2026",
  DRAFT_CATS:["PTS","REB","AST","3PM","STL","BLK","FG%","FT%"]
})({
  weekly:{Pirates:{1:{games:40,scheduledGames:40}},Wolves:{1:{games:34,scheduledGames:34}}},
  weeklyPlayers:{Pirates:{1:[]},Wolves:{1:[]}},
  matchupResults:[{week:1,away:"Pirates",home:"Wolves",awayPoints:5,homePoints:3,seeded:false,categories:[
    {cat:"PTS",left:120,right:100,winner:"left",homeTie:false},{cat:"REB",left:50,right:55,winner:"right",homeTie:false},
    {cat:"AST",left:30,right:25,winner:"left",homeTie:false},{cat:"3PM",left:18,right:14,winner:"left",homeTie:false},
    {cat:"STL",left:9,right:8,winner:"left",homeTie:false},{cat:"BLK",left:4,right:7,winner:"right",homeTie:false},
    {cat:"FG%",left:.49,right:.48,winner:"left",homeTie:false},{cat:"FT%",left:.8,right:.82,winner:"right",homeTie:false}
  ]}]
},"Wolves");
assert.match(journeyMarkup,/Season Journey · Wolves/);
assert.match(journeyMarkup,/monster-season-week-side">Heim/,
  "Ein ausgewähltes Heimteam muss in der Journey als Heim und der Gegner links erscheinen");
assert.ok(journeyMarkup.indexOf("[Pirates]")<journeyMarkup.indexOf("[Wolves]"),
  "Die Journey muss immer Auswärts links und Heim rechts darstellen");
assert.match(journeyMarkup,/<b>40 GP<\/b><span class="good">\+6<\/span>/,
  "Auswärts-GP und die grüne positive Differenz müssen direkt unter dem Team stehen");
assert.match(journeyMarkup,/<b>34 GP<\/b><span class="bad">−6<\/span>/,
  "Heim-GP und die rote negative Differenz müssen direkt unter dem Team stehen");
assert.match(journeyMarkup,/Niederlage/);
assert.match(journeyMarkup,/monster-season-week outcome-bad/,
  "Die komplette Wochenzeile muss aus Sicht des Analyse-Teams dezent als Niederlage eingefärbt sein");
assert.match(html,/\.monster-season-week\.outcome-good\{[^}]*rgba\(34,201,138,\.135\)[^}]*border-color[^}]*box-shadow:inset 4px/,
  "Ein Vorsaison-Sieg braucht eine deutlich erkennbare grüne Fläche, Kontur und Statuskante");
assert.match(html,/\.monster-season-week\.outcome-bad\{[^}]*rgba\(255,89,104,\.125\)[^}]*border-color[^}]*box-shadow:inset 4px/,
  "Eine Vorsaison-Niederlage braucht eine deutlich erkennbare rote Fläche, Kontur und Statuskante");
assert.doesNotMatch(journeyMarkup,/Pirates \+1|Wolves \+1|Heim-Tie/,
  "Die Detailfelder dürfen oben rechts keinen zusätzlichen Punktgewinner mehr ausschreiben");
assert.equal((journeyMarkup.match(/monster-season-category"/g)||[]).length,8,
  "Aufgeklappt muss eine Woche genau acht Kategorievergleiche enthalten");
assert.doesNotMatch(journeyMarkup,/<details[^>]*\sopen(?:\s|>)/,
  "Alle 18 Wochen bleiben für eine kompakte Übersicht zunächst eingeklappt");
const pgMonsterSource=functionSource("pgMonster");
const pickupCardIndex=pgMonsterSource.indexOf("${pickupCard}"),seasonSimulatorIndex=pgMonsterSource.indexOf("${monsterSeasonProjectionMarkup()}");
assert.ok(pickupCardIndex>=0&&seasonSimulatorIndex>pickupCardIndex,
  "Das Pickup Impact Lab muss vor dem Season Simulator erscheinen");
assert.match(pgMonsterSource,/monsterSimulatorMarkup\(analysisTeam,comparisonTeam,analysisForecast,analysisSimulation\)/,
  "Das Pickup Lab muss auch bei gedrehter Heim-/Auswärtsdarstellung auf das Analyse-Team rechnen");
assert.match(html,/volle Spielerverfügbarkeit; Rückkehrdaten werden nicht erfunden/,
  "Die Verfügbarkeitsannahme der Vorsaison-Simulation muss sichtbar sein");
assert.match(html,/Saison läuft – Endprognose wartet auf Ist \+ Restspiel-Modell; keine Werte werden simuliert\./,
  "Nach Saisonstart müssen alte Vorsaisonsergebnisse verborgen bleiben");
assert.match(functionSource("monsterSeasonProjectionFingerprint"),/lifecycle:/,
  "Der Lebenszyklus muss Teil des Projektions-Fingerprints sein");
assert.match(functionSource("monsterSeasonProjectionCalculate"),/seenNbaSignatures[\s\S]*has\(signature\)[\s\S]*denselben Termin[\s\S]*verschiedenen Event-IDs/,
  "Derselbe NBA-Termin darf unter zwei Event-IDs nicht doppelt in die Endtabelle eingehen");

const fakeSchedule=[
  {week:1,away:"Pirates",home:"Wolves",start:"2026-10-20",end:"2026-10-25"},
  {week:1,away:"Lions",home:"Bears",start:"2026-10-20",end:"2026-10-25"},
  {week:1,away:"Rhinos",home:"Eagles",start:"2026-10-20",end:"2026-10-25"},
  {week:1,away:"Unicorns",home:"Snipers",start:"2026-10-20",end:"2026-10-25"},
  {week:2,away:"Wolves",home:"Lions",start:"2026-10-26",end:"2026-11-01"},
  {week:2,away:"Pirates",home:"Bears",start:"2026-10-26",end:"2026-11-01"},
  {week:2,away:"Rhinos",home:"Snipers",start:"2026-10-26",end:"2026-11-01"},
  {week:2,away:"Eagles",home:"Unicorns",start:"2026-10-26",end:"2026-11-01"}
];
const weeks=loadFunction("monsterWeeks",{
  monsterSchedule:()=>fakeSchedule,
  monsterFallbackWeekDates:week=>({start:`fallback-${week}`,end:`fallback-${week}`}),
  Map
})();
assert.equal(weeks.length,2,"Acht Matchups aus zwei Wochen müssen genau zwei Wochenoptionen ergeben");
assert.deepEqual(JSON.parse(JSON.stringify(weeks.map(row=>row.week))),[1,2]);

const scheduledOpponent=loadFunction("monsterScheduledOpponent",{monsterSchedule:()=>fakeSchedule});
assert.equal(scheduledOpponent("Wolves",1),"Pirates");
assert.equal(scheduledOpponent("Wolves",2),"Lions");

const displayMatchup=loadFunction("monsterDisplayMatchupTeams",{monsterSchedule:()=>fakeSchedule});
assert.deepEqual(JSON.parse(JSON.stringify(displayMatchup("Wolves","Pirates",1))),
  {away:"Pirates",home:"Wolves",analysisSide:"right"},
  "Ein als Heimteam angesetztes Analyse-Team muss rechts erscheinen");
assert.deepEqual(JSON.parse(JSON.stringify(displayMatchup("Wolves","Eagles",1))),
  {away:"Eagles",home:"Wolves",analysisSide:"right"},
  "Auch freie Vergleiche müssen die reale Heimseite des Analyse-Teams erhalten");
assert.deepEqual(JSON.parse(JSON.stringify(displayMatchup("Wolves","Lions",2))),
  {away:"Wolves",home:"Lions",analysisSide:"left"},
  "Ein als Auswärtsteam angesetztes Analyse-Team muss links erscheinen");

const swapForecast=loadFunction("monsterSwapForecastSides",{Object});
const swapped=swapForecast({a:{team:"Wolves"},b:{team:"Pirates"},aExpected:5.5,bExpected:2.5,cats:[{cat:"PTS",a:120,b:100,p:.7}]});
assert.equal(swapped.a.team,"Pirates");
assert.equal(swapped.b.team,"Wolves");
assert.equal(swapped.aExpected,2.5);
assert.equal(swapped.bExpected,5.5);
assert.ok(Math.abs(swapped.cats[0].p-.3)<1e-12,"Beim Seitenwechsel muss auch die linke Gewinnwahrscheinlichkeit gespiegelt werden");

const pointRowsMarkup=loadFunction("monsterPointRowsMarkup",{
  T:team=>({s:team,c:team==="Pirates"?"#7657ef":"#b21f35"}),
  E:value=>String(value),
  formatDraftValue:(cat,value)=>String(value),
  monsterImpactClass:value=>value>.004?"good":value<-.004?"bad":"neutral",
  Math
});
const rightSidePickup=pointRowsMarkup(
  {cats:[{cat:"PTS",a:100,b:80,p:.6}]},"Pirates","Wolves",
  {analysisSide:"right",after:{cats:[{cat:"PTS",a:100,b:95,p:.4}]}}
);
assert.match(rightSidePickup,/40% → 60%/,
  "Bei einem Heimteam-Pickup muss der Vorher-/Nachher-Prozentwert aus Sicht der rechten Analyseseite laufen");
assert.match(rightSidePickup,/\+20 Pp\./);
assert.match(rightSidePickup,/100<\/strong><small>unverändert/,
  "Der linke Vergleichsgegner muss bei einem Pickup des rechten Analyse-Teams unverändert bleiben");
assert.match(rightSidePickup,/95<\/strong><small>vorher 80/,
  "Der neue Wert des rechten Analyse-Teams muss seinen eigenen Vorher-Wert zeigen");

const requestState={data:null,dataWeek:null,loading:false,error:null,week:1,requestSeq:0,activeRequest:0,queuedWeek:null,queuedForce:false,queuedFullSync:false};
const requestCalls=[],requestResolvers=[];
const loadMonsterData=loadAsyncFunction("loadMonsterData",{
  MONSTER_STATE:requestState,
  monsterToken:()=>"device-token",
  openMonsterGate:()=>assert.fail("Ein vorhandenes Gerätetoken darf nicht zum Gate führen"),
  monsterJsonp:params=>{requestCalls.push(params);return new Promise(resolve=>requestResolvers.push(resolve))},
  monsterEnsureTeams:()=>{},
  localStorage:{removeItem:()=>{}},
  CUR:"monster",
  render:()=>{}
});
const firstRequest=loadMonsterData(true);
assert.equal(requestCalls.length,1);
assert.equal(requestCalls[0].week,1);
requestState.week=2;
await loadMonsterData(true);
assert.equal(requestState.queuedWeek,2,"Während W1 lädt, muss W2 vorgemerkt werden");
requestResolvers[0]({ok:true,marker:"alte-woche",nbaSchedule:{matchupWeek:1}});
for(let turn=0;turn<3&&requestCalls.length<2;turn++)await new Promise(resolve=>setImmediate(resolve));
assert.equal(requestCalls.length,2,"Nach der alten Antwort muss automatisch der vorgemerkte W2-Abruf starten");
assert.equal(requestCalls[1].week,2);
assert.notEqual(requestState.data&&requestState.data.marker,"alte-woche","Die verspätete W1-Antwort darf im W2-Zustand nie autoritativ werden");
requestResolvers[1]({ok:true,marker:"neue-woche",nbaSchedule:{matchupWeek:2}});
await firstRequest;
assert.equal(requestState.data.marker,"neue-woche");
assert.equal(requestState.dataWeek,2);

const fullSyncState={data:null,dataWeek:null,loading:false,error:null,week:1,requestSeq:0,activeRequest:0,queuedWeek:null,queuedForce:false,queuedFullSync:false};
const fullSyncEvents=[];
const fullSyncLoad=loadAsyncFunction("loadMonsterData",{
  MONSTER_STATE:fullSyncState,
  monsterToken:()=>"device-token",
  openMonsterGate:()=>assert.fail("Ein vorhandenes Gerätetoken darf nicht zum Gate führen"),
  requestFullEspnRefresh:async()=>{fullSyncEvents.push("full-sync");return {ok:true,fullSync:true}},
  monsterJsonp:async params=>{fullSyncEvents.push({request:params});return {ok:true,marker:"Chris hat neuen Spieler",roster:[{team:"Chris",playerId:"new-player"}],nbaSchedule:{matchupWeek:1}}},
  monsterEnsureTeams:()=>{},
  localStorage:{removeItem:()=>{}},
  CUR:"monster",
  render:()=>{}
});
await fullSyncLoad(true,true);
assert.equal(fullSyncEvents[0],"full-sync","Der ESPN-Vollsync muss vor dem neuen Monster-Payload abgeschlossen sein");
assert.deepEqual(JSON.parse(JSON.stringify(fullSyncEvents[1])),{request:{monster:"data",token:"device-token",week:1}},
  "Nach bestätigtem Vollsync wird der Payload ohne zweiten Schedule-Fetch gelesen");
assert.equal(fullSyncState.data.roster[0].playerId,"new-player","Ein gerade getätigter Roster Move muss sofort Berechnungsgrundlage werden");
assert.match(functionSource("refreshMonsterLive"),/loadMonsterData\(true,true\)/,
  "Live neu laden muss den vollständigen ESPN-Sync anfordern");
assert.match(functionSource("requestFullEspnRefresh"),/monsterToken\(\)[\s\S]*monster:"refresh"[\s\S]*token/,
  "Der Vollsync muss über den geschützten Geräte-Token laufen");

const stats={PTS:10,REB:5,AST:4,"3PM":2,STL:1,BLK:1,FGM:4,FGA:8,FTM:2,FTA:3};
const makeWeekRoster=(prefix,nba)=>Array.from({length:13},(_,index)=>Object.assign({name:`${prefix} ${index+1}`,nba,projectionReady:true},stats));
const basisState={week:1,teamA:"Wolves",teamB:"Pirates"};
const projectionBasisIssue=loadFunction("monsterProjectionBasisIssue",{
  MONSTER_STATE:basisState,
  monsterScheduledWeekGames:nba=>nba.games||[],
  monsterNbaKey:value=>String(value||"").toUpperCase().replace(/[^A-Z]/g,""),
  Map
});
const wolves=makeWeekRoster("Wolf","SAS"),pirates=makeWeekRoster("Pirate","LAL"),completeWeek={matchupWeek:1,games:[{teams:["SAS","OKC"],status:"SCHEDULED"},{teams:["LAL","DEN"],status:"SCHEDULED"}]};
assert.equal(projectionBasisIssue(completeWeek,wolves,pirates),"");
const missingPlayerSchedule=pirates.map((player,index)=>index?player:Object.assign({},player,{nba:"ATL"}));
assert.match(projectionBasisIssue(completeWeek,wolves,missingPlayerSchedule),/Kein bekannter verbleibender ESPN-Termin.*ATL/);
const unrelatedWeek={matchupWeek:1,games:[{teams:["BOS","MIA"],status:"SCHEDULED"}]};
assert.match(projectionBasisIssue(unrelatedWeek,wolves,pirates),/Keine verbleibenden NBA-Spiele.*Wolves.*Pirates/);

const lifecycle=(value,livePhase="PRESEASON")=>loadFunction("monsterSeasonProjectionLifecycle",{
  MONSTER_STATE:{data:value},
  PHASE_SNAPSHOT_CONFIG:{phase:"PRESEASON",effectivePhase:"PRESEASON"},
  activePhase:()=>livePhase
})();
assert.equal(lifecycle({phase:"PRESEASON",nbaSeasonSchedule:{games:[{status:"SCHEDULED"}]}}).allowed,true);
assert.equal(lifecycle({phase:"DRAFT",nbaSeasonSchedule:{games:[{status:"STATUS_IN_PROGRESS"}]}}).allowed,false);
assert.equal(lifecycle({phase:"REGULAR_SEASON",nbaSeasonSchedule:{games:[{status:"SCHEDULED"}]}}).allowed,false);
assert.equal(lifecycle({nbaSeasonSchedule:{games:[{status:"SCHEDULED"}]}},"REGULAR_SEASON").allowed,false,
  "D.appConfig über activePhase muss die Vorsaison-Simulation nach dem Saisonstart blockieren");
const blockedProjectionMarkup=loadFunction("monsterSeasonProjectionMarkup",{
  monsterSeasonProjectionLifecycle:()=>({phase:"REGULAR_SEASON",seasonRunning:true,allowed:false}),
  MONSTER_SEASON_PROJECTION_STATE:{status:"ready",result:{secret:"darf nicht erscheinen"},error:"",fingerprint:"same"},
  monsterSeasonProjectionFingerprint:()=>"same",
  MONSTER_SEASON_MODEL:"Testmodell",
  E:value=>String(value)
})();
assert.match(blockedProjectionMarkup,/Saison läuft – Endprognose wartet auf Ist \+ Restspiel-Modell/);
assert.doesNotMatch(blockedProjectionMarkup,/Jetzt durchrechnen|Neu durchrechnen|darf nicht erscheinen/,
  "Ein altes Vorsaison-Ergebnis und seine Buttons müssen nach dem Saisonstart verborgen bleiben");

const b2bGroups=loadFunction("monsterB2bGroups",{monsterNbaKey:value=>String(value).toUpperCase(),Map});
const groups=b2bGroups([
  {team:"ATL",first:"2026-10-23",second:"2026-10-24",crossWeek:false},
  {team:"BKN",first:"2026-10-23",second:"2026-10-24",crossWeek:false},
  {team:"LAL",first:"2026-10-25",second:"2026-10-26",crossWeek:true}
]);
assert.equal(groups.length,2,"NBA-Teams mit demselben Tagespaar gehören in ein gemeinsames B2B-Feld");
assert.deepEqual(JSON.parse(JSON.stringify(groups[0].teams)),["ATL","BKN"]);
assert.equal(groups[1].crossWeek,true,"Sonntag-zu-Montag muss als Lookahead erhalten bleiben");

const b2bPoints=["PTS","REB","AST","3PM","STL","BLK","FG%","FT%"],b2bProfiles=new Map([
  ["edey",{overall:8,overallRank:20,z:{BLK:2,"3PM":0}}],
  ["turner",{overall:10,overallRank:15,z:{BLK:1.5,"3PM":1.5}}]
]);
const b2bContribution=loadFunction("monsterB2bContribution",{
  draftValueModel:()=>({byId:b2bProfiles}),monsterAvailability:()=>1,DRAFT_CATS:b2bPoints,de:(value,digits)=>Number(value).toFixed(digits).replace(".",","),Array,Number,Math
});
const edeyCombo=b2bContribution({id:"edey",BLK:2,"3PM":0},["3PM","BLK"]),turnerCombo=b2bContribution({id:"turner",BLK:1.5,"3PM":1.5},["3PM","BLK"]);
assert.equal(edeyCombo.value,2,"2,0 BLK-z und 0,0 3PM-z müssen über zwei B2B-Spiele den Wert 2 ergeben");
assert.equal(turnerCombo.value,3,"Zwei gleichmäßig starke FBA-Punkte müssen den Spezialisten im Kombi-Ranking schlagen");
assert.ok(turnerCombo.value>edeyCombo.value);
assert.match(edeyCombo.label,/\+1,0 z Ø/);

const impactClass=loadFunction("monsterImpactClass");
assert.equal(impactClass(.08),"good");
assert.equal(impactClass(-.08),"bad");
assert.equal(impactClass(0),"neutral");

const pointNames=["PTS","REB","AST","3PM","STL","BLK","FG%","FT%"];
const baseForecast={cats:pointNames.map(cat=>({cat,a:10,b:10,p:.5}))};
const afterForecast={cats:pointNames.map((cat,index)=>({cat,a:10+index,b:10,p:index%2?.42:.58}))};
const pointMarkup=loadFunction("monsterPointRowsMarkup",{
  T:team=>({c:team==="Wolves"?"#7b2234":"#623c94",s:team}),
  E:value=>String(value),
  formatDraftValue:(_cat,value)=>String(value),
  monsterImpactClass:impactClass,
  Math
})(baseForecast,"Wolves","Pirates",{after:afterForecast});
assert.equal((pointMarkup.match(/monster-point-impact /g)||[]).length,8,
  "Ein Pickup-Szenario muss für alle acht FBA-Punkte einen Vorher-Nachher-Hinweis rendern");
assert.match(pointMarkup,/50% → 58%/);
assert.match(pointMarkup,/50% → 42%/);
assert.match(pointMarkup,/monster-point-impact good/);
assert.match(pointMarkup,/monster-point-impact bad/);

assert.match(html,/FantasyPros[^\n]+Adapter[^\n]+false|FantasyPros API vorbereitet/,
  "FantasyPros darf weiterhin nur als vorbereitete Quelle erscheinen");
assert.match(html,/Hashtag[^\n]+Adapter[^\n]+false|Hashtag Export vorbereitet/,
  "Hashtag darf weiterhin nur als vorbereitete Quelle erscheinen");

assert.match(functionSource("hardReloadApp"),/caches\.keys\(\)[\s\S]*caches\.delete/,
  "Hard Reset muss Cache Storage leeren");
assert.match(functionSource("hardReloadApp"),/serviceWorker\.getRegistrations\(\)[\s\S]*registration\.unregister/,
  "Hard Reset muss eventuell aktive Service Worker entfernen");
assert.match(functionSource("hardReloadApp"),/await requestFullEspnRefresh\(\)[\s\S]*clearAnalyticsCache\(\)[\s\S]*caches\.keys\(\)/,
  "Hard Reset muss den ESPN-Vollsync bestätigen, bevor lokale Daten gelöscht und neu geladen werden");
assert.match(functionSource("hardReloadApp"),/Live-Reset abgebrochen:[\s\S]*return/,
  "Bei einem fehlgeschlagenen Vollsync muss der Reset abbrechen und den letzten bestätigten Stand behalten");
assert.match(functionSource("hardReloadApp"),/MONSTER_FORCE_REFRESH_KEY[\s\S]*_fba_refresh[\s\S]*location\.replace/,
  "Hard Reset muss öffentliche und geschützte Live-Daten mit Cachebuster neu laden");
assert.match(functionSource("openMonsterGate"),/consumeMonsterForceRefresh\(\)/,
  "Nach dem Hard Reset muss der nächste Monster-Aufruf den Backend-Cache umgehen");

console.log("PASS · Matchup Monster v39 frontend regression tests");
