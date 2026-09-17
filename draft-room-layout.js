/* v86: four visible rounds, responsive sizing and preserved manual scrolling. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){
    root.FBA_DRAFT_LAYOUT=api;
    root.draftRosterPositionsMarkup=()=>{
      const team=draftCoachContext().team;
      // The identity registry owns these fields. Stats and source overlays never supply positions.
      const roster=api.positions(DRAFT_STATE.picks,root.FBA_DRAFT_POOL,team);
      const limit=roster.centers>=4?'full':roster.centers===3?'near':'open';
      return `<section class="draft-roster-positions draft-glass" aria-label="ESPN-Positionen für ${E(team)}">
        <div class="draft-roster-heading"><b>Deine Positionen</b><small>${E(T(team).s||team)} · ${roster.total}/${DRAFT_MAX_ROUNDS}</small></div>
        <div class="draft-roster-counts">${api.labels.map(pos=>`<div data-roster-position="${pos}" title="${E(roster.names[pos].join(', ')||'Noch kein Spieler mit dieser ESPN-Position')}"><span>${pos}</span><strong>${roster.counts[pos]}</strong></div>`).join('')}</div>
        <div class="draft-center-limit" data-limit-state="${limit}" role="status"><span>Center-Limit</span><strong>${roster.unknownPrimary?'≥ ':''}${roster.centers} / 4</strong><small>${roster.centers>=4?'Limit erreicht':roster.unknownPrimary?'ESPN-Hauptposition noch unvollständig':(4-roster.centers)+' '+(roster.centers===3?'Center-Platz frei':'Center-Plätze frei')}</small></div>
        <p>ESPN-Spielberechtigungen; Doppelpositionen zählen jeweils. Das C-Limit zählt die ESPN-Hauptposition.</p>
        ${roster.unknown?`<p class="draft-position-warning">Für ${roster.unknown} ${roster.unknown===1?'Spieler fehlt':'Spieler fehlen'} noch die ESPN-Positionen.</p>`:''}
      </section>`;
    };
    root.jumpToDraftRound=()=>api.restoreBoard(document,null);
  }
})(typeof window==='object'?window:null,function(){
  'use strict';
  const labels=Object.freeze(['PG','SG','SF','PF','C']);
  function positions(picks,pool,team){
    const byId=new Map((pool||[]).map(p=>[String(p.id),p]));
    const counts=Object.fromEntries(labels.map(p=>[p,0])),names=Object.fromEntries(labels.map(p=>[p,[]]));
    const seen=new Set();let centers=0,unknown=0,unknownPrimary=0;
    for(const pick of picks||[]){
      const id=String(pick.playerId);
      if(pick.team!==team||seen.has(id))continue;
      seen.add(id);
      const player=byId.get(id),eligible=labels.filter(p=>Array.isArray(player?.espnPositions)&&player.espnPositions.includes(p));
      if(!eligible.length)unknown++;
      for(const pos of eligible){counts[pos]++;names[pos].push(player.name);}
      if(player?.espnPrimaryPosition==='C')centers++;
      if(!labels.includes(player?.espnPrimaryPosition))unknownPrimary++;
    }
    return {counts,names,centers,unknown,unknownPrimary,total:seen.size};
  }
  function captureBoard(document){
    const board=document.getElementById('draftBoardScroll');
    return board?{round:board.dataset.currentRound,top:board.scrollTop,left:board.scrollLeft}:null;
  }
  // Four actual rows, including their gaps. Use the tallest four-row window so
  // populated rounds and longer player labels still fit without shrinking cards.
  function fourRoundHeight(rects){
    const count=Math.min(4,rects.length);let height=0;
    for(let first=0;first<=rects.length-count&&count;first++){
      const end=rects[first+count-1];
      height=Math.max(height,end.top+end.height-rects[first].top);
    }
    return height;
  }
  function sizeBoard(document,board,rounds){
    const height=fourRoundHeight(rounds.map(row=>row.getBoundingClientRect()));
    if(!(height>0))return;
    const css=document.defaultView?.getComputedStyle?.(board);
    const padding=(parseFloat(css?.paddingTop)||0)+(parseFloat(css?.paddingBottom)||0);
    const chrome=Math.max(0,(board.offsetHeight||0)-(board.clientHeight||0));
    const target=Math.ceil(height+padding+chrome);
    if(board.style.height!==target+'px')board.style.height=target+'px';
  }
  const observers=new WeakMap();
  function observeBoard(document,board,rounds){
    const previous=observers.get(document);
    if(previous?.board===board)return;
    previous?.observer.disconnect();observers.delete(document);
    const Observer=document.defaultView?.ResizeObserver;
    if(!board||!Observer)return;
    const observer=new Observer(()=>{
      if(!board.isConnected){observer.disconnect();if(observers.get(document)?.observer===observer)observers.delete(document);return;}
      restoreBoard(document,captureBoard(document));
    });
    rounds.forEach(row=>observer.observe(row));
    observers.set(document,{board,observer});
  }
  function restoreBoard(document,previous){
    const board=document.getElementById('draftBoardScroll');
    if(!board){observeBoard(document,null,[]);return;}
    const rounds=[...board.querySelectorAll('[data-draft-round]')],inner=board.querySelector('.draft-board');
    const current=rounds.find(row=>row.dataset.draftRound===board.dataset.currentRound);
    // No artificial space after round 13: keep the final four rounds together.
    if(inner)inner.style.paddingBottom='0px';
    sizeBoard(document,board,rounds);
    if(previous?.round===board.dataset.currentRound)board.scrollTop=previous.top;
    else if(current)board.scrollTop=(board.scrollTop||0)+current.getBoundingClientRect().top-board.getBoundingClientRect().top-(board.clientTop||0);
    if(Number.isFinite(board.scrollHeight)&&Number.isFinite(board.clientHeight))board.scrollTop=Math.max(0,Math.min(board.scrollTop,board.scrollHeight-board.clientHeight));
    if(previous)board.scrollLeft=previous.left;
    observeBoard(document,board,rounds);
  }
  return {labels,positions,captureBoard,restoreBoard,fourRoundHeight};
});
