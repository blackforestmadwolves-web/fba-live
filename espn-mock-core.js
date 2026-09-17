/* ESPN Mock bridge: validate room metadata, rendered picks and conservative clock state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FBA_ESPN_MOCK_CORE=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const integer=(n,min=1,max=2147483647)=>Number.isInteger(Number(n))&&Number(n)>=min&&Number(n)<=max;
  const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const fail=message=>{throw new Error(message);};
  function room(input){
    const text=String(input??'').trim();let leagueId,seasonId=2027,teamId=null;
    if(/^\d+$/.test(text))leagueId=text;
    else{
      let u;try{u=new URL(text);}catch{fail('Bitte den ESPN-Mock-Link oder seine Liga-ID eingeben.');}
      if(u.origin!=='https://fantasy.espn.com'||!/^\/basketball\/(draft|waitingroom)\/?$/.test(u.pathname))fail('Benötigt wird der ESPN-Basketball-Link zum Draft- oder Warteraum.');
      leagueId=u.searchParams.get('leagueId');seasonId=u.searchParams.get('seasonId')||2027;teamId=u.searchParams.get('teamId');
    }
    if(!integer(leagueId)||!integer(seasonId,2020,2100)||(teamId!=null&&!integer(teamId)))fail('Liga, Saison oder Team im ESPN-Link ist ungültig.');
    return {leagueId:String(Number(leagueId)),seasonId:Number(seasonId),teamId:teamId==null?null:Number(teamId)};
  }
  function metadata(raw,expected){
    if(!raw||Number(raw.id)!==Number(expected.leagueId)||Number(raw.seasonId)!==expected.seasonId||Number(raw.gameId)!==3)fail('ESPN antwortet mit einer anderen Liga, Saison oder Sportart.');
    const settings=raw.settings||{},draft=settings.draftSettings||{},order=draft.pickOrder;
    if(!['MOCKDRAFT_LOBBY','MOCKDRAFT'].includes(draft.leagueSubType)||settings.isPublic!==true)fail('Diese Verbindung unterstützt öffentliche ESPN Mock Drafts.');
    if(draft.type!=='SNAKE'||Number(settings.size)!==8)fail('Bitte einen 8-Team-Snake-Mock wählen. Der FBA War Room hat acht Teams.');
    if(!Array.isArray(order)||order.length!==8||order.some(n=>!integer(n))||new Set(order.map(Number)).size!==8)fail('ESPN liefert noch keine eindeutige Draft-Reihenfolge.');
    if(!Array.isArray(raw.teams)||raw.teams.length!==8)fail('Die acht ESPN-Teams sind noch nicht vollständig verfügbar.');
    const teams=order.map(id=>{
      const team=raw.teams.find(t=>Number(t.id)===Number(id));if(!team)fail('Ein Team fehlt in der ESPN-Draft-Reihenfolge.');
      const name=String(team.name||[team.location,team.nickname].filter(Boolean).join(' ')||'').trim();
      if(!name||name.length>160)fail('Ein ESPN-Teamname ist nicht eindeutig lesbar.');
      return {id:Number(id),name};
    });
    if(new Set(teams.map(t=>normalize(t.name))).size!==8)fail('ESPN-Teamnamen sind doppelt. Eine sichere Zuordnung ist damit nicht möglich.');
    const scheduled=raw.draftDetail?.picks;
    if(!Array.isArray(scheduled)||scheduled.length!==104)fail('Dieser Test unterstützt ESPN Mocks mit acht Teams und 13 Runden.');
    for(let i=0;i<104;i++){
      const pick=scheduled.find(p=>Number(p.overallPickNumber)===i+1),slot=slotFor(i+1);
      if(!pick||Number(pick.teamId)!==teams[slot-1].id||pick.keeper||pick.reservedForKeeper)fail('Dieser Raum verwendet keine reguläre 13-Runden-Snake-Reihenfolge.');
    }
    return {...expected,name:String(settings.name||'ESPN Mock Draft').slice(0,160),teams};
  }
  function slotFor(overall){const round=Math.ceil(overall/8),pos=(overall-1)%8;return round%2?pos+1:8-pos;}
  function teamOrder(teams,ownTeam,slot){
    if(!Array.isArray(teams)||teams.length!==8||new Set(teams).size!==8||!teams.includes(ownTeam)||!integer(slot,1,8))fail('Eigenes Team und ESPN-Draftplatz auswählen.');
    const out=teams.filter(t=>t!==ownTeam);out.splice(Number(slot)-1,0,ownTeam);return out;
  }
  function picks(snapshot,config,pool){
    if(!snapshot||snapshot.protocol!==1||String(snapshot.leagueId)!==config.leagueId||Number(snapshot.seasonId)!==config.seasonId)fail('Der übertragene Verlauf gehört nicht zu diesem Mock Draft.');
    if(!snapshot.ready)fail(snapshot.message||'In ESPN Pick History → All Rounds öffnen.');
    if(!Array.isArray(snapshot.picks)||snapshot.picks.length>104)fail('Der ESPN-Verlauf ist unvollständig oder hat mehr als 104 Picks.');
    const byId=new Map(pool.map(p=>[String(p.id),p])),byName=new Map();
    pool.forEach(p=>{const name=normalize(p.name);byName.set(name,[...(byName.get(name)||[]),p]);});
    const usedPlayers=new Set(),rows=new Map();
    for(const row of snapshot.picks){
      if(!row||!integer(row.overall,1,104)||typeof row.name!=='string'||!row.name.trim()||row.name.length>160||typeof row.team!=='string'||row.team.length>160)fail('Eine ESPN-Pick-Zeile ist nicht eindeutig lesbar.');
      const overall=Number(row.overall),slot=slotFor(overall),team=config.teams[slot-1];
      if(normalize(row.team)!==normalize(team.name))fail(`Pick ${overall}: Das ESPN-Team passt nicht zur geprüften Snake-Reihenfolge.`);
      const exact=row.playerId!=null&&String(row.playerId)!=='';
      if(exact&&(!/^\d+$/.test(String(row.playerId))||!integer(row.playerId)))fail('Eine ESPN-Spieler-ID ist ungültig.');
      const candidates=exact?[byId.get(String(row.playerId))||{id:String(row.playerId),name:row.name.trim()}]:byName.get(normalize(row.name))||[];
      if(candidates.length!==1)fail(`Pick ${overall}: ${row.name} ist im FBA-Spielerpool nicht eindeutig zugeordnet. Der letzte geprüfte Stand bleibt erhalten.`);
      const player=candidates[0],id=String(player.id);
      // An ESPN ID is authoritative; names are an exact normalized fallback, never fuzzy matching.
      const result={overall,round:Math.ceil(overall/8),slot:(overall-1)%8+1,team:config.fbaTeams[slot-1],playerId:id,playerName:player.name,at:''};
      if(rows.has(overall)){if(rows.get(overall).playerId!==id)fail(`Pick ${overall} wurde widersprüchlich übertragen.`);continue;}
      if(usedPlayers.has(id))fail(`${row.name} wurde mehrfach übertragen.`);
      rows.set(overall,result);usedPlayers.add(id);
    }
    const out=[...rows.values()].sort((a,b)=>a.overall-b.overall);
    if(out.some((p,i)=>p.overall!==i+1))fail('Im ESPN-Verlauf fehlen Picks. Bitte Pick History auf All Rounds stellen.');
    return out;
  }
  function changed(previous,next){return previous.length>next.length||previous.some((p,i)=>next[i]?.overall!==p.overall||next[i]?.playerId!==p.playerId);}
  function remaining(snapshot,now=Date.now(),bufferMs=0){
    const clock=snapshot&&snapshot.clock,observed=Number(snapshot&&snapshot.observedAt),deadline=Number(clock&&clock.deadlineAt);
    if(!clock?.found||!Number.isFinite(observed)||!Number.isFinite(deadline))return null;
    return Math.max(0,deadline-Number(now)-Math.max(0,Number(bufferMs)||0));
  }
  function canDraft(snapshot,config,now=Date.now()){
    const failDraft=reason=>({ok:false,reason,remainingMs:remaining(snapshot,now)});
    if(!snapshot||snapshot.protocol!==1||Number(snapshot.bridgeVersion)<4)return failDraft('Bridge 0.3.3 laden und beide Tabs neu laden.');
    if(!config||String(snapshot.leagueId)!==String(config.leagueId)||Number(snapshot.seasonId)!==Number(config.seasonId))return failDraft('Der ESPN-Stand gehört nicht zu diesem Mock.');
    if(!snapshot.ready)return failDraft(snapshot.message||'Der ESPN-Draftstand ist noch nicht bereit.');
    if(!Number.isFinite(snapshot.observedAt)||Math.abs(Number(now)-Number(snapshot.observedAt))>3500)return failDraft('Die ESPN-Synchronisierung ist zu alt.');
    if(!Array.isArray(snapshot.picks)||snapshot.picks.length>=104)return failDraft('Der Draft ist bereits abgeschlossen.');
    const overall=snapshot.picks.length+1;
    if(slotFor(overall)!==Number(config.ownSlot))return failDraft('Aktuell ist ein anderes Team am Zug.');
    const left=remaining(snapshot,now);
    if(left==null)return failDraft('Die ESPN-Restzeit ist nicht eindeutig lesbar.');
    if(snapshot.clock.phase==='PRESTART')return failDraft('Start-Countdown · der ESPN-Draft hat noch nicht begonnen.');
    if(snapshot.clock.phase!=='PICK')return failDraft('Die laufende ESPN-Pick-Uhr ist noch nicht bestätigt. Bridge 0.3.3 verwenden.');
    if(left<=0)return failDraft('Die ESPN-Pick-Zeit ist abgelaufen.');
    return {ok:true,reason:'',remainingMs:left,overall,warning:left<6000?'Weniger als sechs Sekunden – Pick bleibt freigegeben.':''};
  }
  return {room,metadata,slotFor,teamOrder,picks,changed,remaining,canDraft,normalize};
});
