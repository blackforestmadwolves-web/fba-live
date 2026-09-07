/* Isolated content script: no cookies, private JS state, network interception or draft actions. */
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id||message?.type!=='FBA_MOCK_READ')return;
  try{reply(FBA_ESPN_DOM.read(document,location.href));}
  catch{reply({protocol:1,ready:false,message:'Der ESPN-Verlauf konnte nicht gelesen werden.'});}
});
