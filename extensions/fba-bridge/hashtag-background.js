(()=>{
  'use strict';
  const FBA='https://fba-control-center.netlify.app',SOURCE='https://hashtagbasketball.com/import-v4/fantasy-basketball-projections#fba-sync';
  const API='https://script.google.com/macros/s/AKfycby02oSRlkddDZfq1od7DXtKkPVgGScoJBa9x-Jsj50LF1sHUYnfIRicV3KTIZRQI9Sh/exec';
  let pending=false;
  chrome.runtime.onMessage.addListener((m,sender,reply)=>{
    let origin;try{origin=new URL(sender.url).origin;}catch{return;}
    if(sender.id!==chrome.runtime.id||!sender.tab||sender.frameId!==0||origin!==FBA||m?.type!=='FBA_HASHTAG_SYNC')return;
    if(pending){reply({ok:false,error:'Ein Hashtag-Abgleich läuft bereits.'});return;}
    if(typeof m.token!=='string'||!m.token||m.token.length>1000){reply({ok:false,error:'Bitte das Control Center entsperren.'});return;}
    pending=true;
    (async()=>{
      try{
        const started=Date.now(),tabs=await chrome.tabs.query({url:'https://hashtagbasketball.com/*'});
        let tab=tabs.find(t=>t.url===SOURCE);
        if(tab)await chrome.tabs.reload(tab.id,{bypassCache:true});
        else tab=await chrome.tabs.create({url:SOURCE,active:false});
        let snapshot;
        for(let i=0;i<45;i++){
          await new Promise(r=>setTimeout(r,2000));
          const current=await chrome.tabs.get(tab.id);
          if(current.status!=='complete')continue;
          if(current.url!==SOURCE)throw new Error('Hashtag-Anmeldung fehlt. Bitte im selben Browser-Profil anmelden und erneut abgleichen.');
          let result;try{result=await chrome.tabs.sendMessage(tab.id,{type:'FBA_HASHTAG_READ'},{frameId:0});}catch{continue;}
          if(result?.error)throw new Error(result.error);
          if(result?.ready&&result.loadedAt>=started){snapshot=result.snapshot;break;}
        }
        if(!snapshot)throw new Error('Hashtag hat die vollständige Tabelle nicht rechtzeitig geladen. Bitte erneut versuchen.');
        const response=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},credentials:'omit',redirect:'follow',body:JSON.stringify({action:'hashtag_import',token:m.token,snapshot})});
        if(!response.ok)throw new Error('FBA-Datenquelle nicht erreichbar (HTTP '+response.status+').');
        let result;try{result=await response.json();}catch{throw new Error('Die FBA-Datenquelle unterstützt den Hashtag-Import noch nicht.');}
        // Do not return the private table or the device token to unrelated pages.
        reply(result);
      }catch(error){reply({ok:false,error:error.message||'Hashtag-Abgleich fehlgeschlagen.'});}
      finally{pending=false;}
    })();return true;
  });
})();
