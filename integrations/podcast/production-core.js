/* FBA Funk v133: deterministic editorial and publication gates; no provider secrets. */
var FBA_PRODUCTION133=(function(){
  function assert(ok,message){if(!ok)throw Error(message);}
  function berlin(now){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
  function slots(now){var d=berlin(now),weekday=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Berlin',weekday:'short'}).format(new Date(now));return [{id:'daily-'+d,date:d,kind:'daily'}].concat(weekday==='Mon'?[{id:'weekly-'+d,date:d,kind:'weekly'}]:[]);}
  // Rebuilt from immutable published jobs, never drafts or fictional manager speech.
  function hostMemory(published){
    var claims=[],byId={};
    (published||[]).filter(function(j){return j.status==='published';}).sort(function(a,b){return a.date.localeCompare(b.date)||a.id.localeCompare(b.id);}).forEach(function(j){
      (j.host_claims||[]).forEach(function(x){var t=(j.turns||[])[x.turn_index];if(!t||!['michael','tom'].includes(x.host)||t.speaker!==x.host||t.kind==='fictional_press_conference')return;
        var m={id:j.id+':'+x.key,episode_id:j.id,date:j.date,season:j.season||null,host:x.host,claim:x.claim,quote:x.quote,condition:x.condition||'',horizon:x.horizon,team_ids:x.team_ids||[],source_refs:t.source_refs||[],status:'tracking',reviews:[]};claims.push(m);byId[m.id]=m;});
      if(!(j.host_claims||[]).length)(j.opinions||[]).forEach(function(o,i){var host=/^Michael\b/i.test(o)?'michael':/^Tom\b/i.test(o)?'tom':null;var m={id:j.id+':legacy-'+i,episode_id:j.id,date:j.date,season:j.season||null,host:host,claim:o,quote:null,legacy:true,condition:'',horizon:'unspecified',team_ids:[],status:'tracking',reviews:[]};claims.push(m);byId[m.id]=m;});
      (j.memory_reviews||[]).forEach(function(r){var m=byId[r.claim_id];if(!m)return;m.status=r.status;m.reviews.push({episode_id:j.id,date:j.date,status:r.status,assessment:r.assessment});});
    });
    return claims;
  }
  function context(p,published,now){
    assert(p&&p.ok&&p.schema===132,'SOURCE_MISSING');
    var age=Date.parse(now)-Date.parse(p.created_at);assert(age>=-60000&&age<=90*60000,'SOURCE_STALE');
    var covered={};(published||[]).forEach(function(j){(j.covered_trade_ids||[]).forEach(function(id){covered[id]=true;});});
    var refs=['espn:league:'+p.created_at,'bbm:profile:'+p.sources.bbm.as_of,'memory:published'];
    var trades=(p.transactions||[]).filter(function(t){return t.is_completed_trade;}).map(function(t){refs.push('trade:'+t.id);return t;});
    (p.nba_night.source_refs||[]).forEach(function(x){refs.push(x);});
    (p.nba_night.performances||[]).forEach(function(x){refs.push(x.source_ref);});
    var memory=(p.memory||[]).slice(-28);
    memory.forEach(function(m){refs.push('memory:'+m.date);});
    var host_memory=hostMemory(published);host_memory.forEach(function(m){refs.push('memory:claim:'+m.id);});
    return {schema:133,revision:p.created_at,created_at:now,date:berlin(now),slots:slots(now),week:p.week,season:p.season,
      night:p.nba_night,teams:p.teams,matchups:p.matchups,trades:trades,mandatory_trade_ids:(p.mandatory_trade_ids||[]).filter(function(id){return !covered[id];}),
      player_events:p.player_events||[],bbm:{status:p.sources.bbm.status,as_of:p.sources.bbm.as_of,scope:p.sources.bbm.scope,
        teams:(p.sources.bbm.teams||[]).map(function(t){return {team_id:t.team_id,team:t.team,complete:t.complete,strengths:t.strengths,weaknesses:t.weaknesses};})},
      memory:memory,editorial_modes:['recap','preview'],published:(published||[]).slice(-35).map(function(j){return {id:j.id,date:j.date,kind:j.kind,title:j.title,summary:j.summary,opinions:j.opinions||[],editorial_plan:j.editorial_plan||null,covered_trade_ids:j.covered_trade_ids||[]};}),
      host_memory:host_memory,memory_policy:{archive:'all_published_episodes',fiction_is_evidence:false,recall:'only when relevant; at most two callbacks per daily episode; not obligatory'},
      source_refs:refs.filter(function(x,i,a){return x&&a.indexOf(x)===i;}),limitations:p.limitations,
      instructions:'German entertainment. Hosts Michael Ellbogen and Tom Winter. Dry sarcasm, natural conversation, no announcer/ASMR. 15% less arguing; informed disagreement, sometimes agree. FBA spoken Eff Bie Ey. Short greeting. Explain impact, no BBM values or dense percentages. Only registered manager_speakers may appear in brief clearly fictional press conferences. Every mandatory completed trade must be mentioned by a host; incomplete trade legs explicitly unknown, no fabricated before/after. Opinions are opinions. Prior claims only from published host_memory, with exact host/date and original conditions. Never rewrite an earlier prediction. Manager fiction is never evidence or a real manager opinion. No invented forecast baseline.'};
  }
  function validate(d,c,now){
    assert(d&&d.schema===133,'DRAFT_SCHEMA');var slot=c.slots.find(function(x){return x.id===d.id;});assert(slot&&d.kind===slot.kind&&d.date===slot.date,'WRONG_EPISODE_SLOT');
    assert(d.source_revision===c.revision,'SOURCE_REVISION_CHANGED');assert(berlin(now)===d.date,'EPISODE_DATE_EXPIRED');
    assert(Date.parse(now)-Date.parse(c.revision)<=90*60000,'SOURCE_STALE');
    assert(!['pending_games_or_boxscores','unavailable'].includes(c.night.status),'NIGHT_NOT_FINAL');
    var preview=d.editorial_plan&&d.editorial_plan.mode==='preview';
    if(preview){
      assert(d.kind==='daily'&&['out_of_season','no_games'].includes(c.night.status),'PREVIEW_NOT_APPLICABLE');
      var plan=d.editorial_plan;assert(typeof plan.topic_key==='string'&&/^[a-z0-9-]{8,100}$/.test(plan.topic_key),'PREVIEW_TOPIC_KEY');
      assert(typeof plan.angle==='string'&&plan.angle.length>=30&&plan.angle.length<=500,'PREVIEW_ANGLE');
      assert(!(c.published||[]).some(function(j){return j.editorial_plan&&j.editorial_plan.topic_key===plan.topic_key;}),'PREVIEW_TOPIC_ALREADY_COVERED');
      assert(c.bbm&&c.bbm.status==='ready'&&Date.parse(now)-Date.parse(c.bbm.as_of)<=48*3600000,'PREVIEW_ANALYSIS_STALE');
    }
    assert(preview||c.night.status==='complete'||c.mandatory_trade_ids.length||c.player_events.length,'NO_NEW_VERIFIED_STORY');
    if(d.kind==='weekly')assert(c.memory.some(function(m){return (m.matchups||[]).some(function(x){return x.end_date&&x.end_date<d.date&&x.week===d.week;});}),'WEEK_NOT_COMPLETE');
    assert(typeof d.title==='string'&&d.title.length>=5&&d.title.length<=110,'TITLE');assert(typeof d.summary==='string'&&d.summary.length<=500,'SUMMARY');
    assert(Array.isArray(d.turns)&&d.turns.length>=10&&d.turns.length<=100,'TURN_COUNT');
    var words=0,chars=0,seen={},used={},guests=0,guestSpeakers={},fictionIntro=false;
    var managers=(c.manager_speakers||[]).map(function(m){return m.speaker;});
    d.turns.forEach(function(t){var host=['michael','tom'].includes(t.speaker);assert(host||managers.includes(t.speaker),'UNAPPROVED_SPEAKER');assert(typeof t.text==='string'&&t.text.length>=2&&t.text.length<=1600,'TURN_LENGTH');assert(!/\bFBA\b|<[^>]+>|https?:\/\//i.test(t.text),'SPEECH_TEXT');
      assert(Array.isArray(t.source_refs)&&t.source_refs.every(function(r){return c.source_refs.includes(r);}), 'UNKNOWN_SOURCE');
      if(host){assert(!t.kind||t.kind==='host','HOST_TURN_KIND');fictionIntro=/fiktive[nr]? (?:KI[- ]?)?Pressekonferenz/i.test(t.text);t.source_refs.forEach(function(r){used[r]=true;});}
      else{assert(t.kind==='fictional_press_conference'&&t.source_refs.length===0,'FICTION_NOT_FACT');assert(fictionIntro,'FICTION_INTRO_REQUIRED');assert(!guestSpeakers[t.speaker],'MANAGER_DUPLICATE');assert(t.text.trim().split(/\s+/).length<=45&&t.text.length<=450,'MANAGER_TOO_LONG');guestSpeakers[t.speaker]=true;guests++;}
      seen[t.speaker]=true;words+=t.text.trim().split(/\s+/).length;chars+=t.text.length;
    });
    assert(guests<=3,'TOO_MANY_MANAGERS');
    if(guests)assert(/fiktive[nr]? (?:KI[- ]?)?Pressekonferenz/i.test(d.summary)&&d.qa&&d.qa.fiction_clearly_labeled===true&&d.qa.fiction_excluded_from_facts===true,'FICTION_QA_REQUIRED');
    assert(seen.michael&&seen.tom,'BOTH_HOSTS_REQUIRED');
    if(preview){assert(Object.keys(used).some(function(r){return r.indexOf('espn:league:')===0;})&&Object.keys(used).some(function(r){return r.indexOf('bbm:profile:')===0;}),'PREVIEW_SOURCES_REQUIRED');}
    assert(words>=(d.kind==='weekly'?2300:650)&&words<=(d.kind==='weekly'?3100:1200),'DURATION_WORD_BUDGET');
    assert(chars<=(d.kind==='weekly'?27000:11000),'CHARACTER_BUDGET');
    assert(c.mandatory_trade_ids.every(function(id){return (d.covered_trade_ids||[]).includes(id)&&used['trade:'+id];}),'MANDATORY_TRADE_MISSING');
    assert((d.covered_trade_ids||[]).every(function(id){return c.trades.some(function(t){return t.id===id;})&&used['trade:'+id];}),'UNSOURCED_TRADE');
    assert(d.qa&&d.qa.facts_checked===true&&d.qa.entertainment_checked===true&&(d.qa.no_unlabeled_invented_quotes===true||!guests&&d.qa.no_invented_quotes===true),'QA_REQUIRED');
    assert(Array.isArray(d.opinions)&&d.opinions.length<=8&&d.opinions.every(function(o){return typeof o==='string'&&o.length<=300;}),'OPINIONS');
    var keys={},claims=d.host_claims||[],reviews=d.memory_reviews||[],reviewed={};
    assert(Array.isArray(claims)&&claims.length<=8,'HOST_CLAIM_COUNT');
    claims.forEach(function(x){var t=Number.isInteger(x.turn_index)&&d.turns[x.turn_index];assert(typeof x.key==='string'&&/^[a-z0-9-]{3,80}$/.test(x.key)&&!keys[x.key],'HOST_CLAIM_KEY');keys[x.key]=true;
      assert(t&&['michael','tom'].includes(x.host)&&t.speaker===x.host,'HOST_CLAIM_SPEAKER');
      assert(typeof x.claim==='string'&&x.claim.length>=10&&x.claim.length<=300&&typeof x.quote==='string'&&x.quote.length>=10&&x.quote.length<=350&&t.text.includes(x.quote),'HOST_CLAIM_TEXT');
      assert(typeof x.horizon==='string'&&x.horizon.length>=3&&x.horizon.length<=100&&typeof x.condition==='string'&&x.condition.length<=250,'HOST_CLAIM_CONDITIONS');
      assert(Array.isArray(x.team_ids)&&x.team_ids.length<=8&&x.team_ids.every(function(id){return (c.teams||[]).some(function(team){return String(team.id||team.team_id)===String(id);});}),'HOST_CLAIM_TEAM');
    });
    assert(Array.isArray(reviews)&&reviews.length<=(d.kind==='weekly'?4:2),'MEMORY_REVIEW_COUNT');
    reviews.forEach(function(r){var m=(c.host_memory||[]).find(function(x){return x.id===r.claim_id;}),t=Number.isInteger(r.turn_index)&&d.turns[r.turn_index];
      assert(m&&!reviewed[r.claim_id]&&t&&['michael','tom'].includes(t.speaker),'MEMORY_REVIEW_TARGET');reviewed[r.claim_id]=true;
      assert(['tracking','supported','challenged','confirmed','missed','revised'].includes(r.status)&&typeof r.assessment==='string'&&r.assessment.length>=10&&r.assessment.length<=300,'MEMORY_REVIEW_ASSESSMENT');
      assert(t.source_refs.includes('memory:claim:'+r.claim_id)&&t.source_refs.some(function(ref){return ref.indexOf('memory:')!==0;}),'MEMORY_REVIEW_EVIDENCE');
    });
    return {words:words,characters:chars,estimated_seconds:Math.round(words/145*60)};
  }
  function chunks(turns){var out=[],part=[],n=0;turns.forEach(function(t){if(n+t.text.length>1800){out.push(part);part=[];n=0;}part.push(t);n+=t.text.length;});if(part.length)out.push(part);return out;}
  function canPublish(j,c,now){
    var errors=[];if(j.status!=='audio_ready')errors.push('AUDIO_NOT_READY');
    if(berlin(now)!==j.date)errors.push('EPISODE_DATE_EXPIRED');
    var hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',hourCycle:'h23'}).format(new Date(now)));if(hour<8)errors.push('BEFORE_RELEASE');
    if(!c||c.night.date!==j.night_date||['pending_games_or_boxscores','unavailable'].includes(c.night.status))errors.push('NIGHT_CHANGED');
    if(!j.audio||!j.audio.file_id||!Number.isFinite(j.audio.seconds)||j.audio.seconds<(j.kind==='weekly'?17*60:5*60)||j.audio.seconds>(j.kind==='weekly'?23*60:10*60))errors.push('AUDIO_DURATION');
    if(c&&c.mandatory_trade_ids.some(function(id){return !(j.covered_trade_ids||[]).includes(id);}))errors.push('NEW_MANDATORY_TRADE');
    return errors;
  }
  // ElevenLabs mp3_44100_128: keep complete MPEG1 Layer III frames, discard ID3/Xing metadata.
  function mp3(bytes){var b=bytes.map(function(n){return n&255;}),i=0,out=[],frames=0,samples=0;
    if(b[0]===73&&b[1]===68&&b[2]===51){assert(b.length>=10,'MP3_TAG');i=10+((b[6]&127)*2097152+(b[7]&127)*16384+(b[8]&127)*128+(b[9]&127));}
    while(i+4<=b.length){if(b.length-i===128&&b[i]===84&&b[i+1]===65&&b[i+2]===71)break;
      var h1=b[i+1],h2=b[i+2];assert(b[i]===255&&(h1&224)===224&&((h1>>3)&3)===3&&((h1>>1)&3)===1,'MP3_FRAME');
      var kbps=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320][h2>>4],sr=[44100,48000,32000][(h2>>2)&3];assert(kbps&&sr===44100,'MP3_FORMAT');
      var size=Math.floor(144000*kbps/sr)+((h2>>1)&1);assert(i+size<=b.length,'MP3_TRUNCATED');
      var tag=i+4+((h1&1)?0:2)+(((b[i+3]>>6)===3)?17:32),name=String.fromCharCode.apply(null,b.slice(tag,tag+4));
      if(name!=='Xing'&&name!=='Info'){for(var k=i;k<i+size;k++)out.push(b[k]>127?b[k]-256:b[k]);frames++;samples+=1152;}
      i+=size;
    }
    assert(frames>0&&b.length-i<4||b.length-i===128&&frames>0,'MP3_EMPTY_OR_TRAILING');return {bytes:out,seconds:samples/44100,frames:frames};
  }
  return {berlin:berlin,slots:slots,context:context,hostMemory:hostMemory,validate:validate,chunks:chunks,canPublish:canPublish,mp3:mp3};
})();
if(typeof module!=='undefined')module.exports=FBA_PRODUCTION133;
