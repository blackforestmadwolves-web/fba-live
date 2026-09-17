/* Personal War Room UI. Uses the real local draft state; no demo data. */
(function(root){
  'use strict';
  let cached=null,previewId=null;
  function selectedTeam(){
    const teams=draftTeams();
    return teams.includes(DRAFT_STATE.myTeam)?DRAFT_STATE.myTeam:teams.includes('BlackForest Mad Wolves')?'BlackForest Mad Wolves':teams[0];
  }
  function nextOwnPick(team){
    const used=new Set(DRAFT_STATE.picks.map(p=>Number(p.overall)));
    for(let overall=1;overall<=DRAFT_MAX_ROUNDS*8;overall++)if(!used.has(overall)&&snakeTeamForPick(overall)===team)return overall;
    return null;
  }
  function context(){
    const team=selectedTeam(),pool=draftPool(),key=JSON.stringify([team,DRAFT_STATE.goal,DRAFT_STATE.punts,DRAFT_STATE.hunt,DRAFT_STATE.picks]);
    if(!cached||cached.pool!==pool||cached.key!==key){
      const data=root.FBA_DRAFT_COACH.analyze({teams:draftTeams(),pool,picks:DRAFT_STATE.picks,team,goal:DRAFT_STATE.goal,punts:DRAFT_STATE.punts,hunt:DRAFT_STATE.hunt,defaultGames:DRAFT_DEMO_GP,maxRoster:DRAFT_MAX_ROUNDS,nextPick:nextOwnPick(team)});
      // The displayed rank is exactly the rank in the existing Live Standings.
      const standings=computeDraftStandings().byTeam[team];
      data.tiles.forEach(tile=>tile.rank=data.ready?standings?.ranks?.[tile.cat]??null:null);
      cached={key,pool,data};
    }
    return cached.data;
  }
  function rankText(value){return value==null?'–':'#'+value;}
  function coachNote(data){
    if(!data.ready)return {title:'Team auswählen',body:'Wähle dein Team, um den Draft-Kompass zu öffnen.'};
    if(data.full)return {title:'Dein Kader ist komplett',body:'Deine acht Kategorie-Ränge aktualisieren sich weiter, wenn die anderen Teams picken oder Picks zurückgenommen werden.'};
    if(data.goal==='punt'&&!data.punts.length)return {title:'Wähle deine Punt-Kategorien',body:'Markiere oben, welche Kategorien du aufgibst. Die Beratung konzentriert sich anschließend auf die verbleibenden Kategorien.'};
    if(!data.own?.picks)return {title:'Dein Build beginnt mit dem ersten Pick',body:'Wähle einen verfügbaren Spieler zur Vorschau. Nach deinem ersten Pick bewerten wir deine Stärken und Lücken im Vergleich zur Liga.'};
    if(!data.enough)return {title:'Die Liga baut ihre Kader noch auf',body:'Für einen Vergleich brauchen mindestens zwei Teams einen Pick. Bis dahin zeigen wir dein bisheriges Profil ohne Handlungsdruck.'};
    if(data.goal==='strengths'){
      const cats=data.hunt?[data.hunt]:data.strongest.slice(0,2);
      return {title:cats.join(' + ')+' als Säulen ausbauen',body:(data.hunt?'Dein gewählter Fokus: ':'Deine stärksten Ausgangspositionen je besetztem Kaderplatz: ')+cats.join(' und ')+'. Die Spielervorschau zeigt auch, welche anderen Kategorien dabei nachgeben.'};
    }
    const weak=data.priorities.filter(p=>p.deficit>1e-8).slice(0,2);
    if(!weak.length)return {title:'Dein aktives Profil liegt mindestens im Mittelfeld',body:'Aktuell besteht je besetztem Kaderplatz kein Rückstand zum Liga-Median in deinen aktiven Kategorien. Vergleiche die nächsten Spieler auf breiten Nutzen.'};
    const cats=weak.map(p=>p.cat);
    const quick=data.recommendations.flatMap(rec=>rec.improvements.filter(part=>part.rankGain>0).map(part=>({rec,part}))).sort((a,b)=>b.part.rankGain-a.part.rankGain)[0];
    return {title:cats.join(' + ')+' gezielt verstärken',body:(data.punts.length?data.punts.join(' + ')+' bleibt bewusst ausgeklammert. ':'')+'Hier liegt dein größter Rückstand zum Mittelfeld je besetztem Kaderplatz.'+(quick?` ${quick.rec.player.name} verbessert in der Modellvorschau dein ${quick.part.cat}-Profil im Vergleich zur Liga.`:' Prüfe die Vorschläge auf erreichbare Verbesserungen und Auswirkungen auf deine übrigen Kategorien.')};
  }
  function tilesMarkup(data){
    return data.tiles.map(tile=>{
      const status=tile.punted?'PUNT':tile.rank==null?'Offen':!data.enough?'Im Aufbau':tile.rank<=3?'Stark':tile.rank<=5?'Mittelfeld':'Rückstand';
      const tone=tile.punted?'punted':tile.rank==null||!data.enough?'neutral':tile.rank<=3?'good':tile.rank<=5?'neutral':'weak';
      const rankColorAttr=!tile.punted&&data.enough&&Number.isInteger(tile.rank)&&tile.rank>=1&&tile.rank<=8?` data-coach-rank="${tile.rank}"`:'';
      return `<div class="draft-coach-cat ${tone}" data-coach-category="${E(tile.cat)}"${rankColorAttr}><span>${E(tile.cat)}</span><strong>${rankText(tile.rank)}</strong><small>${status}</small></div>`;
    }).join('');
  }
  function markup(){
    const data=context(),note=coachNote(data),next=nextOpenDraftPick();
    const ownNext=nextOwnPick(data.team),turn=next?.team===data.team?'Du bist am Zug':next?`Am Zug: ${T(next.team).s||next.team}`:'Draft abgeschlossen';
    return `<section class="draft-coach-panel draft-glass" aria-label="Dein Team und Draft-Ziel"><div class="draft-coach-heading"><div><span class="draft-coach-kicker">Dein Draft-Kompass</span><h2>${E(T(data.team).s||data.team)}</h2></div><span class="draft-coach-turn">${E(turn)}${ownNext?` · Dein nächster Pick: #${ownNext}`:''}</span></div><div class="draft-coach-controls"><label>Mein Team<select id="draftCoachTeam" onchange="setDraftCoachTeam(this.value)">${draftTeams().map(team=>`<option value="${E(team)}"${team===data.team?' selected':''}>${E(team)}</option>`).join('')}</select></label><label>Mein Draft-Ziel<select id="draftCoachGoal" onchange="setDraftCoachGoal(this.value)">${Object.entries(root.FBA_DRAFT_COACH.goals).map(([key,label])=>`<option value="${key}"${data.goal===key?' selected':''}>${E(label)}</option>`).join('')}</select></label></div>${data.goal==='punt'?`<fieldset class="draft-coach-punts"><legend>Diese Kategorien gebe ich auf</legend>${root.FBA_DRAFT_COACH.categories.map(cat=>`<label><input type="checkbox" value="${E(cat)}"${data.punts.includes(cat)?' checked':''}${data.punts.length>=7&&!data.punts.includes(cat)?' disabled':''} onchange="toggleDraftPunt(this.value)">${E(cat)}</label>`).join('')}</fieldset>`:''}<div class="draft-coach-categories">${tilesMarkup(data)}</div><p class="draft-coach-rank-note"># = Rang wie in den Live-Standings · ${data.own?.picks||0}/${DRAFT_MAX_ROUNDS} eigene Picks · ${data.participants}/${draftTeams().length} Teams mit Picks${data.uneven?' · Unterschiedliche Pickzahlen':''}</p>${data.missing?`<div class="draft-coach-projection-warnings" role="status"><b>Vorläufiger Teamvergleich · ${data.missing} Spieler ohne Projektion</b>${data.rows.filter(row=>row.missing).map(row=>`<div><b>${E(T(row.team).s||row.team)}</b>${draftMissingProjectionMarkup(row.missingPlayers,true)}</div>`).join('')}</div>`:''}<div class="draft-coach-note" role="status" aria-live="polite"><b>${E(note.title)}</b><p>${E(note.body)}</p></div><details class="draft-coach-method"><summary>Basis der Draft-Beratung</summary><p>Die Ränge sind die aktuelle Momentaufnahme aus den Live-Standings. Für die Hinweise vergleichen wir zusätzlich die Leistung je besetztem Kaderplatz, damit unterschiedliche Pickzahlen nicht automatisch als Stärke oder Schwäche gelten. FG% und FT% zählen nach Treffern und Versuchen, nicht als einfacher Mittelwert.</p><p>Gültige Projektionen 2026/27 nutzen die erwarteten Spiele der Quelle. Für gedraftete Spieler ohne Expert-Projektion setzen wir ausdrücklich 0 Statistikbeitrag und 0 FBA-Value als Ersatz an. Sie belegen weiter ihren Kaderplatz; die betroffenen Teams werden markiert. Die anderen Spielerwerte bleiben erhalten. Eine Quote ohne Versuche bleibt offen. Diese Ersatzwerte gelten nur für die Draft-Auswertung. Das ist eine Draft-Modellrechnung, keine Wochenprognose. FBA-Value und seine Saisonbasis stehen separat am Spieler.</p><p>Vorschläge gewichten dein Ziel, Abstände zum Mittelfeld, erreichbare Rangverbesserungen pro Kaderplatz und Nachteile in anderen aktiven Kategorien. Zunächst betrachten wir verfügbare Spieler bis 24 ADP-Plätze hinter deinem nächsten Pick; fehlen dort bewertbare Spieler, erweitern wir die Auswahl. ADP garantiert keine Verfügbarkeit. Die Vorschau bleibt eine Modellrechnung.</p></details></section>`;
  }
  function recommendationsMarkup(){
    const data=context();
    if(data.full||!data.ready||data.goal==='punt'&&!data.punts.length)return '';
    return `<section class="draft-coach-recommendations"><div class="draft-bestfit-title"><b>Spieler für ${E(T(data.team).s||data.team)}</b><small>${E(root.FBA_DRAFT_COACH.goals[data.goal])}</small></div>${data.recommendations.length?`<div class="draft-coach-suggestions">${data.recommendations.map(rec=>{
      const improves=rec.improvements.slice(0,2).map(p=>p.cat).join(' + '),harms=rec.harms.slice(0,2).map(p=>p.cat).join(' + ');
      return `<button type="button" class="draft-coach-suggestion" onclick="showDraftCoachPreview('${E(rec.player.id)}')"><strong>${E(rec.player.name)}</strong><span>${E(rec.player.pos||'NBA')} · ADP ${E(rec.player.adp??'–')}</span><b>${E(improves?'Stärkt das Profil: '+improves:'Breite Ergänzung prüfen')}</b>${harms?`<small>Je Kaderplatz schwächer: ${E(harms)}</small>`:''}<span class="draft-coach-preview-link">Auswirkung auf mein Team →</span></button>`;
    }).join('')}</div>`:'<p class="draft-coach-empty">Aktuell kein verfügbarer Spieler mit vollständiger Statistikbasis.</p>'}</section>`;
  }
  function previewMarkup(){
    const data=context(),rec=data.candidates.find(rec=>String(rec.player.id)===previewId);
    if(!rec){previewId=null;return '';}
    const next=nextOpenDraftPick(),locked=typeof espnDraftReadOnly==='function'&&espnDraftReadOnly(),espnCan=locked&&Boolean(root.FBA_ESPN_MOCK?.canDraft?.()),at=locked?(espnCan?'Bei ESPN draften':'Warte auf ESPN'):next?`Für ${T(next.team).s||next.team} draften · Pick ${next.overall}`:'Draft abgeschlossen';
    return `<section class="draft-coach-preview draft-glass" aria-label="Spielervorschau für dein Team"><div class="draft-coach-preview-head"><div><span class="draft-coach-kicker">Vorschau für ${E(T(data.team).s||data.team)}</span><h3>${E(rec.player.name)}</h3></div><button type="button" onclick="closeDraftCoachPreview()" aria-label="Spielervorschau schließen">×</button></div><p class="draft-coach-preview-intro">Liga-Ränge, wenn du diesen Spieler deinem Kader hinzufügst:</p><div class="draft-coach-preview-grid">${rec.ranks.map(change=>`<div class="${change.punted?'punted':''}"><span>${E(change.cat)}${change.punted?' · PUNT':''}</span><b>${rankText(change.before)} → ${rankText(change.after)}</b><small>${change.direction==='up'?'↑ Profil pro Kaderplatz':change.direction==='down'?'↓ Profil pro Kaderplatz':change.direction==='same'?'Profil stabil':'Profil im Aufbau'}</small></div>`).join('')}</div><p class="draft-coach-preview-foot">Die Vorschau rechnet einen zusätzlichen eigenen Pick ein. Die Profil-Pfeile vergleichen die Leistung je Kaderplatz. ${locked?"Der Pick wird erst nach ESPNs Bestätigung übernommen.":"Dein Kader wird erst mit dem Draft-Button verändert."}</p><div class="draft-coach-preview-actions">${maikValueMarkup(rec.player)}<button type="button" class="draft-pick-action" data-espn-player-id="${locked?E(rec.player.id):''}" onclick="selectDraftPlayer('${E(rec.player.id)}')"${next&&(!locked||espnCan)?'':' disabled'}>${E(at)}</button></div></section>`;
  }
  root.resetDraftCoach=()=>{cached=null;};
  root.draftCoachContext=context;
  root.draftCoachMarkup=markup;
  root.draftCoachRecommendationsMarkup=recommendationsMarkup;
  root.draftCoachPreviewMarkup=previewMarkup;
  root.setDraftCoachTeam=value=>{if(!draftTeams().includes(value))return;DRAFT_STATE.myTeam=value;saveDraftState();refreshDraftPage(true);};
  root.setDraftCoachGoal=value=>{
    DRAFT_STATE.goal=root.FBA_DRAFT_COACH.normalizeGoal(value);DRAFT_STATE.punts=[];DRAFT_STATE.hunt=null;
    saveDraftState();refreshDraftPage(true);
  };
  root.showDraftCoachPreview=id=>{
    const data=context();
    if(!data.candidates.some(rec=>String(rec.player.id)===String(id))){showDraftToast('Für diese Vorschau fehlt eine vollständige Statistikbasis oder dein Kader ist bereits voll.',false);return;}
    previewId=String(id);let box=document.getElementById('draftCoachPreview');
    if(!box){DRAFT_STATE.panel='room';saveDraftState();refreshDraftPage(true);box=document.getElementById('draftCoachPreview');}
    if(box){box.innerHTML=previewMarkup();box.scrollIntoView?.({behavior:'smooth',block:'nearest'});}
  };
  root.closeDraftCoachPreview=()=>{previewId=null;const box=document.getElementById('draftCoachPreview');if(box)box.innerHTML='';};
})(typeof globalThis!=='undefined'?globalThis:this);
