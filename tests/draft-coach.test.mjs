import test from 'node:test';
import assert from 'node:assert/strict';
import coach from '../draft-coach.js';
const teams=['A','B','C','D','E','F','G','H'];
const player=(id,overrides={})=>Object.freeze({id:String(id),name:'Player '+id,adp:20,projectionReady:true,PTS:20,REB:5,AST:5,'3PM':2,STL:1,BLK:1,FGM:5,FGA:10,FTM:4,FTA:5,...overrides});
function fixture(){
 const pool=teams.map((_,i)=>player(i,{PTS:10+i,AST:2+i,REB:12-i}));
 pool.push(player('assist',{AST:12,PTS:15}),player('rebound',{REB:15,AST:3}),player('bad-shooting',{AST:12,FGM:1,FGA:20,FTM:1,FTA:15}));
 return {teams,pool,picks:teams.map((team,i)=>({team,playerId:String(i),overall:i+1})),team:'A',goal:'balanced',punts:[],maxRoster:13,nextPick:9};
}
test('coach derives real ranks, excludes used players and leaves source objects unchanged',()=>{
 const input=fixture(),before=JSON.stringify(input),data=coach.analyze(input);
 assert.equal(data.tiles.find(t=>t.cat==='AST').rank,8);
 assert.equal(data.tiles.find(t=>t.cat==='REB').rank,1);
 assert.equal(data.priorities[0].cat,'PTS');
 assert.ok(data.recommendations.some(r=>r.player.id==='assist'));
 assert.equal(data.candidates.length,3);
 assert.equal(JSON.stringify(input),before);
 const preview=data.candidates.find(c=>c.player.id==='assist');
 assert.equal(preview.ranks.find(r=>r.cat==='AST').before,8);
 assert.equal(preview.ranks.find(r=>r.cat==='AST').after,1);
});
test('equal profiles remain equal for advice even with unequal pick counts',()=>{
 const pool=[player('one'),player('two'),player('three'),player('candidate')];
 const data=coach.analyze({teams:['A','B'],team:'A',pool,picks:[{team:'A',playerId:'one'},{team:'B',playerId:'two'},{team:'B',playerId:'three'}],goal:'balanced'});
 assert.equal(data.uneven,true);assert.equal(data.tiles[0].rank,2);
 assert.ok(data.priorities.every(n=>n.deficit===0));
 assert.equal(data.candidates[0].score,0);
});
test('multiple punts remove categories from advice; strengths and hunt target the chosen goal',()=>{
 const input=fixture(),punt=coach.analyze({...input,goal:'punt',punts:['PTS','AST']});
 assert.deepEqual(punt.punts,['PTS','AST']);
 assert.ok(punt.priorities.every(p=>!['PTS','AST'].includes(p.cat)));
 assert.ok(punt.candidates.every(c=>c.improvements.every(p=>!['PTS','AST'].includes(p.cat))));
 const strength=coach.analyze({...input,goal:'strengths'});
 assert.ok(strength.strongest.includes('REB'));
 const hunt=coach.analyze({...input,goal:'strengths',hunt:'REB'});
 assert.deepEqual(hunt.active,['REB']);assert.equal(hunt.recommendations[0].player.id,'rebound');
 assert.equal(coach.normalizePunts(coach.categories).length,7);
});
test('shooting ratios combine makes and attempts and warn about high-volume dilution',()=>{
 const input=fixture(),data=coach.analyze(input),bad=data.candidates.find(c=>c.player.id==='bad-shooting');
 assert.equal(data.own.values['FG%'],.5);
 assert.ok(bad.harms.some(p=>p.cat==='FG%'));
 assert.equal(bad.ranks.find(r=>r.cat==='FG%').direction,'down');
 const combined=coach.analyze({...input,picks:[...input.picks,{team:'A',playerId:'bad-shooting'}]});
 assert.equal(combined.own.values['FG%'],6/30);
 assert.equal(combined.own.values['FT%'],5/20);
});
test('empty, tied, full and missing-stat rosters do not invent rankings or recommendations',()=>{
 const input=fixture(),empty=coach.analyze({...input,picks:[]});
 assert.equal(empty.enough,false);assert.ok(empty.tiles.every(t=>t.rank===null));
 const missing=player('missing',{projectionReady:false});
 const partial=coach.analyze({...input,pool:[...input.pool,missing],picks:[...input.picks,{team:'B',playerId:'missing'}]});
 assert.equal(partial.ready,false);assert.equal(partial.missing,1);assert.equal(partial.recommendations.length,0);
 assert.ok(partial.tiles.every(t=>t.rank===null));
 const full=coach.analyze({...input,maxRoster:1});assert.equal(full.full,true);assert.equal(full.candidates.length,0);
 assert.equal(coach.stats(player('invalid',{FGM:11,FGA:10})),null);
 assert.equal(coach.stats(player('invalid',{REB:null})),null);
 assert.equal(coach.stats(player('invalid',{AST:Infinity})),null);
 const zero=coach.analyze({teams:['A','B'],team:'A',pool:[player('z',{FGA:0,FGM:0}),player('b')],picks:[{team:'A',playerId:'z'},{team:'B',playerId:'b'}]});
 assert.equal(zero.tiles.find(t=>t.cat==='FG%').rank,null);
 assert.equal(zero.tiles.find(t=>t.cat==='PTS').rank,1,'tied teams share first rank');
});
test('explicit projected games take priority and market scope does not hide previewable players',()=>{
 const input=fixture();input.pool=[player(0,{projectedGp:60}),...input.pool.slice(1),player('late',{adp:120,AST:30})];
 const data=coach.analyze(input);
 assert.equal(data.own.values.PTS,20*60);
 assert.ok(data.candidates.some(c=>c.player.id==='late'));
 assert.ok(!data.recommendations.some(c=>c.player.id==='late'));
});
