// Offline release step: public ESPN identities/positions only, never ownership or stats.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const [input, sourceFile, output] = process.argv.slice(2);
assert.ok(input && sourceFile && output, 'Usage: node scripts/build-draft-player-catalog.mjs RAW.json SOURCE.json OUTPUT.js');
const bytes = fs.readFileSync(input), raw = JSON.parse(bytes), source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
assert.equal(raw.seasonId, 2027, 'Only current ESPN fantasy season 2027');
assert.equal(source.seasonId, 2027);
assert.equal(source.count, raw.players.length);
assert.ok(raw.players.length >= 600, 'Do not publish a truncated player catalog');
assert.equal(new URL(source.url).hostname, 'lm-api-reads.fantasy.espn.com');
assert.equal(new URL(source.url).protocol, 'https:');
assert.equal(source.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
assert.ok(Number.isFinite(Date.parse(source.fetchedAt)));
const context = vm.createContext({console});
vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.js', import.meta.url), 'utf8'), context);
const ids = new Set();
const players = raw.players.map(entry => {
  const player = context.normalizeFantasyPlayerV2_(entry);
  const original = entry.playerPoolEntry?.player || entry.player || entry;
  assert.match(player.id, /^\d+$/);
  assert.ok(player.name.trim());
  assert.ok(!ids.has(player.id), `Duplicate ESPN identity ${player.id}`);
  ids.add(player.id);
  assert.ok(player.fantasyPositions.split(',').every(p => ['PG','SG','SF','PF','C'].includes(p)));
  return {id:player.id, name:player.name, nba:context.nbaAbbreviationV3_(player.proTeamId),
    primaryPosition:player.primaryPosition, fantasyPositions:player.fantasyPositions,
    ...(typeof original.active === 'boolean' ? {active:original.active} : {})};
}).sort((a,b) => a.id.localeCompare(b.id, 'en', {numeric:true}));
const catalog = {version:1, seasonId:2027, reviewedAt:source.fetchedAt.slice(0,10),
  source:{provider:'ESPN Fantasy', url:source.url, fetchedAt:source.fetchedAt, rawSha256:source.sha256, count:players.length}, players};
fs.writeFileSync(output, `/* Reviewed public ESPN player metadata for 2026/27. ADP comes from the existing daily FBA feed. */
(function (root) {
  'use strict';
  const catalog = ${JSON.stringify(catalog)};
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  const data = freeze(catalog);
  if (typeof module === 'object' && module.exports) module.exports = data;
  if (root) root.FBA_DRAFT_PLAYER_CATALOG = data;
})(typeof window === 'object' ? window : null);
`);
console.log(JSON.stringify({output,seasonId:catalog.seasonId,players:players.length,reviewedAt:catalog.reviewedAt}));
