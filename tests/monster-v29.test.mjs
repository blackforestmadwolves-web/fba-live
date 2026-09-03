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

console.log("PASS · Matchup Monster v30 backend tests");
