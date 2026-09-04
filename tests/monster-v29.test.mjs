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

const sheetValues=[
  ["SAISON","WOCHE","MATCHUP","START","STATUS","AWAY","HOME"],
  ["2026/27",1,"W1-1","","","East Bay Pirates","BlackForest Mad Wolves"],
  ["2026/27",1,"W1-2","","","Balingen Lions","Karlsruhe Unicorns"]
];
context.book=()=>({getSheetByName:()=>({
  getLastRow:()=>sheetValues.length,
  getDataRange:()=>({getValues:()=>sheetValues})
})});
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

cache.put(context.MATCHUP_MONSTER_V29.pinCacheKey,context.monsterHashV29_("123456"));
const token=context.createMonsterDeviceV29_("123456");
assert.ok(token&&token.length>40);
cacheData.clear();
assert.equal(context.validMonsterDeviceV29_(token),true,"Gerätefreigabe muss einen Cache-Neustart überstehen");
assert.equal(context.validMonsterDeviceV29_("falsch"),false);

console.log("PASS · Matchup Monster v31 backend tests");
