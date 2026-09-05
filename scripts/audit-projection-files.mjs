// Audit previously downloaded public responses; does not fetch or publish data.
// node scripts/audit-projection-files.mjs <espn.json> <yahoo.html> [YYYY-MM-DD]
import fs from 'node:fs';
import vm from 'node:vm';
const [espnFile,yahooFile,date=new Date().toISOString().slice(0,10)]=process.argv.slice(2);
if(!espnFile||!yahooFile)throw new Error('Pass ESPN JSON and Yahoo HTML paths.');
const context={console};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.js',import.meta.url),'utf8'),context);
const hub=JSON.parse(fs.readFileSync(espnFile,'utf8')),stamp=date+'T12:00:00Z';
const metadata=(hub.players||[]).map(e=>context.rawFantasyPlayerV36_(e)).map(p=>({player_id:String(p.id),full_name:p.fullName,season_id:hub.seasonId}));
const index=context.consensusIdentityIndexV44_(metadata);
const espn=context.parseEspnProjectionRowsV36_(hub,stamp);
const parsed=context.parseYahooConsensusV44_(fs.readFileSync(yahooFile,'utf8'),stamp);
const results=parsed.rows.map(r=>context.normalizeConsensusRowV44_(r,index,stamp)),valid=results.filter(r=>r.ok).map(r=>r.row),merged=context.mergeConsensusV44_(valid);
console.log(JSON.stringify({date,espn:{season:hub.seasonId,players:metadata.length,validCurrentProjections:espn.length},yahoo:{parser:parsed.status,rows:parsed.rows.length,matched:valid.length,rejected:results.filter(r=>!r.ok).map(r=>r.reason),completePlayers:merged.filter(r=>r.complete).length,fields:valid[0]?Object.keys(valid[0].base).filter(k=>valid[0].base[k]!=null):[]}},null,2));
