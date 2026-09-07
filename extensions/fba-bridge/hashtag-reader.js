/* Reads only the rendered projection table; no cookies or login fields. */
(()=>{
  'use strict';
  const loadedAt=Date.now();let preparingUntil=0;
  const desired={DDSHOW:'900',DDGAMES:'0',DropDownList1:'Off',DDPOS:'All',DDTSUM:'All',DDDURATION:'0',DDRANK:'AVG'};
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(sender.id!==chrome.runtime.id||message?.type!=='FBA_HASHTAG_READ')return;
    if(location.origin!=='https://hashtagbasketball.com'||location.pathname!=='/import-v4/fantasy-basketball-projections'||location.hash!=='#fba-sync'){
      reply({error:'Bitte Hashtag im selben Browser-Profil anmelden und danach den Abgleich erneut starten.'});return;
    }
    if(document.readyState!=='complete'||Date.now()<preparingUntil){reply({waiting:true});return;}
    for(const [key,value] of Object.entries(desired)){
      const select=document.getElementById('ContentPlaceHolder1_'+key);
      if(!select||!Array.from(select.options).some(o=>o.value===value)){reply({error:'Hashtag-Ansicht hat sich geändert. Der bisherige Import bleibt erhalten.'});return;}
      if(select.value!==value){preparingUntil=Date.now()+2500;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));reply({waiting:true});return;}
    }
    const table=document.getElementById('ContentPlaceHolder1_GridView1');
    if(!table?.rows.length){reply({error:'Hashtag-Projektionstabelle fehlt. Bitte Anmeldung prüfen.'});return;}
    const snapshot={sourceUrl:location.origin+location.pathname,heading:document.querySelector('h5')?.innerText,
      updatedText:(document.body.innerText.match(/Updated:\s*\d{1,2} [A-Za-z]+ \d{4}/)||[])[0],
      options:Object.fromEntries(Array.from(document.querySelectorAll('select')).slice(0,10).map(s=>[s.id.replace('ContentPlaceHolder1_',''),{value:s.value,label:s.options[s.selectedIndex]?.text}])),
      headers:Array.from(table.rows[0].cells,c=>c.innerText.trim()),
      rows:Array.from(table.rows).filter(r=>r.querySelector('a[href$="/player"]')).map(r=>{const a=r.querySelector('a[href$="/player"]');return {cells:Array.from(r.cells,c=>c.innerText.trim()),playerName:a.innerText.trim(),playerLink:a.getAttribute('href')};})};
    reply({ready:true,loadedAt,snapshot});
  });
})();
