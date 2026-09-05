import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const backend=fs.readFileSync(new URL('../apps-script/Code.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const publicCode=html.slice(html.indexOf('const DEFAULT_API ='),html.indexOf('/* UI-Verdrahtung */'));
const clone=value=>JSON.parse(JSON.stringify(value));
const payload=()=>({meta:{source:'fixture'},appConfig:{seasonCode:'S26_27'},draftTop25:Array.from({length:25},(_,i)=>({id:String(i+1),adp:i+1.25,fantasyPositions:'PF,C'}))});

function server(){
  let now=1000,serial=0,syncs=0,builds=0;
  const entries=new Map(),cache={get:key=>entries.get(key)??null,getAll:keys=>Object.fromEntries(keys.filter(k=>entries.has(k)).map(k=>[k,entries.get(k)])),put:(k,v)=>entries.set(k,v),putAll:parts=>Object.entries(parts).forEach(([k,v])=>entries.set(k,v)),remove:key=>entries.delete(key)};
  class Clock extends Date {static now(){return now}}
  const c=vm.createContext({console,Date:Clock,CacheService:{getScriptCache:()=>cache},Utilities:{getUuid:()=>String(++serial)}});
  vm.runInContext(backend,c);
  c.syncEspnIfStale_=()=>{syncs++};
  c.getPayload=forced=>{builds++;return {...payload(),forced,sequence:builds}};
  return {c,cache,entries,tick:ms=>now+=ms,counts:()=>({syncs,builds})};
}

function client(storage=new Map()){
  const elements=new Map(['srcPill','srcTxt'].map(k=>[k,{}]));
  const c=vm.createContext({console,Date,URL,URLSearchParams,AbortController,Promise,setTimeout,clearTimeout,setInterval:()=>{},
    location:{search:''},document:{getElementById:id=>elements.get(id)},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    PHASE_SNAPSHOT_CONFIG:{seasonCode:'S26_27'},SNAPSHOT:{meta:{source:'snapshot'}},D:{meta:{source:'snapshot'}},LIVE:false,
    PUBLIC_SAVED_AT:0,PUBLIC_PENDING:false,PUBLIC_REQUEST_SEQUENCE:0,PUBLIC_ACTIVE_REQUEST:null,
    updateCountdowns:()=>{},preloadFreeAgencyData:()=>{},clearAnalyticsCache:()=>{},applyVerifiedSeasonData:x=>x,phaseDraftSnapshot:()=>({}),render:()=>{},alert:()=>{},
  });
  vm.runInContext(publicCode,c);
  return {c,storage,key:vm.runInContext('PUBLIC_STARTUP_CACHE_KEY',c),elements};
}

test('warm public response skips ESPN sync and all payload builders; reset and edits invalidate it',()=>{
  const s=server(),first=s.c.getPublicPayloadV46_(false);
  for(let i=0;i<10;i++)assert.deepEqual(clone(s.c.getPublicPayloadV46_(false)),clone(first));
  assert.deepEqual(s.counts(),{syncs:1,builds:1});
  assert.equal(s.c.getPublicPayloadV46_(true).forced,true);
  assert.deepEqual(s.counts(),{syncs:2,builds:2});
  s.c.onEdit({range:{getSheet:()=>({getName:()=>s.c.CONFIG_SHEET_PHASE_V1})}});
  assert.equal(s.c.getPublicPayloadV46_(false).sequence,3);
  s.tick(120000);
  assert.equal(s.c.getPublicPayloadV46_(false).sequence,4,'Expired response must not be used even if the platform has not evicted it');
  s.c.clearEspnDependentCachesV1_();
  assert.equal(s.c.getPublicPayloadV46_(false).sequence,5);
});

test('missing chunks, corrupt cache and cache write failures retain a valid rebuilt response',()=>{
  const s=server();s.c.getPublicPayloadV46_(false);
  const key=s.c.PUBLIC_PAYLOAD_CACHE_V46+'idx';
  s.entries.delete(JSON.parse(s.entries.get(key)).keys[0]);
  assert.equal(s.c.getPublicPayloadV46_(false).sequence,2);
  s.entries.set(key,'invalid JSON');
  assert.equal(s.c.getPublicPayloadV46_(false).sequence,3);
  s.cache.putAll=()=>{throw new Error('Cache unavailable')};
  assert.equal(s.c.getPublicPayloadV46_(true).sequence,4);
});

test('large responses keep chunks within limits and generations never mix',()=>{
  const s=server(),a={...payload(),note:'🦄'.repeat(100000)},b={...payload(),note:'B'.repeat(300000)};
  s.c.writePublicPayloadCacheV46_(s.cache,a);
  const previous=JSON.parse(s.entries.get(s.c.PUBLIC_PAYLOAD_CACHE_V46+'idx')).keys;
  s.c.writePublicPayloadCacheV46_(s.cache,b);
  const current=JSON.parse(s.entries.get(s.c.PUBLIC_PAYLOAD_CACHE_V46+'idx')).keys;
  assert.equal(current.some(k=>previous.includes(k)),false);
  for(const k of [...previous,...current])assert.ok(Buffer.byteLength(s.entries.get(k))<100000);
  assert.equal(s.c.readPublicPayloadCacheV46_(s.cache).note,b.note);
});

test('saved public data is present at the first render, never marked LIVE, and excludes private fields',()=>{
  const b=client(),input={...payload(),token:'private-token',monster:{private:true},consensus:{private:true}};
  b.c.savePublicStartupPayload(input,b.c.apiUrl());
  const saved=JSON.parse(b.storage.get(b.key));
  assert.equal(saved.data.token,undefined);assert.equal(saved.data.monster,undefined);assert.equal(saved.data.consensus,undefined);
  let firstRender;
  b.c.render=()=>{firstRender=clone(b.c.D)};
  b.c.jsonp=()=>new Promise(()=>{});
  vm.runInContext(html.slice(html.indexOf('/* Start */'),html.indexOf('</script>',html.indexOf('/* Start */'))),b.c);
  assert.deepEqual(firstRender.draftTop25,input.draftTop25);
  assert.equal(b.c.LIVE,false);assert.equal(b.c.PUBLIC_PENDING,true);
});

test('cache respects season, API, TTL, reset flag and unavailable storage',()=>{
  const b=client();b.c.savePublicStartupPayload(payload(),b.c.apiUrl());const valid=b.storage.get(b.key);
  for(const patch of [{season:'S25_26'},{base:'https://other.invalid'},{savedAt:Date.now()-86400001},{savedAt:Date.now()+60000},{version:0}]){
    b.storage.set(b.key,JSON.stringify({...JSON.parse(valid),...patch}));assert.equal(b.c.restorePublicStartupPayload(),false);
  }
  b.storage.set(b.key,valid);b.c.location.search='?_fba_refresh=1';assert.equal(b.c.restorePublicStartupPayload(),false);
  b.c.location.search='';assert.equal(b.c.restorePublicStartupPayload(),true);
  b.c.resetPublicStartupData();assert.equal(b.storage.has(b.key),false);assert.equal(b.c.PUBLIC_SAVED_AT,0);
  b.c.localStorage.getItem=()=>{throw new Error('Storage blocked')};b.c.localStorage.setItem=()=>{throw new Error('Quota')};
  assert.equal(b.c.restorePublicStartupPayload(),false);assert.ok(b.c.savePublicStartupPayload(payload(),'source')>0);
});

test('background refresh coalesces duplicates and a failed fetch keeps the saved 25 cards',async()=>{
  const b=client();b.c.savePublicStartupPayload(payload(),b.c.apiUrl());b.c.restorePublicStartupPayload();
  let resolve,calls=0;b.c.jsonp=()=>{calls++;return new Promise(r=>resolve=r)};
  const a=b.c.loadLive(null,true),duplicate=b.c.loadLive(null,true);
  assert.equal(a,duplicate);assert.equal(calls,1);assert.equal(b.c.D.draftTop25.length,25);assert.equal(b.c.LIVE,false);
  resolve({...payload(),meta:{source:'updated'}});assert.equal(await a,true);assert.equal(b.c.LIVE,true);assert.equal(b.c.D.meta.source,'updated');
  b.c.jsonp=()=>Promise.reject(new Error('Offline'));b.c.fetchPublicFallback=()=>Promise.reject(new Error('Offline'));
  assert.equal(await b.c.loadLive(null,true),false);assert.equal(b.c.D.draftTop25.length,25);assert.equal(b.c.LIVE,false);
  assert.equal(b.elements.get('srcTxt').textContent,'GESPEICHERT');assert.equal(b.c.PUBLIC_PENDING,false);
});

test('late responses cannot overwrite a changed source or re-enable a cleared source',async()=>{
  const b=client(),resolvers=[];b.c.jsonp=()=>new Promise(resolve=>resolvers.push(resolve));
  const old=b.c.loadLive('https://old.invalid',true),fresh=b.c.loadLive('https://new.invalid',true);
  resolvers[1]({...payload(),meta:{source:'new'}});await fresh;
  resolvers[0]({...payload(),meta:{source:'old'}});assert.equal(await old,false);assert.equal(b.c.D.meta.source,'new');
  const pending=b.c.loadLive('https://new.invalid',true);b.c.resetPublicStartupData();resolvers[2](payload());
  assert.equal(await pending,false);assert.equal(b.c.D.meta.source,'snapshot');assert.equal(b.storage.has(b.key),false);
});

test('HTTP fallback aborts rather than waiting indefinitely',async()=>{
  const b=client();let timeout,cleared=false;
  b.c.setTimeout=(fn,ms)=>{assert.equal(ms,15000);timeout=fn;return 1};b.c.clearTimeout=()=>{cleared=true};
  b.c.fetch=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('Aborted'))));
  const pending=b.c.fetchPublicFallback('https://example.invalid');timeout();await assert.rejects(pending,/Aborted/);assert.equal(cleared,true);
});
