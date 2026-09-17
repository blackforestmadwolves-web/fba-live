/* v83: post-draft report; explicit zero contributions never erase known stats. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FBA_DRAFT_REVIEW=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  const cats=['PTS','REB','AST','3PM','STL','BLK','FG%','FT%'];
  const fields=['PTS','REB','AST','3PM','STL','BLK','FGM','FGA','FTM','FTA'];
  const pos=['PG','SG','SF','PF','C'];
  const finite=Number.isFinite;
  function columnPick(round,column,teamCount=8){return (round-1)*teamCount+(round%2?column+1:teamCount-column);}
  function completion(teams,picks,rounds=13){
    const max=teams.length*rounds,slots=new Set(),players=new Set();let invalid=false;
    if(teams.length!==8||new Set(teams).size!==8)return {complete:false,count:0,max,invalid:true};
    for(const p of picks){
      if(!p||typeof p!=='object'){invalid=true;continue;}
      const n=Number(p.overall),round=Math.ceil(n/8),column=round%2?(n-1)%8:7-(n-1)%8,id=String(p.playerId||'');
      if(!Number.isInteger(n)||n<1||n>max||!id||slots.has(n)||players.has(id)||p.team!==teams[column])invalid=true;
      slots.add(n);players.add(id);
    }
    return {complete:!invalid&&slots.size===max,count:slots.size,max,invalid};
  }
  function analyze({teams,picks,pool,rounds=13,defaultGames=72,statsFor,valueFor,positionFor}){
    const status=completion(teams,picks,rounds);
    if(!status.complete)return {...status,rows:[],standingsReady:false};
    const byId=new Map(pool.map(p=>[String(p.id),p]));
    const rows=teams.map(team=>({team,picks:[],missingStats:[],missingValue:[],missingAdp:[],missingPositions:[],
      historicalValue:0,projectedValue:0,defaultGamesCount:0,explicitGamesCount:0,
      totals:Object.fromEntries(fields.map(f=>[f,0])),positions:Object.fromEntries(pos.map(p=>[p,0])),ranks:{},points:{},score:null,rank:null}));
    const byTeam=new Map(rows.map(row=>[row.team,row]));
    for(const pick of picks.slice().sort((a,b)=>Number(a.overall)-Number(b.overall))){
      const id=String(pick.playerId),row=byTeam.get(pick.team),player=byId.get(id),stats=player?statsFor(player,defaultGames):null;
      const primary=player?valueFor(player)?.primary:null,positions=player?[...new Set(positionFor(player).filter(p=>pos.includes(p)))]:[];
      const rawAdp=player?.adp,adp=(typeof rawAdp==='number'||typeof rawAdp==='string')&&String(rawAdp).trim()!==''&&finite(Number(rawAdp))&&Number(rawAdp)>0?Number(rawAdp):null;
      const zeroValue=!stats||!finite(primary?.value);
      const item={id,player,name:player?.name||pick.playerName||`Spieler #${id}`,overall:Number(pick.overall),round:Math.ceil(Number(pick.overall)/8),stats,primary,positions,adp,adpDelta:adp==null?null:Number(pick.overall)-adp,zeroValue,evaluationValue:zeroValue?0:primary.value};
      row.picks.push(item);positions.forEach(p=>row.positions[p]++);
      if(!positions.length)row.missingPositions.push(item.name);
      if(stats){
        fields.forEach(f=>row.totals[f]+=stats[f]*stats.games);
        const gp=Number(player.projectedGp);
        if(Number.isInteger(gp)&&gp>0&&gp<=82)row.explicitGamesCount++;else row.defaultGamesCount++;
      }else row.missingStats.push(item.name);
      if(zeroValue)row.missingValue.push(item.name);
      else if(primary.kind==='projection')row.projectedValue++;else row.historicalValue++;
      if(adp==null)row.missingAdp.push(item.name);
    }
    for(const row of rows){
      row.values={...row.totals,'FG%':row.totals.FGA>0?row.totals.FGM/row.totals.FGA:null,'FT%':row.totals.FTA>0?row.totals.FTM/row.totals.FTA:null};
      row.valueAverage=row.picks.reduce((sum,p)=>sum+p.evaluationValue,0)/row.picks.length;
      const market=row.picks.filter(p=>p.adpDelta!=null);
      row.adpCount=market.length;row.adpAverage=market.length?market.reduce((s,p)=>s+p.adpDelta,0)/market.length:null;
      row.late=market.filter(p=>p.adpDelta>0).sort((a,b)=>b.adpDelta-a.adpDelta).slice(0,3);
      row.early=market.filter(p=>p.adpDelta<0).sort((a,b)=>a.adpDelta-b.adpDelta).slice(0,3);
      row.anchor=row.picks.filter(p=>!p.zeroValue).sort((a,b)=>b.primary.value-a.primary.value)[0]||null;
    }
    const categoryReady=Object.fromEntries(cats.map(cat=>[cat,rows.every(row=>finite(row.values[cat]))]));
    const standingsReady=cats.some(cat=>rows.some(row=>finite(row.values[cat])));
    const partialStandings=!cats.every(cat=>categoryReady[cat]);
    for(const cat of cats){
      // No attempts means no percentage for that team, not a league-wide failure.
      const eligible=rows.filter(row=>finite(row.values[cat]));
      for(const row of eligible){
        const better=eligible.filter(r=>r.values[cat]>row.values[cat]).length,tied=eligible.filter(r=>r.values[cat]===row.values[cat]).length;
        row.ranks[cat]=better+1;row.points[cat]=8-better-(tied-1)/2;
      }
    }
    for(const row of rows){
      row.strengths=cats.filter(c=>row.ranks[c]<=4).sort((a,b)=>row.ranks[a]-row.ranks[b]);
      row.weaknesses=cats.filter(c=>row.ranks[c]>=5).sort((a,b)=>row.ranks[b]-row.ranks[a]);
      row.midGaps=Object.fromEntries(cats.map(c=>{
        const fourth=rows.map(r=>r.values[c]).filter(finite).sort((a,b)=>b-a)[3];
        return [c,finite(row.values[c])&&finite(fourth)?row.values[c]-fourth:null];
      }));
      row.scoredCategories=cats.filter(c=>finite(row.points[c])).length;
      if(standingsReady)row.score=cats.reduce((sum,c)=>sum+(row.points[c]||0),0);
      row.matchups=rows.filter(r=>r!==row).map(other=>{
        const comparable=cats.filter(c=>finite(row.values[c])&&finite(other.values[c]));
        const wins=comparable.filter(c=>row.values[c]>other.values[c]);
        const losses=comparable.filter(c=>row.values[c]<other.values[c]);
        const ties=comparable.filter(c=>row.values[c]===other.values[c]);
        return {team:other.team,wins,losses,ties,missing:cats.filter(c=>!comparable.includes(c)),provisional:!!(row.missingStats.length||other.missingStats.length)};
      });
    }
    if(standingsReady)for(const row of rows)row.rank=1+rows.filter(r=>r.score>row.score).length;
    const standings=standingsReady?rows.slice().sort((a,b)=>b.score-a.score):rows;
    return {...status,rows,standings,standingsReady,partialStandings,provisional:partialStandings||rows.some(r=>r.missingStats.length||r.missingValue.length),categoryReady,categories:cats,defaultGames,
      sources:[...new Set(rows.flatMap(row=>row.picks.filter(p=>p.stats).map(p=>p.player.source||'Quelle nicht hinterlegt')))],
      missingStats:rows.flatMap(r=>r.missingStats),historicalValue:rows.reduce((s,r)=>s+r.historicalValue,0),projectedValue:rows.reduce((s,r)=>s+r.projectedValue,0),
      defaultGamesCount:rows.reduce((s,r)=>s+r.defaultGamesCount,0),explicitGamesCount:rows.reduce((s,r)=>s+r.explicitGamesCount,0)};
  }
  return Object.freeze({columnPick,completion,analyze});
});

(function(root){
  'use strict';
  let opened=false,selectedTeam=null,archived=null;
  const number=(value,d=1)=>Number.isFinite(value)?value.toLocaleString('de-DE',{minimumFractionDigits:0,maximumFractionDigits:d}):'–';
  const signed=value=>Number.isFinite(value)?(value>0?'+':'')+number(value):'–';
  function status(){return root.FBA_DRAFT_REVIEW.completion(draftTeams(),DRAFT_STATE.picks,DRAFT_MAX_ROUNDS);}
  function data(){
    const catalog=new Map((root.FBA_DRAFT_PLAYER_CATALOG?.players||[]).map(p=>[String(p.id),p]));
    return root.FBA_DRAFT_REVIEW.analyze({teams:archived?.teams||draftTeams(),picks:archived?.picks||DRAFT_STATE.picks,pool:draftPool(),rounds:DRAFT_MAX_ROUNDS,defaultGames:DRAFT_DEMO_GP,
      statsFor:root.FBA_DRAFT_COACH.stats,valueFor:maikValueFor,positionFor:p=>root.FBA_DRAFT_POOL_TOOLS.playerPositions(p,catalog.get(String(p.id)))});
  }
  function button(){
    const state=status();
    return `<button type="button" class="draft-review-button" onclick="openDraftReview()" aria-controls="draftReviewReport" aria-expanded="${opened&&!archived&&state.complete}"${state.complete?'':' disabled'} title="${state.complete?'Alle acht Teams und jeden Pick auswerten':state.invalid?'Pick-Zuordnung prüfen':`Verfügbar nach ${state.max} Picks`}">Draft-Analyse${state.complete?'':` · ${state.count}/${state.max}`}</button>`;
  }
  function rank(value){return value==null?'–':'#'+value;}
  function catValue(cat,value){return Number.isFinite(value)?cat.includes('%')?number(value*100,2)+' %':number(value,1):'–';}
  function marketText(value){return value==null?'ADP-Vergleich offen':`${number(Math.abs(value))} Picks ${value>=0?'später':'früher'} als ADP`;}
  function names(items){return items.map(p=>`${p.name} (Pick ${p.overall}, ADP ${number(p.adp)})`).join('; ');}
  function narrative(row,report){
    const strong=row.strengths.slice(0,3).map(c=>`${c} (${rank(row.ranks[c])})`).join(', '),weak=row.weaknesses.slice(0,3).map(c=>`${c} (${rank(row.ranks[c])})`).join(', ');
    const profile=report.standingsReady?`Dein Kader liegt ${report.provisional?'in dieser vorläufigen Auswertung ':''}im Vergleich auf Platz ${row.rank} mit ${number(row.score)} von 64 Roto-Punkten. ${strong?'Deine stärksten Bereiche: '+strong+'. ':''}${weak?'Den größten Aufholbedarf zeigt das Modell bei '+weak+'.':row.scoredCategories===8?'Alle acht Kategorien liegen mindestens auf Platz 4.':'Die bewertbaren Kategorien liegen mindestens auf Platz 4; einzelne Quoten sind offen.'}`:'Die verfügbaren Spielerwerte und ADP-Vergleiche stehen unten.';
    const anchor=row.anchor?`${row.anchor.name} hat mit ${maikValueFormat(row.anchor.primary.value)} den höchsten verfügbaren FBA-Value in deinem Kader (${row.anchor.primary.basis}).`:'';
    const price=row.adpAverage==null?'Für deinen Kader liegen keine gültigen ADP-Vergleiche vor.':`Im Mittel hast du deine Spieler ${marketText(row.adpAverage)} gewählt (${row.adpCount}/${row.picks.length} Picks mit ADP). ${row.late.length?'Am weitesten gegenüber ADP gefallen: '+names(row.late)+'. ':''}${row.early.length?'Am frühesten gegenüber ADP genommen: '+names(row.early)+'.':''}`;
    const thin=Object.entries(row.positions).filter(([,count])=>count<=1).map(([pos,count])=>`${pos}: ${count===0?'keine Option':'nur eine Option'}`);
    const positionText=thin.length?`Bei der Positionsbesetzung solltest du ${thin.join(', ')} im Blick behalten.`:'Für jede der fünf Positionen besitzt du mindestens zwei berechtigte Spieler.';
    let next='';
    const target=row.weaknesses[0];
    if(target){
      next=`Für die nächste Kaderverbesserung bietet sich zuerst ${target} an. Vergleiche mögliche Zugänge in dieser Kategorie und prüfe dann über die Team-Vorschau, welche deiner anderen Kategorien dadurch nachgeben.`;
      if(!target.includes('%')){
        const leader=row.picks.filter(p=>p.stats).sort((a,b)=>b.stats[target]*b.stats.games-a.stats[target]*a.stats.games)[0];
        if(leader&&row.totals[target]>0)next+=` ${leader.name} liefert derzeit ${number(leader.stats[target]*leader.stats.games/row.totals[target]*100)} % deines modellierten ${target}-Volumens.`;
      }
    }
    return `<div class="draft-review-prose"><p>${E(profile)}</p>${anchor?`<p>${E(anchor)}</p>`:''}<p>${E(price)}</p><p>${E(positionText)}${row.missingPositions.length?` Positionsangaben fehlen bei ${E(row.missingPositions.join(', '))}.`:''}</p>${next?`<p><b>Nächster Ansatz:</b> ${E(next)}</p>`:''}</div>`;
  }
  function markup(){
    if(!opened)return '';
    const report=data();
    if(!report.complete){opened=false;return '';}
    const preferred=archived?.ownTeam||DRAFT_STATE.myTeam;
    const team=report.rows.some(r=>r.team===selectedTeam)?selectedTeam:report.rows.some(r=>r.team===preferred)?preferred:report.rows[0].team;
    const row=report.rows.find(r=>r.team===team);
    const missing=report.missingStats.length?`<p class="draft-review-warning">Vorläufige Auswertung: ${report.missingStats.length} Spieler ohne Projektion zählen mit 0 Statistikbeitrag und 0 FBA-Value als Ersatz. Die betroffenen Teams und Spielernamen sind unten markiert. Die anderen Spielerwerte bleiben erhalten.</p>`:'';
    return `<section class="draft-review draft-glass" aria-labelledby="draftReviewTitle">
      <div class="draft-review-heading"><div><span class="draft-kicker">${report.max} Picks · ${report.rows.length} Teams</span><h2 id="draftReviewTitle">Deine Draft-Analyse</h2></div><button type="button" class="draft-review-close" onclick="closeDraftReview()" aria-label="Draft-Analyse schließen">×</button></div>
      <p class="draft-review-intro">${archived?`Gespeicherter Mock: <b>${E(archived.name)}</b>. Gespeicherte Picks, neu berechnet mit den aktuell verfügbaren Projektionen. Dein laufender Draft bleibt erhalten.`:'Auswertung deines fertigen Drafts aus dem vorhandenen Datensatz.'} Alle acht Kategorien zählen gleich; persönliche Punt-/Hunt-Einstellungen ändern diesen Ligavergleich nicht.</p>
      <details class="draft-review-method" open><summary>Statistikbasis &amp; Leseschlüssel</summary><p><b>Kategorie-Datenbasis:</b> ${E(report.sources.join("; ")||"offen")}.</p><p>Die Kategorie-Werte nutzen dieselbe Rechenbasis wie der Kompass: Spielerwerte × Modell-GP. Bei ${report.defaultGamesCount} Spielern gelten ${report.defaultGames} GP als gemeinsame Annahme${report.explicitGamesCount?`, bei ${report.explicitGamesCount} Spielern ist eine eigene GP-Projektion hinterlegt`:''}. FG% und FT% entstehen aus den summierten Treffern und Versuchen.</p><p>FBA-Value: ${report.historicalValue} Spieler mit Saisonbasis 2025/26, ${report.projectedValue} mit freigegebener Projektion 2026/27. Fehlende Projektionen und FBA-Werte zählen für die Draft-Auswertung als gekennzeichnete 0; alle 13 Spieler zählen im Kaderdurchschnitt mit. Bei fehlenden Wurfversuchen bleibt nur die betreffende Quote offen und erhält keine Roto-Punkte. Der ADP-Vergleich nutzt die hinterlegte ESPN-ADP; positive Differenz = später gedraftet. Roto-Gleichstände teilen die Punkte. Der Kategorievergleich berücksichtigt keine Wochen-Spielpläne und zeigt keine Gewinnwahrscheinlichkeit.</p></details>
      ${missing}${report.partialStandings?'<p class="draft-review-warning">Einzelne Quoten sind mangels Wurfversuchen offen und erhalten keine Roto-Punkte. Vorhandene Kategorien und Gegnervergleiche werden weiter ausgewertet.</p>':''}
      <h3>Die Liga im Vergleich</h3><div class="draft-review-table-scroll"><table><thead><tr><th>Rang</th><th>Team</th><th>Roto-Punkte</th><th>Ø FBA-Value</th><th>Ø Pick − ADP</th></tr></thead><tbody>${report.standings.map(r=>`<tr${r.team===team?' class="is-selected"':''}><td>${rank(r.rank)}</td><th scope="row"><button type="button" class="draft-review-team-link" data-review-team="${E(r.team)}" onclick="setDraftReviewTeam(this.dataset.reviewTeam)">${E(T(r.team).s||r.team)}</button>${draftMissingProjectionMarkup(r.missingStats,true)}</th><td>${number(r.score)} / 64${r.scoredCategories<8?`<small> · ${r.scoredCategories}/8 Kategorien</small>`:''}</td><td>${maikValueFormat(r.valueAverage)}${r.missingValue.length?`<small title="${E(r.missingValue.join(', '))}"> · ${r.missingValue.length} × 0 als Ersatz</small>`:''}</td><td title="${r.adpCount}/${r.picks.length} Picks mit ADP">${signed(r.adpAverage)} <small>(${r.adpCount}/${r.picks.length})</small></td></tr>`).join('')}</tbody></table></div>
      <label class="draft-review-team-select" for="draftReviewTeam">Team ausführlich analysieren<select id="draftReviewTeam" onchange="setDraftReviewTeam(this.value)">${report.rows.map(r=>`<option value="${E(r.team)}"${r.team===team?' selected':''}>${E(r.team)}</option>`).join('')}</select></label>
      <h3>${E(team)} · Kaderprofil</h3>${draftMissingProjectionMarkup(row.missingStats)}${narrative(row,report)}
      <div class="draft-review-positions">${Object.entries(row.positions).map(([p,n])=>`<span><b>${p}</b> ${n} Spieler</span>`).join('')}</div><p class="draft-review-caption">ESPN-Positionsberechtigungen aus dem vorhandenen Katalog. Mehrfachpositionen zählen je Position; die Summe kann über 13 liegen.</p>
      <h3>Alle acht Kategorien</h3><div class="draft-review-table-scroll"><table><thead><tr><th>Kategorie</th><th>Modellwert</th><th>Liga-Rang</th><th>Vorsprung / Rückstand zu #4</th></tr></thead><tbody>${report.categories.map(cat=>`<tr><th scope="row">${cat}</th><td>${catValue(cat,row.values[cat])}</td><td${row.ranks[cat]?` data-review-rank="${row.ranks[cat]}"`:''}>${rank(row.ranks[cat])}</td><td>${row.midGaps[cat]==null?'–':signed(cat.includes('%')?row.midGaps[cat]*100:row.midGaps[cat])}${cat.includes('%')&&row.midGaps[cat]!=null?' %-Pkt.':''}</td></tr>`).join('')}</tbody></table></div>
      <h3>Jeder Pick im Detail</h3><p class="draft-review-caption">Pick − ADP: positiv = später als der Marktmittelwert, negativ = früher. Eine große Differenz allein bewertet die Qualität oder den Team-Fit eines Picks nicht.</p>${row.missingValue.length?`<p class="draft-review-warning">Mit FBA-Value 0 als Ersatz bewertet: ${E(row.missingValue.join(', '))}. Diese Spieler zählen im Kaderdurchschnitt mit.</p>`:''}<div class="draft-review-table-scroll"><table><thead><tr><th>Runde</th><th>Pick</th><th>Spieler</th><th>Position</th><th>FBA-Value</th><th>ADP</th><th>Pick − ADP</th></tr></thead><tbody>${row.picks.map(p=>`<tr><td>${p.round}</td><td>${p.overall}</td><th scope="row">${E(p.name)}</th><td>${E(p.positions.join('/')||'–')}</td><td>${draftRosterValueMarkup(p.player)}</td><td>${number(p.adp)}</td><td>${signed(p.adpDelta)}</td></tr>`).join('')}</tbody></table></div>
      <h3>Dein Kategorievergleich mit jedem Gegner</h3><p class="draft-review-caption">Anzahl der höheren, gleichen und niedrigeren Modellwerte über alle acht Kategorien.</p><div class="draft-review-table-scroll"><table><thead><tr><th>Gegner</th><th>Vorn</th><th>Gleich</th><th>Hinten</th><th>Deine Vorteile</th></tr></thead><tbody>${row.matchups.map(m=>`<tr><th scope="row">${E(T(m.team).s||m.team)}${m.provisional?'<small> · mit Nullbeitrag</small>':''}</th><td>${m.wins.length}</td><td>${m.ties.length}</td><td>${m.losses.length}</td><td>${E(m.wins.join(', ')||'–')}${m.missing.length?` · ${m.missing.length} Kategorien offen`:''}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  }
  root.draftReviewMarkup=markup;root.draftReviewButtonMarkup=button;
  root.openDraftReview=function(){
    if(!status().complete)return;
    archived=null;opened=true;selectedTeam=null;resetMaikValueContext();refreshDraftPage(true);
    requestAnimationFrame(()=>document.getElementById('draftReviewReport')?.scrollIntoView?.({behavior:'smooth',block:'start'}));
  };
  root.openSavedDraftReview=function(session){
    const teams=session?.config?.fbaTeams,picks=session?.state?.picks;
    if(session?.version!==1||!Array.isArray(teams)||!Array.isArray(picks)||!teams.every(t=>draftTeams().includes(t))||!root.FBA_DRAFT_REVIEW.completion(teams,picks,DRAFT_MAX_ROUNDS).complete)return false;
    // Read only: neither the current picks nor an ESPN connection are replaced.
    archived=JSON.parse(JSON.stringify({teams,picks,ownTeam:session.config.ownTeam,name:session.config.name||'ESPN Mock Draft'}));
    opened=true;selectedTeam=null;resetMaikValueContext();refreshDraftPage(true);
    requestAnimationFrame(()=>document.getElementById('draftReviewReport')?.scrollIntoView?.({behavior:'smooth',block:'start'}));
    return true;
  };
  root.closeDraftReview=function(){opened=false;archived=null;refreshDraftPage(true);};
  root.setDraftReviewTeam=function(team){
    if(!(archived?.teams||draftTeams()).includes(team))return;
    selectedTeam=team;const box=document.getElementById('draftReviewReport');if(box)box.innerHTML=markup();
    document.getElementById('draftReviewTeam')?.focus({preventScroll:true});
  };
})(typeof window==='object'?window:{});
