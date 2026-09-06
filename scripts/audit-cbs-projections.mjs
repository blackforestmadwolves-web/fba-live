// Read already captured CBS tables; no network, public data export or Sheet write.
// node scripts/audit-cbs-projections.mjs <html-directory> <draft-player-catalog.js>
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const [directory,catalog]=process.argv.slice(2);
if(!catalog)throw Error('Pass HTML directory and ESPN catalog path');
const ctx={console,Date};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.js',import.meta.url),'utf8'),ctx);
const meta={window:{}};vm.createContext(meta);vm.runInContext(fs.readFileSync(catalog,'utf8'),meta);
const dataset=Object.values(meta.window).find(v=>Array.isArray(v)||Array.isArray(v?.players));
const players=Array.isArray(dataset)?dataset:dataset.players;
const index=ctx.consensusIdentityIndexV44_(players.map(p=>({id:String(p.id),fullName:p.name||p.fullName,season_id:2027})));
const stamp=new Date().toISOString();
const pages=Array.from(ctx.FBA_CBS_V70.positions,p=>ctx.parseCbsProjectionPageV70_(fs.readFileSync(path.join(directory,p+'.html'),'utf8'),p,stamp));
if(pages.some(p=>!p.ok))throw Error(JSON.stringify(pages.map(p=>({position:p.position,state:p.state}))));
const merged=ctx.mergeCbsPositionsV70_(pages),mapped=ctx.mapCbsPlayersV70_(merged.rows,index,[],stamp);
const normalized=mapped.rows.map(row=>ctx.normalizeConsensusRowV44_(row,index,stamp));
const again=ctx.mapCbsPlayersV70_(merged.rows,index,mapped.mappings,stamp);
if(again.rows.length!==mapped.rows.length||normalized.some(r=>!r.ok))throw Error('Unstable mapping or invalid normalized rows');
console.log(JSON.stringify({pages:pages.map(p=>({position:p.position,rows:p.rows.length})),unique:merged.rows.length,duplicates:merged.duplicates,conflicts:merged.conflicts,mapping:mapped.audit,complete:ctx.mergeConsensusV44_(normalized.map(r=>r.row)).filter(r=>r.complete).length},null,2));
