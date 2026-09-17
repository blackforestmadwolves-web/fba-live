/* Authenticated projections overlay the immutable draft metadata by ESPN ID.
 * Draft views keep missing projections empty; history stays a separate comparison.
 * No source data is embedded here or persisted to public/local caches.
 */
(function(root){
  'use strict';
  const fields=['PTS','REB','AST','3PM','STL','BLK','FGM','FGA','FTM','FTA'];
  function withoutProjection(player){return Object.freeze({...player,...Object.fromEntries(fields.map(k=>[k,null])),projectedGp:null,projectionReady:false,projectionMissing:true,projectionBasis:null,projectionSourceIds:[],source:'Expert-Projektion fehlt'});}
  function sourceLabel(ids){const names={cbs:'CBS Sports',espn:'ESPN',yahoo:'Yahoo / RotoWire',lineupexperts:'LineupExperts',hashtag:'Hashtag Basketball',fantasypros:'FantasyPros',fanscout:'FanScout',basketballreference:'Basketball-Reference'};return (ids||[]).map(id=>names[id]||id).join(' + ');}
  function statValue(player,cat){
    if(player.projectionMissing)return '–';
    let value=player[cat];
    if(cat==='FG%'||cat==='FT%'){const made=player[cat==='FG%'?'FGM':'FTM'],attempts=player[cat==='FG%'?'FGA':'FTA'];value=typeof made==='number'&&typeof attempts==='number'&&attempts>0?made/attempts*100:null;}
    return typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})+(cat.includes('%')?'%':''):'–';
  }
  function overlay(pool,engine,{ready=false,finish,issue,projectionOnly=false}={}){
    const missing=projectionOnly?withoutProjection:player=>player;
    if(!ready||!engine||!Array.isArray(engine.players))return projectionOnly?Object.freeze(pool.map(missing)):pool;
    const records=new Map(),duplicates=new Set();
    for(const record of engine.players){const id=String(record.id||record.playerId||'');if(!id)continue;if(records.has(id))duplicates.add(id);else records.set(id,record);}
    let changed=false;
    const result=pool.map(player=>{
      const id=String(player.id),record=records.get(id);if(!record||duplicates.has(id)||issue(record))return missing(player);
      const seasons=[engine.season,engine.seasonId,engine.baseline?.season,engine.baseline?.seasonId,record.seasonId,record.consensus?.seasonId].filter(s=>s!=null&&s!=='');
      if(!seasons.length||seasons.some(s=>!['2027','2026/27','2026-27','2026/2027','2026-2027'].includes(String(s))))return missing(player);
      let projection;try{projection=finish(record);}catch{return missing(player);}
      if(!projection||!Number.isInteger(projection.finishGp)||projection.finishGp<=0||projection.finishGp>82||fields.some(k=>typeof projection.perGame?.[k]!=='number'||!Number.isFinite(projection.perGame[k])||projection.perGame[k]<0))return missing(player);
      changed=true;const sourceIds=record.consensus?.sourceIds||['espn'];
      return Object.freeze({...player,...Object.fromEntries(fields.map(k=>[k,projection.perGame[k]])),projectedGp:projection.finishGp,projectionReady:true,
        projectionMissing:false,projectionBasis:projection.actualGp>0?'Ist + Rest 2026/27':'Expert-Projektion 2026/27',source:sourceLabel(sourceIds)+' · 2026/27',projectionSourceIds:sourceIds.slice()});
    });
    return changed||projectionOnly?Object.freeze(result):pool;
  }
  let cache=null;
  const request={data:null,pending:null,loading:false,error:null};
  function dataFor(fallback){
    if(!monsterUnlocked())return null;
    if(!request.data)return fallback||null;
    // A later complete Monster response can include newer actual games.
    const other=fallback?.projectionEngine,actual=other?.actual||{};
    const hasActuals=Number(actual.completeGames||0)>0||Number(actual.inProgressRows||0)>0||(actual.pendingEventIds||[]).length>0;
    return other&&Date.parse(fallback.generated)>Date.parse(request.data.generated)&&(other.active||hasActuals)?fallback:request.data;
  }
  function updateViews(){
    cache=null;
    if(typeof resetMaikValueContext==='function')resetMaikValueContext();
    if(CUR==='draft')refreshDraftPage(true);
    else if(CUR==='predraft')root.draftPreparationRefresh?.();
  }
  function load(refreshSources=false){
    if(!monsterUnlocked()){request.data=null;request.error=null;cache=null;return Promise.resolve();}
    if(request.pending)return request.pending;
    if(!refreshSources&&!request.error&&request.data&&state(request.data).ready)return Promise.resolve(request.data);
    request.loading=true;request.error=null;
    const token=monsterToken();
    request.pending=(async()=>{
      // Defer until request.pending is assigned before a view rerender.
      await Promise.resolve();updateViews();
      try{
        if(refreshSources){const checked=await monsterJsonp({monster:'projections_refresh',token});if(!checked?.ok){if(checked?.locked)localStorage.removeItem(MONSTER_SESSION_KEY);throw new Error(checked?.error||'Quellenprüfung fehlgeschlagen.');}}
        const result=await monsterJsonp({monster:'draft_projections',token});
        if(!result?.ok){if(result?.locked)localStorage.removeItem(MONSTER_SESSION_KEY);throw new Error(result?.error||'Draft-Projektionen konnten nicht geladen werden.');}
        if(!monsterUnlocked()||monsterToken()!==token)return;
        if(result.version<72||result.scope!=='draft-projections'||!result.projectionEngine)throw new Error('Die Datenquelle unterstützt den neuen Projektionsabruf noch nicht.');
        request.data=result;
        const loaded=state(result);
        if(!loaded.ready)request.error=loaded.engine?.consensus?.message||loaded.issue||'Noch keine vollständigen Expert-Projektionen freigegeben.';
        return result;
      }catch(error){request.error=error?.message||String(error);}
      finally{if(!monsterUnlocked())request.data=null;request.loading=false;request.pending=null;updateViews();}
    })();
    return request.pending;
  }
  function state(data){
    data=dataFor(data);
    const state=monsterProjectionEngineState(data,undefined,{purpose:"draft"}),actual=state.actual||{};
    // Before the first season game, a missing daily-boxscore sync cannot hide a confirmed season forecast.
    // Matchup calculations continue to use the unchanged, stricter Monster readiness gate.
    if(!state.ready&&state.active&&state.engineReady&&state.baselineReady&&state.players.length&&state.engine?.consensus?.preseason===true&&Number(actual.completeGames||0)===0&&Number(actual.inProgressRows||0)===0&&Number(actual.excludedFinalRows||actual.missingFinalRows||0)===0&&!(actual.missingEventIds||[]).length&&!(actual.pendingEventIds||[]).length&&!(actual.inProgressEventIds||[]).length)return {...state,ready:true,issue:''};
    return state;
  }
  function currentPool(pool){
    const projectionOnly=typeof CUR!=='undefined'&&(CUR==='draft'||CUR==='predraft');
    let data=null;try{if(monsterUnlocked())data=projectionOnly?dataFor(MONSTER_STATE.data):MONSTER_STATE.data;}catch{}
    if(cache?.pool===pool&&cache.data===data&&cache.projectionOnly===projectionOnly)return cache.result;
    const projectionState=projectionOnly?state(data):monsterProjectionEngineState(data);
    const result=overlay(pool,projectionState.engine,{ready:projectionState.ready,issue:monsterProjectionRecordIssue,finish:monsterProjectionSeasonFinish,projectionOnly});
    cache={pool,data,projectionOnly,result};return result;
  }
  async function reload(){if(request.pending)await request.pending;request.data=null;cache=null;const result=await load(false);if(request.error)throw new Error(request.error);return result;}
  root.FBA_DRAFT_PROJECTIONS=Object.freeze({overlay,currentPool,sourceLabel,statValue,state,load,reload});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.FBA_DRAFT_PROJECTIONS;
  root.draftProjectionSourceMarkup=function(){
    const pool=draftPool(),projected=pool.filter(p=>p.projectionBasis).length,authorized=monsterUnlocked(),engine=dataFor(MONSTER_STATE.data)?.projectionEngine,consensus=engine?.consensus;
    const problem=request.error||(!projected&&!request.loading&&engine?state(dataFor(MONSTER_STATE.data)).issue:'');
    const status=request.loading?'Expert-Projektionen werden geladen …':!authorized?'Expert-Projektionen · bitte entsperren':problem?'Expert-Projektionen · Abruf prüfen':projected?`Expert-Projektionen 2026/27 · ${projected}/${pool.length} Spieler`:'Expert-Projektionen 2026/27 · noch nicht geladen';
    const active=(consensus?.sources||[]).filter(s=>s.contributing).map(s=>s.id);
    const providerRows=(consensus?.sources||[]).filter(s=>['espn','cbs','lineupexperts','hashtag'].includes(s.id)).map(s=>{
      const mapping=s.mapping,pending=mapping?.issues||[],time=s.refreshMode==='manual_import'?s.lastImported:s.lastChecked||consensus.lastAttempt;
      return `<p><strong>${E(sourceLabel([s.id]))}</strong>: ${Number(s.rows)||0} gültige Projektionen${mapping?` · ${Number(mapping.matched)||0} zugeordnet · ${Number(mapping.pending)||0} offen`:''}. ${E(s.reason||'')}${s.providerUpdatedAt?` Anbieter-Update: ${E(s.providerUpdatedAt)}.`:''}${time?` Stand unseres ${s.refreshMode==='manual_import'?'Imports':'Abrufs'}: ${E(monsterProjectionTimestamp(time))}.`:''}</p>${pending.length?`<details><summary>${E(sourceLabel([s.id]))}: offene Zuordnungen (${Number(mapping.pending)||pending.length})</summary><p>${pending.map(r=>`${E(r.name)} · ${E(r.reason==='UNMATCHED_PLAYER'?'Spieler noch nicht eindeutig zugeordnet':r.reason)}`).join('<br>')}</p></details>`:''}`;
    }).join('');
    const mergedPlayers=pool.filter(p=>p.projectionSourceIds?.length>1).length;
    const coverage=active.length>1?`<p>${mergedPlayers} Spieler im Pool mit mehreren Quellen. Je Statistik zählt der Mittelwert der vorhandenen unabhängigen Quellen. FG% und FT% werden aus gemittelten Treffern und Versuchen berechnet; LineupExperts liefert dafür aktuell keine Wurfversuche. Fehlende Quellenwerte werden beim Zusammenführen nicht mit 0 aufgefüllt.</p>`:'';
    return `<details class="draft-projection-source"${problem||!authorized?' open':''}><summary>${E(status)}${active.length?` · ${E(sourceLabel(active))}`:''}</summary>${problem?`<p role="alert">${E(problem)}${projected?' Die zuletzt geladenen Werte bleiben sichtbar.':''}</p>`:''}<p>${E(active.length?`Aktive Quellen: ${sourceLabel(active)}. ${active.length===1?'Eine Quelle – aktuell noch kein Mehrquellen-Mittelwert.':'Unabhängige Quellen werden je Statistik gleich gewichtet.'}`:'Bestätigte Quellen: ESPN, CBS Sports, LineupExperts und Hashtag Basketball.')}</p>${coverage}${providerRows}<p>Die Monster Projection kombiniert die Saison-Projections für den Draft. Simulation und Matchup-Prognosen benötigen separat bestätigte, aktuelle ROS-Projections.</p><p>${pool.length-projected} Spieler im Pool haben noch keine vollständige Expert-Projektion. Im Spielerpool bleiben ihre Quellwerte offen. Werden sie gedraftet, zählt die Draft-Auswertung sie mit gekennzeichnetem 0-Statistikbeitrag und FBA-Value 0 als Ersatz. Saisonwerte 2025/26 stehen separat als Vergleich in der Vorbereitung.</p><p>${consensus?.frozen?'Die Saisonbasis ist eingefroren; bestätigte Spiele ersetzen erwartete Spiele.':'ESPN und CBS werden vor Saisonbeginn täglich geprüft; erneute Quellenprüfung frühestens nach 15 Minuten. LineupExperts nutzt den zuletzt geprüften Import. Dieser Button lädt keinen neuen LineupExperts- oder Hashtag-Webstand. Hashtag wird separat über den geplanten Cloud-Abgleich aktualisiert.'}</p>${authorized?`<button class="btn" type="button" onclick="FBA_DRAFT_PROJECTIONS.load(${problem?'false':'true'})"${request.loading?' disabled':''}>${problem?'Erneut laden':'Projektionen aktualisieren'}</button>`:`<button class="btn" type="button" onclick="openMonsterGate()">Projektionen entsperren</button>`}${authorized&&root.FBA_HASHTAG?`<div data-hashtag-sync-panel>${root.FBA_HASHTAG.markup(consensus?.sources?.find(s=>s.id==='hashtag'))}</div>`:''}</details>`;
  };
})(typeof window==='object'?window:globalThis);
