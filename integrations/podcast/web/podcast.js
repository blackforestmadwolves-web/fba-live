/* Published audio only; the private editorial packet and API key are never fetched here. */
(function(root){'use strict';
  let episodes=[],busy=false,loaded=false,error='',stamp=0,selected=null,sequence=0;
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function markup(){setTimeout(()=>load(false),0);return '<section class="fba-podcast"><div class="podcast-kicker">FBA FUNK</div><h1>Ellbogen. Winter. Gegenwind.</h1><p class="podcast-deck">Der tägliche Liga-Talk mit Michael Ellbogen und Tom Winter.</p><p class="podcast-format">5–10 Minuten am Morgen · Der Wochenrückblick in rund 20 Minuten</p><div id="podcast-episodes">'+list()+'</div><button class="podcast-refresh" onclick="FBA_PODCAST.load(true)">Folgen aktualisieren</button></section>';}
  function list(){if(error)return '<p role="status">Die Folgen sind gerade nicht erreichbar. Bitte gleich noch einmal versuchen.</p>';
    if(!loaded)return '<p role="status">Folgen werden geladen …</p>';
    if(!episodes.length)return '<div class="podcast-empty"><h2>Noch keine Folge veröffentlicht.</h2><p>Hier erscheinen die fertigen Folgen.</p></div>';
    return episodes.map(e=>'<article class="podcast-episode"><div class="podcast-meta">'+(e.kind==='weekly'?'WOCHENRÜCKBLICK':'MORGENRUNDE')+' · '+esc(new Date(e.published_at).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'}))+' · '+Math.round(e.duration_seconds/60)+' MIN</div><h2>'+esc(e.title)+'</h2><p>'+esc(e.summary)+'</p><button onclick="FBA_PODCAST.play(\''+esc(e.id)+'\')">'+(selected===e.id?'Player öffnen':'Folge anhören')+'</button></article>').join('');}
  function update(){const el=document.getElementById('podcast-episodes');if(el)el.innerHTML=list();}
  function load(force){if(busy||(!force&&loaded&&Date.now()-stamp<60000))return;busy=true;error='';const callback='fbaPodcast133_'+(++sequence),script=document.createElement('script');let timer;
    function finish(){clearTimeout(timer);script.remove();root[callback]=()=>{};busy=false;stamp=Date.now();update();}
    root[callback]=data=>{try{if(!data||data.schema!==133||!data.ok||!Array.isArray(data.episodes))throw Error();episodes=data.episodes.filter(e=>/^(daily|weekly)-\d{4}-\d{2}-\d{2}$/.test(e.id)&&/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/preview$/.test(e.preview_url)&&Number.isFinite(e.duration_seconds));loaded=true;}catch(e){error='invalid';}finally{finish();}};
    script.onerror=()=>{error='offline';finish();};timer=setTimeout(()=>{error='timeout';finish();},45000);
    const url=new URL(apiUrl());url.searchParams.set('podcast','feed133');url.searchParams.set('callback',callback);script.src=url.toString();document.head.appendChild(script);
  }
  function play(id){const e=episodes.find(x=>x.id===id);if(!e)return;let dock=document.getElementById('podcast-dock');if(!dock){dock=document.createElement('aside');dock.id='podcast-dock';dock.setAttribute('aria-label','Podcast-Player');document.body.appendChild(dock);}
    if(selected!==id){dock.innerHTML='<div class="podcast-playing"><strong>'+esc(e.title)+'</strong><button aria-label="Podcast schließen" onclick="FBA_PODCAST.close()">×</button></div><iframe title="FBA Funk Audioplayer" src="'+esc(e.preview_url)+'" allow="autoplay" loading="eager"></iframe>';selected=id;}
    dock.hidden=false;document.body.classList.add('podcast-playing-active');update();}
  function close(){const el=document.getElementById('podcast-dock');if(el)el.remove();selected=null;document.body.classList.remove('podcast-playing-active');update();}
  root.FBA_PODCAST={markup,load,play,close};
})(window);
