/* v83: one/two-category focus; movement follows the chosen baseline sort. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FBA_DRAFT_POOL_TOOLS=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  const categories=Object.freeze(['PTS','REB','AST','3PM','STL','BLK','FG%','FT%']);
  const positions=Object.freeze(['PG','SG','SF','PF','C']);
  function normalizeFocus(value){
    const selected=[...new Set((Array.isArray(value)?value:[value]).filter(cat=>categories.includes(cat)))].slice(0,2);
    return selected.length?selected:null;
  }
  const normalizePosition=value=>positions.includes(value)?value:'ALL';
  const normalizeText=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  function playerPositions(player,catalog){
    const parse=value=>[...new Set(String(value||'').toUpperCase().split(/[^A-Z]+/).filter(p=>positions.includes(p)))];
    for(const value of [player.fantasyPositions,catalog?.fantasyPositions,player.pos,catalog?.primaryPosition]){
      const found=parse(value);if(found.length)return found;
    }
    return [];
  }
  // Average tied ranks on the complete eligible pool, before picks or filters.
  // Percentiles put category z-scores and overall FBA values on the same scale.
  function percentiles(rows,value){
    const sorted=rows.slice().sort((a,b)=>value(b)-value(a)),out=new Map();
    for(let first=0;first<sorted.length;){
      let end=first+1;while(end<sorted.length&&value(sorted[end])===value(sorted[first]))end++;
      const strength=sorted.length===1?.5:1-(first+end-1)/2/(sorted.length-1);
      for(let i=first;i<end;i++)out.set(String(sorted[i].player.id),strength);
      first=end;
    }
    return out;
  }
  function view({pool,baseline,used,focus,position,query,valueFor,catalog,merged,nextPick}){
    focus=normalizeFocus(focus);position=normalizePosition(position);
    const catalogById=new Map((catalog||[]).map(p=>[String(p.id),p]));
    const positionsById=new Map(pool.map(p=>[String(p.id),playerPositions(p,catalogById.get(String(p.id)))]));
    const available=baseline.filter(p=>!used.has(String(p.id)));
    const details=new Map();let ordered=available;
    if(focus){
      const adpFor=player=>{const value=merged?.get(String(player.id))?.adp;return Number.isFinite(value)&&value>0?value:null;};
      // Compare with the user's selected order, before search/position filters.
      const baseRanks=new Map(available.map((p,i)=>[String(p.id),i+1]));
      const profiles=pool.map(player=>({player,primary:valueFor(player)?.primary}));
      const valid=profiles.filter(p=>Number.isFinite(p.primary?.value)&&focus.every(cat=>Number.isFinite(p.primary?.z?.[cat])));
      const categoryStrength=focus.map(cat=>percentiles(valid,p=>p.primary.z[cat]));
      const overallStrength=percentiles(valid,p=>p.primary.value);
      const scores=new Map(valid.map(p=>{const id=String(p.player.id),strength=categoryStrength.reduce((sum,values)=>sum+values.get(id),0)/focus.length;return [id,.65*strength+.35*overallStrength.get(id)];}));
      ordered=available.slice().sort((a,b)=>{
        const x=scores.get(String(a.id)),y=scores.get(String(b.id));
        const baseTie=baseRanks.get(String(a.id))-baseRanks.get(String(b.id));
        if(x==null||y==null)return x==null?(y==null?baseTie:1):-1;
        return y-x||baseTie;
      });
      const primaryById=new Map(profiles.map(p=>[String(p.player.id),p.primary]));
      ordered.forEach((player,i)=>{
        const id=String(player.id),primary=primaryById.get(id),adp=adpFor(player),baseRank=baseRanks.get(id);
        details.set(id,{focus,primary,ready:scores.has(id),score:scores.get(id)??null,rank:i+1,adp,baseRank,movement:baseRank-i-1,
          nextPick:Number.isInteger(nextPick)&&nextPick>0?nextPick:null,
          adpGap:Number.isFinite(adp)&&Number.isInteger(nextPick)&&nextPick>0?Math.round(adp-nextPick):null,
          weaknesses:categories.filter(c=>!focus.includes(c)&&Number.isFinite(primary?.z?.[c])&&primary.z[c]<-1).sort((a,b)=>primary.z[a]-primary.z[b]).slice(0,2)});
      });
    }
    const tokens=normalizeText(query).split(/\s+/).filter(Boolean);
    const rows=ordered.filter(p=>{
      const pos=positionsById.get(String(p.id));
      return (position==='ALL'||pos.includes(position))&&tokens.every(t=>normalizeText([p.name,p.nba,pos.join(' '),p.pos].join(' ')).includes(t));
    });
    return {rows,details,positionsById,available:available.length};
  }
  return Object.freeze({categories,positions,normalizeFocus,normalizePosition,playerPositions,view});
});

function draftPoolView(query,merged){
  const pool=draftPool(),mode=draftPlayerSortMode(DRAFT_STATE);
  const baseline=window.FBA_DRAFT_PREP.sortPlayers(pool,mode==='strategy'?'adp':mode,maikValueFor,merged);
  if(mode==='strategy')baseline.sort((a,b)=>draftPlayerModeScore(b)-draftPlayerModeScore(a));
  return window.FBA_DRAFT_POOL_TOOLS.view({pool,baseline,used:draftedMap(),focus:DRAFT_STATE.poolFocus,position:DRAFT_STATE.poolPosition,query,
    valueFor:maikValueFor,catalog:window.FBA_DRAFT_PLAYER_CATALOG?.players,merged,nextPick:DRAFT_STATE.poolFocus?draftCoachContext().nextPick:null});
}
function draftPoolControlsMarkup(){
  const data=draftCoachContext(),focus=window.FBA_DRAFT_POOL_TOOLS.normalizeFocus(DRAFT_STATE.poolFocus),position=DRAFT_STATE.poolPosition||'ALL';
  const tiles=new Map(data.tiles.map(tile=>[tile.cat,tile]));
  return `<div class="draft-pool-tools">
    <div class="draft-pool-tools-heading"><span><b class="draft-pool-focus-count">${focus?.length||0}/2 Fokus</b> Kategorien kombinieren · ${E(T(data.team).s||data.team)}</span><button type="button" data-pool-control="clear" onclick="clearDraftPoolFilters()"${focus||position!=='ALL'?'':' hidden'}>Zurücksetzen</button></div>
    <div class="draft-pool-categories" role="group" aria-label="Bis zu zwei Kategorien stärken; Ränge deines Teams aus dem Kompass">${DRAFT_CATS.map(cat=>{
      const tile=tiles.get(cat),rank=tile?.rank,hasRank=Number.isInteger(rank)&&rank>=1&&rank<=8;
      const color=hasRank&&data.enough&&!tile.punted?` data-coach-rank="${rank}"`:'';
      const caption=hasRank?'#'+rank:'–',note=!data.ready?'Statistikbasis unvollständig':!data.enough?'Im Aufbau':tile?.punted?'Im Draft-Ziel gepuntet':'Rang im Kompass';
      const selected=Boolean(focus?.includes(cat)),limited=focus?.length===2&&!selected;
      return `<button type="button" class="draft-pool-category" data-pool-control="${cat}"${color} aria-pressed="${selected}" aria-controls="draftPlayerResults" aria-label="${cat} stärken, ${hasRank?'Rang '+rank:'Rang offen'}" title="${E(note)} · ${selected?'Nochmals anklicken: diese Kategorie abwählen':limited?'Zuerst eine der zwei gewählten Kategorien abwählen':'Zum Fokus hinzufügen'}" onclick="setDraftPoolFocus('${cat}')"${limited?' disabled':''}><span>${cat}</span><b>${caption}</b></button>`;
    }).join('')}</div>
    <div class="draft-pool-positions" role="group" aria-label="Spieler nach Position filtern">${['ALL',...window.FBA_DRAFT_POOL_TOOLS.positions].map(pos=>`<button type="button" data-pool-control="position-${pos}" aria-pressed="${position===pos}" aria-controls="draftPlayerResults" onclick="setDraftPoolPosition('${pos}')">${pos==='ALL'?'Alle':pos}</button>`).join('')}</div>
    <div class="draft-pool-focus-caption" role="status">${focus?`<b>${E(focus.join(' + '))}-Fokus</b> · ${focus.length===2?'je 32,5 % pro Kategorie':'65 % Kategorie'} + 35 % Gesamt-FBA${data.nextPick?` · Dein Pick #${data.nextPick}`:''}<small>${focus.length===2?'Zum Wechseln eine Kategorie abwählen.':'Zweite Kategorie antippen, um beide zu kombinieren.'} Pfeile vergleichen mit deiner gewählten Sortierung.</small>`:'Eine oder zwei Kategorien antippen · Draft-Ziel bleibt erhalten'}</div>
  </div>`;
}
function refreshDraftPoolTools(control){
  const controls=document.getElementById('draftPoolControls');if(controls)controls.innerHTML=draftPoolControlsMarkup();
  const label=document.getElementById('draftPoolSortLabel');if(label)label.textContent=DRAFT_STATE.poolFocus?'Reihenfolge ohne Fokus':'Sortierung';
  draftSearch(DRAFT_STATE.query);
  const scroll=document.getElementById('draftPoolScroll');if(scroll)scroll.scrollTop=0;
  if(control&&controls)Array.from(controls.querySelectorAll('[data-pool-control]')).find(button=>button.dataset.poolControl===control&&!button.hidden)?.focus({preventScroll:true});
}
function setDraftPoolFocus(cat){
  if(!DRAFT_CATS.includes(cat))return;
  const tools=window.FBA_DRAFT_POOL_TOOLS,focus=tools.normalizeFocus(DRAFT_STATE.poolFocus)||[];
  if(!focus.includes(cat)&&focus.length===2){showDraftToast('Du kannst zwei Kategorien kombinieren. Zum Wechseln zuerst eine abwählen.',false);return;}
  DRAFT_STATE.poolFocus=tools.normalizeFocus(focus.includes(cat)?focus.filter(value=>value!==cat):[...focus,cat]);saveDraftState();refreshDraftPoolTools(cat);
}
function setDraftPoolPosition(position){
  DRAFT_STATE.poolPosition=window.FBA_DRAFT_POOL_TOOLS.normalizePosition(position);saveDraftState();refreshDraftPoolTools('position-'+DRAFT_STATE.poolPosition);
}
function clearDraftPoolFilters(){
  DRAFT_STATE.poolFocus=null;DRAFT_STATE.poolPosition='ALL';saveDraftState();refreshDraftPoolTools('position-ALL');
}
function draftPoolFocusMarkup(info){
  if(!info)return '';
  const focus=window.FBA_DRAFT_POOL_TOOLS.normalizeFocus(info.focus)||[];
  const market=info.adpGap==null?(info.nextPick?'ESPN-ADP offen':'Kein eigener Pick offen'):info.adpGap===0?'Dein Pick liegt ungefähr beim ADP':`Dein Pick: ca. ${Math.abs(info.adpGap)} Pick${Math.abs(info.adpGap)===1?'':'s'} ${info.adpGap>0?'vor':'nach'} ADP`;
  const marketTitle=info.nextPick?`ESPN-ADP ${info.adp==null?'offen':de(info.adp,1)}; dein nächster eigener Pick #${info.nextPick}. ADP ist ein Durchschnitt, keine Zusage zur Verfügbarkeit.`:'Dein Kader ist komplett.';
  const marketMarkup=`<small class="draft-focus-market" data-adp-timing="${info.adpGap==null?'unknown':info.adpGap>0?'early':info.adpGap<0?'late':'on-time'}" title="${E(marketTitle)}">${E(market)}</small>`;
  if(!info.ready)return `<span class="draft-player-focus"><b>${E(focus.join(' + '))}-Fokus: Wert offen</b><small>Vollständige Basis für ${focus.length===2?'beide gewählten Kategorien':'die gewählte Kategorie'} und Gesamt-FBA nötig</small>${marketMarkup}</span>`;
  const primary=info.primary,stats=primary.stats||{};
  const values=focus.map(cat=>{
    const percent=cat.includes('%'),attempts=cat==='FG%'?'FGA':'FTA',makes=cat==='FG%'?'FGM':'FTM';
    const raw=percent?(Number.isFinite(stats[makes])&&Number.isFinite(stats[attempts])&&stats[attempts]>0?de(stats[makes]/stats[attempts]*100,1)+' %':'–'):Number.isFinite(stats[cat])?de(stats[cat],1):'–';
    return `<b data-focus-stat="${cat}" style="color:${maikValueColor(primary.z[cat])}" title="${E(primary.basis)} · ${percent?'Volumenbereinigter Quotenbeitrag':'Beitrag pro Spiel'}">${E(cat)} ${E(raw)} · ${E(maikValueFormat(primary.z[cat]))} z</b>`;
  }).join('');
  const mode={adp:'ADP',maik:'FBA-Value',merge:'Merge Value',strategy:'Strategie'}[draftPlayerSortMode(DRAFT_STATE)]||'ADP';
  const movement=`${info.movement>0?'↑ '+info.movement:info.movement<0?'↓ '+Math.abs(info.movement):'± 0'} Plätze ggü. ${mode}`;
  return `<span class="draft-player-focus">
    <span class="draft-focus-values">${values}</span>
    <small class="draft-focus-movement" title="${E(`Fokusplatz gegenüber ${mode}-Sortierung im freien Pool, vor Such- und Positionsfilter. Die Verschiebung ist kein Abstand zu deinem Draftpick.`)}">${E(movement)}</small>
    ${marketMarkup}${info.weaknesses.length?`<small>Schwach: ${E(info.weaknesses.join(', '))}</small>`:''}
  </span>`;
}
