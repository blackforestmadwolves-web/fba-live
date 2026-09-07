/* Reads only rendered Pick History. Selectors checked against ESPN's public draft client, 2026-09-05. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FBA_ESPN_DOM=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const text=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  function read(document,href,visible=node=>Boolean(node?.getClientRects().length)){
    const u=new URL(href),leagueId=u.searchParams.get('leagueId'),seasonId=Number(u.searchParams.get('seasonId')||2027),teamId=Number(u.searchParams.get('teamId')||0);
    const base={protocol:1,leagueId,seasonId,teamId,observedAt:Date.now(),ready:false,picks:[]};
    const fail=message=>({...base,message});
    if(u.origin!=='https://fantasy.espn.com'||!/^\/basketball\/draft\/?$/.test(u.pathname)||!/^\d+$/.test(leagueId||''))return fail('Bitte den ESPN-Basketball-Draftraum öffnen.');
    const history=document.querySelector('.pick-history');
    if(!history||!visible(history))return fail('In deinem ESPN-Draftraum Pick History → All Rounds öffnen und geöffnet lassen.');
    const tables=[...history.querySelectorAll('.pick-history-table')];
    const select=history.querySelector('.roundsDropdown select');
    if(select&&String(select.value)!=='-1'||tables.some(t=>!visible(t)))return fail('In ESPN bitte All Rounds auswählen, damit keine Picks fehlen.');
    if(!tables.length){
      if(/Picks will appear here once your draft starts/i.test(text(history)))return {...base,ready:true};
      return fail('Die ESPN-Pick-Tabelle ist noch nicht lesbar. Pick History geöffnet lassen.');
    }
    const picks=[];
    for(const table of tables){
      const rows=[...table.querySelectorAll('[role="row"], tr')];
      let dataRows=0;
      for(const row of rows){
        if(!row.querySelector('.player-column'))continue;
        dataRows++;
        const name=text(row.querySelector('.playerinfo__playername'));
        let cells=[...row.querySelectorAll('.cell:not(.header-cell)')];
        if(!cells.length)cells=[...row.querySelectorAll('[role="gridcell"], td')];
        const pickText=text(cells[0]),team=text(cells[2]);
        if(!/^\d+$/.test(pickText)||!name||!team)return fail('Eine Pick-Zeile ist noch unvollständig. Die Übernahme wartet auf den vollständigen ESPN-Verlauf.');
        const sources=[...row.querySelectorAll('.player-column img')].flatMap(img=>[img.getAttribute('src'),img.getAttribute('data-src')]).filter(Boolean);
        const ids=new Set();
        for(const source of sources){
          let decoded=source;try{decoded=decodeURIComponent(source);}catch{}
          const match=decoded.match(/\/headshots\/nba\/players\/(?:full|[a-z0-9_-]+)\/(\d+)\.png/i);if(match)ids.add(match[1]);
        }
        if(ids.size>1)return fail('Die ESPN-Spielerbilder sind einer Zeile nicht eindeutig zugeordnet.');
        picks.push({overall:Number(pickText),name,team,playerId:ids.size?[...ids][0]:null});
      }
      if(!dataRows)return fail('Die ESPN-Pick-Tabelle lädt noch.');
    }
    if(picks.length>104)return fail('Dieser War Room unterstützt acht Teams mit 13 Runden.');
    return {...base,ready:true,picks};
  }
  return {read};
});
