/* ESPN Mock session: verified readback, live clock and conservative one-click drafting. */
(function(root){
  'use strict';
  const KEY='fba_espn_mock_v1',core=root.FBA_ESPN_MOCK_CORE;
  let config=null,backup=null,paused=false,pending=null,pendingAt=0,request=null,draftRequest=null,snapshot=null,generation=0,busy=false,lastValid=0;
  let message='Chrome/Edge-Erweiterung installieren, dann deinen ESPN-Mock verbinden.',tone='neutral';
  let poolStatus='';
  let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
  const copy=value=>JSON.parse(JSON.stringify(value));
  const active=()=>Boolean(config);
  function refresh(){
    if(typeof CUR!=='undefined'&&CUR!=='draft')return;
    const focused=document.activeElement,id=focused?.id,start=focused?.selectionStart,end=focused?.selectionEnd;
    refreshDraftPage(true);
    const replacement=id&&document.getElementById(id);
    if(replacement){replacement.focus?.({preventScroll:true});if(Number.isInteger(start)&&Number.isInteger(end))replacement.setSelectionRange?.(start,end);}
    updateClock();
  }
  function status(text,type='neutral'){
    message=text;tone=type;const box=document.getElementById('espnMockStatus');
    if(box){box.textContent=text;box.dataset.tone=type;}updateClock();
  }
  function save(){
    if(!config)return;
    saved={version:1,config:copy(config),state:copy(DRAFT_STATE),lastValid};
    try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{status('Mock läuft, konnte aber nicht auf diesem Gerät gespeichert werden.','warning');}
  }
  function draftGate(now=Date.now()){
    if(!config)return {ok:false,reason:'Noch nicht mit ESPN verbunden.',remainingMs:null};
    if(paused)return {ok:false,reason:'ESPN-Übernahme ist pausiert.',remainingMs:core.remaining(snapshot,now)};
    if(pending)return {ok:false,reason:'Ein geänderter ESPN-Verlauf muss zuerst geprüft werden.',remainingMs:core.remaining(snapshot,now)};
    if(draftRequest)return {ok:false,reason:'Der Pick wartet auf ESPNs Bestätigung.',remainingMs:core.remaining(snapshot,now)};
    return core.canDraft(snapshot,config,now);
  }
  function clockFormat(ms){
    if(!Number.isFinite(ms))return '--:--';
    const seconds=Math.max(0,Math.ceil(ms/1000));
    return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  }
  function clockState(now=Date.now()){
    const gate=draftGate(now),remainingMs=core.remaining(snapshot,now);
    const urgent=gate.ok&&remainingMs<6000;
    return {ready:gate.ok,label:clockFormat(remainingMs),remainingMs,urgent,detail:gate.ok?(urgent?'ESPN live · unter 6 Sek. · Pick bleibt freigegeben':'ESPN live · Pick freigegeben'):gate.reason};
  }
  function updateClock(){
    if(!config)return;
    const state=clockState(),clock=document.getElementById('draftClockSeconds'),sync=document.getElementById('draftClockSync');
    if(clock){clock.textContent=state.label;clock.dataset.ready=state.ready?'true':'false';clock.dataset.urgent=state.urgent?'true':'false';}
    if(sync)sync.textContent=state.detail;
    document.querySelectorAll('.draft-pick-action[data-espn-player-id]').forEach(button=>{
      button.disabled=!state.ready;
      button.textContent=draftRequest?'Warte auf ESPN …':state.ready?`Bei ESPN draften · ${state.label}`:'Warte auf ESPN';
      button.title=state.detail;
    });
    document.querySelectorAll('.draft-player-pick-portrait[data-espn-player-id]').forEach(portrait=>{
      portrait.setAttribute('aria-disabled',state.ready?'false':'true');portrait.title=state.ready?`Bei ESPN draften · ${state.label}`:state.detail;
    });
  }
  function markup(){
    const last=saved?.version===1?saved.config:null;
    return `<section class="espn-mock-panel draft-glass" aria-label="ESPN Mock Draft Verbindung"><div class="espn-mock-heading"><b>ESPN Mock Draft</b><span>Bridge 0.3.3 · Chrome / Edge</span></div>${config?`<p>${E(config.name)} · ESPN-Draftplatz ${config.ownSlot} → ${E(config.ownTeam)}</p><div class="espn-mock-actions"><button type="button" onclick="FBA_ESPN_MOCK.togglePause()">${paused?'Übernahme fortsetzen':'Übernahme pausieren'}</button><button type="button" onclick="FBA_ESPN_MOCK.disconnect()">Zurück zum lokalen Test</button>${pending?`<button type="button" onclick="FBA_ESPN_MOCK.acceptCorrection()">Geänderten ESPN-Stand übernehmen (${pending.length} Picks)</button>`:''}</div>`:`<details ${busy?'open':''}><summary>Mock verbinden / fortsetzen</summary><p>Installiere zuerst die FBA Bridge 0.3.3. Beide Seiten müssen im selben Browser-Profil geöffnet sein. Wähle bei ESPN <b>Pick History → All Rounds</b> und lasse diese Ansicht offen.</p><form onsubmit="event.preventDefault();FBA_ESPN_MOCK.connectFromForm()"><label>ESPN-Draft-Link oder Liga-ID<input id="espnMockRoom" type="text" autocomplete="off" spellcheck="false" placeholder="https://fantasy.espn.com/basketball/draft?leagueId=…" value="${E(last?.leagueId||'')}" required></label><label>Dein ESPN-Draftplatz<select id="espnMockSlot"><option value="">Auswählen – bei Team-ID im Link automatisch</option>${Array.from({length:8},(_,i)=>i+1).map(slot=>`<option value="${slot}"${slot===last?.ownSlot?' selected':''}>Platz ${slot}</option>`).join('')}</select></label><p>Dein aktuell gewähltes FBA-Team übernimmt diesen Draftplatz. Unterstützt: öffentliche 8-Team-Snake-Mocks mit 13 Runden.</p><button type="submit"${busy?' disabled':''}>${busy?'ESPN-Raum wird geprüft …':'Mock verbinden'}</button></form></details>`}${savedReviewMarkup()}<p class="espn-pool-status">${E(poolStatus||`${root.FBA_DRAFT_PLAYER_POOL.count()} ESPN-Spieler verfügbar · vollständiger Neuabgleich beim Verbinden.`)}</p><p id="espnMockStatus" role="status" aria-live="polite" data-tone="${tone}">${E(message)}</p><small>Die Restzeit kommt aus der sichtbaren ESPN-Uhr. Ein Bildklick bleibt während deines Zugs bis zum Ablauf freigegeben; unter sechs Sekunden erscheint nur eine Warnung. FBA übernimmt den Pick erst, wenn ESPN ihn in der Pick History bestätigt. Zugangsdaten werden nicht übertragen.</small></section>`;
  }
  function savedReviewMarkup(){
    const teams=saved?.config?.fbaTeams,picks=saved?.state?.picks;
    if(saved?.version!==1||!Array.isArray(teams)||!Array.isArray(picks)||!root.FBA_DRAFT_REVIEW?.completion(teams,picks).complete)return '';
    return '<div class="espn-mock-actions"><button type="button" onclick="FBA_ESPN_MOCK.reviewSaved()">Letzten gespeicherten Mock analysieren</button></div>';
  }
  function reviewSaved(){
    const ok=Boolean(root.openSavedDraftReview?.(saved));
    if(!ok)status('Kein vollständiger, gültiger Mock mit 104 Picks auf diesem Gerät gespeichert.','warning');
    return ok;
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
      try{
        const players=await root.FBA_DRAFT_PLAYER_POOL.fetchPlayers(room,{signal:abort.signal});
        if(id!==generation)return false;
        root.FBA_DRAFT_PLAYER_POOL.add(players);
        poolStatus=`${players.length} ESPN-Spieler beim Verbinden vollständig geladen.`;
      }catch(error){
        poolStatus=`Spielerkatalog nicht neu abrufbar · ${root.FBA_DRAFT_PLAYER_POOL.count()} gespeicherte Spieler verfügbar. Eindeutige ESPN-Picks werden weiterhin übernommen.`;
      }
      const ownSlot=room.teamId?meta.teams.findIndex(t=>t.id===room.teamId)+1:Number(chosenSlot);
      const teams=draftTeams(),ownTeam=teams.includes(DRAFT_STATE.myTeam)?DRAFT_STATE.myTeam:teams.find(t=>t==='BlackForest Mad Wolves')||teams[0];
      const nextConfig={...meta,ownSlot,ownTeam,fbaTeams:core.teamOrder(teams,ownTeam,ownSlot)};
      saveDraftState();backup=copy(DRAFT_STATE);
      let next=draftDefaultState();next.myTeam=ownTeam;
      if(saved?.version===1&&saved.config?.leagueId===room.leagueId&&saved.config.seasonId===room.seasonId&&JSON.stringify(saved.config.fbaTeams)===JSON.stringify(nextConfig.fbaTeams)){
        try{
          const restored=core.picks({protocol:1,...room,ready:true,picks:saved.state.picks.map(p=>({overall:p.overall,playerId:p.playerId,name:p.playerName||draftPlayerById(p.playerId)?.name||'',team:meta.teams[core.slotFor(p.overall)-1]?.name||''}))},nextConfig,draftPool());
          root.FBA_DRAFT_PLAYER_POOL.learnPicks(restored);
          next.picks=restored;next.goal=root.FBA_DRAFT_COACH.normalizeGoal(saved.state.goal);next.punts=root.FBA_DRAFT_COACH.normalizePunts(saved.state.punts);next.hunt=DRAFT_CATS.includes(saved.state.hunt)?saved.state.hunt:null;
          next.rotoMode=root.FBA_DRAFT_LIVE.mode(saved.state.rotoMode);next.sort=draftPlayerSortMode(saved.state);next.poolFocus=root.FBA_DRAFT_POOL_TOOLS.normalizeFocus(saved.state.poolFocus);next.poolPosition=root.FBA_DRAFT_POOL_TOOLS.normalizePosition(saved.state.poolPosition);
        }catch{status('Gespeicherter Mock-Stand konnte nicht übernommen werden. Es wird neu aus ESPN gelesen.','warning');}
      }
      config=nextConfig;paused=false;pending=null;request=null;draftRequest=null;snapshot=null;lastValid=0;
      Object.assign(DRAFT_STATE,next);closeDraftCoachPreview();save();
      status('Warte auf Bridge 0.3.3, ESPN Pick History und die sichtbare Draft-Uhr.');refresh();tick();return true;
    }catch(error){if(id===generation)status(error.name==='AbortError'?'ESPN antwortet zu langsam. Bitte erneut verbinden.':error.message||'ESPN konnte nicht erreicht werden.','warning');return false;}
    finally{clearTimeout(timeout);busy=false;}
  }
  function tick(){
    if(!config||paused)return;
    const now=Date.now();
    if(draftRequest){
      // Allow the ID-based autocomplete search plus ESPN's confirmation window.
      if(now-draftRequest.at<10000)return;
      draftRequest=null;status('Keine Pick-Bestätigung von ESPN. FBA bleibt unverändert und liest den Draft neu ein.','warning');
    }
    if(request){
      if(now-request.at<8000)return;
      request=null;status('Keine Antwort der Erweiterung. Bridge 0.3.3 aktivieren und beide Tabs neu laden. Der letzte Stand bleibt erhalten.','warning');
    }
    const nonce=`${generation}-${now}-${Math.random().toString(36).slice(2)}`;
    request={nonce,at:now,generation};
    root.postMessage({type:'FBA_MOCK_REQUEST',protocol:1,nonce,leagueId:config.leagueId,seasonId:config.seasonId},root.location.origin);
  }
  function apply(next){
    root.FBA_DRAFT_PLAYER_POOL.learnPicks(next);
    DRAFT_STATE.picks=next;DRAFT_STATE.history=[];pending=null;save();refresh();
  }
  function receiveRead(data){
    if(!request||data.nonce!==request.nonce||request.generation!==generation)return;
    request=null;snapshot=data.response;
    try{
      if(!snapshot?.ready)throw new Error(snapshot?.message||'Der ESPN-Pick-Verlauf ist noch nicht verfügbar.');
      if(Number(snapshot.bridgeVersion)<4)throw new Error('Für Uhr und direkte Picks bitte Bridge 0.3.3 laden und beide Tabs neu laden.');
      if(!Number.isFinite(snapshot.observedAt)||Math.abs(Date.now()-snapshot.observedAt)>30000)throw new Error('Der empfangene ESPN-Stand ist veraltet. Bitte den ESPN-Tab prüfen.');
      if(snapshot.teamId&&Number(snapshot.teamId)!==config.teams[config.ownSlot-1].id)throw new Error('Dein ESPN-Team passt nicht zum gewählten Draftplatz. Verbinde erneut mit dem vollständigen Draft-Link.');
      const next=core.picks(snapshot,config,draftPool());
      if(core.changed(DRAFT_STATE.picks,next)){
        pending=next;pendingAt=Date.now();status('ESPN zeigt eine Änderung an bisherigen Picks. Prüfe den Verlauf und bestätige den neuen Stand.','warning');refresh();return;
      }
      const hadPending=Boolean(pending);pending=null;lastValid=Date.now();
      const time=new Date(lastValid).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      status(`ESPN live um ${time} · ${next.length}/104 Picks${next.length===104?' · Draft komplett':''}`,'good');
      if(next.length!==DRAFT_STATE.picks.length)apply(next);else if(hadPending)refresh();else updateClock();
    }catch(error){status(error.message||'ESPN-Verlauf konnte nicht eindeutig geprüft werden.','warning');}
  }
  function receiveDraft(data){
    if(!draftRequest||data.nonce!==draftRequest.nonce||draftRequest.generation!==generation)return;
    const sent=draftRequest;draftRequest=null;
    try{
      const response=data.response;
      if(!response?.ok||!response.confirmed)throw new Error(response?.message||'ESPN hat den Pick nicht bestätigt.');
      snapshot=response.snapshot;
      const next=core.picks(snapshot,config,draftPool()),confirmed=next.find(p=>p.overall===sent.overall&&String(p.playerId)===sent.playerId);
      if(!confirmed)throw new Error('ESPNs Bestätigung passt nicht eindeutig zum gesendeten Spieler.');
      lastValid=Date.now();status(`ESPN bestätigt: ${sent.playerName} · Pick ${sent.overall}`,'good');apply(next);
      showDraftToast(`${sent.playerName} wurde von ESPN als Pick ${sent.overall} bestätigt.`,false);
    }catch(error){status(error.message||'ESPN hat den Pick nicht bestätigt. FBA bleibt unverändert.','warning');showDraftToast(error.message||'Pick nicht bestätigt.',false);tick();}
  }
  function receive(event){
    const data=event.data;
    if(event.source!==root||event.origin!==root.location.origin||!config||paused||data?.protocol!==1)return;
    if(data.type==='FBA_MOCK_RESPONSE')receiveRead(data);
    else if(data.type==='FBA_MOCK_DRAFT_RESPONSE')receiveDraft(data);
  }
  function draft(id){
    if(!config)return false;
    const player=draftPlayerById(id),already=DRAFT_STATE.picks.some(p=>String(p.playerId)===String(id));
    if(!player||already){showDraftToast(already?'Dieser Spieler ist bereits gedraftet.':'Spieler nicht gefunden.',false);return false;}
    const gate=draftGate();
    if(!gate.ok){status(gate.reason,'warning');showDraftToast(gate.reason,false);return false;}
    const next=nextOpenDraftPick();
    if(!next||next.overall!==gate.overall||next.team!==config.ownTeam){status('FBA- und ESPN-Draftstand sind nicht eng genug synchronisiert. Bitte einen Moment warten.','warning');return false;}
    const now=Date.now(),nonce=`draft-${generation}-${now}-${Math.random().toString(36).slice(2)}`;
    draftRequest={nonce,at:now,generation,overall:gate.overall,playerId:String(player.id),playerName:player.name};
    status(`${player.name} wird für Pick ${gate.overall} an ESPN gesendet …`);
    root.postMessage({type:'FBA_MOCK_DRAFT_REQUEST',protocol:1,nonce,leagueId:config.leagueId,seasonId:config.seasonId,playerId:String(player.id),playerName:player.name,expectedOverall:gate.overall,minimumRemainingMs:0},root.location.origin);
    updateClock();return true;
  }
  function acceptCorrection(){
    if(!config||!pending)return;
    if(Date.now()-pendingAt>30000){pending=null;status('Die Änderung ist nicht mehr aktuell. Bitte den ESPN-Verlauf erneut lesen lassen.','warning');refresh();return;}
    const next=pending;lastValid=Date.now();status(`Geänderter ESPN-Verlauf übernommen · ${next.length}/104 Picks`,'good');apply(next);
  }
  function togglePause(){
    if(!config)return;if(draftRequest){status('Bitte erst die laufende ESPN-Pick-Bestätigung abwarten.','warning');return;}
    paused=!paused;request=null;status(paused?'Übernahme pausiert. Angezeigt wird der letzte geprüfte Stand.':'Übernahme wird fortgesetzt.');refresh();if(!paused)tick();
  }
  function disconnect(){
    if(draftRequest){status('Bitte erst die laufende ESPN-Pick-Bestätigung abwarten.','warning');return;}
    generation++;request=null;pending=null;paused=false;snapshot=null;save();config=null;
    if(backup){Object.assign(DRAFT_STATE,backup);backup=null;}
    closeDraftCoachPreview();status('Lokaler Test-Draft wiederhergestellt. Dein Mock ist separat gespeichert.');refresh();
  }
  root.FBA_ESPN_MOCK={isActive:active,teams:()=>config?.fbaTeams||null,canDraft:()=>draftGate().ok,clockState,draft,save,markup,reviewSaved,connect,connectFromForm,tick,receive,disconnect,togglePause,acceptCorrection,updateClock};
  root.addEventListener('message',receive);
  root.setInterval(tick,500);root.setInterval(updateClock,250);
})(typeof globalThis!=='undefined'?globalThis:this);
