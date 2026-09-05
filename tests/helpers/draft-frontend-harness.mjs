import fs from 'node:fs';
import vm from 'node:vm';
import coach from '../../draft-coach.js';
import prep from '../../draft-prep.js';
import core from '../../maik-value.js';
import history from '../../maik-history-2025-26.js';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const html=read('index.html');
export function harness(count=48){
 const storage=new Map(),elements=new Map([['draftCoachPreview',{innerHTML:'',scrollIntoView(){}}]]);
 const c=vm.createContext({FBA_DRAFT_COACH:coach,FBA_DRAFT_PREP:prep,FBA_MAIK_VALUE:core,FBA_MAIK_HISTORY:history,D:{draft:{teams:[]}},DRAFT_CATS:coach.categories,DRAFT_MAX_ROUNDS:13,DRAFT_DEMO_GP:72,DRAFT_STORAGE_KEY:'test-draft',
 MONSTER_STATE:{data:null},monsterUnlocked:()=>false,monsterProjectionEngineState:()=>({ready:false,players:[]}),
 localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:{getElementById:id=>elements.get(id)},
 E:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),de:(n,d=1)=>Number(n||0).toFixed(d).replace('.',','),
 T:t=>({s:t.replace('BlackForest Mad Wolves','Wolves')}),canonicalTeamName:t=>t,chip:team=>`<span class="chip">${team}</span>`,
 espnPlayerHeadshot:id=>`https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`,imageFallbackAttr:()=>'',playerInitials:name=>name.slice(0,2),
 window:null,requestAnimationFrame:fn=>fn(),confirm:()=>true});
 c.window=c;c.scrollTo=()=>{};
 vm.runInContext(read('draft-prototype-data.js'),c);
 const start=html.indexOf('function draftDefaultState('),end=html.indexOf('/* ===================== MATCHUP MONSTER',start);
 vm.runInContext(html.slice(start,end),c);
 c.DRAFT_STATE=c.draftDefaultState();
 const pool=c.draftPool();
 c.DRAFT_STATE.picks=pool.slice(0,count).map((p,i)=>({...c.draftPickMeta(i+1),playerId:p.id,at:''}));
 c.showDraftToast=()=>{};
 vm.runInContext(read('draft-war-room.js'),c);
 c.render=()=>{c.page=c.pgDraftRoom();elements.get('draftCoachPreview').innerHTML=c.draftCoachPreviewMarkup();};
 return {c,storage,elements};
}
