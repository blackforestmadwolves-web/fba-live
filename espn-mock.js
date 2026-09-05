/* Local ESPN Mock session, independent from the existing manual draft. */
(function(root){
  'use strict';
  const KEY='fba_espn_mock_v1',core=root.FBA_ESPN_MOCK_CORE;
  let config=null,backup=null,paused=false,pending=null,pendingAt=0,request=null,generation=0,busy=false,lastValid=0;
  let message='Chrome/Edge-Erweiterung installieren, dann deinen ESPN-Mock verbinden.',tone='neutral';
  let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
  const copy=value=>JSON.parse(JSON.stringify(value));
  const active=()=>Boolean(config);
  function refresh(){
    if(typeof CUR!=='undefined'&&CUR!=='draft')return;
    const focused=document.activeElement,id=focused?.id,start=focused?.selectionStart,end=focused?.selectionEnd;
    refreshDraftPage(true);
    const replacement=id&&document.getElementById(id);
    if(replacement){replacement.focus?.({preventScroll:true});if(Number.isInteger(start)&&Number.isInteger(end))replacement.setSelectionRange?.(start,end);}
  }
  function status(text,type='neutral'){
    message=text;tone=type;const box=document.getElementById('espnMockStatus');
    if(box){box.textContent=text;box.dataset.tone=type;}
  }
  function save(){
    if(!config)return;
    saved={version:1,config:copy(config),state:copy(DRAFT_STATE),lastValid};
    try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{status('Mock läuft, konnte aber nicht auf diesem Gerät gespeichert werden.','warning');}
  }
  function markup(){
    const last=saved?.version===1?saved.config:null;
    return `<section class="espn-mock-panel draft-glass" aria-label="ESPN Mock Draft Verbindung"><div class="espn-mock-heading"><b>ESPN Mock Draft</b><span>Testversion · Chrome / Edge</span></div>${config?`<p>${E(config.name)} · ESPN-Draftplatz ${config.ownSlot} → ${E(config.ownTeam)}</p><div class="espn-mock-actions"><button type="button" onclick="FBA_ESPN_MOCK.togglePause()">${paused?'Übernahme fortsetzen':'Übernahme pausieren'}</button><button type="button" onclick="FBA_ESPN_MOCK.disconnect()">Zurück zum lokalen Test</button>${pending?`<button type="button" onclick="FBA_ESPN_MOCK.acceptCorrection()">Geänderten ESPN-Stand übernehmen (${pending.length} Picks)</button>`:''}</div>`:`<details ${busy?'open':''}><summary>Mock verbinden / fortsetzen</summary><p>Installiere zuerst die FBA ESPN Mock Bridge. Beide Seiten müssen im selben Browser-Profil geöffnet sein. Wähle bei ESPN <b>Pick History → All Rounds</b> und lasse diese Ansicht offen.</p><form onsubmit="event.preventDefault();FBA_ESPN_MOCK.connectFromForm()"><label>ESPN-Draft-Link oder Liga-ID<input id="espnMockRoom" type="text" autocomplete="off" spellcheck="false" placeholder="https://fantasy.espn.com/basketball/draft?leagueId=…" value="${E(last?.leagueId||'')}" required></label><label>Dein ESPN-Draftplatz<select id="espnMockSlot"><option value="">Auswählen – bei Team-ID im Link automatisch</option>${Array.from({length:8},(_,i)=>i+1).map(slot=>`<option value="${slot}"${slot===last?.ownSlot?' selected':''}>Platz ${slot}</option>`).join('')}</select></label><p>Dein aktuell gewähltes FBA-Team übernimmt diesen Draftplatz. Unterstützt: öffentliche 8-Team-Snake-Mocks mit 13 Runden.</p><button type="submit"${busy?' disabled':''}>${busy?'ESPN-Raum wird geprüft …':'Mock verbinden'}</button></form></details>`}<p id="espnMockStatus" role="status" aria-live="polite" data-tone="${tone}">${E(message)}</p><small>Die Erweiterung liest den angezeigten Pick-Verlauf etwa alle vier Sekunden. Deine Spieler wählst du weiterhin bei ESPN. Zugangsdaten werden nicht übertragen. Der angemeldete Live-Mock muss noch praktisch erprobt werden.</small></section>`;
  }
  async function connectFromForm(){
    const input=document.getElementById('espnMockRoom')?.value,slot=document.getElementById('espnMockSlot')?.value;
    return connect(input,slot);
  }
  async function connect(input,chosenSlot){
    if(busy||active())return false;
    let room;try{room=core.room(input);}catch(error){status(error.message,'warning');return false;}
    busy=true;const id=++generation;
    status('ESPN-Raum und Draft-Reihenfolge werden geprüft.');
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),15000);
    try{
      const url=`https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${room.seasonId}/segments/0/leagues/${room.leagueId}?view=mDraftDetail&view=mSettings&view=mTeam`;
      const response=await fetch(url,{credentials:'omit',cache:'no-store',signal:abort.signal});
      if(!response.ok)throw new Error('ESPN-Raum nicht verfügbar. Prüfe den Link; abgelaufene Mock-Räume werden möglicherweise entfernt.');
      const meta=core.metadata(await response.json(),room);
      if(id!==generation)return false;
      const ownSlot=room.teamId?meta.teams.findIndex(t=>t.id===room.teamId)+1:Number(chosenSlot);
      const teams=draftTeams(),ownTeam=teams.includes(DRAFT_STATE.myTeam)?DRAFT_STATE.myTeam:teams.find(t=>t==='BlackForest Mad Wolves')||teams[0];
      const nextConfig={...meta,ownSlot,ownTeam,fbaTeams:core.teamOrder(teams,ownTeam,ownSlot)};
      saveDraftState();backup=copy(DRAFT_STATE);
      let next=draftDefaultState();next.myTeam=ownTeam;
      // Restore only this exact room and mapping; validate persisted IDs and order again.
      if(saved?.version===1&&saved.config?.leagueId===room.leagueId&&saved.config.seasonId===room.seasonId&&JSON.stringify(saved.config.fbaTeams)===JSON.stringify(nextConfig.fbaTeams)){
        try{
          const restored=core.picks({protocol:1,...room,ready:true,picks:saved.state.picks.map(p=>({overall:p.overall,playerId:p.playerId,name:draftPlayerById(p.playerId)?.name||'',team:meta.teams[core.slotFor(p.overall)-1]?.name||''}))},nextConfig,draftPool());
          next.picks=restored;next.goal=root.FBA_DRAFT_COACH.normalizeGoal(saved.state.goal);next.punts=root.FBA_DRAFT_COACH.normalizePunts(saved.state.punts);next.hunt=DRAFT_CATS.includes(saved.state.hunt)?saved.state.hunt:null;
          next.sort=draftPlayerSortMode(saved.state);
        }catch{status('Gespeicherter Mock-Stand konnte nicht übernommen werden. Es wird neu aus ESPN gelesen.','warning');}
      }
      config=nextConfig;paused=false;pending=null;request=null;lastValid=0;
      Object.assign(DRAFT_STATE,next);closeDraftCoachPreview();save();
      status('Warte auf die Erweiterung und den geöffneten ESPN-Pick-Verlauf.');refresh();tick();return true;
    }catch(error){if(id===generation)status(error.name==='AbortError'?'ESPN antwortet zu langsam. Bitte erneut verbinden.':error.message||'ESPN konnte nicht erreicht werden.','warning');return false;}
    finally{clearTimeout(timeout);busy=false;}
  }
  function tick(){
    if(!config||paused)return;
    const now=Date.now();
    if(request){
      if(now-request.at<8000)return;
      request=null;status('Keine Antwort der Erweiterung. Bridge installieren/aktivieren und beide Tabs neu laden. Der letzte Stand bleibt erhalten.','warning');
    }
    const nonce=`${generation}-${now}-${Math.random().toString(36).slice(2)}`;
    request={nonce,at:now,generation};
    root.postMessage({type:'FBA_MOCK_REQUEST',protocol:1,nonce,leagueId:config.leagueId,seasonId:config.seasonId},root.location.origin);
  }
  function apply(next){
    DRAFT_STATE.picks=next;DRAFT_STATE.history=[];pending=null;save();refresh();
  }
  function receive(event){
    const data=event.data;
    if(event.source!==root||event.origin!==root.location.origin||!config||paused||!request||data?.type!=='FBA_MOCK_RESPONSE'||data.protocol!==1||data.nonce!==request.nonce||request.generation!==generation)return;
    request=null;
    const snapshot=data.response;
    try{
      if(!snapshot?.ready)throw new Error(snapshot?.message||'Der ESPN-Pick-Verlauf ist noch nicht verfügbar.');
      if(!Number.isFinite(snapshot.observedAt)||Math.abs(Date.now()-snapshot.observedAt)>30000)throw new Error('Der empfangene ESPN-Stand ist veraltet. Bitte den ESPN-Tab prüfen.');
      if(snapshot.teamId&&Number(snapshot.teamId)!==config.teams[config.ownSlot-1].id)throw new Error('Dein ESPN-Team passt nicht zum gewählten Draftplatz. Verbinde erneut mit dem vollständigen Draft-Link.');
      const next=core.picks(snapshot,config,draftPool());
      if(core.changed(DRAFT_STATE.picks,next)){
        pending=next;pendingAt=Date.now();status('ESPN zeigt eine Änderung an bisherigen Picks. Prüfe den Verlauf und bestätige den neuen Stand.','warning');refresh();return;
      }
      const hadPending=Boolean(pending);pending=null;lastValid=Date.now();
      const time=new Date(lastValid).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      status(`ESPN-Verlauf gelesen um ${time} · ${next.length}/104 Picks${next.length===104?' · Draft komplett':''}`,'good');
      if(next.length!==DRAFT_STATE.picks.length)apply(next);
      else if(hadPending)refresh();
    }catch(error){status(error.message||'ESPN-Verlauf konnte nicht eindeutig geprüft werden.','warning');}
  }
  function acceptCorrection(){
    if(!config||!pending)return;
    if(Date.now()-pendingAt>30000){pending=null;status('Die Änderung ist nicht mehr aktuell. Bitte den ESPN-Verlauf erneut lesen lassen.','warning');refresh();return;}
    const next=pending;lastValid=Date.now();status(`Geänderter ESPN-Verlauf übernommen · ${next.length}/104 Picks`,'good');apply(next);
  }
  function togglePause(){
    if(!config)return;paused=!paused;request=null;
    status(paused?'Übernahme pausiert. Angezeigt wird der letzte geprüfte Stand.':'Übernahme wird fortgesetzt.');refresh();if(!paused)tick();
  }
  function disconnect(){
    generation++;request=null;pending=null;paused=false;save();config=null;
    if(backup){Object.assign(DRAFT_STATE,backup);backup=null;}
    closeDraftCoachPreview();status('Lokaler Test-Draft wiederhergestellt. Dein Mock ist separat gespeichert.');refresh();
  }
  root.FBA_ESPN_MOCK={isActive:active,teams:()=>config?.fbaTeams||null,save,markup,connect,connectFromForm,tick,receive,disconnect,togglePause,acceptCorrection};
  root.addEventListener('message',receive);
  root.setInterval(tick,4000);
})(typeof globalThis!=='undefined'?globalThis:this);
