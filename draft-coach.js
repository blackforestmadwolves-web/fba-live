/* Personal draft advice. Pure functions; no changes to picks or the FBA model.
   Raw ranks mirror Live Standings. Advice compares output per occupied slot. */
(function(root){
  'use strict';
  const categories=Object.freeze(['PTS','REB','AST','3PM','STL','BLK','FG%','FT%']);
  const fields=Object.freeze(['PTS','REB','AST','3PM','STL','BLK','FGM','FGA','FTM','FTA']);
  const goals=Object.freeze({balanced:'Ausgeglichen draften',punt:'Punt-Build',strengths:'Stärken ausbauen'});
  const normalizeGoal=goal=>Object.hasOwn(goals,goal)?goal:'balanced';
  const normalizePunts=punts=>[...new Set((Array.isArray(punts)?punts:[]).filter(c=>categories.includes(c)))].slice(0,7);
  const number=value=>(typeof value==='number'||typeof value==='string')&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
  function stats(player,defaultGames=72){
    if(!player||player.projectionReady===false)return null;
    const result={};
    for(const field of fields){const n=number(player[field]);if(n==null||n<0)return null;result[field]=n;}
    if(result.FGM>result.FGA+1e-8||result.FTM>result.FTA+1e-8)return null;
    const gp=number(player.projectedGp);
    result.games=Number.isInteger(gp)&&gp>0&&gp<=82?gp:defaultGames;
    if(!Number.isFinite(result.games)||result.games<=0)return null;
    return result;
  }
  function finish(row){
    const values={...row.totals,'FG%':row.totals.FGA>0?row.totals.FGM/row.totals.FGA:null,'FT%':row.totals.FTA>0?row.totals.FTM/row.totals.FTA:null};
    const quality=Object.fromEntries(categories.map(cat=>[cat,values[cat]==null?null:cat.includes('%')?values[cat]:row.picks?values[cat]/row.picks:null]));
    return {...row,values,quality};
  }
  function add(row,playerStats){
    const totals={...row.totals};fields.forEach(field=>totals[field]+=playerStats[field]*playerStats.games);
    return finish({...row,picks:row.picks+1,totals});
  }
  function rank(rows,team,cat,key='values'){
    const current=rows.find(row=>row.team===team);
    if(!current?.complete||!current.picks||current[key][cat]==null)return null;
    const eligible=rows.filter(row=>row.complete&&row.picks&&row[key][cat]!=null);
    return 1+eligible.filter(row=>row[key][cat]>current[key][cat]).length;
  }
  function spread(values){
    if(!values.length)return 0;
    const mean=values.reduce((s,n)=>s+n,0)/values.length;
    return Math.sqrt(values.reduce((s,n)=>s+(n-mean)**2,0)/values.length);
  }
  function median(values){const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
  function analyze(input){
    const teams=[...new Set(input.teams||[])],pool=input.pool||[],byId=new Map(pool.map(player=>[String(player.id),player]));
    const goal=normalizeGoal(input.goal),punts=goal==='punt'?normalizePunts(input.punts):[],hunt=goal==='strengths'&&categories.includes(input.hunt)?input.hunt:null;
    const active=hunt?[hunt]:categories.filter(cat=>!punts.includes(cat));
    const used=new Set(),raw=teams.map(team=>({team,picks:0,missing:0,complete:true,totals:Object.fromEntries(fields.map(f=>[f,0]))}));
    for(const pick of input.picks||[]){
      const row=raw.find(row=>row.team===pick.team),id=String(pick.playerId);
      if(!row||used.has(id))continue;
      used.add(id);row.picks++;
      const s=stats(byId.get(id),input.defaultGames);
      if(!s){row.missing++;row.complete=false;continue;}
      fields.forEach(field=>row.totals[field]+=s[field]*s.games);
    }
    const rows=raw.map(finish),own=rows.find(row=>row.team===input.team)||null,participants=rows.filter(row=>row.picks>0);
    const missing=participants.reduce((sum,row)=>sum+row.missing,0),ready=!!own?.complete&&!missing;
    const enough=ready&&own.picks>0&&participants.length>=2;
    const full=!!own&&own.picks>=(input.maxRoster||13);
    const tiles=categories.map(cat=>({cat,rank:ready?rank(rows,input.team,cat):null,punted:punts.includes(cat)}));
    const needs=active.map(cat=>{
      const peers=participants.filter(row=>row.complete&&row.quality[cat]!=null).map(row=>row.quality[cat]);
      const base=own?.quality[cat],center=peers.length?median(peers):null;
      // The player spread prevents a near-tie in one category from dominating.
      const playerValues=pool.map(p=>stats(p,input.defaultGames)).filter(Boolean).map(s=>cat==='FG%'?s.FGA?s.FGM/s.FGA:null:cat==='FT%'?s.FTA?s.FTM/s.FTA:null:s[cat]*s.games).filter(v=>v!=null);
      const scale=Math.max(spread(peers),spread(playerValues)*.2,1e-8);
      const deficit=enough&&base!=null&&center!=null?Math.max(-2,Math.min(2,(center-base)/scale)):0;
      return {cat,scale,deficit,rank:enough?rank(rows,input.team,cat,'quality'):null,weight:1};
    });
    const strongest=[...needs].sort((a,b)=>a.deficit-b.deficit||categories.indexOf(a.cat)-categories.indexOf(b.cat)).slice(0,3).map(x=>x.cat);
    for(const need of needs)need.weight=!enough?1:goal==='strengths'?(hunt||strongest.includes(need.cat)?2:.35):1+Math.max(0,need.deficit)*2;
    const candidates=[];
    if(ready&&own&&!full){
      for(const player of pool){
        if(used.has(String(player.id)))continue;
        const s=stats(player,input.defaultGames);if(!s)continue;
        const after=add(own,s),afterRows=rows.map(row=>row.team===own.team?after:row);
        const changes=needs.map(need=>{
          let gain;
          if(!own.picks){
            const peers=participants.filter(row=>row.complete&&row.quality[need.cat]!=null).map(row=>row.quality[need.cat]);
            gain=after.quality[need.cat]==null?0:(after.quality[need.cat]-(peers.length?median(peers):0))/need.scale;
          }else gain=own.quality[need.cat]==null||after.quality[need.cat]==null?0:(after.quality[need.cat]-own.quality[need.cat])/need.scale;
          // Bound outliers and keep harms in the score, including percentage dilution.
          const beforeRank=rank(rows,input.team,need.cat,'quality'),afterRank=rank(afterRows,input.team,need.cat,'quality');
          const rankGain=beforeRank!=null&&afterRank!=null?beforeRank-afterRank:0;
          return {cat:need.cat,gain,rankGain,weighted:(Math.max(-4,Math.min(4,gain))+.15*rankGain)*need.weight};
        });
        const score=changes.reduce((sum,change)=>sum+change.weighted,0)/active.length;
        const improvements=changes.filter(change=>change.gain>1e-8).sort((a,b)=>b.weighted-a.weighted);
        const harms=changes.filter(change=>change.gain<-1e-8).sort((a,b)=>a.weighted-b.weighted);
        const ranks=categories.map(cat=>({cat,before:tiles.find(t=>t.cat===cat).rank,after:rank(afterRows,input.team,cat),punted:punts.includes(cat),direction:own.quality[cat]==null||after.quality[cat]==null?null:after.quality[cat]>own.quality[cat]+1e-8?'up':after.quality[cat]<own.quality[cat]-1e-8?'down':'same'}));
        candidates.push({player,score,improvements,harms,ranks});
      }
    }
    // Market scope keeps early picks focused on players in the next three rounds.
    const pickNumber=number(input.nextPick),market=candidates.filter(c=>number(c.player.adp)>0&&number(c.player.adp)<=(pickNumber||1)+24);
    const marketCandidates=market.length?market:candidates;
    const recommendations=[...marketCandidates].sort((a,b)=>b.score-a.score||(number(a.player.adp)||Infinity)-(number(b.player.adp)||Infinity)||String(a.player.id).localeCompare(String(b.player.id))).slice(0,3);
    const priorities=[...needs].sort((a,b)=>b.deficit-a.deficit||categories.indexOf(a.cat)-categories.indexOf(b.cat));
    const counts=participants.map(row=>row.picks);
    return {team:input.team,goal,punts,hunt,active,own,rows,tiles,ready,enough,full,missing,participants:participants.length,uneven:new Set(counts).size>1,
      priorities,strongest,recommendations,candidates,marketLimited:market.length>0,nextPick:pickNumber};
  }
  const api=Object.freeze({categories,fields,goals,normalizeGoal,normalizePunts,stats,analyze});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FBA_DRAFT_COACH=api;
})(typeof globalThis!=='undefined'?globalThis:this);
