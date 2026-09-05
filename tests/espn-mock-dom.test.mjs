import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import reader from '../extensions/espn-mock/espn-dom.js';
import core from '../espn-mock-core.js';
import {harness} from './helpers/draft-frontend-harness.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const url='https://fantasy.espn.com/basketball/draft?leagueId=2079171393&seasonId=2027&teamId=2&memberId=DO-NOT-TRANSFER';
// Test markup reconstructed from the public ESPN client: Pick History / fixed-data-table / .cell.
const row=(pick=1,name='Nikola Jokic',id='3112335',team='Team 1')=>`<div role="row"><div role="gridcell"><div class="cell">${pick}</div></div><div role="gridcell"><div class="cell"><div class="player-column"><div class="player-headshot"><img src="https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${id}.png&w=48"></div><span class="playerinfo__playername"><a>${name}</a></span></div></div></div><div role="gridcell"><div class="cell truncate">${team}</div></div><div role="gridcell"><div class="cell">18</div></div></div>`;
const page=body=>parseHTML(`<html><body>${body}</body></html>`).document;
const table=rows=>`<div class="pick-history-table isViewing"><div class="caption">Round 1</div><div class="k-table"><div role="row"><div class="cell header-cell">PICK</div></div>${rows}</div></div>`;
const history=rows=>`<div class="pick-history"><div class="roundsDropdown"><select><option value="-1" selected>All Rounds</option></select></div>${table(rows)}</div>`;
const visible=node=>node.getAttribute('data-test-hidden')!=='true';

test('ESPN fixed-data-table pick rows yield only the exact player/team/pick fields, never member identifiers',()=>{
 const doc=page(history(row()+row(2,'LaMelo Ball','4432816','Team 2'))),result=reader.read(doc,url,visible);
 assert.equal(result.ready,true);assert.equal(result.picks.length,2);
 assert.deepEqual(result.picks[0],{overall:1,name:'Nikola Jokic',team:'Team 1',playerId:'3112335'});
 assert.equal(result.teamId,2);assert.doesNotMatch(JSON.stringify(result),/DO-NOT-TRANSFER|memberId|combiner|cookie/);
 const raw=JSON.parse(read('tests/fixtures/espn-mock-room-20260905.json')),meta=core.metadata(raw,core.room(url));
 const cfg={...meta,fbaTeams:['A','B','C','D','E','F','G','H']};
 const picks=core.picks(result,cfg,[{id:'3112335',name:'Nikola Jokić'},{id:'4432816',name:'LaMelo Ball'}]);
 assert.deepEqual(picks.map(p=>p.team),['A','B']);
});

test('visible history and All Rounds are required; no automatic clearing on unavailable content',()=>{
 assert.equal(reader.read(page(row()),url,visible).ready,false);
 const doc=page(history(row()));doc.querySelector('.pick-history').setAttribute('data-test-hidden','true');assert.equal(reader.read(doc,url,visible).ready,false);
 doc.querySelector('.pick-history').removeAttribute('data-test-hidden');doc.querySelector('.pick-history-table').setAttribute('data-test-hidden','true');assert.match(reader.read(doc,url,visible).message,/All Rounds/);
 const filtered=page(history(row()));filtered.querySelector('select').innerHTML='<option value="1" selected>Round 1</option>';assert.match(reader.read(filtered,url,visible).message,/All Rounds/);
 const empty=reader.read(page('<div class="pick-history"><h3>Picks will appear here once your draft starts</h3></div>'),url,visible);assert.equal(empty.ready,true);assert.equal(empty.picks.length,0);
 assert.equal(reader.read(page(history(row())),url.replace('/basketball/','/football/'),visible).ready,false);
});

test('incomplete rows fail as a whole; absent headshots fall back to full names and ambiguous images fail',()=>{
 const doc=page(history(row()+row(2,'','4432816','Team 2')));assert.equal(reader.read(doc,url,visible).ready,false);
 const noImage=page(history(row()));noImage.querySelector('img').remove();assert.equal(reader.read(noImage,url,visible).picks[0].playerId,null);
 const multiple=page(history(row()));multiple.querySelector('.player-column').innerHTML+='<img src="https://a.espncdn.com/i/headshots/nba/players/full/4432816.png">';assert.equal(reader.read(multiple,url,visible).ready,false);
});

test('extension only relays one matching basketball room to the FBA origin, with no network, storage or draft action permissions',async()=>{
 const manifest=JSON.parse(read('extensions/espn-mock/manifest.json'));
 assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions||[],[]);
 assert.equal(manifest.content_scripts[0].matches[0],'https://fantasy.espn.com/basketball/*');
 let listener,reads=0;
 const snapshot={ready:true,picks:[]};
 const c=vm.createContext({URL,chrome:{runtime:{id:'bridge',onMessage:{addListener:f=>listener=f}},tabs:{query:async()=>[{id:1,url},{id:2,url:url.replace('2079171393','777')}],sendMessage:async(id,packet,options)=>{reads++;assert.equal(id,1);assert.equal(packet.type,'FBA_MOCK_READ');assert.equal(options.frameId,0);return snapshot;}}}});
 vm.runInContext(read('extensions/espn-mock/background.js'),c);
 const packet={type:'FBA_MOCK_REQUEST',leagueId:'2079171393',seasonId:2027},sender={id:'bridge',tab:{id:9},frameId:0,url:'https://fba-control-center.netlify.app/'};
 const result=await new Promise(resolve=>listener(packet,sender,resolve));assert.equal(result,snapshot);assert.equal(reads,1);
 listener(packet,{...sender,url:'https://evil.test/'},()=>assert.fail('foreign origin'));listener(packet,{...sender,frameId:1},()=>assert.fail('child frame'));assert.equal(reads,1);
 c.chrome.tabs.query=async()=>[{id:1,url},{id:2,url}];const duplicate=await new Promise(resolve=>listener(packet,sender,resolve));assert.equal(duplicate.ready,false);assert.equal(reads,1);
});

test('actual content scripts carry a rendered ESPN pick through worker and relay into the real War Room',async()=>{
 const {c}=harness(0),raw=JSON.parse(read('tests/fixtures/espn-mock-room-20260905.json'));
 const player=c.draftPool()[0],doc=page(history(row(1,player.name,player.id,'Team 1')));
 for(const node of doc.querySelectorAll('*'))node.getClientRects=()=>[{}];
 let espnListener,workerListener,complete;
 const received=new Promise(resolve=>complete=resolve);
 const espn=vm.createContext({FBA_ESPN_DOM:reader,document:doc,location:{href:url},chrome:{runtime:{id:'bridge',onMessage:{addListener:f=>espnListener=f}}}});
 vm.runInContext(read('extensions/espn-mock/espn-reader.js'),espn);
 const worker=vm.createContext({URL,chrome:{runtime:{id:'bridge',onMessage:{addListener:f=>workerListener=f}},tabs:{query:async()=>[{id:2,url}],sendMessage:async()=>new Promise(resolve=>espnListener({type:'FBA_MOCK_READ'},{id:'bridge'},resolve))}}});
 vm.runInContext(read('extensions/espn-mock/background.js'),worker);
 c.FBA_ESPN_MOCK_CORE=core;c.URL=URL;c.AbortController=AbortController;c.setTimeout=setTimeout;c.clearTimeout=clearTimeout;c.setInterval=()=>0;
 c.location={origin:'https://fba-control-center.netlify.app'};c.mockListeners=[];c.addEventListener=(_,listener)=>c.mockListeners.push(listener);
 c.fetch=async()=>({ok:true,json:async()=>raw});
 c.chrome={runtime:{sendMessage:(packet,reply)=>workerListener(packet,{id:'bridge',frameId:0,tab:{id:1},url:c.location.origin+'/'},reply)}};
 c.postMessage=packet=>{
  c.mockPacket=packet;
  vm.runInContext('mockListeners.forEach(fn=>fn({source:window,origin:location.origin,data:mockPacket}))',c);
  if(packet.type==='FBA_MOCK_RESPONSE')complete();
 };
 vm.runInContext(read('espn-mock.js'),c);vm.runInContext(read('extensions/espn-mock/fba-relay.js'),c);
 assert.equal(await c.FBA_ESPN_MOCK.connect(url,2),true);await received;
 assert.equal(c.DRAFT_STATE.picks.length,1);assert.equal(c.DRAFT_STATE.picks[0].playerId,String(player.id));
 assert.equal(c.DRAFT_STATE.picks[0].team,c.draftTeams()[0]);c.FBA_ESPN_MOCK.disconnect();
});
