'use strict';
const FBA_ORIGIN='https://fba-control-center.netlify.app';
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  let source;try{source=new URL(sender.url);}catch{return;}
  if(sender.id!==chrome.runtime.id||!sender.tab||sender.frameId!==0||source.origin!==FBA_ORIGIN||message?.type!=='FBA_MOCK_REQUEST'||!/^\d+$/.test(String(message.leagueId))||!Number.isInteger(message.seasonId))return;
  (async()=>{
    try{
      const tabs=await chrome.tabs.query({url:'https://fantasy.espn.com/basketball/draft*'});
      const matching=tabs.filter(tab=>{try{const u=new URL(tab.url);return /^\/basketball\/draft\/?$/.test(u.pathname)&&u.searchParams.get('leagueId')===String(message.leagueId)&&Number(u.searchParams.get('seasonId')||2027)===message.seasonId;}catch{return false;}});
      if(matching.length!==1){reply({ready:false,message:matching.length?'Bitte nur einen ESPN-Tab für diesen Mock geöffnet lassen.':'Kein passender ESPN-Draftraum geöffnet. Öffne deinen Mock im selben Chrome-/Edge-Profil.'});return;}
      const response=await chrome.tabs.sendMessage(matching[0].id,{type:'FBA_MOCK_READ'},{frameId:0});
      reply(response);
    }catch{reply({ready:false,message:'ESPN-Tab bitte einmal neu laden und Pick History → All Rounds öffnen.'});}
  })();
  return true;
});
