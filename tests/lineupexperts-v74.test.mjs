import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseTable,mapPlayers} from '../scripts/prepare-lineupexperts-import.mjs';
import {fixture} from './expert-projections-v71.test.mjs';
const stamp='2026-09-06T12:00:00Z';
const page='2026-2027 Fantasy Basketball Projections\nPreseason\n1 Players\nPlayer | FPTS | AVG | ADP | GP | OFF | B2B | FG | FG3 | FT | PTS | RB | AST | STL | BLK | TO\nL182: cite1†T.J. McConnellT. McConnell (IND - PG) | 958.3 | 18.8 | 118.75 | 51 | 30 | 15 | 3.5 | .2 | .4 | 7.6 | 2.0 | 4.5 | .9 | .2 | 1.0';
test('LineupExperts parser identifies per-game categories without guessing shot attempts or provider IDs',()=>{
  const [row]=parseTable(page,stamp);
  assert.equal(row.provider_name,'T.J. McConnell');assert.equal(row.provider_player_id,'name:tjmcconnell');
  assert.equal(row.PTS,7.6);assert.equal(row['3PM'],.2);assert.equal(row.projected_gp,51);assert.equal(row.FGA,null);assert.equal(row.FGM,null);
  assert.throws(()=>parseTable(page.replace('1 Players','2 Players'),stamp),/Incomplete/);
  assert.throws(()=>parseTable(page.replace('2026-2027','2025-2026'),stamp),/Expected/);
  assert.throws(()=>parseTable(page.replace('STL | BLK','BLK | STL'),stamp),/column/);
});
test('persistent ESPN bindings reject identity conflicts, ambiguity and duplicate voting',()=>{
  const rows=parseTable(page,stamp),meta=[{season_id:2027,player_id:'2530530',full_name:'T.J. McConnell'}];
  const first=mapPlayers(rows,meta,[],stamp),second=mapPlayers(rows,meta,first.mappings,stamp);
  assert.deepEqual(first,second);assert.equal(first.audit.matched,1);
  const conflict=mapPlayers(rows,meta,[{...first.mappings[0],player_id:'bad'}],stamp);assert.equal(conflict.rows.length,0);
  assert.equal(mapPlayers(rows,[...meta,{...meta[0],player_id:'another'}],[],stamp).rows.length,0);
  assert.throws(()=>mapPlayers([...rows,{...rows[0],provider_player_id:'other'}],meta,[],stamp),/Multiple/);
});
test('policy migration combines six categories and GP, while shooting volume remains CBS only',()=>{
  const f=fixture(),{c,sheets,props}=f;
  const cbs=f.input(),le=f.input('lineupexperts',{PTS:30,REB:10,projected_gp:80,FGM:null,FGA:null,FTM:null,FTA:null,provider_player_id:'name:testplayer',provider_name:'Test Player',observed_at:stamp});
  sheets.set(c.FBA_CONSENSUS_V44.inputs,[cbs,le]);
  props.set(c.FBA_CONSENSUS_V44.statusKey,JSON.stringify({policyVersion:71,lastAttempt:stamp}));
  const out=c.applyProjectionConsensusV44_(f.engine()),p=out.players[0];
  assert.equal(p.base.PTS,25);assert.equal(p.base.REB,9);assert.equal(p.projectedGp,75);
  assert.equal(p.base.FGA,cbs.FGA);assert.equal(p.base.FGM,cbs.FGM);assert.equal(p.consensus.sourceCount,2);
  assert.equal(p.consensus.fields.PTS.length,2);assert.equal(p.consensus.fields.FGA.length,1);
  const status=out.consensus.sources.find(s=>s.id==='lineupexperts');assert.equal(status.refreshMode,'manual_import');assert.equal(status.lastImported,stamp);assert.equal(status.coverage.PTS,1);assert.equal(status.coverage.FGA,0);
  assert.equal(f.fetches(),0);const writes=f.writes();c.applyProjectionConsensusV44_(f.engine());assert.equal(f.writes(),writes);
});
test('one source per player still works; incomplete LineupExperts-only rows never borrow historical shooting stats',()=>{
  const f=fixture(),{c,sheets}=f;
  sheets.set(c.FBA_CONSENSUS_V44.inputs,[f.input('lineupexperts',{FGM:null,FGA:null,FTM:null,FTA:null})]);
  const out=c.applyProjectionConsensusV44_(f.engine());assert.equal(out.active,false);assert.equal(out.players[0].base,null);
  const g=fixture(),p=g.c.applyProjectionConsensusV44_(g.engine()).players[0];assert.equal(p.base.PTS,20);assert.equal(p.consensus.sourceCount,1);
});
test('a later same-day LineupExperts import updates the existing player without a second vote',()=>{
  const f=fixture(),{c,sheets}=f,le=f.input('lineupexperts',{PTS:30,observed_at:'2026-09-06T09:00:00Z',FGM:null,FGA:null,FTM:null,FTA:null});
  sheets.set(c.FBA_CONSENSUS_V44.inputs,[f.input(),le]);c.applyProjectionConsensusV44_(f.engine());
  sheets.set(c.FBA_CONSENSUS_V44.inputs,[f.input(),{...le,PTS:34,observed_at:'2026-09-06T11:00:00Z'}]);
  f.props.delete(c.FBA_CONSENSUS_V44.statusKey);const p=c.applyProjectionConsensusV44_(f.engine()).players[0];
  assert.equal(p.base.PTS,27);assert.equal(p.consensus.sourceCount,2);assert.equal(p.consensus.fields.PTS.length,2);
});
