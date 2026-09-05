'use strict';
let busy=false;
window.addEventListener('message',event=>{
  const message=event.data;
  if(event.source!==window||event.origin!==location.origin||message?.type!=='FBA_MOCK_REQUEST'||message.protocol!==1||typeof message.nonce!=='string'||message.nonce.length>100||busy)return;
  busy=true;
  chrome.runtime.sendMessage({type:'FBA_MOCK_REQUEST',leagueId:String(message.leagueId),seasonId:message.seasonId},response=>{
    busy=false;
    const failed=chrome.runtime.lastError;
    window.postMessage({type:'FBA_MOCK_RESPONSE',protocol:1,nonce:message.nonce,response:failed?{ready:false,message:'Erweiterung wurde neu geladen. Bitte auch den FBA-Tab neu laden.'}:response},location.origin);
  });
});
