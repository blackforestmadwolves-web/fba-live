import assert from "node:assert/strict";
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
assert.match(manifest.start_url,/war-room-monster-v32-20260904/);
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

assert.match(html,/war-room-monster-v32-20260904/,"Produktions-Build muss v32 ausweisen");
assert.match(html,/data-testid="monster-analysis-team"/,"Das Analyse-Team braucht einen eindeutigen Selektor");
assert.match(html,/data-testid="monster-week"/,"Die eindeutige Wochenwahl muss vorhanden sein");
assert.match(html,/data-testid="monster-opponent"/,"Der freie Vergleichsgegner muss erhalten bleiben");
assert.match(html,/function monsterWeeks\(\)[\s\S]*new Map\(\)/,"Vier Spielplanzeilen pro Woche müssen zu einer Wochenoption verdichtet werden");
assert.match(html,/function setMonsterWeek\(value\)[\s\S]*monsterScheduledOpponent/,
  "Ein Wochenwechsel muss den echten Gegner des Analyse-Teams vorauswählen");
assert.match(html,/MONSTER_TEAM_KEY="fba_monster_analysis_team_v32"/,
  "Das gewählte Analyse-Team muss auf dem Gerät erhalten bleiben");

assert.match(html,/function monsterB2bGroups\(list\)/,"B2B-Einträge müssen nach Tagespaar gruppiert werden");
assert.match(html,/monsterWeekdayPair\(group\.first,group\.second\)/,"Der Wochentag muss im Radar vor den NBA-Teams stehen");
assert.match(html,/toggleMonsterB2b\('\$\{E\(group\.key\)\}'\)/,"B2B-Zeilen müssen aufklappbar sein");
assert.match(html,/function monsterB2bFreeAgents\(teams,cat\)/,"Aufgeklappte B2B-Zeilen brauchen freie Spieler der betroffenen NBA-Teams");
assert.match(html,/MONSTER_STATE\.b2bHunt=DRAFT_CATS\.includes\(cat\)\?cat:null/,
  "Das B2B-Radar muss Gesamtprofil und jeden einzelnen FBA-Punkt unterstützen");

assert.match(html,/hunt:null/,"Das Pickup Impact Lab muss ohne ausgewählten FBA-Punkt starten");
assert.match(html,/setMonsterHunt\(''\).*GESAMT/,
  "Das Pickup Impact Lab braucht eine Gesamtprofil-Auswahl");
assert.match(html,/function monsterSimulation\(teamA,teamB,baseForecast\)/,
  "Drop und Add müssen ein gemeinsames Vorher-Nachher-Szenario erzeugen");
assert.match(html,/Alle acht FBA-Punkte zeigen jetzt Vorher → Nachher/,
  "Das ausgewählte Pickup-Szenario muss oberhalb der acht Balken sichtbar werden");
assert.match(html,/monster-point-impact \$\{impact\}/,
  "Jeder FBA-Punkt braucht einen farbigen Gewinn-/Verlust-Hinweis");

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

const b2bGroups=loadFunction("monsterB2bGroups",{monsterNbaKey:value=>String(value).toUpperCase(),Map});
const groups=b2bGroups([
  {team:"ATL",first:"2026-10-23",second:"2026-10-24",crossWeek:false},
  {team:"BKN",first:"2026-10-23",second:"2026-10-24",crossWeek:false},
  {team:"LAL",first:"2026-10-25",second:"2026-10-26",crossWeek:true}
]);
assert.equal(groups.length,2,"NBA-Teams mit demselben Tagespaar gehören in ein gemeinsames B2B-Feld");
assert.deepEqual(JSON.parse(JSON.stringify(groups[0].teams)),["ATL","BKN"]);
assert.equal(groups[1].crossWeek,true,"Sonntag-zu-Montag muss als Lookahead erhalten bleiben");

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

console.log("PASS · Matchup Monster v32 frontend regression tests");
