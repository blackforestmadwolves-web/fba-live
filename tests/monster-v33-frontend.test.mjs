import assert from "node:assert/strict";
// v43 regression suite: Monster, ROS Free Agency, live ADP, responsive layout and pickup tools.
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
assert.match(manifest.start_url,/war-room-monster-v50-20260905/);
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

// Maik-Value arithmetic has its own suite. These isolated render/loader tests
// retain controlled presentation dependencies while exercising their original
// behavior and the same shared VM context (especially navigation and preload).
const maikUiStubs={
  maikValueMarkup:()=>'<span class="maik-value">Maik-Value –</span>',
  maikValueText:()=>"Maik-Value –",
  maikValueDetailsMarkup:()=>"",
  maikValueSettingsMarkup:()=>"",
  maikValueFor:player=>({id:String(player&&player.id||""),history:null,current:null,primary:null}),
  resetMaikValueContext:()=>{}
};
function addMaikUiStubs(context){
  for(const [name,stub] of Object.entries(maikUiStubs)){
    if(!Object.prototype.hasOwnProperty.call(context,name))context[name]=stub;
  }
  return context;
}
function loadFunction(name,context={}){
  addMaikUiStubs(context);
  return vm.runInNewContext(`(${functionSource(name)})`,context,{filename:`${name}.js`});
}
function loadAsyncFunction(name,context={}){
  addMaikUiStubs(context);
  return vm.runInNewContext(`(async ${functionSource(name)})`,context,{filename:`${name}.js`});
}

assert.match(html,/war-room-monster-v50-20260905/,"Vorbereiteter Build muss v50 ausweisen");
assert.match(html,/\["monster","Monster",pgMonster\],[\s\S]*\["freeagency","Free Agency",pgFreeAgency\],[\s\S]*\["pr","Power Ranking",pgPR\]/,
  "Free Agency muss als geschützte Seite direkt hinter Monster stehen");
assert.match(functionSource("monsterPrivatePage"),/key==="monster"\|\|key==="freeagency"/,
  "Monster und Free Agency müssen denselben privaten Gerätezugang verwenden");
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
assert.doesNotMatch(functionSource("monsterB2bMarkup"),/setMonsterB2bTeam/,
  "Im geschlossenen B2B-Feld dürfen Teamkürzel noch keine eigene Filteraktion auslösen");
assert.match(functionSource("monsterB2bPlayersMarkup"),/monster-b2b-team-filter[\s\S]*setMonsterB2bTeam/,
  "Erst das geöffnete B2B-Feld muss anklickbare NBA-Teamfilter erhalten");
assert.match(functionSource("toggleMonsterB2b"),/b2bTeam=""/,
  "Der erste Klick öffnet das Fenster und startet ohne alten Teamfilter");
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
assert.match(html,/\.monster-b2b-player\{[^}]*grid-template-columns:88px minmax\(0,1fr\) 90px[^}]*min-height:104px[^}]*overflow:hidden/,
  "B2B-Spielerkarten müssen dem Namen und der festen Rangspalte kontrolliert Platz geben");
assert.match(html,/\.monster-b2b-player-art img\{[^}]*left:-22px[^}]*width:142px[^}]*height:104px[^}]*object-fit:contain[^}]*drop-shadow/,
  "Die großen Spielerbilder müssen unverändert hoch bleiben und mit angeschnittener linker Schulter nach links rücken");
assert.match(html,/\.monster-b2b-player-copy\{[^}]*z-index:3[^}]*padding-left:6px[\s\S]*\.monster-b2b-player-copy>b\{[^}]*white-space:normal[^}]*-webkit-line-clamp:2/,
  "Der gewonnene Platz muss Spielernamen über maximal zwei Zeilen zugutekommen");
assert.match(functionSource("monsterPlayer"),/espnFantasyPositions[\s\S]*positionMap\[id\][\s\S]*fantasyPositions/,
  "Auch freie Spieler müssen ihre ligaabhängigen ESPN-Positionen aus dem vollständigen Spielerpool erhalten");
assert.match(functionSource("monsterB2bPlayersMarkup"),/<b title="\$\{E\(player\.name\)\}">\$\{E\(player\.name\)\}<\/b>[\s\S]*monster-b2b-player-meta[\s\S]*player\.nba[\s\S]*position[\s\S]*vs\.[\s\S]*monster-b2b-player-value[\s\S]*monster-b2b-player-rank[\s\S]*ESPN #[\s\S]*value\.label[\s\S]*monster-b2b-player-detail[\s\S]*detailParts/,
  "Name und Gegner müssen links stehen; ESPN-Rang, FBA-Wert und getrennte Detailzeilen rechts");
const espnPositionLabel=loadFunction("monsterEspnFantasyPositionLabel",{Set});
assert.equal(espnPositionLabel({fantasyPositions:"SG,PG,UTIL,BE"}),"PG, SG",
  "ESPN-Mehrfachberechtigungen müssen in fester Basketball-Reihenfolge erscheinen; Flex und Bank bleiben draußen");
assert.equal(espnPositionLabel({fantasyPositions:"4,7,8"}),"ESPN-Sync",
  "Historische numerische Slotwerte dürfen nicht als vermeintlich exakte ESPN-Position ausgegeben werden");
assert.doesNotMatch(html,/ESPN-Position offen/,
  "Die Oberfläche darf keinen falschen offenen Positionsstatus mehr anzeigen");

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

assert.match(html,/<h2>Season Simulation<\/h2>/,"Die Conference-Rechnung muss Season Simulation heißen");
assert.match(html,/<h2>Matchup Projection<\/h2>/,"Die Matchup-Karte muss Matchup Projection heißen");
assert.doesNotMatch(html,/>Meta Projection</);
assert.match(html,/monster-projection-stage[\s\S]*Erwartete FBA-Punkte/,
  "Matchup Projection muss die ruhige Broadcast-Struktur mit allen Werten behalten");
assert.doesNotMatch(html,/Wahrscheinlichstes Szenario|Ein Balance-Balken je FBA-Punkt/,
  "Doppelte Meta-Erklärungen müssen aus der kompakten Ansicht entfernt sein");
assert.match(functionSource("pgMonster"),/monster-projection-score[\s\S]*<i>:<\/i>/,
  "Der neue Matchup-Score trennt beide Teams neutral mit einem Doppelpunkt");
assert.match(functionSource("pgMonster"),/monster-projection-team home[\s\S]*monster-projection-team-main">\$\{chip\(rightTeam\)\}<span><b>\$\{E\(T\(rightTeam\)\.s\|\|rightTeam\)\}<\/b>/,
  "Das Heimteam muss wie das Auswärtsteam mit Logo vor Name und GP aufgebaut sein");
assert.doesNotMatch(functionSource("monsterPointRowsMarkup"),/T\(teamA\)\.c|T\(teamB\)\.c|--monster-left|--monster-right/,
  "Matchup-Balken dürfen keine Teamfarben mehr aus dem Teamprofil übernehmen");
assert.match(functionSource("pgMonster"),/monsterPointRowsMarkup\(forecast,leftTeam,rightTeam,simulation,analysisTeam\)/,
  "Die einzelne Siegchance muss auch ohne Pickup das gewählte Analyse-Team berücksichtigen");
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
assert.match(html,/\.monster-season-week\.outcome-tie\{[^}]*rgba\(255,255,255/,
  "Ein Remis muss neutral weiß statt gelb erscheinen");
assert.match(html,/\.monster-season-outcome\.tie\{[^}]*color:#eef2f8/,
  "Auch das Remis-Label muss neutral bleiben");
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
assert.match(functionSource("monsterSimulatorMarkup"),/<option value="">Free Agent wählen …<\/option>/,
  "Das Pickup-Feld muss kurz Free Agent wählen heißen");
assert.match(pgMonsterSource,/monsterSimulatorMarkup\(analysisTeam,comparisonTeam,analysisForecast,analysisSimulation\)/,
  "Das Pickup Lab muss auch bei gedrehter Heim-/Auswärtsdarstellung auf das Analyse-Team rechnen");
assert.match(html,/volle Spielerverfügbarkeit; Rückkehrdaten werden nicht erfunden/,
  "Die Verfügbarkeitsannahme der Season Simulation muss sichtbar sein");
const seasonMarkupSource=functionSource("monsterSeasonProjectionMarkup"),seasonReadyReturn=seasonMarkupSource.lastIndexOf("return `<section");
assert.ok(seasonMarkupSource.indexOf("${info(coverage)}",seasonReadyReturn)>seasonMarkupSource.indexOf("${monsterSeasonJourneyMarkup",seasonReadyReturn),
  "Modellhinweise müssen in der fertigen Season Simulation ganz unten stehen");
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

const chanceIndicator=loadFunction("monsterChanceIndicator",{Math,Number});
const pointRowsMarkup=loadFunction("monsterPointRowsMarkup",{
  monsterChanceIndicator:chanceIndicator,
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
assert.match(rightSidePickup,/monster-balance-track lean-right/,
  "Bei einem führenden Heim-Analyse-Team wächst der Balken von der Mitte nach rechts");
assert.match(rightSidePickup,/monster-chance good/);
assert.match(rightSidePickup,/monster-chance-value[^>]*data-percent="60"[^>]*>60%/);
assert.doesNotMatch(rightSidePickup,/monster-balance-percent/);

// v48: probabilities keep their meaning; color is relative to the analyst's
// team, while the center-out bar points toward the favorite's physical side.
const chanceCases=[
  [.51,"left",51,"good","left",49,1],
  [.49,"left",49,"bad","right",50,1],
  [.58,"left",58,"good","left",42,8],
  [.42,"right",58,"good","right",50,8],
  [.58,"right",42,"bad","left",42,8],
  [.42,"left",42,"bad","right",50,8],
  [.5,"left",50,"neutral","center",50,0],
  [.5,"right",50,"neutral","center",50,0],
  [.499,"left",50,"neutral","center",50,0],
  [0,"left",0,"bad","right",50,50],
  [1,"left",100,"good","left",0,50]
];
for(const [p,side,percent,tone,direction,start,width] of chanceCases){
  assert.deepEqual(JSON.parse(JSON.stringify(chanceIndicator(p,side))),{percent,tone,direction,start,width});
}
for(const invalid of [null,undefined,NaN,Infinity,-.1,1.1,"0.6"]){
  const indicator=chanceIndicator(invalid,"left");
  assert.equal(indicator.percent,null,"Ungültige Wahrscheinlichkeiten dürfen keine erfundenen 50 Prozent erzeugen");
  assert.equal(indicator.width,0);
}
for(const p of [.04,.495,.505,.58,.955,.96]){
  assert.equal(chanceIndicator(p,"left").percent,chanceIndicator(1-p,"right").percent,
    "Heim/Auswärts darf die gerundete eigene Siegchance nicht verändern");
}
const ownChanceForecast={cats:[{cat:"PTS",a:100,b:95,p:.42}]};
const ownChanceBefore=JSON.stringify(ownChanceForecast);
const rightChanceWithoutPickup=pointRowsMarkup(ownChanceForecast,"Pirates","Wolves",null,"Wolves");
assert.match(rightChanceWithoutPickup,/Siegchance für <b>Wolves<\/b>/);
assert.match(rightChanceWithoutPickup,/58 Prozent Siegchance für Wolves/);
assert.match(rightChanceWithoutPickup,/monster-chance good/);
assert.match(rightChanceWithoutPickup,/--monster-lead-start:50%;--monster-lead-width:8%/);
assert.equal((rightChanceWithoutPickup.match(/class="monster-chance-value"/g)||[]).length,1);
assert.match(rightChanceWithoutPickup,/>100<\/strong>/);assert.match(rightChanceWithoutPickup,/>95<\/strong>/);
assert.equal(JSON.stringify(ownChanceForecast),ownChanceBefore,"Darstellung verändert keine Prognose-Eingaben");
const switchedChance=pointRowsMarkup(ownChanceForecast,"Pirates","Wolves",null,"Pirates");
assert.match(switchedChance,/42 Prozent Siegchance für Pirates/);
assert.match(switchedChance,/monster-chance bad/);
assert.match(switchedChance,/monster-balance-track lean-right/);
const evenChance=pointRowsMarkup({cats:[{cat:"PTS",a:100,b:100,p:.5}]},"Pirates","Wolves",null,"Wolves");
assert.match(evenChance,/monster-chance neutral/);assert.match(evenChance,/>50%<\/strong>/);
assert.match(evenChance,/--monster-lead-width:0%/);
const missingChance=pointRowsMarkup({cats:[{cat:"PTS",a:100,b:95,p:null}]},"Pirates","Wolves",null,"Wolves");
assert.match(missingChance,/Siegchance für Wolves nicht verfügbar/);assert.doesNotMatch(missingChance,/>50%<\/strong>/);

const requestState={data:null,dataWeek:null,loading:false,error:null,week:1,requestSeq:0,activeRequest:0,queuedWeek:null,queuedForce:false,queuedFullSync:false};
const requestCalls=[],requestResolvers=[];
const loadMonsterData=loadAsyncFunction("loadMonsterData",{
  MONSTER_STATE:requestState,
  monsterToken:()=>"device-token",
  openMonsterGate:()=>assert.fail("Ein vorhandenes Gerätetoken darf nicht zum Gate führen"),
  monsterJsonp:params=>{requestCalls.push(params);return new Promise(resolve=>requestResolvers.push(resolve))},
  monsterEnsureTeams:()=>{},
  monsterPrivatePage:()=>true,
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
  monsterPrivatePage:()=>true,
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
  "D.appConfig über activePhase muss einen unvollständigen In-Season-Stand blockieren");
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
  monsterChanceIndicator:chanceIndicator,
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

assert.match(functionSource("freeAgencyZones"),/Hot Zone[\s\S]*Maik-Value[\s\S]*Upside/,
  "Free Agency muss die Hot Zone nach dem Maik-Value benennen und Upside behalten");
assert.doesNotMatch(functionSource("freeAgencyZones"),/B2B Edge|Wochen-Impact/,
  "Das allgemeine Free-Agent-Board darf keinen B2B- oder Wochenfokus mehr haben");
assert.match(functionSource("pgFreeAgency"),/Free-Agent Board/,
  "Free Agency braucht das lange Spieler-Board");
assert.match(functionSource("pgFreeAgency"),/ESPN-Position[\s\S]*NBA-Team[\s\S]*Sortierung/,
  "Die 100er-Liste muss nach ESPN-Position und NBA-Team filter- sowie mehrfach sortierbar sein");
assert.match(functionSource("pgFreeAgency"),/fa-card-list[\s\S]*Rest-of-Season-Projektionen/,
  "Das Board muss als lesbare ROS-Kartenliste statt als breite Mobil-Tabelle rendern");
assert.doesNotMatch(functionSource("pgFreeAgency"),/Rest-GP|<th>B2B<\/th>|Live-Fenster/,
  "Rest-GP, B2B und aktuelles Wochenfenster gehören nicht ins allgemeine Free-Agent-Scouting");
assert.match(html,/\.fa-player-art img\{[^}]*width:104px[\s\S]*\.fa-stat b\{[^}]*font-size:15px/,
  "Spielerbilder und Projektionszahlen müssen auf dem Free-Agent-Board deutlich lesbar sein");
assert.match(html,/\.fa-card-details\{[^}]*grid-template-rows:0fr[\s\S]*\.fa-player-card\.open \.fa-card-details\{[^}]*grid-template-rows:1fr/,
  "Die ROS-Stats müssen platzsparend einklappen und weich aufklappen können");
assert.match(functionSource("freeAgencyRows"),/owned\.has\(String\(row\.player\.id\)\)/,
  "Aktuell gerosterte Spieler dürfen nie in der Free-Agency-Liste erscheinen");
assert.match(functionSource("freeAgencyFilteredRows"),/slice\(0,100\)/,
  "Das Free-Agent Board muss hart auf 100 Spieler begrenzt sein");
const projectionStats=["PTS","REB","AST","3PM","STL","BLK","FGM","FGA","FTM","FTA"];
const rosBase={PTS:25,REB:12,AST:4,"3PM":2,STL:1,BLK:3,FGM:9,FGA:18,FTM:5,FTA:6};
const rosActual={PTS:10,REB:10,AST:2,"3PM":1,STL:1,BLK:2,FGM:4,FGA:15,FTM:1,FTA:2};
const rosRecord={id:"wemby",projectedGp:70,base:rosBase,actual:{gp:1,totals:rosActual}};
const seasonFinish=loadFunction("monsterProjectionSeasonFinish",{
  monsterProjectionRecordIssue:()=>"",monsterProjectionBase:record=>record.base,MONSTER_PROJECTION_STATS:projectionStats,Number,Math
});
const rosProjection=loadFunction("freeAgencyRosProjection",{
  monsterProjectionEngineState:()=>({ready:true,engine:{}}),MONSTER_STATE:{data:{}},monsterProjectionPlayerRecord:()=>rosRecord,
  monsterProjectionRecordIssue:()=>"",monsterProjectionSeasonFinish:seasonFinish,MONSTER_PROJECTION_STATS:projectionStats,Number
})({id:"wemby"},{ready:true,engine:{}});
assert.equal(rosProjection.actualGp,1);
assert.equal(rosProjection.remainingGp,69);
assert.equal(rosProjection.totals.PTS,1735);
assert.ok(Math.abs(rosProjection.perGame.PTS-24.785714285714285)<1e-12,
  "Das Free-Agent-Board muss 10 Ist-Punkte plus 69 mal 25 Projection exakt als 24,785714 ROS ausgeben");
assert.ok(Math.abs(rosProjection.perGame["FG%"]-(4+69*9)/(15+69*18))<1e-12,
  "ROS-FG% muss aus summierten Treffern und Versuchen entstehen");
const relevantStatus=loadFunction("freeAgencyInjuryStatus",{String});
assert.equal(relevantStatus({injuryStatus:"ACTIVE"}),"","Gesunde Spieler dürfen kein ACTIVE-Label bekommen");
assert.equal(relevantStatus({injuryStatus:"DAY_TO_DAY"}),"DTD");
assert.equal(relevantStatus({injuryStatus:"OUT"}),"OUT");
const freeAgencyCardState={openIds:new Set()};
const renderFreeAgentCard=loadFunction("freeAgencyPlayerRow",{
  freeAgencyConsensusMarkup:loadFunction("freeAgencyConsensusMarkup",{E:value=>String(value),de:(value,digits)=>Number(value).toFixed(digits),Number,Array}),
  freeAgencyInjuryStatus:relevantStatus,draftNormalize:value=>String(value||"").toLowerCase(),de:(value,digits)=>Number(value).toFixed(digits).replace(".",","),
  DRAFT_CATS:["PTS","REB","AST","3PM","STL","BLK","FG%","FT%"],freeAgencyProjectionValue:(cat,value)=>cat.includes("%")?`${(value*100).toFixed(1)}%`:Number(value).toFixed(1),
  freeAgencyZ:value=>`${value} z`,freeAgencySigned:value=>String(value),E:value=>String(value),espnPlayerHeadshot:id=>`photo-${id}`,imageFallbackAttr:()=>"",FREE_AGENCY_STATE:freeAgencyCardState,String,Number,Set
});
const freeAgentRow={player:{id:"kpj",name:"Kevin Porter Jr.",nba:"MIL",injuryStatus:"ACTIVE",photo:"kpj.png"},positions:"SG",espnRank:93.4,fbaRank:20,upside:73,profile:{best:"AST",worst:"FT%",z:{AST:1.2,"FT%":-1.1}},projection:{basis:"IST + REST",detail:"1 echtes Spiel · 69 ESPN-Projektionsspiele",perGame:{PTS:24.7857,REB:5,AST:6,"3PM":2,STL:1,BLK:.4,"FG%":.48,"FT%":.75}}};
const freeAgentCard=renderFreeAgentCard(freeAgentRow,0);
assert.equal((freeAgentCard.match(/class="fa-stat"/g)||[]).length,8,"Jede Karte muss alle acht großen ROS-Projektionen zeigen");
assert.equal((freeAgentCard.match(/MIL/g)||[]).length,1,"NBA-Team darf auf der Spielerkarte nicht doppelt erscheinen");
assert.match(freeAgentCard,/Kevin Porter Jr\.[\s\S]*MIL · SG/,
  "ESPN-Position muss direkt unter dem Spielernamen neben dem NBA-Team stehen");
assert.doesNotMatch(freeAgentCard,/ACTIVE|B2B|Rest-GP/,
  "Gesunde Spieler und Wochenfelder dürfen die ROS-Karte nicht vermüllen");
assert.match(freeAgentCard,/class="fa-card-head fa-card-toggle"[\s\S]*aria-expanded="false"[\s\S]*class="fa-card-details"[\s\S]*aria-hidden="true"/,
  "Eine Free-Agent-Karte muss standardmäßig kompakt und per kompletter Kopfzeile bedienbar sein");
freeAgencyCardState.openIds.add("kpj");
const openFreeAgentCard=renderFreeAgentCard(freeAgentRow,0);
assert.match(openFreeAgentCard,/class="fa-player-card open"[\s\S]*aria-expanded="true"[\s\S]*class="fa-card-details"[\s\S]*aria-hidden="false"/,
  "Der offene Zustand muss Filter- und Sortier-Renderings überstehen");
const toggleState={openIds:new Set()},cardClasses=new Set(),detailAttributes={},buttonAttributes={},toggleLabel={textContent:"Stats"};
const fakeCard={dataset:{playerId:"kpj"},classList:{contains:value=>cardClasses.has(value),toggle:(value,on)=>on?cardClasses.add(value):cardClasses.delete(value)},querySelector:selector=>selector===".fa-card-details"?{setAttribute:(key,value)=>detailAttributes[key]=value}:null};
const fakeButton={dataset:{playerName:"Kevin Porter Jr."},closest:selector=>selector===".fa-player-card"?fakeCard:null,querySelector:selector=>selector===".fa-card-expand span"?toggleLabel:null,setAttribute:(key,value)=>buttonAttributes[key]=value};
const toggleFreeAgentCard=loadFunction("toggleFreeAgencyCard",{FREE_AGENCY_STATE:toggleState,String,Set});
toggleFreeAgentCard(fakeButton);
assert.equal(cardClasses.has("open"),true);
assert.equal(toggleState.openIds.has("kpj"),true);
assert.equal(buttonAttributes["aria-expanded"],"true");
assert.equal(detailAttributes["aria-hidden"],"false");
assert.equal(toggleLabel.textContent,"Schließen");
toggleFreeAgentCard(fakeButton);
assert.equal(cardClasses.has("open"),false);
assert.equal(toggleState.openIds.has("kpj"),false);
assert.equal(buttonAttributes["aria-expanded"],"false");
assert.equal(detailAttributes["aria-hidden"],"true");
const freeAgencyFilterState={query:"",position:"ALL",nba:"ALL",sort:"maik"};
const filterFreeAgents=loadFunction("freeAgencyFilteredRows",{
  FREE_AGENCY_STATE:freeAgencyFilterState,
  maikValueFor:player=>({primary:player.maikScore==null?null:{value:player.maikScore}}),
  monsterNbaKey:value=>String(value||"").toUpperCase(),
  draftNormalize:value=>String(value||"").toLowerCase(),DRAFT_CATS:["PTS","REB","AST","3PM","STL","BLK","FG%","FT%"],
  String,Number
});
const filterRows=Array.from({length:130},(_,index)=>({fbaRank:index+1,espnRank:130-index,upside:index,positions:index%2?"PG, SG":"C",projection:{perGame:{PTS:index}},player:{name:`Player ${index+1}`,nba:index%3?"DAL":"ATL",maikScore:index}}));
assert.equal(filterFreeAgents(filterRows.slice()).length,100,"Auch ein großer ESPN-Pool darf maximal 100 Free Agents rendern");
assert.equal(filterFreeAgents(filterRows.slice())[0].player.name,"Player 130",
  "Maik-Sortierung muss den stärksten Maik-Value zuerst zeigen, unabhängig vom bisherigen FBA-Rang");
freeAgencyFilterState.sort="fba";
assert.equal(filterFreeAgents(filterRows.slice())[0].player.name,"Player 1",
  "Die ausdrücklich gewählte bisherige FBA-Sortierung muss erhalten bleiben");
freeAgencyFilterState.sort="maik";
freeAgencyFilterState.position="C";
assert.equal(filterFreeAgents(filterRows.slice()).length,65,"ESPN-Positionsfilter müssen Mehrfachberechtigungen exakt berücksichtigen");
freeAgencyFilterState.position="ALL";freeAgencyFilterState.nba="ATL";
assert.equal(filterFreeAgents(filterRows.slice()).every(row=>row.player.nba==="ATL"),true);

const adpTrendMarkup=loadFunction("draftAdpTrendMarkup",{E:value=>String(value),Number,Math});
assert.match(adpTrendMarkup({adpTrend:{ready:true,change:2.25}}),/up[\s\S]*▲ 2,3 Plätze/,
  "Ein besserer ESPN-ADP muss als grüne Aufwärtsbewegung erscheinen");
assert.match(adpTrendMarkup({adpTrend:{ready:true,change:-1.4}}),/down[\s\S]*▼ 1,4 Plätze/,
  "Ein schlechterer ESPN-ADP muss als Abwärtsbewegung erscheinen");
assert.match(adpTrendMarkup({}),/3T-Trend baut sich auf/,
  "Vor drei echten Vortagen darf kein erfundener ADP-Trend erscheinen");
assert.match(functionSource("draftRadarHome"),/ESPN-ADP täglich · 3T-Trend vs\. Ø der drei Vortage/,
  "Die Startseite muss die dynamische ADP-Berechnung transparent erklären");
assert.doesNotMatch(functionSource("draftRadarHome"),/Stand 03\.09/,
  "Der Draft Radar darf kein statisches Tages-Standbild mehr behaupten");

const draftRadarCueRules=[...html.matchAll(/\.draft-radar-open\s*\{([^}]+)\}/g)].map(match=>match[1]);
assert.ok(draftRadarCueRules.length,"Der Analyse-Hinweis braucht eine eigene Layout-Regel");
assert.match(draftRadarCueRules[0],/position:relative;/,
  "Analyse muss mit der Beschreibung mitfließen, damit mehrzeilige ADP-Hinweise keinen Text überlagern");
assert.match(draftRadarCueRules[0],/display:flex;[\s\S]*margin-top:10px;/,
  "Analyse muss eine eigene Zeile mit Abstand unter der Beschreibung bekommen");
for(const rule of draftRadarCueRules){
  assert.doesNotMatch(rule,/(?:position:(?:absolute|fixed)|(?:^|;)(?:top|right|bottom|left|inset):)/,
    "Auch mobile Regeln dürfen Analyse nicht wieder fest über dem Text positionieren");
}
assert.match(html,/\.draft-radar-summary\{[^}]*padding:17px 17px 32px;/,
  "Desktop-Karten müssen unter Analyse Platz für die Draft-Heat-Leiste lassen");
assert.match(html,/@media\(max-width:680px\)\{[\s\S]*?\.draft-radar-summary\{[^}]*padding:14px 14px 30px(?:;|\})/,
  "Mobile Karten müssen unter Analyse Platz für die Draft-Heat-Leiste lassen");
assert.match(html,/\.draft-radar-header\{[^}]*display:flex;[^}]*justify-content:space-between;/,
  "Rang und Kennzahlen müssen eine gemeinsame Kopfzeile im normalen Layout bilden");
for(const rule of [...html.matchAll(/\.draft-radar-score\s*\{([^}]+)\}/g)].map(match=>match[1])){
  assert.doesNotMatch(rule,/position:(?:absolute|fixed)|(?:^|;)(?:top|right|bottom|left|inset):/,
    "ADP und Maik-Value müssen auch mobil ihre volle Höhe vor dem Spielernamen reservieren");
}
assert.match(html,/\.draft-radar-score \.maik-value\{[^}]*justify-content:flex-end;text-align:right/,
  "Maik-Value muss unter ESPN ADP rechtsbündig stehen");
const renderDraftRadarCard=loadFunction("draftRadarCard",{
  E:value=>String(value),espnPlayerHeadshot:id=>`headshot-${id}.png`,imageFallbackAttr:()=>"",
  playerInitials:()=>"SG",draftAdpTrendMarkup:adpTrendMarkup,monsterEspnFantasyPositionLabel:espnPositionLabel,Number,Math,
  draftRadarAdpLabel:loadFunction("draftRadarAdpLabel",{Number}),DRAFT_RADAR_EDITORIAL:[],monsterB2bDate:value=>value
});
for(const adpTrend of [undefined,{ready:true,change:2.25}]){
  const reason="Elite-Scoring und Effizienz ohne echte Schwäche im FBA-Profil. Auch längere Beschreibungen brauchen Platz.";
  const card=renderDraftRadarCard({id:"sga",name:"Shai Gilgeous-Alexander",reason,adpTrend},2);
  assert.match(card,/<details class="draft-radar-card" name="draft-radar"><summary class="draft-radar-summary">/,
    "Die gesamte Karte muss weiterhin nativ aufklappbar sein");
  assert.ok(card.includes(`<p>${reason}</p></div><span class="draft-radar-open">Analyse`),
    "Analyse muss nach der vollständigen Beschreibung und außerhalb des Textblocks stehen");
  assert.match(card,/<span class="draft-radar-open">Analyse <i>⌄<\/i><\/span><div class="draft-radar-bar" aria-hidden="true">[\s\S]*?<\/summary>\s*<div class="draft-radar-report">/,
    "Analyse, Heat-Leiste und aufklappbarer Bericht müssen ihre getrennten Bereiche behalten");
  const summary=card.slice(0,card.indexOf("</summary>"));
  assert.match(summary,/<div class="draft-radar-header"><span class="draft-radar-rank">#[^<]+<\/span><div class="draft-radar-score"><b>[^<]+<\/b><small>ESPN ADP<\/small><span class="maik-value">Maik-Value –<\/span><\/div><\/div>/,
    "Der gemeinsame Kartenkopf muss Maik-Value direkt unter ESPN ADP ausgeben");
  assert.equal((summary.match(/class="maik-value"/g)||[]).length,1,
    "Die geschlossene Karte darf Maik-Value nicht nochmals unter dem Spielernamen ausgeben");
}
const radarPositionCard=renderDraftRadarCard({id:"guard",name:"ESPN Guard",nba:"OKC",adp:3.1,primaryPosition:"PG",fantasyPositions:"SG,PG,UTIL,BE"},0);
assert.match(radarPositionCard,/<h3>ESPN Guard<\/h3><div class="draft-radar-meta"><span class="draft-radar-team">OKC · <span title="ESPN-Fantasy-Positionen">PG, SG<\/span>/,
  "Die Startkarte muss die vollständigen ESPN-Positionen unter dem Namen beim Team zeigen");
assert.doesNotMatch(radarPositionCard,/UTIL|BE/,
  "Flex- und Bank-Slots dürfen auch auf den Startkarten nicht als Position erscheinen");
assert.match(renderDraftRadarCard({primaryPosition:"C"},0),/title="ESPN-Fantasy-Positionen">C<\/span>/,
  "Bei älteren ESPN-Sheetzeilen darf ESPNs eigene Hauptposition einspringen");
assert.doesNotMatch(renderDraftRadarCard({},0),/ESPN-Fantasy-Positionen|ESPN-Sync/,
  "Ohne echte ESPN-Daten darf die Startkarte keine Position erfinden oder einen technischen Platzhalter zeigen");
assert.match(radarPositionCard,/<b>3,1<\/b><small>ESPN ADP<\/small>/,
  "Die rechte Kennzahl muss den tatsächlichen ESPN-ADP statt erfundener Heat-Punkte zeigen");
assert.match(radarPositionCard,/Markt-Reihenfolge, keine FBA-Leistungsprojektion/,
  "Die Analyse muss Marktposition und FBA-Leistungsprognose verständlich unterscheiden");
assert.doesNotMatch(html,/Draft Heat|50 % Experten-Ränge|DRAFT_RADAR_FALLBACK/,
  "Weder unbelegte Gewichte noch statische Heat-Ranglisten dürfen als Live-Modell erscheinen");
const radarInput=Array.from({length:30},(_,i)=>({id:`P${i}`,name:`Player ${i}`,adp:40-i,rank:99,score:100}));
const radarState={draftTop25:radarInput};
const sortedRadar=loadFunction("draftRadarData",{D:radarState,Set,Number,String,Object});
const sortedRadarRows=sortedRadar();
assert.equal(sortedRadarRows.length,25);
assert.equal(sortedRadarRows[0].id,"P29");
assert.deepEqual(Array.from(sortedRadarRows,row=>row.rank),Array.from({length:25},(_,i)=>i+1));
assert.equal(radarInput[0].rank,99,"Das Sortieren darf die Quelldaten nicht überschreiben");
radarState.draftTop25=[{id:"giannis",name:"Giannis",adp:5.3,score:76},{id:"edwards",name:"Edwards",adp:6.8,score:78},
  {id:"zero",adp:0},{id:"nan",adp:"ungültig"},{id:"inactive",adp:1,active:false},{id:"giannis",adp:5.3}];
assert.deepEqual(Array.from(sortedRadar(),row=>row.id),["giannis","edwards"],
  "Nur gültige eindeutige Spieler dürfen erscheinen; der alte Heat-Score darf keinen Einfluss haben");
radarState.draftTop25[1].adp=4.9;
assert.equal(sortedRadar()[0].id,"edwards","Ein geänderter ADP muss die sichtbare Reihenfolge ändern");
radarState.draftTop25=[];
assert.equal(sortedRadar().length,0,"Fehlende Daten dürfen nicht mit einer festen Rangliste kaschiert werden");

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

// v47: run the actual startup/navigation/loader functions with controlled I/O.
// The unresolved public request must not delay the authenticated private one.
function preloadHarness(){
  const state={data:null,dataWeek:null,loading:false,error:null,week:1,weekPinned:false,requestSeq:0,activeRequest:0,queuedWeek:null,queuedForce:false,queuedFullSync:false};
  const io={token:"unit-test-device",api:"https://example.invalid",force:false,calls:[],resolvers:[],events:[],timers:[],gates:0,fullSyncs:0};
  const context={MONSTER_STATE:state,CUR:"ueber",MONSTER_SESSION_KEY:"test-session",monsterToken:()=>io.token,monsterUnlocked:()=>Boolean(io.token),apiUrl:()=>io.api,
    consumeMonsterForceRefresh:()=>{const value=io.force;io.force=false;return value},
    monsterJsonp:params=>{io.calls.push(params);return new Promise((resolve,reject)=>io.resolvers.push({resolve,reject}))},
    monsterEnsureTeams:()=>{},monsterPrivatePage:()=>context.CUR==="monster"||context.CUR==="freeagency",
    openMonsterGate:()=>{io.gates++},requestFullEspnRefresh:async()=>{io.fullSyncs++},
    localStorage:{removeItem:()=>{io.token=""}},render:()=>io.events.push("render:"+context.CUR),
    restorePublicStartupPayload:()=>io.events.push("restore-public"),insideAppsScript:()=>false,
    loadLive:()=>{io.events.push("public-request");return new Promise(()=>{})},updateCountdowns:()=>{},setInterval:()=>{},
    setTimeout:fn=>{io.timers.push(fn);return io.timers.length}};
  context.loadMonsterData=loadAsyncFunction("loadMonsterData",context);
  context.preloadFreeAgencyData=loadFunction("preloadFreeAgencyData",context);
  context.navigatePage=loadFunction("navigatePage",context);
  return {state,io,context};
}
const startupCode=inline[1].slice(inline[1].indexOf("/* Start */"));
const preloaded=preloadHarness();
vm.runInNewContext(startupCode,preloaded.context);
assert.deepEqual(preloaded.io.events,["restore-public","render:ueber","public-request"]);
assert.equal(preloaded.io.calls.length,0,"Der private Abruf startet erst nach dem synchronen Seitenaufbau");
assert.equal(preloaded.io.timers.length,1);
const preloadPending=preloaded.io.timers[0]();
assert.equal(preloaded.io.calls.length,1,"Der private Abruf darf nicht auf die noch offene öffentliche API warten");
assert.equal(preloaded.io.calls[0].monster,"data");
assert.equal(preloaded.io.calls[0].refresh,undefined,"Normales Vorladen erzwingt keinen Refresh");
assert.equal(preloaded.io.fullSyncs,0);
assert.equal(preloaded.context.CUR,"ueber");
assert.equal(preloaded.state.loading,true);
preloaded.context.navigatePage("freeagency");
assert.equal(preloaded.io.calls.length,1,"Ein schneller Seitenwechsel verwendet den laufenden Abruf");
const privateFixture={ok:true,nbaSchedule:{matchupWeek:1},espnPlayerPool:[{id:"fixture-player"}]};
preloaded.io.resolvers[0].resolve(privateFixture);
await preloadPending;
assert.equal(preloaded.state.data,privateFixture);
assert.equal(preloaded.state.loading,false);
preloaded.context.navigatePage("freeagency");
assert.equal(preloaded.io.calls.length,1,"Bereits vorgeladene Daten werden beim Öffnen wiederverwendet");

const quietPreload=preloadHarness();
const quietPending=quietPreload.context.preloadFreeAgencyData();
quietPreload.io.resolvers[0].resolve(privateFixture);await quietPending;
assert.deepEqual(quietPreload.io.events,[],"Eine Hintergrundantwort darf die öffentliche Ansicht nicht neu rendern");
assert.equal(quietPreload.context.CUR,"ueber");
assert.equal(quietPreload.io.gates,0);

for(const skip of ["locked","no-api","already-loading","already-loaded"]){
  const p=preloadHarness();p.io.force=true;
  if(skip==="locked")p.io.token="";
  if(skip==="no-api")p.io.api="";
  if(skip==="already-loading")p.state.loading=true;
  if(skip==="already-loaded")p.state.data=privateFixture;
  await p.context.preloadFreeAgencyData();
  assert.equal(p.io.calls.length,0,skip+": kein zusätzlicher Abruf");
  assert.equal(p.io.gates,0,skip+": kein unverlangter PIN-Dialog");
  assert.equal(p.io.force,true,skip+": Reset-Markierung nicht vorzeitig verbrauchen");
}

const failedPreload=preloadHarness();
const failedPending=failedPreload.context.preloadFreeAgencyData();
failedPreload.io.resolvers[0].reject(new Error("Test-Netzwerkfehler"));await failedPending;
assert.equal(failedPreload.state.error,"Test-Netzwerkfehler");
assert.equal(failedPreload.state.data,null);assert.equal(failedPreload.io.gates,0);
assert.deepEqual(failedPreload.io.events,[]);
const retryPending=failedPreload.context.loadMonsterData(false);
assert.equal(failedPreload.io.calls.length,2,"Nach einem Vorladefehler bleibt ein normaler neuer Versuch möglich");
failedPreload.io.resolvers[1].resolve(privateFixture);await retryPending;

const revokedPreload=preloadHarness();
const revokedPending=revokedPreload.context.preloadFreeAgencyData();
revokedPreload.io.resolvers[0].resolve({ok:false,locked:true});await revokedPending;
assert.equal(revokedPreload.io.token,"");assert.equal(revokedPreload.state.data,null);
assert.equal(revokedPreload.io.gates,0,"Widerrufener Zugang öffnet keinen Dialog auf der Startseite");
await revokedPreload.context.loadMonsterData(false);
assert.equal(revokedPreload.io.gates,0,"Auch ein inzwischen entferntes Token bleibt im Hintergrund still");
revokedPreload.context.CUR="freeagency";await revokedPreload.context.loadMonsterData(false);
assert.equal(revokedPreload.io.gates,1,"Bei bewusster privater Navigation bleibt der Zugangs-Dialog erhalten");

const resetPreload=preloadHarness();resetPreload.io.force=true;
const resetPending=resetPreload.context.preloadFreeAgencyData();
assert.equal(resetPreload.io.calls[0].refresh,1);assert.equal(resetPreload.io.force,false);
assert.equal(resetPreload.io.fullSyncs,0,"Vorladen erzeugt keinen weiteren Vollsync nach dem Reset");
resetPreload.io.resolvers[0].resolve(privateFixture);await resetPending;

console.log("PASS · Matchup Monster frontend, startup preload and centered chance regression tests");
