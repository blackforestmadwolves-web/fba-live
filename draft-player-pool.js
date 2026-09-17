/* Complete ESPN identities, independent of projection coverage and editorial lists. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){
    const registry=api.create(root.FBA_DRAFT_PLAYER_CATALOG?.players||[],root.FBA_DRAFT_POOL||[]);
    root.FBA_DRAFT_POOL=registry.pool();
    const publish=()=>{root.FBA_DRAFT_POOL=registry.pool();};
    root.FBA_DRAFT_PLAYER_POOL={
      fetchPlayers:api.fetchPlayers,
      add(players){registry.add(players);publish();},
      learnPicks(picks){registry.learnPicks(picks);publish();},
      count:()=>registry.pool().length
    };
  }
})(typeof window==='object'?window:null,function(){
  'use strict';
  const fields=['PTS','REB','AST','3PM','STL','BLK','FGM','FGA','FTM','FTA'];
  const positions=['PG','SG','SF','PF','C'];
  const nba={1:'ATL',2:'BOS',3:'NOP',4:'CHI',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GSW',10:'HOU',11:'IND',12:'LAC',13:'LAL',14:'MIA',15:'MIL',16:'MIN',17:'BKN',18:'NYK',19:'ORL',20:'PHI',21:'PHX',22:'POR',23:'SAC',24:'SAS',25:'OKC',26:'UTA',27:'WAS',28:'TOR',29:'MEM',30:'CHA'};
  function identity(player){
    const id=String(player?.id??''),name=String(player?.name??'').trim();
    if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<=0||!name||name.length>160)throw new Error('Eine ESPN-Spieleridentität ist ungültig.');
    return {id,name};
  }
  function fromEspn(entry){
    const p=entry?.player;
    if(!p)throw new Error('Der ESPN-Spielerkatalog ist unvollständig.');
    const basic=identity({id:p.id,name:p.fullName});
    if(entry.id!=null&&String(entry.id)!==basic.id)throw new Error('ESPN liefert widersprüchliche Spieler-IDs.');
    const pos=positions[Number(p.defaultPositionId)-1]||'';
    const fantasyPositions=positions.filter((_,i)=>(p.eligibleSlots||[]).includes(i)).join(',')||pos;
    const rawAdp=p.ownership?.averageDraftPosition,adp=typeof rawAdp==='number'&&Number.isFinite(rawAdp)&&rawAdp>0?rawAdp:null;
    return {...basic,nba:nba[p.proTeamId]||'',primaryPosition:pos,fantasyPositions,active:p.active!==false,adp};
  }
  function withoutStats(player){
    return {...identity(player),nba:'',pos:'',photo:`https://a.espncdn.com/i/headshots/nba/players/full/${player.id}.png`,rank:null,adp:null,gp:null,projectedGp:null,
      ...Object.fromEntries(fields.map(field=>[field,null])),projectionReady:false,projectionMissing:true,source:'Expert-Projektion fehlt'};
  }
  function create(catalog,existing=[]){
    let byId=new Map(),pool=Object.freeze([]);
    for(const player of existing){const basic=identity(player);byId.set(basic.id,Object.freeze({...player,...basic}));}
    function add(players){
      const next=new Map(byId),seen=new Set();
      for(const metadata of players){
        const basic=identity(metadata);if(seen.has(basic.id))throw new Error('Der ESPN-Spielerkatalog enthält doppelte IDs.');seen.add(basic.id);
        const previous=next.get(basic.id)||withoutStats(basic);
        // Only public identity/market fields may enter here, never projection stats.
        const entry={...previous,...basic};
        for(const field of ['nba','primaryPosition','fantasyPositions','active','adp'])if(Object.hasOwn(metadata,field))entry[field]=metadata[field];
        // Keep ESPN eligibility separate from projection providers' position labels.
        if(Object.hasOwn(metadata,'fantasyPositions'))entry.espnPositions=Object.freeze(positions.filter(pos=>String(metadata.fantasyPositions||'').split(/[,/\s]+/).includes(pos)));
        if(Object.hasOwn(metadata,'primaryPosition'))entry.espnPrimaryPosition=positions.includes(metadata.primaryPosition)?metadata.primaryPosition:null;
        if(metadata.primaryPosition!=null)entry.pos=metadata.primaryPosition;
        entry.photo=`https://a.espncdn.com/i/headshots/nba/players/full/${basic.id}.png`;
        next.set(basic.id,Object.freeze(entry));
      }
      byId=next;pool=Object.freeze([...byId.values()]);
    }
    function learnPicks(picks){
      const missing=new Map();
      for(const pick of picks){
        if(byId.has(String(pick.playerId)))continue;
        const basic=identity({id:pick.playerId,name:pick.playerName});missing.set(basic.id,basic);
      }
      if(missing.size)add([...missing.values()]);
    }
    add(catalog);
    return {pool:()=>pool,add,learnPicks};
  }
  async function fetchPlayers(room,{fetcher=globalThis.fetch,signal}={}){
    if(!/^\d+$/.test(String(room?.leagueId))||!Number.isInteger(room?.seasonId)||room.seasonId!==2027)throw new Error('ESPN-Spielerkatalog: Saison oder Raum ungültig.');
    const url=`https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${room.seasonId}/segments/0/leagues/${room.leagueId}?view=kona_player_info`;
    const players=[],seen=new Set(),pageSize=1000;
    // Read through the terminal empty page; never silently truncate a catalog.
    for(let page=0;page<30;page++){
      const response=await fetcher(url,{credentials:'omit',cache:'no-store',signal,headers:{Accept:'application/json','X-Fantasy-Filter':JSON.stringify({players:{limit:pageSize,offset:players.length,sortPercOwned:{sortPriority:1,sortAsc:false}}})}});
      if(!response.ok)throw new Error('Der vollständige ESPN-Spielerkatalog ist gerade nicht erreichbar.');
      const data=await response.json();
      if(!Array.isArray(data.players))throw new Error('ESPN liefert keine vollständige Spielerliste.');
      if(!data.players.length){if(!players.length)throw new Error('Der ESPN-Spielerkatalog ist leer.');return players;}
      for(const entry of data.players){
        const player=fromEspn(entry);
        if(seen.has(player.id))throw new Error('Die ESPN-Spielerseiten überschneiden sich. Der letzte Katalog bleibt erhalten.');
        seen.add(player.id);players.push(player);
      }
    }
    throw new Error('Das Ende des ESPN-Spielerkatalogs wurde nicht bestätigt.');
  }
  return {identity,fromEspn,create,fetchPlayers};
});
