// Import an already obtained public table. No network requests or Sheet writes.
// Usage: node scripts/prepare-lineupexperts-import.mjs <page.txt> <ESPN-metadata.json> <output.json> [previous-map.json]
// Keep generated player data private; only this importer belongs in the repository.
import fs from 'node:fs';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';

export const sourceUrl='https://www.lineupexperts.com/basketball/projections?flt_proj_time_period=Preseason';
export const mapHeaders=['season_id','provider_player_id','player_id','provider_name','espn_name','status','first_seen','last_seen'];
const variants={
  'Taurean Waller-Prince':['2990962','Taurean Prince'], // nba.com/player/1627752/taurean-prince/bio
  'Nicolas Claxton':['4278067','Nic Claxton'],
  'Herb Jones':['4277813','Herbert Jones'],
  'Gregory Jackson':['5105550','GG Jackson'],
  'Ron Holland':['4683771','Ronald Holland II']
};
const key=name=>String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const suffixKey=name=>key(String(name).replace(/(?:\s|,)+(?:Jr\.?|Sr\.?|II|III|IV)$/i,''));
export function parseTable(text,stamp){
  if(!/2026-2027 Fantasy Basketball Projections/.test(text)||!/Preseason/.test(text))throw Error('Expected 2026/27 preseason projections');
  const expected=Number(text.match(/(?:^|\n)(?:L\d+: )?(\d+) Players\b/)?.[1]);
  const columns=['FPTS','AVG','ADP','GP','OFF','B2B','FG','FG3','FT','PTS','RB','AST','STL','BLK','TO'];
  const header=text.split('\n').find(l=>/Player\s*\|\s*FPTS/.test(l));
  if(!header||header.split('|').slice(1).map(x=>x.trim()).join(',')!==columns.join(','))throw Error('Unexpected column layout');
  const rows=[],seen=new Set();
  for(const line of text.split('\n')){
    const m=line.match(/†([^]+) \(([^)]+)\)\s*\|(.+)$/);if(!m)continue;
    // CBS/ESPN citation indexes are NOT provider IDs. The table repeats an abbreviated name.
    const boundary=m[1].lastIndexOf(m[1][0]+'. '),name=boundary>0?m[1].slice(0,boundary):'';
    if(!name||!name.includes(' '))throw Error('Unrecognized player name: '+m[1]);
    const cells=m[3].split('|').map(s=>s.trim());if(cells.length!==columns.length)throw Error('Wrong cell count: '+name);
    const numbers=Object.fromEntries(columns.map((c,i)=>[c,/^(?:\d+(?:,\d{3})*|\d*\.\d+)$/.test(cells[i])?Number(cells[i].replace(/,/g,'')):null]));
    if(!numbers.GP||numbers.GP>82||['PTS','RB','AST','FG3','STL','BLK'].some(k=>numbers[k]==null))throw Error('Invalid projection: '+name);
    const providerKey='name:'+key(name);if(seen.has(providerKey))throw Error('Duplicate provider identity: '+name);seen.add(providerKey);
    rows.push({source_id:'lineupexperts',season_id:2027,provider_player_id:providerKey,provider_name:name,basis:'per_game',projected_gp:numbers.GP,
      snapshot_date:stamp.slice(0,10),observed_at:stamp,source_url:sourceUrl,origin_family:'lineupexperts',PTS:numbers.PTS,REB:numbers.RB,AST:numbers.AST,'3PM':numbers.FG3,STL:numbers.STL,BLK:numbers.BLK,
      // FG and FT are makes. Without attempts neither shooting pair can contribute.
      FGM:null,FGA:null,FTM:null,FTA:null});
  }
  if(!expected||rows.length!==expected)throw Error(`Incomplete table: ${rows.length}/${expected}`);
  return rows;
}
export function mapPlayers(rows,metadata,stored,stamp){
  const ids=new Map(),exact=new Map(),suffix=new Map(),bindings=new Map();
  const add=(map,k,id)=>map.set(k,[...new Set([...(map.get(k)||[]),id])]);
  for(const p of metadata){if(Number(p.season_id)!==2027)continue;const id=String(p.player_id);ids.set(id,p.full_name);add(exact,key(p.full_name),id);add(suffix,suffixKey(p.full_name),id);}
  for(const m of stored){if(Number(m.season_id)!==2027)continue;if(bindings.has(m.provider_player_id))throw Error('Duplicate stored identity');bindings.set(m.provider_player_id,m);}
  const mapped=[],updates=new Map(bindings),issues=[];
  for(const raw of rows){
    const old=bindings.get(raw.provider_player_id),alias=variants[raw.provider_name];
    let matches=exact.get(key(raw.provider_name))||suffix.get(suffixKey(raw.provider_name))||[];
    if(!matches.length&&alias&&ids.get(alias[0])===alias[1])matches=[alias[0]];
    let id=matches.length===1?matches[0]:'',status=id?'MATCHED':matches.length?'AMBIGUOUS_PLAYER':'UNMATCHED_PLAYER';
    if(old?.player_id&&(String(old.player_id)!==id||key(old.provider_name)!==key(raw.provider_name)||old.espn_name!==ids.get(id)))status='PLAYER_ID_NAME_CONFLICT';
    if(status==='MATCHED')mapped.push({...raw,player_id:id,full_name:ids.get(id)});
    else issues.push({name:raw.provider_name,providerPlayerId:raw.provider_player_id,reason:status});
    updates.set(raw.provider_player_id,{season_id:2027,provider_player_id:raw.provider_player_id,player_id:old?.player_id||id,provider_name:old?.provider_name||raw.provider_name,espn_name:old?.espn_name||ids.get(id)||'',status,first_seen:old?.first_seen||stamp,last_seen:stamp});
  }
  if(new Set(mapped.map(r=>r.player_id)).size!==mapped.length)throw Error('Multiple provider identities target the same ESPN player');
  return {rows:mapped,mappings:[...updates.values()],audit:{parsed:rows.length,matched:mapped.length,pending:issues.length,issues}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [page,metadataPath,output,previous]=process.argv.slice(2);if(!output)throw Error('Pass page, metadata JSON and output path');
  const stamp=new Date().toISOString(),table=JSON.parse(fs.readFileSync(metadataPath)),metadata=table.slice(1).map(r=>Object.fromEntries(table[0].map((h,i)=>[h,r[i]])));
  const stored=previous?JSON.parse(fs.readFileSync(previous)):[],result=mapPlayers(parseTable(fs.readFileSync(page,'utf8'),stamp),metadata,stored,stamp);
  const c={console,Date};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.js',import.meta.url),'utf8'),c);
  const index=c.consensusIdentityIndexV44_(metadata),invalid=result.rows.map(r=>c.normalizeConsensusRowV44_(r,index,stamp)).filter(r=>!r.ok);
  if(invalid.length)throw Error('Rejected normalized rows: '+JSON.stringify(invalid));
  const again=mapPlayers(parseTable(fs.readFileSync(page,'utf8'),stamp),metadata,result.mappings,stamp);
  if(JSON.stringify(again.rows)!==JSON.stringify(result.rows))throw Error('Unstable mapping');
  fs.writeFileSync(output,JSON.stringify({...result,stamp,headers:Array.from(c.FBA_CONSENSUS_INPUT_HEADERS_V44),inputs:result.rows.map(r=>Array.from(c.FBA_CONSENSUS_INPUT_HEADERS_V44,k=>r[k]??'')),map:[mapHeaders,...result.mappings.map(r=>mapHeaders.map(k=>r[k]??''))]},null,2));
  console.log(JSON.stringify(result.audit));
}
