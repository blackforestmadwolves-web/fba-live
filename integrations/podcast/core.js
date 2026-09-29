/* FBA Podcast source bridge 132. Pure functions shared by GAS and Node tests.
 * Facts, provider projections and editorial judgements remain separate.
 */
var FBA_PODCAST_CORE132 = (function () {
  'use strict';
  var fields = ['PTS','REB','AST','3PM','STL','BLK','FGM','FGA','FTM','FTA'];
  var categories = ['PTS','REB','AST','3PM','STL','BLK','FG%','FT%'];
  var ids = {PTS:'0',REB:'6',AST:'3','3PM':'17',STL:'2',BLK:'1','FG%':'19','FT%':'20'};
  function fail(s) { throw Error(s); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function iso(v) { if (v === null || v === undefined || v === '') return null; var d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); }
  function finite(n) { return typeof n === 'number' && Number.isFinite(n); }
  function fresh(stamp, now, maxHours) { var age = Date.parse(now) - Date.parse(stamp); return Number.isFinite(age) && age >= -60000 && age <= maxHours * 3600000; }
  function zero() { return Object.fromEntries(fields.map(function (f) { return [f,0]; })); }
  function add(sum, row, gp) { fields.forEach(function(f) { if (!finite(row[f]) || row[f] < 0) fail('Ungültige Projektion: '+f); sum[f] += row[f] * gp; }); }
  function rates(sum) { return Object.assign({}, sum, {'FG%':sum.FGA ? sum.FGM / sum.FGA : null, 'FT%':sum.FTA ? sum.FTM / sum.FTA : null}); }

  function league(raw, names, now) {
    if (!raw || String(raw.id) !== '1152091056' || Number(raw.seasonId) !== 2027 || !Array.isArray(raw.teams) || raw.teams.length !== 8) fail('Falsche oder unvollständige ESPN-Liga.');
    var seen = {}, teams = raw.teams.map(function(t) {
      var id=String(t.id), entries=t.roster && t.roster.entries;
      if (!names[id] || !Array.isArray(entries) || !entries.length) fail('ESPN-Kader fehlt: '+id);
      var roster=entries.map(function(e) {
        var p=e.playerPoolEntry && e.playerPoolEntry.player || {}, pid=String(e.playerId || p.id || '');
        if (!/^\d+$/.test(pid) || seen[pid] || !p.fullName) fail('Fehlende oder doppelte ESPN-Spielerzuordnung.');
        seen[pid]=true;
        return {player_id:pid,name:p.fullName,team_id:id,lineup_slot:e.lineupSlotId,injury_status:p.injuryStatus || null,nba_team_id:p.proTeamId,acquisition_type:e.acquisitionType || null,acquired_at:iso(e.acquisitionDate)};
      });
      var record=t.record && t.record.overall || {};
      return {id:id,name:names[id],roster:roster,standing:{wins:record.wins,losses:record.losses,ties:record.ties},source_ref:'espn:league:'+now};
    });
    var scoring=raw.settings && raw.settings.scoringSettings || {};
    var got=(scoring.scoringItems || []).map(function(r){return String(r.statId);}).sort();
    if (scoring.scoringType !== 'H2H_CATEGORY' || JSON.stringify(got) !== JSON.stringify(Object.values(ids).sort())) fail('ESPN-Kategorien weichen von den acht FBA-Kategorien ab.');
    return {league_id:String(raw.id),season:2027,week:Number((raw.status || {}).currentMatchupPeriod || 1),scoring_period:Number(raw.scoringPeriodId || (raw.status || {}).latestScoringPeriod || 1),teams:teams,rules:{scoring_type:scoring.scoringType,categories:categories.slice(),stat_ids:ids},as_of:now};
  }

  function transactions(raw, prior, now) {
    if (!Array.isArray(raw)) fail('ESPN-Transaktionen fehlen; fehlend ist nicht leer.');
    var index={}; (prior || []).forEach(function(t){index[t.id]=clone(t);});
    raw.forEach(function(t) {
      if (!t.id || !t.type || !t.status) fail('Transaktion ohne ID/Typ/Status.');
      var type=String(t.type).toUpperCase(), status=String(t.status).toUpperCase(), old=index[String(t.id)] || {};
      var completed = /^(TRADE_ACCEPT|TRADE_ACCEPTED|TRADE|TRADE_LM|LM_TRADE)$/.test(type) && status==='EXECUTED' && t.isPending!==true;
      var movements=(t.items || []).filter(function(x){return x.playerId && Number(x.fromTeamId)!==Number(x.toTeamId);}).map(function(x){
        return {player_id:String(x.playerId),from_team_id:Number(x.fromTeamId)>0 ? String(x.fromTeamId) : null,to_team_id:Number(x.toTeamId)>0 ? String(x.toTeamId) : null,type:String(x.type || '')};
      });
      if(!movements.length&&old.details_status==='complete')movements=clone(old.movements);
      var validLegs=movements.length>=2 && movements.every(function(m){return m.from_team_id && m.to_team_id;});
      index[String(t.id)]={id:String(t.id),type:type,status:status,is_completed_trade:completed,scoring_period:Number(t.scoringPeriodId || 0),related_transaction_id:t.relatedTransactionId || null,
        team_id:t.teamId ? String(t.teamId) : null,provider_event_at:iso(t.proposedDate),completed_at:iso(t.processDate || t.executionDate),observed_at:now,first_seen_at:old.first_seen_at || now,
        movements:movements,details_status:completed ? (validLegs ? 'complete' : 'missing_trade_legs') : 'not_a_completed_trade',
        covered_episode_ids:old.covered_episode_ids || [],source_refs:['espn:transaction:'+String(t.id)]};
    });
    return Object.values(index).sort(function(a,b){return String(a.provider_event_at).localeCompare(String(b.provider_event_at)) || a.id.localeCompare(b.id);});
  }

  function matchups(raw, state, schedule, now) {
    var rows=(raw.schedule || []).filter(function(m){return Number(m.matchupPeriodId)===state.week && m.away && m.home;});
    var used={};
    var result=rows.map(function(m){
      var a=String(m.away.teamId),h=String(m.home.teamId),an=state.teams.find(function(t){return t.id===a;}),hn=state.teams.find(function(t){return t.id===h;});
      if (!an || !hn || a===h || used[a] || used[h]) fail('ESPN-Paarungen nicht eindeutig.'); used[a]=used[h]=true;
      var window=(schedule || []).find(function(s){return Number(s.week)===state.week && s.away===an.name && s.home===hn.name;});
      var hasPlayed=Number(m.away.gamesPlayed || 0)+Number(m.home.gamesPlayed || 0)>0;
      function scores(side) {
        var source=side.cumulativeScore && side.cumulativeScore.scoreByStat || {};
        return Object.fromEntries(categories.map(function(k){var v=source[ids[k]];return [k,v && finite(v.score) ? v.score : null];}));
      }
      var av=scores(m.away),hv=scores(m.home),points={away:0,home:0};
      var complete=categories.every(function(k){return finite(av[k]) && finite(hv[k]);});
      if (hasPlayed && complete) categories.forEach(function(k){if(av[k]>hv[k])points.away++;else if(hv[k]>av[k])points.home++;});
      return {matchup_id:String(m.id),week:state.week,away_team_id:a,home_team_id:h,away:an.name,home:hn.name,
        status:hasPlayed ? (complete ? 'live' : 'score_incomplete') : 'not_started',current_points:!hasPlayed || complete ? points : null,
        category_totals:hasPlayed ? {away:av,home:hv} : null,start_date:window && window.start || null,end_date:window && window.end || null,
        source_refs:['espn:league:'+now],forecast_comparison:null,forecast_limit:'Keine bestätigte Startprognose im Podcast-Speicher. Spielstand ist keine Prognose.'};
    });
    if(result.length!==4 || Object.keys(used).length!==8) fail('Vier aktuelle FBA-Matchups fehlen.');
    return result;
  }

  function bbm(horizons, teams, now) {
    var candidates=(horizons && horizons.snapshots || []).filter(function(s){return s.sourceId==='bbm' && s.horizon==='ros';}).sort(function(a,b){return Date.parse(b.asOf)-Date.parse(a.asOf);});
    var snapshot=candidates[0];
    var status={source:'Basketball Monster',analysis_method:'own_calculation_from_bbm_projections',direct_trade_monster:false,as_of:snapshot && snapshot.asOf || null,
      horizon:'ros',status:'unavailable',source_url:'https://basketballmonster.com/projections.aspx',teams:[],snapshot:null};
    if(!snapshot){var providerStatus=(horizons&&Array.isArray(horizons.status)?horizons.status:[]).find(function(s){return s.sourceId==='bbm'&&s.horizon==='ros';});
      if(providerStatus){status.as_of=providerStatus.asOf||null;status.status=providerStatus.status==='STALE_OR_INVALID'?'stale_or_invalid':'unavailable';}return status;}
    if(snapshot.seasonId!==2027||snapshot.schema!==126||snapshot.basis!=='remaining_per_game'||!['provider_projection','provider_season_projection'].includes(snapshot.kind))fail('BBM-Saison oder Projektionsart ungültig.');
    if(!fresh(snapshot.asOf,now,72)){status.status='stale';return status;}
    if(snapshot.kind==='provider_season_projection' && now>='2026-10-20T00:00:00.000Z'){status.status='season_baseline_expired';return status;}
    var byId={}; (snapshot.rows || []).forEach(function(r){if(byId[r.playerId])fail('Doppelte BBM-Spieler-ID.');byId[r.playerId]=r;});
    var profiles=teams.map(function(t){
      var total=zero(),missing=[];
      t.roster.forEach(function(p){var r=byId[p.player_id];if(!r || !finite(r.remainingGp) || r.remainingGp<0 || r.remainingGp>82 || !r.perGame){missing.push(p.player_id);return;}
        if(r.perGame.FGM>r.perGame.FGA||r.perGame.FTM>r.perGame.FTA||r.perGame['3PM']>r.perGame.FGM)fail('BBM-Treffer überschreiten Versuche.');add(total,r.perGame,r.remainingGp);});
      return {team_id:t.id,team:t.name,complete:!missing.length,missing_player_ids:missing,projected_remaining_totals:missing.length?null:rates(total)};
    });
    var allComplete=profiles.every(function(p){return p.complete;});
    if(allComplete)profiles.forEach(function(p){
      p.category_ranks={};categories.forEach(function(k){var v=p.projected_remaining_totals[k];p.category_ranks[k]=v===null?null:1+profiles.filter(function(other){return other.projected_remaining_totals[k]>v;}).length;});
      p.strengths=categories.filter(function(k){return p.category_ranks[k]!==null && p.category_ranks[k]<=3;});
      p.weaknesses=categories.filter(function(k){return p.category_ranks[k]!==null && p.category_ranks[k]>=6;});
    });
    status.status=allComplete?'ready':'partial';status.teams=profiles;status.snapshot=clone(snapshot);
    status.scope='ROS-Kaderprofil ohne Aufstellungsoptimierung; keine Matchup-Siegwahrscheinlichkeit';return status;
  }

  function reverseTrade(afterTeams, tx) {
    if(!tx.is_completed_trade || tx.details_status!=='complete')fail('Trade-Spieler fehlen.');
    var before=clone(afterTeams),map=Object.fromEntries(before.map(function(t){return [t.id,t];})),seen={};
    tx.movements.forEach(function(m){
      if(seen[m.player_id] || !map[m.to_team_id] || !map[m.from_team_id])fail('Trade-Bewegungen unvollständig.');seen[m.player_id]=true;
      var to=map[m.to_team_id],from=map[m.from_team_id],idx=to.roster.findIndex(function(p){return p.player_id===m.player_id;});
      if(idx<0 || from.roster.some(function(p){return p.player_id===m.player_id;}))fail('Kader passt nicht zum abgeschlossenen Trade.');
      var p=to.roster.splice(idx,1)[0];p.team_id=from.id;from.roster.push(p);
    });return before;
  }

  function build(input, prior) {
    prior=prior || {};var now=input.now,state=league(input.league,input.teamNames,now),journal=transactions(input.transactions,prior.transactions,now);
    var bbmData=bbm(input.horizons,state.teams,now),pending=journal.filter(function(t){return t.is_completed_trade && !t.covered_episode_ids.length;});
    // Raw season/roster facts and per-provider projections stay separate.
    var output={schema:132,ok:true,scope:'private_podcast_sources',created_at:now,season:2027,league_id:state.league_id,week:state.week,
      rules:state.rules,teams:state.teams,matchups:matchups(input.league,state,input.schedule,now),transactions:journal,
      mandatory_trade_ids:pending.map(function(t){return t.id;}),unresolved_trade_ids:pending.filter(function(t){return t.details_status!=='complete';}).map(function(t){return t.id;}),
      sources:{espn:{status:'ready',as_of:now,source_url:'https://fantasy.espn.com/basketball/league?leagueId=1152091056',transaction_coverage:input.transactionCoverage},bbm:bbmData},
      nba_night:input.night || {status:'unavailable'},player_events:input.playerEvents || [],
      editorial:{hosts:['Michael Ellbogen','Tom Winter'],pronunciation:'Eff Bie Ey',debate_multiplier:0.85,daily_minutes:[5,10],weekly_minutes:20,manager_guests:[0,3],speak_provider_values:false},
      publication:{status:'not_generated',covered_transaction_ids:[]},limitations:[]};
    if(bbmData.status!=='ready')output.limitations.push('Aktuelle vollständige BBM-Analyse fehlt.');
    if(output.unresolved_trade_ids.length)output.limitations.push('Vollzogene Trades ohne Spielerbewegungen müssen gemeldet werden; deren Bewertung bleibt offen.');
    if(!input.transactionCoverage || !input.transactionCoverage.complete)output.limitations.push('Transaktionshistorie noch nicht vollständig bestätigt.');
    if(output.nba_night.status!=='complete' && output.nba_night.status!=='no_games' && output.nba_night.status!=='out_of_season')output.limitations.push('NBA-Nacht nicht vollständig bestätigt.');
    output.limitations.push('Eine gespeicherte Startprognose für den späteren Soll-Ist-Vergleich fehlt noch.');
    output.readiness={facts_ready:true,analysis_ready:bbmData.status==='ready',trade_details_ready:!output.unresolved_trade_ids.length,
      can_generate_daily:output.nba_night.status==='complete' && !!input.transactionCoverage && input.transactionCoverage.complete && !output.unresolved_trade_ids.length && bbmData.status==='ready',audio_ready:false};
    return output;
  }
  return {league:league,transactions:transactions,matchups:matchups,bbm:bbm,reverseTrade:reverseTrade,build:build,fresh:fresh,iso:iso};
})();
if(typeof module==='object' && module.exports)module.exports=FBA_PODCAST_CORE132;
