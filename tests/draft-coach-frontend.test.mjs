import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import coach from '../draft-coach.js';
import prep from '../draft-prep.js';
import core from '../maik-value.js';
import history from '../maik-history-2025-26.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
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
test('real War Room renders selected Wolves, all eight rank-only tiles and 452 complete player cards',()=>{
 const {c}=harness();const markup=c.pgDraftRoom(),data=c.draftCoachContext(),standing=c.computeDraftStandings().byTeam[data.team];
 assert.equal(data.team,'BlackForest Mad Wolves');
 for(const tile of data.tiles)assert.equal(tile.rank,standing.ranks[tile.cat]??null);
 assert.equal((markup.match(/data-coach-category=/g)||[]).length,8);
 assert.equal((markup.match(/<article class="draft-player-row"/g)||[]).length,452);
 assert.match(markup,/Mein Team/);assert.match(markup,/Mein Draft-Ziel/);
 const tiles=markup.match(/<div class="draft-coach-categories">([\s\S]*?)<p class="draft-coach-rank-note">/)[1];
 assert.doesNotMatch(tiles,/156|49,4|class=".*value|[0-9],[0-9]/);
 assert.match(markup,/Für mein Team prüfen/);assert.match(markup,/ESPN ADP/);assert.match(markup,/Merge Value/);
 assert.match(markup,/FBA-Value/);assert.match(markup,/Modell #/);assert.match(markup,/GP · 2025\/26/);
 assert.ok(!data.candidates.some(rec=>c.DRAFT_STATE.picks.some(p=>p.playerId===rec.player.id)));
});
test('team and goals persist, preview is read-only, actual pick keeps snake ownership and undo refreshes the coach',()=>{
 const {c,elements,storage}=harness(16);
 c.setDraftCoachTeam('BlackForest Mad Wolves');c.setDraftCoachGoal('punt');c.toggleDraftPunt('AST');
 assert.equal(c.DRAFT_STATE.goal,'punt');assert.ok(c.draftCoachContext().tiles.find(t=>t.cat==='AST').punted);
 const stored=JSON.parse(storage.get('test-draft'));assert.equal(stored.myTeam,'BlackForest Mad Wolves');assert.equal(stored.goal,'punt');
 const next=c.nextOpenDraftPick(),player=c.draftCoachContext().recommendations[0].player;
 const before=JSON.stringify(c.DRAFT_STATE.picks);
 c.showDraftCoachPreview(player.id);
 assert.equal(JSON.stringify(c.DRAFT_STATE.picks),before);
 assert.match(elements.get('draftCoachPreview').innerHTML,/Vorschau für Wolves/);
 assert.match(elements.get('draftCoachPreview').innerHTML,new RegExp(`Für ${next.team} draften`));
 assert.match(elements.get('draftCoachPreview').innerHTML,/→/);
 c.selectDraftPlayer(player.id);
 assert.equal(c.DRAFT_STATE.picks.at(-1).team,next.team);
 assert.equal(c.draftCoachContext().team,'BlackForest Mad Wolves');
 assert.equal(elements.get('draftCoachPreview').innerHTML,'','drafted player preview is cleared');
 c.undoDraftPick();assert.equal(JSON.stringify(c.DRAFT_STATE.picks),before);
 c.setDraftCoachTeam('East Bay Pirates');assert.equal(c.draftCoachContext().team,'East Bay Pirates');
 c.setDraftCoachGoal('balanced');assert.equal(c.DRAFT_STATE.punts.length,0);
 assert.equal(c.loadDraftState().myTeam,'East Bay Pirates');
 assert.equal(c.loadDraftState().goal,'balanced');
 c.setDraftCoachTeam('<script>');assert.equal(c.draftCoachContext().team,'East Bay Pirates');
});
test('empty and complete drafts render without false urgency, invalid teams migrate to Wolves',()=>{
 const {c}=harness(0);c.DRAFT_STATE.myTeam='Unknown';
 assert.match(c.pgDraftRoom(),/Dein Build beginnt mit dem ersten Pick/);
 assert.ok(c.draftCoachContext().tiles.every(t=>t.rank==null));
 const {c:full}=harness(104);assert.match(full.pgDraftRoom(),/Dein Kader ist komplett/);
 assert.equal(full.draftCoachContext().recommendations.length,0);
 assert.doesNotMatch(full.pgDraftRoom(),/class="draft-coach-suggestion"/);
});
