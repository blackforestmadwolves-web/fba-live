(function(root){
  'use strict';
  const ENABLED='FBA_HASHTAG_SYNC_ENABLED_V75',LAST='FBA_HASHTAG_SYNC_LAST_V75';
  let busy=false,message='',timer=null,nonce=null,nextAttempt=0,source=null;
  function enabled(){return localStorage.getItem(ENABLED)==='1';}
  function redraw(){document.querySelectorAll('[data-hashtag-sync-panel]').forEach(el=>{el.innerHTML=markup();});}
  function markup(current){
    if(current)source=current;
    const last=localStorage.getItem(LAST);
    const cloud=source?.cloudSync,stale=cloud?.lastAttempt&&Date.now()-Date.parse(cloud.lastAttempt)>8*3600000;
    const issue=cloud?.state==='AUTH_REQUIRED'?'Hashtag-Anmeldung im ChatGPT-Cloud-Browser erneuern.':cloud?.state==='ERROR'||cloud?.importState==='REJECTED'?cloud.message||'Cloud-Abgleich fehlgeschlagen; letzter gültiger Stand bleibt erhalten.':stale?'Der letzte Cloud-Abruf ist über acht Stunden her. Bitte den geplanten Abgleich in ChatGPT prüfen.':'';
    return `<p><strong>Hashtag · Cloud-Abgleich</strong></p><p>${cloud?.enabled?'Geplanter Abruf alle sechs Stunden über ChatGPT Work. Dein Mac und das Control Center können geschlossen bleiben.':'Cloud-Abgleich noch nicht als aktiv bestätigt.'}</p>${source?.lastChecked?`<p>Letzter übernommener Stand: ${E(monsterProjectionTimestamp(source.lastChecked))}</p>`:''}${cloud?.lastAttempt?`<p>Letzter Cloud-Versuch: ${E(monsterProjectionTimestamp(cloud.lastAttempt))}</p>`:''}${issue?`<p role="alert">${E(issue)}</p>`:''}<small>Alle Geräte laden dieselbe zentrale Datenbasis. Bei abgelaufener Anmeldung bleibt der letzte gültige Stand erhalten. Die Saisonbasis wird nach Saisonstart eingefroren.</small><details><summary>Optional: einmaliger Abruf über die Desktop-Bridge</summary><p>Nur für einen zusätzlichen manuellen Abruf im angemeldeten Desktop-Browser.</p>${last?`<p>Letzter lokaler Abgleich: ${E(monsterProjectionTimestamp(last))}</p>`:''}${message?`<p role="status">${E(message)}</p>`:''}<p><button class="btn" type="button" onclick="FBA_HASHTAG.sync()"${busy?' disabled':''}>${busy?'Hashtag wird abgeglichen …':'Einmal über Bridge abrufen'}</button></p></details>`;
  }
  function fail(text){busy=false;clearTimeout(timer);nonce=null;localStorage.removeItem(ENABLED);message=text+' Der geplante Cloud-Abgleich bleibt davon unabhängig.';redraw();}
  function sync(){
    if(busy)return;
    if(!monsterUnlocked()){openMonsterGate();return;}
    localStorage.setItem(ENABLED,'1');busy=true;nonce=crypto.randomUUID();message='Vollständige Hashtag-Tabelle wird frisch geladen …';redraw();
    timer=setTimeout(()=>fail('Keine Bestätigung erhalten. Bridge 0.2.0 aktivieren und den FBA-Tab neu laden; danach erneut abgleichen. Der letzte gültige Stand bleibt erhalten.'),150000);
    root.postMessage({type:'FBA_HASHTAG_SYNC',protocol:1,nonce,token:monsterToken()},location.origin);
  }
  root.addEventListener('message',async event=>{
    const m=event.data;
    if(event.source!==root||event.origin!==location.origin||!busy||m?.type!=='FBA_HASHTAG_RESULT'||m.protocol!==1||m.nonce!==nonce)return;
    clearTimeout(timer);nonce=null;
    if(!m.response?.ok){if(m.response?.locked)localStorage.removeItem(MONSTER_SESSION_KEY);fail(m.response?.error||'Hashtag-Abgleich fehlgeschlagen.');return;}
    const r=m.response;localStorage.setItem(LAST,r.lastChecked);nextAttempt=0;
    message=`${r.mapping?.matched||0} Hashtag-Spieler übertragen · ${r.mapping?.pending||0} Zuordnungen/Daten offen. Expert-Merge wird aktualisiert …`;redraw();
    try{
      await root.FBA_DRAFT_PROJECTIONS.reload();
      // Existing simulation/matchup caches must be rebuilt from the newly merged records.
      if(typeof MONSTER_STATE==='object'){MONSTER_STATE.data=null;MONSTER_STATE.dataWeek=null;}
      if(typeof monsterPrivatePage==='function'&&monsterPrivatePage()&&typeof loadMonsterData==='function')await loadMonsterData(true);
      message=`${r.mapping?.matched||0} Hashtag-Spieler abgeglichen · ${r.mapping?.pending||0} Zuordnungen/Daten offen.`;
    }catch{message='Hashtag wurde gespeichert. Bitte die Projektionen erneut laden.';}
    busy=false;redraw();
  });
  root.FBA_HASHTAG=Object.freeze({markup,sync,pause(){localStorage.removeItem(ENABLED);message='Automatik pausiert. Ein bereits laufender Abgleich wird noch abgeschlossen.';redraw();}});
  // Scheduled cloud task owns periodic reads. Desktop bridge stays manual only.
})(window);
