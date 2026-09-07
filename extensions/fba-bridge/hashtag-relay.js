(()=>{
  'use strict';let busy=false;
  window.addEventListener('message',event=>{
    const m=event.data;
    if(event.source!==window||event.origin!=='https://fba-control-center.netlify.app'||m?.type!=='FBA_HASHTAG_SYNC'||m.protocol!==1||typeof m.nonce!=='string'||m.nonce.length>100)return;
    if(busy)return;
    if(typeof m.token!=='string'||m.token.length>1000)return;
    busy=true;
    chrome.runtime.sendMessage({type:m.type,token:m.token},response=>{
      busy=false;const error=chrome.runtime.lastError;
      window.postMessage({type:'FBA_HASHTAG_RESULT',protocol:1,nonce:m.nonce,response:error?{ok:false,error:'Bridge neu laden und FBA-Tab anschließend neu laden.'}:response},location.origin);
    });
  });
})();
