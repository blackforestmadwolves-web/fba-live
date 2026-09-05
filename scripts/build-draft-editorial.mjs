// Assemble reviewed prose; this script does not generate articles or player facts.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import pool from '../draft-radar-pool.js';
import catalog from '../draft-player-catalog.js';

const [payloadFile, output, ...parts] = process.argv.slice(2);
assert.ok(payloadFile && output && parts.length===3, 'Usage: node scripts/build-draft-editorial.mjs ADP_PAYLOAD.json OUTPUT.js PART1.json PART2.json PART3.json');
const rows=pool.build(JSON.parse(fs.readFileSync(payloadFile,'utf8')),catalog);
assert.equal(rows.length,100,'Confirm current top 100 before assembling editorials');
const required=rows.slice(25),expected=new Set(required.map(p=>p.id));
const reports=parts.flatMap(file=>{
  const part=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.ok(Array.isArray(part) && part.length===25,`${file}: need 25 completed articles`);
  return part;
});
// Use the league's established terminology in user-visible prose.
for (const report of reports) for (const [key, value] of Object.entries(report)) {
  if (typeof value === 'string' && !/Url$/.test(key)) report[key] = value
    .replaceAll('Kategoriebeiträge','Einzelbeiträge').replaceAll('Kategorie-Fit','FBA-Fit')
    .replaceAll('Kategorien','FBA-Punkte').replaceAll('Kategorie','FBA-Punkt');
}
const wordingFixes={"FBA-Punktduelle": "Duelle um FBA-Punkte", "FBA-Punktabzug": "Punkteabzug", "FBA-Punktvorteil": "Vorteil", "FBA-Punktankern": "Stützen", "FBA-Punktanker": "Stützen", "FBA-Punktbeitrag": "Beitrag", "FBA-Punkthilfe": "Hilfe", "FBA-Punktausrichtung": "Ausrichtung", "FBA-Punkt-Ergänzung": "gezielte Ergänzung", "die Assist-FBA-Punkt": "die Wertung der Assists", "Die fehlende Turnover-FBA-Punkt": "Der fehlende Turnover-Abzug", "keine Turnover-FBA-Punkt": "kein Turnover-Abzug", "Turnover-FBA-Punkt": "Turnover-Abzug", "in einer einzelnen FBA-Punkt": "in einem einzelnen FBA-Punkt", "in dieser FBA-Punkt": "in diesem FBA-Punkt", "in jeder FBA-Punkt": "in jedem FBA-Punkt", "in keiner fehlenden FBA-Punkt": "in keinem fehlenden FBA-Punkt", "eine bereits starke Scoring-FBA-Punkt": "einen bereits starken Scoring-Punkt", "eine weitere große FBA-Punkt": "einen weiteren wichtigen FBA-Punkt", "eine dominierte FBA-Punkt": "einen dominierten FBA-Punkt", "keine tragende FBA-Punkt": "kein tragender FBA-Punkt", "keine eigene FBA-Punkt bilden": "keinen eigenen FBA-Punkt bilden", "jede offensive FBA-Punkt": "jeder offensive FBA-Punkt", "keine FBA-Punkt": "kein FBA-Punkt", "eine FBA-Punkt": "einen FBA-Punkt", "diese andere FBA-Punkt": "diesen anderen FBA-Punkt", "diese FBA-Punkt": "diesen FBA-Punkt", "dieser FBA-Punkt": "dieses FBA-Punkts", "jeder FBA-Punkt.": "jedes FBA-Punkts.", "jede FBA-Punkt": "jeden FBA-Punkt", "Jede FBA-Punkt": "Jeder FBA-Punkt", "beste FBA-Punkt": "besten FBA-Punkt", "die offene FBA-Punkt": "den offenen FBA-Punkt", "kein FBA-Punkt, die er": "kein FBA-Punkt, den er"};
for (const report of reports) for (const [key, value] of Object.entries(report)) {
  if (typeof value !== "string" || /Url$/.test(key)) continue;
  let text=value;
  for (const [from,to] of Object.entries(wordingFixes)) text=text.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?!e)","g"),to);
  report[key]=text;
}
assert.equal(reports.length,75);
const ids=new Set();
for(const report of reports) {
  assert.ok(expected.has(report.id) && !ids.has(report.id),`Unexpected or duplicate player ${report.id}`);
  ids.add(report.id);
  for(const key of ['id','name','reason','report','outlook','strengths','risk','fit','draftPlan','reviewedAt','sourceUrl']) assert.ok(typeof report[key]==='string' && report[key].trim(),`${report.id}/${key}`);
  assert.equal(report.name,required.find(p=>p.id===report.id).name);
  assert.equal(report.reviewedAt,'05.09.2026');
  assert.ok(['report','outlook','strengths','risk','fit','draftPlan'].map(k=>report[k]).join(' ').split(/\s+/).length>=160,`${report.name}: insufficient depth`);
  for(const source of [{url:report.sourceUrl},...(report.sources||[])]) assert.equal(new URL(source.url).protocol,'https:');
  assert.ok(!JSON.stringify(report).includes('Maik-Value'));
}
assert.equal(ids.size,expected.size);
reports.sort((a,b)=>required.findIndex(p=>p.id===a.id)-required.findIndex(p=>p.id===b.id));
fs.writeFileSync(output,`/* Reviewed individual FBA draft analysis, 05.09.2026. Existing top-25 articles remain in index.html.
 * Historical NBA statistics and older-season/college exceptions are labeled in each article.
 * Manual editorial assessments, not live projections or ranking inputs.
 */
(function(root) {
  'use strict';
  const reports=${JSON.stringify(reports,null,2)};
  function freeze(value) {
    if(value && typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}
    return value;
  }
  const data=freeze(reports);
  if(typeof module==='object' && module.exports)module.exports=data;
  if(root)root.FBA_DRAFT_EDITORIAL_V53=data;
})(typeof window==='object'?window:null);
`);
console.log(JSON.stringify({output,reports:reports.length,coveredTop100:100}));
