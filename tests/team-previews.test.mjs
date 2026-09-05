import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const html = read('index.html');
const dataSource = read('team-previews-2026-27.js');
const renderer = read('team-previews.js');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);
function context() {
  const c = vm.createContext({
    E: escape, logoOf: team => `logos/${team}.png`, T: () => ({a:'FBA'}),
    sect: (title, sub) => `<h2>${title}</h2><small>${sub}</small>`,
    fetch: () => {throw new Error('Team stories must not add startup network requests');}
  });
  c.window = c;
  vm.runInContext(dataSource, c);
  vm.runInContext(renderer, c);
  return c;
}

test('the current preview has all eight franchises in their 2026/27 conferences, with their own history', () => {
  const c = context();
  const teams = c.FBA_TEAM_PREVIEWS.teams;
  assert.equal(teams.length, 8);
  assert.deepEqual(Array.from(teams.filter(t=>t.conference==='East'), t=>t.team).sort(), [
    'BlackForest Mad Wolves','East Bay Pirates','Guardians of Rhinos','Toronto Polar Bears'
  ]);
  assert.deepEqual(Array.from(teams.filter(t=>t.conference==='West'), t=>t.team).sort(), [
    'Balingen Lions','Bishkek Easy Snipers','Dormettingen Eagles','Karlsruhe Unicorns'
  ]);
  assert.equal(new Set(teams.map(t=>t.team)).size, 8);
  for (const team of teams) {
    assert.ok(team.sections.length >= 4);
    assert.ok(team.sections.map(s=>s.text).join(' ').split(/\s+/).length >= 280, `${team.team}: vollständiger Bericht`);
    assert.ok(team.facts.some(f=>f.label==='Draftposition'));
  }
  const snipers = teams.find(t=>t.team==='Bishkek Easy Snipers');
  assert.match(snipers.sections.map(s=>s.text).join(' '), /2022\/23[\s\S]*2023\/24/);
  assert.ok(!teams.some(t=>t.team==='Wild Cheetahs'));
  assert.equal(c.teamPreviewsHome('2027/28'), '', 'Reviewed 2026/27 preview must not appear as a future season preview');
  assert.match(c.teamPreviewsHome('2026/27'), /Stand 05\.09\.2026/);
});

test('opening, closing and background rerenders preserve each article without stale detached events', () => {
  const c = context(), name = c.FBA_TEAM_PREVIEWS.teams[0].team;
  const node = {isConnected:true, dataset:{teamPreview:name}, open:true};
  c.rememberTeamPreview(node);
  assert.match(c.teamPreviewsHome('2026/27'), new RegExp(`data-team-preview="${name}" open`));
  c.rememberTeamPreview({...node,isConnected:false,open:false});
  assert.match(c.teamPreviewsHome('2026/27'), new RegExp(`data-team-preview="${name}" open`));
  c.rememberTeamPreview({...node,open:false});
  assert.doesNotMatch(c.teamPreviewsHome('2026/27'), new RegExp(`data-team-preview="${name}" open`));
  c.rememberTeamPreview({...node,dataset:{teamPreview:'Unknown franchise'}});
  assert.equal(vm.runInContext('TEAM_PREVIEW_OPEN.size',c),0);
});

test('editorial text and team links remain escaped; paragraphs and native details stay intact', () => {
  const c = context();
  const dangerous = '<img src=x onerror="alert(1)">';
  const output = c.teamPreviewCard({team:dangerous,conference:'West',title:dangerous,teaser:dangerous,
    facts:[{label:dangerous,value:dangerous}],sections:[{heading:dangerous,text:'First paragraph\n\nSecond paragraph '+dangerous}]}, '05.09.2026');
  assert.doesNotMatch(output, /<img src=x/);
  assert.match(output, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(output, /<p>First paragraph<\/p><p>Second paragraph/);
  assert.match(output, /<details class="team-story"/);
  assert.match(output, /<\/summary>[\s\S]*onclick="openTeam\(this.dataset.team\)"/);
  assert.equal((c.teamPreviewsHome('2026/27').match(/<details class="team-story"/g)||[]).length,8);
});

test('preseason Start renders the articles and draft link while preserving conferences, draft order and odds', () => {
  const c = context(), teams = c.FBA_TEAM_PREVIEWS.teams;
  Object.assign(c, {
    D:{appConfig:{currentSeason:'2026/27',draftDate:'2026-09-27T19:00:00+02:00'},draft:{teams:teams.map(t=>({team:t.team,draftPosition:Number(t.facts.find(f=>f.label==='Draftposition').value)})),
      conferences:{East:teams.filter(t=>t.conference==='East'),West:teams.filter(t=>t.conference==='West')}}},
    countdownMarkup:()=>'<div data-test="countdown"></div>', displayDate:()=> '27.09.2026 · 19 Uhr',
    draftTeamRow:t=>`<div data-test="conference-team">${escape(t.team)}</div>`,
    teamNavAttrs:()=>'',chip:()=>'',draftPrediction:t=>escape(t.team),humanModelText:v=>v,
    draftRadarHome:()=>{throw new Error('Start must no longer render the player overview');}
  });
  const start = html.indexOf('function pgDraftOverview(){'), end = html.indexOf('function pgOverview(){', start);
  vm.runInContext(html.slice(start,end),c);
  const output = c.pgDraftOverview();
  assert.equal((output.match(/<details class="team-story"/g)||[]).length,8);
  assert.match(output, /navigatePage\('predraft'\)/);
  assert.equal((output.match(/data-test="conference-team"/g)||[]).length,8);
  assert.match(output, /Draft-Reihenfolge/);
  assert.equal((output.match(/class="draft-pick predicted team-nav"/g)||[]).length,8);
  assert.match(output, /45%[\s\S]*Ewige RS[\s\S]*45%[\s\S]*Conference-H2H[\s\S]*10%[\s\S]*Draftposition/);
  assert.doesNotMatch(output, /class="draft-radar-card"/);
});

test('the public preparation route loads its dependencies and leaves private navigation protected', () => {
  const c = context();
  vm.runInContext(read('draft-prep.js'),c);
  for (const name of ['pgOverview','pgDraft','pgMonster','pgFreeAgency','pgPR','pgPerf','pgTeams','pgRecords','pgEternal','pgArchive']) c[name]=()=>name;
  vm.runInContext(html.slice(html.indexOf('const PAGES = ['),html.indexOf('const STATE =')),c);
  assert.equal(vm.runInContext('PAGES.find(p=>p[0]==="predraft")[2]',c),c.pgDraftPreparation);
  assert.equal(vm.runInContext('PAGES.find(p=>p[0]==="draft")[2]',c),c.pgDraft);
  const start = html.indexOf('function navigatePage(key){'), end = html.indexOf('async function unlockMonster(',start);
  vm.runInContext(html.slice(start,end),c);
  let renders=0,gates=0;
  Object.assign(c,{render:()=>renders++,openMonsterGate:()=>gates++,monsterUnlocked:()=>false});
  c.navigatePage('predraft');
  assert.equal(vm.runInContext('CUR',c),'predraft');
  assert.equal(renders,1);
  c.navigatePage('monster');c.navigatePage('freeagency');
  assert.equal(gates,2);assert.equal(renders,1);
  const inlineStart=html.indexOf('<script>');
  for (const file of ['draft-prep.js','team-previews-2026-27.js','team-previews.js']) {
    const position=html.indexOf(`src="${file}"`);
    assert.ok(position>0 && position<inlineStart,`${file}: loaded before navigation initializes`);
  }
});
