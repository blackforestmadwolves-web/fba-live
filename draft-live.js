/* v85: per-pick Roto standings and the next three open snake picks. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root)return;
  root.FBA_DRAFT_LIVE=api;
  root.draftLiveRotoMarkup=()=>{
    const mode=api.mode(DRAFT_STATE.rotoMode),teams=draftTeams();
    const view=api.snapshot(DRAFT_STATE.picks,mode,teams.length,DRAFT_MAX_ROUNDS);
    const data=computeDraftStandings(view.picks,{allCategories:true});
    const own=draftCoachContext().team,hasPicks=view.picks.length>0;
    const missing=data.rows.reduce((sum,row)=>sum+row.missingProjections,0);
    const status=mode==='pick'?`${view.picks.length} / ${teams.length*DRAFT_MAX_ROUNDS} Picks · nach jedem Pick`:
      view.rounds?`Runde ${view.rounds} komplett · ${view.picks.length} Picks`:'Nach der ersten vollständigen Runde';
    return `<section id="draftLiveRoto" class="draft-live-roto draft-glass" aria-label="Live Roto-Punkte" data-roto-mode="${mode}" data-roto-picks="${view.picks.length}">
      <div class="draft-roto-heading"><b>Live Roto-Punkte</b><div class="draft-roto-switch" role="group" aria-label="Stand der Roto-Wertung">${['pick','round'].map(value=>`<button type="button" data-roto-mode-button="${value}" aria-pressed="${mode===value}" onclick="setDraftRotoMode('${value}')">${value==='pick'?'Pick':'Runde'}</button>`).join('')}</div></div>
      <p class="draft-roto-status" role="status" aria-live="polite">${E(status)}</p>
      <table class="draft-roto-table"><thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col" title="Gedraftete Spieler in diesem Stand">Picks</th><th scope="col">Roto</th></tr></thead><tbody>${data.sorted.map(row=>{
        const details=DRAFT_CATS.map(cat=>`${cat}: ${row.points[cat]==null?'offen':formatDraftScore(row.points[cat])+' Punkte'}`).join(' · ');
        const warning=row.missingProjections?`${row.missingPlayers.join(', ')}: keine Projektion, mit 0 Beitrag bewertet.`:'';
        return `<tr data-roto-team="${E(row.team)}"${row.team===own?' class="is-own"':''} title="${E(details)}"><td>${row.picks?'#'+row.overallRank:'–'}</td><th scope="row"><span class="draft-roto-team">${chip(row.team)}<span>${E(T(row.team).s||row.team)}${warning?` <span class="draft-roto-warning" title="${E(warning)}" aria-label="${E(warning)}">⚠</span>`:''}</span></span></th><td>${row.picks}</td><td class="draft-roto-score">${row.picks?formatDraftScore(row.score):'–'}</td></tr>`;
      }).join('')}</tbody></table>
      <p class="draft-roto-foot">Alle 8 Kategorien · maximal ${data.maxScore} Punkte${mode==='round'&&view.excluded?`<br>${view.excluded} ${view.excluded===1?'Pick':'Picks'} der laufenden Runde ausgeblendet`:mode==='pick'&&hasPicks&&new Set(data.rows.map(row=>row.picks)).size>1?'<br>Momentaufnahme bei unterschiedlichen Pickzahlen':''}${missing?`<br><span class="draft-roto-warning">⚠ ${missing} ${missing===1?'Spieler ohne Projektion zählt':'Spieler ohne Projektion zählen'} mit 0 Beitrag.</span>`:''}</p>
    </section>`;
  };
  root.setDraftRotoMode=value=>{
    if(!['pick','round'].includes(value))return;
    DRAFT_STATE.rotoMode=value;saveDraftState();
    const panel=document.getElementById('draftLiveRoto');
    if(panel){panel.outerHTML=root.draftLiveRotoMarkup();document.querySelector(`[data-roto-mode-button="${value}"]`)?.focus({preventScroll:true});}
  };
  root.draftUpcomingPicksMarkup=next=>{
    if(!next)return '';
    const picks=api.upcoming(DRAFT_STATE.picks,next.overall,DRAFT_MAX_ROUNDS*draftTeams().length,draftPickMeta);
    return picks.length?`<ol class="draft-upcoming-picks" aria-label="Nächste drei Picks">${picks.map((pick,i)=>`<li data-upcoming-pick="${pick.overall}" data-upcoming-step="${i+1}"${pick.team===DRAFT_STATE.myTeam?' class="is-own"':''}><span class="draft-upcoming-label">Pick ${pick.overall}</span><span class="draft-upcoming-team">${chip(pick.team)}<b>${E(T(pick.team).s||pick.team)}</b></span></li>`).join('')}</ol>`:'';
  };
})(typeof window==='object'?window:null,function(){
  const mode=value=>value==='round'?'round':'pick';
  function snapshot(picks,value,teamCount=8,maxRounds=13){
    const used=new Set(picks.map(pick=>Number(pick.overall)));let consecutive=0;
    while(consecutive<teamCount*maxRounds&&used.has(consecutive+1))consecutive++;
    const rounds=Math.floor(consecutive/teamCount),boundary=rounds*teamCount;
    const included=mode(value)==='round'?picks.filter(pick=>Number(pick.overall)<=boundary):picks.slice();
    return {picks:included,rounds,excluded:picks.length-included.length};
  }
  function upcoming(picks,current,max,meta){
    const used=new Set(picks.map(pick=>Number(pick.overall))),result=[];
    for(let overall=current+1;overall<=max&&result.length<3;overall++)if(!used.has(overall))result.push(meta(overall));
    return result;
  }
  return {mode,snapshot,upcoming};
});
