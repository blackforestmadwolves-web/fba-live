/**
 * FBA CONTROL CENTER – Backend v3
 * Rechnet alle Kennzahlen selbst aus den Rohdaten (StatsRaw + Results).
 * Unabhaengig von den Excel-Formeln, die Google Sheets nicht kennt.
 */

var SPREADSHEET_ID = '';
var CACHE_MINUTES = 10;
var DATA_CACHE_PREFIX = 'fba_v3_';
var SEASON = 'S25_26';
var SEASON_LABEL = '2025-26';
var RS_MAX_WEEK = 18;
var CATS = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FG%', 'FT%'];
var SEASON_KEYS = ['S19_20', 'S20_21', 'S21_22', 'S22_23', 'S23_24', 'S24_25', 'S25_26', 'S26_27'];

var CONF = {
  'BlackForest Mad Wolves': 'East', 'Balingen Lions': 'East',
  'East Bay Pirates': 'East', 'Karlsruhe Unicorns': 'East',
  'Toronto Polar Bears': 'West', 'Dormettingen Eagles': 'West',
  'Guardians of Rhinos': 'West', 'Wild Cheetahs': 'West'
};

var BASE_RS = {
  'East Bay Pirates': [421, 387, 101], 'Balingen Lions': [409, 399, 101],
  'Guardians of Rhinos': [394, 414, 101], 'Toronto Polar Bears': [268, 308, 72],
  'BlackForest Mad Wolves': [467, 341, 101], 'Karlsruhe Unicorns': [389, 419, 101],
  'Wild Cheetahs': [395, 413, 101], 'Dormettingen Eagles': [66, 142, 26]
};
var BASE_PS = {
  'East Bay Pirates': [45, 35, 10], 'Balingen Lions': [39, 41, 10],
  'Guardians of Rhinos': [34, 46, 10], 'Toronto Polar Bears': [34, 30, 8],
  'BlackForest Mad Wolves': [48, 32, 10], 'Karlsruhe Unicorns': [47, 33, 10],
  'Wild Cheetahs': [41, 39, 10], 'Dormettingen Eagles': [6, 10, 2]
};
var BASE_DUEL = {
  'East Bay Pirates': {'Balingen Lions': [5,6,5], 'Guardians of Rhinos': [4,5,5], 'Toronto Polar Bears': [6,4,1], 'BlackForest Mad Wolves': [6,6,0], 'Karlsruhe Unicorns': [7,5,3], 'Wild Cheetahs': [7,7,1], 'Dormettingen Eagles': [3,0,0]},
  'Balingen Lions': {'East Bay Pirates': [6,5,5], 'Guardians of Rhinos': [8,3,4], 'Toronto Polar Bears': [2,7,1], 'BlackForest Mad Wolves': [3,8,3], 'Karlsruhe Unicorns': [8,5,0], 'Wild Cheetahs': [8,6,2], 'Dormettingen Eagles': [4,1,0]},
  'Guardians of Rhinos': {'East Bay Pirates': [5,4,5], 'Balingen Lions': [3,8,4], 'Toronto Polar Bears': [6,5,1], 'BlackForest Mad Wolves': [6,8,1], 'Karlsruhe Unicorns': [6,9,0], 'Wild Cheetahs': [5,8,2], 'Dormettingen Eagles': [2,1,0]},
  'Toronto Polar Bears': {'East Bay Pirates': [4,6,1], 'Balingen Lions': [7,2,1], 'Guardians of Rhinos': [5,6,1], 'BlackForest Mad Wolves': [3,6,2], 'Karlsruhe Unicorns': [5,4,2], 'Wild Cheetahs': [2,5,2], 'Dormettingen Eagles': [1,1,0]},
  'BlackForest Mad Wolves': {'East Bay Pirates': [6,6,0], 'Balingen Lions': [8,3,3], 'Guardians of Rhinos': [8,6,1], 'Toronto Polar Bears': [6,3,2], 'Karlsruhe Unicorns': [8,4,3], 'Wild Cheetahs': [9,3,4], 'Dormettingen Eagles': [5,0,0]},
  'Karlsruhe Unicorns': {'East Bay Pirates': [5,7,3], 'Balingen Lions': [5,8,0], 'Guardians of Rhinos': [9,6,0], 'Toronto Polar Bears': [4,5,2], 'BlackForest Mad Wolves': [4,8,3], 'Wild Cheetahs': [5,8,1], 'Dormettingen Eagles': [4,0,1]},
  'Wild Cheetahs': {'East Bay Pirates': [7,7,1], 'Balingen Lions': [6,8,2], 'Guardians of Rhinos': [8,5,2], 'Toronto Polar Bears': [5,2,2], 'BlackForest Mad Wolves': [3,9,4], 'Karlsruhe Unicorns': [8,5,1], 'Dormettingen Eagles': [2,0,2]},
  'Dormettingen Eagles': {'East Bay Pirates': [0,3,0], 'Balingen Lions': [1,4,0], 'Guardians of Rhinos': [1,2,0], 'Toronto Polar Bears': [1,1,0], 'BlackForest Mad Wolves': [0,5,0], 'Karlsruhe Unicorns': [0,4,1], 'Wild Cheetahs': [0,2,2]}
};

/* ================= Team-Logos (Drive) ================= */
var LOGO_IDS = {
  '__LEAGUE__':             '1zQx4lQOPcbKyER9OeHBFg1InbIG_iEDA',
  'BlackForest Mad Wolves': '1DG0vGxXcGBBK-K0n9Sgr5maaaSAN7eEr',
  'Toronto Polar Bears':    '1GFihjMXNVF7FlBYw2QJbLIxkaEjNJCyP',
  'Balingen Lions':         '1Je0glUiEQVSTwI9H9o39bdSfflDDRYyN',
  'East Bay Pirates':       '1HGXSUoY5bKL1W3IvoQL4vRHHUBRCCI0W',
  'Dormettingen Eagles':    '1k0l7mrm_Onbfei6Y7-KbJAcSIimf6Y5o',
  'Karlsruhe Unicorns':     '155tDJUrDAZgHh9V-pFDcNgQehAMkr73t',
  'Guardians of Rhinos':    '1NfhugmNhOZdcS6K1zq8j7_VtpwQlczKi',
  'Wild Cheetahs':          '1OHpZvphOZwApwnIdl9pskA3EULZGUPmz'
};
var LOGO_CACHE_HOURS = 6;

function logoData() {
  var cache = CacheService.getScriptCache();
  var idx = cache.get('fbalogo_idx');
  if (idx) {
    var keys = [], n = Number(idx), buf = '';
    for (var a = 0; a < n; a++) keys.push('fbalogo_' + a);
    var got = cache.getAll(keys);
    for (var b = 0; b < n; b++) { if (got['fbalogo_' + b] == null) { buf = null; break; } buf += got['fbalogo_' + b]; }
    if (buf) { try { return JSON.parse(buf); } catch (e) {} }
  }
  var out = {};
  var token = ScriptApp.getOAuthToken();
  for (var t in LOGO_IDS) {
    try {
      DriveApp.getFileById(LOGO_IDS[t]).getName();
      var meta = UrlFetchApp.fetch(
        'https://www.googleapis.com/drive/v3/files/' + LOGO_IDS[t] + '?fields=thumbnailLink',
        { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
      if (meta.getResponseCode() !== 200) continue;
      var link = JSON.parse(meta.getContentText()).thumbnailLink;
      if (!link) continue;
      link = link.replace(/=s\d+$/, '=s240').replace(/=w\d+-h\d+.*$/, '=s240');
      var img = UrlFetchApp.fetch(link, { muteHttpExceptions: true, followRedirects: true });
      if (img.getResponseCode() !== 200) continue;
      var bl = img.getBlob(), by = bl.getBytes();
      if (!by || by.length < 200 || by.length > 200000) continue;
      var ct = bl.getContentType() || 'image/jpeg';
      if (ct.indexOf('image') !== 0) continue;
      out[t] = 'data:' + ct + ';base64,' + Utilities.base64Encode(by);
    } catch (e3) {}
  }
  try {
    var s = JSON.stringify(out), size = 90000, parts = {}, k = Math.ceil(s.length / size);
    for (var q = 0; q < k; q++) parts['fbalogo_' + q] = s.substr(q * size, size);
    parts['fbalogo_idx'] = String(k);
    cache.putAll(parts, LOGO_CACHE_HOURS * 3600);
  } catch (e4) {}
  return out;
}

function clearLogoCache() {
  CacheService.getScriptCache().remove('fbalogo_idx');
  try { SpreadsheetApp.getActive().toast('Logo-Cache geleert'); } catch (e) {}
}

function logoDebug() {
  var token = ScriptApp.getOAuthToken(), rep = [];
  for (var t in LOGO_IDS) {
    try {
      DriveApp.getFileById(LOGO_IDS[t]).getName();
      var meta = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + LOGO_IDS[t] + '?fields=thumbnailLink',
        { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
      var code = meta.getResponseCode();
      if (code !== 200) { rep.push(t + ': meta ' + code + ' ' + meta.getContentText().slice(0,80)); continue; }
      var link = JSON.parse(meta.getContentText()).thumbnailLink;
      if (!link) { rep.push(t + ': kein thumbnailLink'); continue; }
      var l2 = link.replace(/=s\d+$/, '=s240').replace(/=w\d+-h\d+.*$/, '=s240');
      var img = UrlFetchApp.fetch(l2, { muteHttpExceptions: true, followRedirects: true });
      rep.push(t + ': img ' + img.getResponseCode() + ' ' + img.getBlob().getContentType() + ' ' + Math.round(img.getBlob().getBytes().length/1024) + ' KB');
    } catch (e) { rep.push(t + ': EX ' + e); }
  }
  Logger.log(rep.join('\n'));
  return rep;
}

function logoSizes() {
  var d = logoData(), s = [];
  for (var t in d) s.push(t + ': ' + Math.round(d[t].length / 1024) + ' KB');
  Logger.log(s.join(' | '));
  return s;
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.monster) return matchupMonsterResponseV30_(p);
  if (p.raw) {
    return ContentService.createTextOutput(HtmlService.createHtmlOutputFromFile('Index').getContent())
      .setMimeType(ContentService.MimeType.TEXT);
  }
  if (p.data) {
    // Beim Öffnen der App höchstens einmal pro Stunde bei ESPN nachsehen.
    // Fehler blockieren niemals den letzten funktionierenden App-Stand.
    try { syncEspnIfStale_(false); } catch (syncErr) {}
    var json;
    try { json = JSON.stringify(getPayload(p.nocache == '1')); }
    catch (err) { json = JSON.stringify({ error: String(err) }); }
    if (p.callback) {
      return ContentService.createTextOutput(p.callback + '(' + json + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('FBA Control Center')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getPayloadJson() { return JSON.stringify(getPayload(false)); }

function getPayload(noCache) {
  var cache = CacheService.getScriptCache();
  if (!noCache) {
    var idx = cache.get(DATA_CACHE_PREFIX + 'idx');
    if (idx) {
      var keys = [], n = Number(idx);
      for (var i = 0; i < n; i++) keys.push(DATA_CACHE_PREFIX + i);
      var got = cache.getAll(keys), buf = '';
      for (var j = 0; j < n; j++) { if (got[DATA_CACHE_PREFIX + j] == null) { buf = null; break; } buf += got[DATA_CACHE_PREFIX + j]; }
      if (buf) { try { return JSON.parse(buf); } catch (e) {} }
    }
  }
  var data = buildData();
  try {
    var s = JSON.stringify(data), size = 90000, parts = {}, k = Math.ceil(s.length / size);
    for (var q = 0; q < k; q++) parts[DATA_CACHE_PREFIX + q] = s.substr(q * size, size);
    parts[DATA_CACHE_PREFIX + 'idx'] = String(k);
    cache.putAll(parts, CACHE_MINUTES * 60);
  } catch (e) {}
  return data;
}

function clearCache() {
  CacheService.getScriptCache().remove(DATA_CACHE_PREFIX + 'idx');
  try { SpreadsheetApp.getActive().toast('Cache geleert'); } catch (e) {}
}

function book() { return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActive(); }
var _g = {};
function grid(name) {
  if (_g[name] !== undefined) return _g[name];
  var sh = book().getSheetByName(name);
  _g[name] = sh ? sh.getDataRange().getValues() : null;
  return _g[name];
}
function cell(g, r, c) {
  if (!g || !g[r - 1]) return null;
  var v = g[r - 1][c - 1];
  if (v === '' || v === undefined) return null;
  if (typeof v === 'string') { v = v.trim(); if (v === '' || v.charAt(0) === '#') return null; }
  return v;
}
function num(v) { return typeof v === 'number' ? v : null; }
function txt(v) { return v === null || v === undefined || v === '' ? null : String(v).trim(); }
function isNum(v) { return typeof v === 'number' && !isNaN(v); }

var _map = null;
function normName(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
var NAME_FIX = { 'deschischsuppa': 'desischsuppa', 'bishkekseasysnipers': 'bishkekeasysnipers' };
function mapping() {
  if (_map) return _map;
  _map = [];
  var g = grid('Team_Mapping');
  if (g) {
    for (var i = 1; i < g.length; i++) {
      var r = g[i];
      if (!r || !r[0]) continue;
      var k = normName(r[0]);
      _map.push({ a: NAME_FIX[k] || k, s: String(r[1]).trim(), f: r[2], t: r[3], c: String(r[4]).trim() });
    }
  }
  return _map;
}
function canon(team, season, week) {
  if (team == null || team === '') return null;
  var k = normName(team); k = NAME_FIX[k] || k;
  var m = mapping();
  for (var i = 0; i < m.length; i++) {
    if (m[i].a === k && m[i].s === season && week >= m[i].f && week <= m[i].t) return m[i].c;
  }
  return String(team).trim();
}

function statsRaw(seasonKey) {
  var g = grid(seasonKey + ' StatsRaw');
  if (!g) return [];
  var hdr = {}, i;
  for (i = 0; i < g[0].length; i++) hdr[String(g[0][i]).trim()] = i;
  var out = [];
  for (i = 1; i < g.length; i++) {
    var r = g[i];
    if (!r || !isNum(r[0])) continue;
    var m = { week: r[0], mu: txt(r[1]), a: canon(r[2], seasonKey, r[0]), b: canon(r[3], seasonKey, r[0]), season: seasonKey };
    if (!m.a || !m.b) continue;
    for (var c = 0; c < CATS.length; c++) {
      var name = CATS[c];
      var ia = hdr[name + '_A'], ib = hdr[name + '_B'];
      m[name] = [ia === undefined ? null : r[ia], ib === undefined ? null : r[ib]];
    }
    out.push(m);
  }
  return out;
}

function catsOf(m) {
  var a = 0, b = 0, det = [];
  for (var i = 0; i < CATS.length; i++) {
    var c = CATS[i], x = m[c][0], y = m[c][1];
    if (!isNum(x) || !isNum(y)) continue;
    if (x > y) { a++; det.push({ cat: c, side: 'A', d: x - y, x: x, y: y }); }
    else { b++; det.push({ cat: c, side: 'B', d: y - x, x: x, y: y, tie: x === y }); }
  }
  return { a: a, b: b, det: det };
}

function fmt(v, c) {
  if (!isNum(v)) return '';
  return c.indexOf('%') > -1 ? v.toFixed(3).replace('.', ',') : String(v);
}

function shortName(t) {
  var p = String(t || '').split(' ');
  return p[p.length - 1];
}
function last3(RS, a, b) {
  var w = 0, l = 0, t = 0;
  RS.forEach(function (m) {
    if ((m.a === a && m.b === b) || (m.a === b && m.b === a)) {
      var r = catsOf(m);
      var f = m.a === a ? r.a : r.b, g = m.a === a ? r.b : r.a;
      if (f > g) w++; else if (f < g) l++; else t++;
    }
  });
  return w + '–' + l + '–' + t;
}
function predict(avg, a, b) {
  if (!avg[a] || !avg[b]) return null;
  var x = 0, y = 0;
  CATS.forEach(function (c) {
    if (!isNum(avg[a][c]) || !isNum(avg[b][c])) return;
    if (avg[a][c] > avg[b][c]) x++; else y++;
  });
  return x + '–' + y;
}
function streakOf(seq) {
  if (!seq.length) return '';
  var last = seq[seq.length - 1], n = 0;
  for (var k = seq.length - 1; k >= 0; k--) { if (seq[k] === last) n++; else break; }
  return last + n;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('FBA App')
    .addItem('Cache leeren', 'clearCache')
    .addItem('Daten testen', 'testData')
    .addSeparator()
    .addItem('ESPN jetzt synchronisieren', 'syncEspnData')
    .addItem('ESPN-Automatik installieren', 'installEspnSync')
    .addItem('ESPN-Syncstatus anzeigen', 'showEspnSyncStatus')
    .addSeparator()
    .addItem('Matchup Monster: Einmal-PIN', 'createMatchupMonsterPin')
    .addItem('Matchup Monster: Geräte sperren', 'resetMatchupMonsterDevices')
    .addToUi();
}
function testData() {
  var d = buildData();
  var msg = 'Woche ' + d.meta.targetWeek + ' · ' + d.meta.qa +
    '\nStandings: ' + d.standings.length + '\nRecap: ' + d.recap.length +
    '\nPreview: ' + d.preview.length + '\nPR+: ' + d.prPlus.length +
    '\nPerformance: ' + d.perf.length + '\nSaisons: ' + d.seasons.length;
  SpreadsheetApp.getUi().alert('FBA Daten', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function buildData() {
  _g = {}; _map = null;
  var PE = grid('Podcast_Export');
  var target = PE ? num(cell(PE, 3, 2)) : null;
  var SR = statsRaw(SEASON);
  var i, j, t, m, c;
  if (!target) {
    target = 0;
    for (i = 0; i < SR.length; i++) if (SR[i].week <= RS_MAX_WEEK && SR[i].week > target) target = SR[i].week;
  }
  var preview = target + 1;
  var out = { meta: {
    targetWeek: target, previewWeek: preview, qa: null,
    season: SEASON, seasonLabel: SEASON_LABEL, source: book().getName(), engine: 'live',
    generated: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm')
  } };

  var RS = SR.filter(function (x) { return x.week <= target; });
  RS.sort(function (x, y) { return x.week - y.week; });

  var acc = {};
  function A(tt) {
    if (!acc[tt]) {
      acc[tt] = { w: 0, l: 0, mw: 0, ml: 0, mt: 0, seq: [], sum: {}, n: {} };
      for (var q = 0; q < CATS.length; q++) { acc[tt].sum[CATS[q]] = 0; acc[tt].n[CATS[q]] = 0; }
    }
    return acc[tt];
  }
  for (i = 0; i < RS.length; i++) {
    m = RS[i];
    var r = catsOf(m), pa = A(m.a), pb = A(m.b);
    pa.w += r.a; pa.l += r.b; pb.w += r.b; pb.l += r.a;
    if (r.a > r.b) { pa.mw++; pb.ml++; pa.seq.push('W'); pb.seq.push('L'); }
    else if (r.a < r.b) { pa.ml++; pb.mw++; pa.seq.push('L'); pb.seq.push('W'); }
    else { pa.mt++; pb.mt++; pa.seq.push('T'); pb.seq.push('T'); }
    for (j = 0; j < CATS.length; j++) {
      c = CATS[j];
      if (isNum(m[c][0])) { pa.sum[c] += m[c][0]; pa.n[c]++; }
      if (isNum(m[c][1])) { pb.sum[c] += m[c][1]; pb.n[c]++; }
    }
  }
  var teams = Object.keys(acc), avg = {};
  for (i = 0; i < teams.length; i++) {
    t = teams[i]; avg[t] = {};
    for (j = 0; j < CATS.length; j++) { c = CATS[j]; avg[t][c] = acc[t].n[c] ? acc[t].sum[c] / acc[t].n[c] : null; }
  }

  out.standings = teams.map(function (tt) {
    var a = acc[tt], tot = a.w + a.l;
    return { team: tt, w: a.w, l: a.l, pct: tot ? a.w / tot : 0, conf: CONF[tt] || null, streak: streakOf(a.seq) };
  }).sort(function (x, y) { return (y.pct - x.pct) || (y.w - x.w) || (x.team < y.team ? -1 : 1); });
  out.standings.forEach(function (s, k) { s.rank = (k + 1) + '.'; });

  out.conferences = { West: [], East: [] };
  ['West', 'East'].forEach(function (cf) {
    var list = out.standings.filter(function (s) { return s.conf === cf; });
    var lead = list.length ? list[0].w : 0;
    out.conferences[cf] = list.map(function (s, k) {
      return { rank: (k + 1) + '.', team: s.team, w: s.w, l: s.l, pct: s.pct, behind: k === 0 ? null : lead - s.w };
    });
  });

  out.seasonAvg = teams.map(function (tt) {
    var o = { team: tt, record: acc[tt].mw + '–' + acc[tt].ml + '–' + acc[tt].mt };
    for (var q = 0; q < CATS.length; q++) o[CATS[q]] = avg[tt][CATS[q]];
    return o;
  }).sort(function (x, y) {
    var ax = acc[x.team], ay = acc[y.team];
    return (ay.mw - ax.mw) || (ax.ml - ay.ml) || (x.team < y.team ? -1 : 1);
  });

  out.avgMin = {}; out.avgMax = {};
  for (j = 0; j < CATS.length; j++) {
    c = CATS[j];
    var vs = teams.map(function (tt) { return avg[tt][c]; }).filter(isNum);
    out.avgMin[c] = vs.length ? Math.min.apply(null, vs) : null;
    out.avgMax[c] = vs.length ? Math.max.apply(null, vs) : null;
  }

  function prBlock(vals) {
    var ts = Object.keys(vals), rank = {}, plus = {};
    ts.forEach(function (tt) { rank[tt] = 0; plus[tt] = 0; });
    CATS.forEach(function (cc) {
      var mx = -Infinity;
      ts.forEach(function (tt) { if (isNum(vals[tt][cc]) && vals[tt][cc] > mx) mx = vals[tt][cc]; });
      ts.forEach(function (tt) {
        var v = vals[tt][cc], seen = {}, bigger = 0;
        ts.forEach(function (u) {
          var w = vals[u][cc];
          if (isNum(w) && isNum(v) && w > v && !seen[w]) { seen[w] = 1; bigger++; }
        });
        rank[tt] += 1 + bigger;
        plus[tt] += (mx && isNum(v)) ? v / mx : 0;
      });
    });
    return ts.map(function (tt) { return { team: tt, avgRank: rank[tt] / CATS.length, score: plus[tt] / CATS.length }; });
  }
  function denseRankBy(list, key, asc) {
    list.forEach(function (o) {
      var seen = {}, better = 0;
      list.forEach(function (p) {
        var d = asc ? (p[key] < o[key]) : (p[key] > o[key]);
        if (d && !seen[p[key]]) { seen[p[key]] = 1; better++; }
      });
      o.rank = 1 + better;
    });
  }

  var wkVals = {};
  SR.forEach(function (mm) {
    if (mm.week !== target) return;
    [[mm.a, 0], [mm.b, 1]].forEach(function (p) {
      wkVals[p[0]] = wkVals[p[0]] || {};
      CATS.forEach(function (cc) { wkVals[p[0]][cc] = mm[cc][p[1]]; });
    });
  });
  var prW = prBlock(wkVals);
  out.pr = prW.map(function (o) { return { team: o.team, avgRank: o.avgRank }; });
  denseRankBy(out.pr, 'avgRank', true);
  out.pr.sort(function (a, b) { return a.avgRank - b.avgRank || (a.team < b.team ? -1 : 1); });

  out.prPlus = prW.map(function (o) { return { team: o.team, score: o.score }; });
  out.prPlus.sort(function (a, b) { return b.score - a.score; });
  out.prPlus.forEach(function (o, k) { o.rank = k + 1; });
  var prRank = {}; out.pr.forEach(function (o) { prRank[o.team] = o.rank; });
  out.prPlus.forEach(function (o) { o.delta = prRank[o.team] - o.rank; });

  var prS = prBlock(avg);
  out.prSeason = prS.map(function (o) { return { team: o.team, pr: o.avgRank, prPlus: o.score }; });
  out.prSeason.sort(function (a, b) { return b.prPlus - a.prPlus; });
  out.prSeason.forEach(function (o, k) { o.rank = (k + 1) + '.'; });

  out.perf = []; out.weekly = []; out.perfMeta = {};
  var baseAcc = {}, wkRaw = {};
  RS.forEach(function (mm) {
    [[mm.a, 0], [mm.b, 1]].forEach(function (p) {
      var tt = p[0], ix2 = p[1];
      if (mm.week < target) {
        var ba = baseAcc[tt] = baseAcc[tt] || {};
        CATS.forEach(function (cc) {
          var vv = mm[cc][ix2];
          if (!isNum(vv)) return;
          ba[cc] = ba[cc] || [0, 0];
          ba[cc][0] += vv; ba[cc][1] += 1;
        });
      } else if (mm.week === target) {
        wkRaw[tt] = wkRaw[tt] || {};
        CATS.forEach(function (cc) { wkRaw[tt][cc] = mm[cc][ix2]; });
      }
    });
  });
  var GPCOL = { 'BlackForest Mad Wolves': 2, 'Balingen Lions': 3, 'Dormettingen Eagles': 4,
    'East Bay Pirates': 5, 'Guardians of Rhinos': 6, 'Karlsruhe Unicorns': 7,
    'Toronto Polar Bears': 8, 'Wild Cheetahs': 9 };
  var GPg = grid('GP'), seasonGP = {};
  if (GPg) {
    for (var tk in GPCOL) {
      var s2 = 0, n2 = 0;
      for (var rr = 4; rr <= 21; rr++) { var vv2 = cell(GPg, rr, GPCOL[tk]); if (isNum(vv2)) { s2 += vv2; n2++; } }
      if (n2) seasonGP[tk] = s2 / 18;
    }
  }
  out.standings.forEach(function (srow) {
    var tt = srow.team;
    if (!wkRaw[tt]) return;
    var d = { team: tt }, sum = 0, cnt = 0;
    CATS.forEach(function (cc) {
      var vv = wkRaw[tt][cc];
      var b = (baseAcc[tt] && baseAcc[tt][cc] && baseAcc[tt][cc][1]) ? baseAcc[tt][cc][0] / baseAcc[tt][cc][1] : null;
      d[cc] = vv;
      var dv = (isNum(vv) && isNum(b) && b) ? vv / b - 1 : null;
      d['d' + cc] = dv;
      if (dv !== null) { sum += dv; cnt++; }
    });
    d.dTotal = cnt ? sum / cnt : null;
    d.gp = isNum(seasonGP[tt]) ? seasonGP[tt] : null;
    d.GP = d.gp;
    out.weekly.push(d);
  });
  out.perf = out.weekly.map(function (d) {
    var top = null, flop = null;
    CATS.forEach(function (cc) {
      var vv = d['d' + cc];
      if (vv === null || vv === undefined) return;
      if (!top || vv > top[1]) top = [cc, vv];
      if (!flop || vv < flop[1]) flop = [cc, vv];
    });
    return { team: d.team, total: d.dTotal, topArea: top ? '\u0394%_' + top[0] : null, topVal: top ? top[1] : null,
      flopArea: flop ? '\u0394%_' + flop[0] : null, flopVal: flop ? flop[1] : null, gp: d.gp };
  }).sort(function (a, b) { return (b.total === null ? -9 : b.total) - (a.total === null ? -9 : a.total); });
  out.perf.forEach(function (o, k) { o.rank = (k + 1) + '.'; });
  out.perfMeta = { baselineFrom: 1, baselineTo: target - 1, week: target };

  function bestOf(list) {
    var res = [];
    CATS.forEach(function (cc) {
      var best = null;
      list.forEach(function (mm) {
        [[mm.a, 0, mm.b], [mm.b, 1, mm.a]].forEach(function (p) {
          var v = mm[cc][p[1]];
          if (!isNum(v)) return;
          if (!best || v > best.value) best = { cat: cc, value: v, team: p[0], week: mm.week, opp: p[2], season: mm.season };
        });
      });
      if (best) { best['new'] = (best.week === target && best.season === SEASON) ? 'Rekord gebrochen' : null; res.push(best); }
    });
    return res;
  }
  var allRS = [], allTot = [];
  SEASON_KEYS.forEach(function (k) {
    statsRaw(k).forEach(function (mm) { allTot.push(mm); if (mm.week <= RS_MAX_WEEK) allRS.push(mm); });
  });
  out.records = {
    season: bestOf(RS).map(function (o) { return { cat: o.cat, value: o.value, team: o.team, week: o.week, opp: shortName(o.opp), 'new': o['new'] }; }),
    allTimeRS: bestOf(allRS), allTime: bestOf(allTot)
  };

  var curRS = {}, curDuel = {};
  RS.forEach(function (mm) {
    var r2 = catsOf(mm);
    [[mm.a, r2.a, r2.b, mm.b], [mm.b, r2.b, r2.a, mm.a]].forEach(function (p) {
      var d2 = curRS[p[0]] = curRS[p[0]] || [0, 0, 0];
      d2[0] += p[1]; d2[1] += p[2]; d2[2] += 1;
      var e2 = (curDuel[p[0]] = curDuel[p[0]] || {});
      var f2 = (e2[p[3]] = e2[p[3]] || [0, 0, 0]);
      if (p[1] > p[2]) f2[0]++; else if (p[1] < p[2]) f2[1]++; else f2[2]++;
    });
  });
  function eternal(base, addCur) {
    var rows = [];
    for (var tt in base) {
      var b = base[tt].slice();
      if (addCur && curRS[tt]) { b[0] += curRS[tt][0]; b[1] += curRS[tt][1]; b[2] += curRS[tt][2]; }
      var tot = b[0] + b[1];
      rows.push({ team: tt, w: b[0], l: b[1], pct: tot ? b[0] / tot : 0, mu: b[2] });
    }
    rows.sort(function (a, b2) { return b2.pct - a.pct; });
    return rows;
  }
  var allBase = {};
  for (t in BASE_RS) allBase[t] = [BASE_RS[t][0] + BASE_PS[t][0], BASE_RS[t][1] + BASE_PS[t][1], BASE_RS[t][2] + BASE_PS[t][2]];
  out.eternal = { RS: eternal(BASE_RS, true), PS: eternal(BASE_PS, false), ALL: eternal(allBase, true) };

  var dteams = out.standings.map(function (s) { return s.team; });
  var matrix = {};
  dteams.forEach(function (a) {
    matrix[a] = {};
    dteams.forEach(function (b) {
      if (a === b) { matrix[a][b] = null; return; }
      var base = (BASE_DUEL[a] && BASE_DUEL[a][b]) ? BASE_DUEL[a][b].slice() : [0, 0, 0];
      var cur = (curDuel[a] && curDuel[a][b]) ? curDuel[a][b] : [0, 0, 0];
      matrix[a][b] = (base[0] + cur[0]) + '–' + (base[1] + cur[1]) + '–' + (base[2] + cur[2]);
    });
  });
  out.duels = { teams: dteams, matrix: matrix };
  function h2hStr(a, b) { return (matrix[a] && matrix[a][b]) ? matrix[a][b] : null; }

  out.recap = [];
  var wkList = RS.filter(function (mm) { return mm.week === target; });
  wkList.forEach(function (mm, k) {
    var r3 = catsOf(mm);
    var close = r3.det.filter(function (x) { return x.cat.indexOf('%') === -1 ? x.d <= 3 : x.d <= 0.006; });
    var catsTxt = close.map(function (x) {
      return x.cat + ' +' + (x.cat.indexOf('%') > -1 ? x.d.toFixed(3).replace('.', ',') : x.d) +
        ' (' + fmt(x.x, x.cat) + '-' + fmt(x.y, x.cat) + ')';
    }).join(' · ');
    out.recap.push({
      no: k + 1, away: mm.a, home: mm.b, awayPts: r3.a, homePts: r3.b,
      h2h: h2hStr(mm.a, mm.b), h2hStreak: null,
      awayStreak: streakOf(acc[mm.a].seq), homeStreak: streakOf(acc[mm.b].seq),
      cats: catsTxt || null
    });
  });

  out.preview = [];
  var SC = grid(SEASON + ' Schedule');
  if (SC) {
    var pnum = 0;
    for (i = 1; i < SC.length; i++) {
      var sr = SC[i];
      if (!sr || sr[1] !== preview) continue;
      var aw = txt(sr[5]), hm = txt(sr[6]);
      if (!aw || !hm) continue;
      pnum++;
      out.preview.push({
        no: pnum, away: aw, home: hm, rivalry: null, tags: null,
        h2h: h2hStr(aw, hm), h2hStreak: null, last3: last3(RS, aw, hm),
        prognose: predict(avg, aw, hm), expert: null,
        awayStreak: acc[aw] ? streakOf(acc[aw].seq) : null,
        homeStreak: acc[hm] ? streakOf(acc[hm].seq) : null
      });
    }
  }

  out.teams = [];
  var TM = grid('Teams');
  if (TM) { var rr2 = 13; while (cell(TM, rr2, 1)) { out.teams.push({ full: txt(cell(TM, rr2, 1)), 'short': txt(cell(TM, rr2, 2)), abbr: txt(cell(TM, rr2, 3)) }); rr2++; } }

  out.seasons = [];
  SEASON_KEYS.forEach(function (key) {
    var entry = { key: key, label: '20' + key.substring(1, 3) + '-' + key.substring(4, 6) };
    var g = grid(key + ' Results');
    if (g) {
      var ix = {};
      for (var q2 = 0; q2 < g[0].length; q2++) ix[String(g[0][q2]).trim()] = q2;
      entry.results = [];
      for (var q3 = 1; q3 < g.length; q3++) {
        var r4 = g[q3];
        if (!r4 || !isNum(r4[ix['Away Cats']])) continue;
        entry.results.push({ week: r4[ix['Week']], phase: r4[ix['Phase']], mu: r4[ix['Matchup']],
          away: canon(r4[ix['Away']], key, r4[ix['Week']]), home: canon(r4[ix['Home']], key, r4[ix['Week']]),
          a: r4[ix['Away Cats']], h: r4[ix['Home Cats']], w: r4[ix['Winner']] });
      }
    }
    var gf = grid(key + ' Final Standings');
    if (gf) {
      entry.final = [];
      for (var q4 = 1; q4 < gf.length; q4++) { if (gf[q4][0] === '' || gf[q4][0] === null) continue; entry.final.push({ place: gf[q4][0], team: txt(gf[q4][1]) }); }
    }
    out.seasons.push(entry);
  });

  out.statsRaw = SR.map(function (mm) {
    var o = { week: mm.week, mu: mm.mu, a: mm.a, b: mm.b };
    CATS.forEach(function (cc) { o[cc] = mm[cc]; });
    return o;
  });
  out.schedule = [];
  if (SC) for (i = 1; i < SC.length; i++) { if (!SC[i] || SC[i][1] === '') continue; out.schedule.push({ week: SC[i][1], mu: txt(SC[i][2]), away: txt(SC[i][5]), home: txt(SC[i][6]) }); }

  // Logos are served as static Netlify assets; do not add Base64 images to JSON.
  out.logos = {};
  out.odds = [];
  out.rivalryInfo = [];
  out.meta.qa = (wkList.length === 4) ? 'PASS' : ('nur ' + wkList.length + ' Matchups in Woche ' + target);
  return out;
}


/* ================= PHASENSTEUERUNG v1 =================
 * Erweitert den bestehenden Payload, ohne die verifizierte Saisonlogik
 * zu verändern. Die Übersicht kann dadurch automatisch zwischen
 * Draft, Regular Season, Postseason usw. wechseln.
 */
var CONFIG_SHEET_PHASE_V1 = 'App_Steuerung';
var CONFIG_CACHE_KEY_PHASE_V1 = 'fba_app_config_v1';

function readAppConfigPhaseV1() {
  var out = {
    currentSeason: '2026/27',
    seasonCode: 'S26_27',
    phase: 'DRAFT',
    lastCompletedSeason: '2025/26',
    currentWeek: null,
    postseasonRound: null,
    startMode: 'AUTO',
    notice: null,
    lastChange: null,
    draftDate: null,
    playoffSpotsPerConference: 2
  };
  var sh = book().getSheetByName(CONFIG_SHEET_PHASE_V1);
  if (!sh || sh.getLastRow() < 2) {
    out.effectivePhase = out.phase;
    return out;
  }
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  var map = {};
  values.forEach(function (r) {
    var key = txt(r[0]);
    if (key) map[key.toUpperCase()] = r[1];
  });
  function val(key, fallback) {
    var v = map[key];
    return (v === '' || v === null || v === undefined) ? fallback : v;
  }
  out.currentSeason = String(val('AKTUELLE_SAISON', out.currentSeason));
  out.seasonCode = String(val('SAISON_CODE', out.seasonCode));
  out.phase = String(val('PHASE', out.phase)).toUpperCase();
  out.lastCompletedSeason = String(val('LETZTE_ABGESCHLOSSENE_SAISON', out.lastCompletedSeason));
  out.currentWeek = val('AKTUELLE_WOCHE', null);
  out.postseasonRound = val('POSTSEASON_RUNDE', null);
  out.startMode = String(val('STARTSEITEN_MODUS', out.startMode)).toUpperCase();
  out.notice = val('APP_HINWEIS', null);
  out.lastChange = val('LETZTE_AENDERUNG', null);
  out.draftDate = val('DRAFT_DATUM', null);
  var spots = Number(val('PLAYOFF_PLAETZE_PRO_CONFERENCE', out.playoffSpotsPerConference));
  out.playoffSpotsPerConference = isNaN(spots) ? 2 : spots;
  out.effectivePhase = out.startMode && out.startMode !== 'AUTO' ? out.startMode : out.phase;
  return out;
}

function appConfigPhaseV1() {
  var cache = CacheService.getScriptCache();
  var saved = cache.get(CONFIG_CACHE_KEY_PHASE_V1);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  var out = readAppConfigPhaseV1();
  try { cache.put(CONFIG_CACHE_KEY_PHASE_V1, JSON.stringify(out), 21600); } catch (e2) {}
  return out;
}

function buildDraftDataPhaseV1(cfg, eternalRows) {
  var sheetName = cfg.seasonCode + ' Draft';
  var g = grid(sheetName);
  var result = {
    sheet: sheetName,
    season: cfg.currentSeason,
    draftDate: cfg.draftDate,
    playoffSpotsPerConference: cfg.playoffSpotsPerConference,
    teams: [],
    conferences: { East: [], West: [] },
    model: {
      label: 'Historisches Basismodell',
      detail: 'Ewige Regular-Season-Bilanz; unbekannte Teams starten beim Liga-Mittelwert.'
    }
  };
  if (!g || !g.length) return result;
  var hdr = {};
  for (var h = 0; h < g[0].length; h++) {
    hdr[String(g[0][h] || '').trim().toUpperCase()] = h;
  }
  var history = {};
  (eternalRows || []).forEach(function (r) { history[r.team] = r.pct; });
  for (var i = 1; i < g.length; i++) {
    var row = g[i];
    var pos = hdr.DRAFT_POSITION === undefined ? null : row[hdr.DRAFT_POSITION];
    var team = hdr.TEAM === undefined ? null : txt(row[hdr.TEAM]);
    if (!isNum(pos) || !team) continue;
    var conf = hdr.CONFERENCE === undefined ? null : txt(row[hdr.CONFERENCE]);
    var oddsOverride = hdr.ODDS_OVERRIDE === undefined ? null : row[hdr.ODDS_OVERRIDE];
    var oddsMode = hdr.ODDS_MODUS === undefined ? 'AUTO' : String(row[hdr.ODDS_MODUS] || 'AUTO').toUpperCase();
    var historicPct = history[team];
    if (!isNum(historicPct)) historicPct = 0.5;
    result.teams.push({
      draftPosition: pos,
      team: team,
      conference: conf,
      status: hdr.STATUS === undefined ? 'ACTIVE' : txt(row[hdr.STATUS]),
      shortName: hdr.SHORT_NAME === undefined ? shortName(team) : txt(row[hdr.SHORT_NAME]),
      oddsOverride: isNum(oddsOverride) ? oddsOverride : null,
      oddsMode: oddsMode,
      note: hdr.NOTIZ === undefined ? null : txt(row[hdr.NOTIZ]),
      historicPct: historicPct,
      historySource: history[team] === undefined ? 'LEAGUE_AVERAGE' : 'ALL_TIME_RS'
    });
  }
  ['East', 'West'].forEach(function (conf) {
    var list = result.teams.filter(function (t) { return t.conference === conf; });
    var totalStrength = 0;
    list.forEach(function (t) {
      t.strength = Math.exp((t.historicPct - 0.5) * 6);
      totalStrength += t.strength;
    });
    list.forEach(function (t) {
      var autoOdds = totalStrength ? cfg.playoffSpotsPerConference * t.strength / totalStrength : 0;
      autoOdds = Math.max(0.01, Math.min(0.99, autoOdds));
      t.earlyOdds = (t.oddsMode === 'MANUELL' && isNum(t.oddsOverride)) ? t.oddsOverride : autoOdds;
      t.oddsSource = (t.oddsMode === 'MANUELL' && isNum(t.oddsOverride)) ? 'MANUELL' : 'AUTO';
      result.conferences[conf].push(t);
    });
    result.conferences[conf].sort(function (a, b) { return b.earlyOdds - a.earlyOdds; });
  });
  result.teams.sort(function (a, b) { return a.draftPosition - b.draftPosition; });
  return result;
}

function enhancePayloadPhaseV1(data, cfg) {
  data.appConfig = cfg;
  data.draft = buildDraftDataPhaseV1(cfg, data.eternal && data.eternal.RS);
  return data;
}

/* Überschreibt bewusst nur den Payload-Wrapper. buildData() bleibt unverändert. */
function getPayload(noCache) {
  var cache = CacheService.getScriptCache();
  var cfg = appConfigPhaseV1();
  applyConfiguredSeasonV1_(cfg);
  if (!noCache) {
    var idx = cache.get(DATA_CACHE_PREFIX + 'idx');
    if (idx) {
      var keys = [];
      var n = Number(idx);
      for (var i = 0; i < n; i++) keys.push(DATA_CACHE_PREFIX + i);
      var got = cache.getAll(keys);
      var buf = '';
      for (var j = 0; j < n; j++) {
        if (got[DATA_CACHE_PREFIX + j] == null) { buf = null; break; }
        buf += got[DATA_CACHE_PREFIX + j];
      }
      if (buf) {
        try { return enhancePayloadPhaseV1(JSON.parse(buf), cfg); } catch (e) {}
      }
    }
  }
  var data = enhancePayloadPhaseV1(buildData(), cfg);
  try {
    var s = JSON.stringify(data);
    var size = 90000;
    var parts = {};
    var k = Math.ceil(s.length / size);
    for (var q = 0; q < k; q++) parts[DATA_CACHE_PREFIX + q] = s.substr(q * size, size);
    parts[DATA_CACHE_PREFIX + 'idx'] = String(k);
    cache.putAll(parts, CACHE_MINUTES * 60);
  } catch (e2) {}
  return data;
}

function clearCache() {
  var cache = CacheService.getScriptCache();
  cache.remove(DATA_CACHE_PREFIX + 'idx');
  cache.remove(CONFIG_CACHE_KEY_PHASE_V1);
  try { SpreadsheetApp.getActive().toast('Cache geleert'); } catch (e) {}
}

function onEdit(e) {
  try {
    var name = e && e.range ? e.range.getSheet().getName() : '';
    if (name === CONFIG_SHEET_PHASE_V1) {
      CacheService.getScriptCache().remove(CONFIG_CACHE_KEY_PHASE_V1);
    }
    if (name === CONFIG_SHEET_PHASE_V1 || /^S\d{2}_\d{2} Draft$/.test(name)) {
      CacheService.getScriptCache().remove(DATA_CACHE_PREFIX + 'idx');
    }
  } catch (err) {}
}

function testPhaseData() {
  var d = getPayload(true);
  var msg = 'Phase: ' + d.appConfig.effectivePhase +
    '\nSaison: ' + d.appConfig.currentSeason +
    '\nDraft-Teams: ' + d.draft.teams.length +
    '\nEast: ' + d.draft.conferences.East.length +
    '\nWest: ' + d.draft.conferences.West.length;
  SpreadsheetApp.getUi().alert('FBA Phasen-Test', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function testPhaseDataConsole() {
  var d = getPayload(true);
  console.log(JSON.stringify({ phase: d.appConfig.effectivePhase, season: d.appConfig.currentSeason, draftTeams: d.draft.teams.length, east: d.draft.conferences.East.length, west: d.draft.conferences.West.length }));
  return d.appConfig.effectivePhase;
}


/* Data cache: bis zu 6 Stunden warm; onEdit invalidiert Änderungen. */
CACHE_MINUTES = 360;


/* Phasen/Draft: Basisdaten-Cache behalten; Draft wird je API-Aufruf frisch ergänzt. */
function onEdit(e) {
  try {
    var name = e && e.range ? e.range.getSheet().getName() : '';
    if (name === CONFIG_SHEET_PHASE_V1 || name === CONFIG_SHEET) {
      var cache = CacheService.getScriptCache();
      cache.remove(CONFIG_CACHE_KEY_PHASE_V1);
      cache.remove(CONFIG_CACHE_KEY);
    }
  } catch (err) {}
}


/* ================= EARLY ODDS MODELL v2 =================
 * Faktoren:
 *  - ewige Regular-Season-Bilanz
 *  - paarweise geglaettete H2H-Bilanz gegen die neuen Conference-Gegner
 *  - geglaettete historische Playoffquote der Draftposition
 */
var EARLY_ODDS_MODEL_SHEET_PHASE_V2 = 'Early_Odds_Modell';
var EARLY_ODDS_MODEL_CACHE_PHASE_V2 = 'fba_early_odds_model_v2';

function defaultEarlyOddsModelPhaseV2() {
  return {
    regularSeasonWeight: 0.45,
    h2hWeight: 0.45,
    draftPositionWeight: 0.10,
    softmaxFactor: 4,
    h2hPriorStrength: 4,
    draftPositions: {
      '1': { samples: 5, playoffs: 4, rawRate: 0.80, smoothedRate: 6 / 9 },
      '2': { samples: 5, playoffs: 3, rawRate: 0.60, smoothedRate: 5 / 9 },
      '3': { samples: 5, playoffs: 3, rawRate: 0.60, smoothedRate: 5 / 9 },
      '4': { samples: 5, playoffs: 5, rawRate: 1.00, smoothedRate: 7 / 9 },
      '5': { samples: 5, playoffs: 1, rawRate: 0.20, smoothedRate: 3 / 9 },
      '6': { samples: 5, playoffs: 1, rawRate: 0.20, smoothedRate: 3 / 9 },
      '7': { samples: 5, playoffs: 2, rawRate: 0.40, smoothedRate: 4 / 9 },
      '8': { samples: 5, playoffs: 1, rawRate: 0.20, smoothedRate: 3 / 9 }
    },
    historySeasons: 'S20_21–S24_25'
  };
}

function readEarlyOddsModelPhaseV2() {
  var cache = CacheService.getScriptCache();
  var saved = cache.get(EARLY_ODDS_MODEL_CACHE_PHASE_V2);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  var out = defaultEarlyOddsModelPhaseV2();
  var g = grid(EARLY_ODDS_MODEL_SHEET_PHASE_V2);
  if (g && g.length) {
    var params = {};
    for (var r = 0; r < g.length; r++) {
      var key = txt(g[r][0]);
      if (key) params[key.toUpperCase()] = g[r][1];
      if (String(key || '').toUpperCase() === 'DRAFT_POSITION') {
        for (var d = r + 1; d < g.length; d++) {
          var pos = g[d][0];
          if (!isNum(pos)) break;
          var samples = g[d][1], playoffs = g[d][2], raw = g[d][3], smooth = g[d][4];
          out.draftPositions[String(pos)] = {
            samples: isNum(samples) ? samples : 0,
            playoffs: isNum(playoffs) ? playoffs : 0,
            rawRate: isNum(raw) ? raw : 0.5,
            smoothedRate: isNum(smooth) ? smooth : 0.5
          };
          if (g[d][5]) out.historySeasons = String(g[d][5]);
        }
      }
    }
    if (isNum(params.REGULAR_SEASON_GEWICHT)) out.regularSeasonWeight = params.REGULAR_SEASON_GEWICHT;
    if (isNum(params.H2H_CONFERENCE_GEWICHT)) out.h2hWeight = params.H2H_CONFERENCE_GEWICHT;
    if (isNum(params.DRAFT_POSITION_GEWICHT)) out.draftPositionWeight = params.DRAFT_POSITION_GEWICHT;
    if (isNum(params.SOFTMAX_FAKTOR)) out.softmaxFactor = params.SOFTMAX_FAKTOR;
  }
  var weightSum = out.regularSeasonWeight + out.h2hWeight + out.draftPositionWeight;
  if (!weightSum || weightSum <= 0) {
    out.regularSeasonWeight = 0.45;
    out.h2hWeight = 0.45;
    out.draftPositionWeight = 0.10;
  } else {
    out.regularSeasonWeight /= weightSum;
    out.h2hWeight /= weightSum;
    out.draftPositionWeight /= weightSum;
  }
  try { cache.put(EARLY_ODDS_MODEL_CACHE_PHASE_V2, JSON.stringify(out), 21600); } catch (e2) {}
  return out;
}

function parseH2HPhaseV2(value) {
  var m = String(value || '').match(/(\d+)\D+(\d+)\D+(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function buildDraftDataPhaseV2(cfg, eternalRows, duels) {
  var sheetName = cfg.seasonCode + ' Draft';
  var g = grid(sheetName);
  var model = readEarlyOddsModelPhaseV2();
  var rsWeight = model.regularSeasonWeight;
  var h2hWeight = model.h2hWeight;
  var draftWeight = model.draftPositionWeight;
  var pctText = function (n) { return Math.round(n * 100) + '%'; };
  var result = {
    sheet: sheetName,
    season: cfg.currentSeason,
    draftDate: cfg.draftDate,
    playoffSpotsPerConference: cfg.playoffSpotsPerConference,
    teams: [],
    conferences: { East: [], West: [] },
    model: {
      label: 'Early Odds Berechnung',
      detail: pctText(rsWeight) + ' ewige Regular Season · ' +
        pctText(h2hWeight) + ' historische H2H-Bilanz gegen die aktuellen Conference-Gegner · ' +
        pctText(draftWeight) + ' historischer Draftplatz-Effekt (' + model.historySeasons + ', geglaettet). ' +
        'Je Conference ergeben die Odds zusammen ' + (cfg.playoffSpotsPerConference * 100) + '% fuer ' +
        cfg.playoffSpotsPerConference + ' Playoffplaetze.',
      weights: {
        regularSeason: rsWeight,
        conferenceH2H: h2hWeight,
        draftPosition: draftWeight
      },
      historySeasons: model.historySeasons,
      h2hMethod: 'Geglaetteter Mittelwert der direkten Duelle gegen jeden aktuellen Conference-Gegner.'
    }
  };
  if (!g || !g.length) return result;

  var hdr = {};
  for (var h = 0; h < g[0].length; h++) hdr[String(g[0][h] || '').trim().toUpperCase()] = h;
  var history = {};
  (eternalRows || []).forEach(function (r) { history[r.team] = r; });
  for (var i = 1; i < g.length; i++) {
    var row = g[i];
    var pos = hdr.DRAFT_POSITION === undefined ? null : row[hdr.DRAFT_POSITION];
    var team = hdr.TEAM === undefined ? null : txt(row[hdr.TEAM]);
    if (!isNum(pos) || !team) continue;
    var conf = hdr.CONFERENCE === undefined ? null : txt(row[hdr.CONFERENCE]);
    var oddsOverride = hdr.ODDS_OVERRIDE === undefined ? null : row[hdr.ODDS_OVERRIDE];
    var oddsMode = hdr.ODDS_MODUS === undefined ? 'AUTO' : String(row[hdr.ODDS_MODUS] || 'AUTO').toUpperCase();
    var hist = history[team];
    var historicPct = hist && isNum(hist.pct) ? hist.pct : 0.5;
    var draftHist = model.draftPositions[String(pos)] || { samples: 0, playoffs: 0, rawRate: 0.5, smoothedRate: 0.5 };
    result.teams.push({
      draftPosition: pos,
      team: team,
      conference: conf,
      status: hdr.STATUS === undefined ? 'ACTIVE' : txt(row[hdr.STATUS]),
      shortName: hdr.SHORT_NAME === undefined ? shortName(team) : txt(row[hdr.SHORT_NAME]),
      oddsOverride: isNum(oddsOverride) ? oddsOverride : null,
      oddsMode: oddsMode,
      note: hdr.NOTIZ === undefined ? null : txt(row[hdr.NOTIZ]),
      historicPct: historicPct,
      historySource: hist ? 'ALL_TIME_RS' : 'LEAGUE_AVERAGE',
      factors: {
        regularSeason: { score: historicPct, wins: hist ? hist.w : null, losses: hist ? hist.l : null },
        draftPosition: {
          score: draftHist.smoothedRate,
          samples: draftHist.samples,
          playoffs: draftHist.playoffs,
          rawRate: draftHist.rawRate
        }
      }
    });
  }

  var duelMatrix = duels && duels.matrix ? duels.matrix : {};
  ['East', 'West'].forEach(function (conf) {
    var list = result.teams.filter(function (t) { return t.conference === conf; });
    var totalStrength = 0;
    list.forEach(function (t) {
      var pairScores = [], agg = [0, 0, 0];
      list.forEach(function (opp) {
        if (opp.team === t.team) return;
        var rec = duelMatrix[t.team] && duelMatrix[t.team][opp.team];
        var p = parseH2HPhaseV2(rec);
        if (!p || p[0] + p[1] + p[2] <= 0) return;
        agg[0] += p[0]; agg[1] += p[1]; agg[2] += p[2];
        var games = p[0] + p[1] + p[2];
        pairScores.push((p[0] + 0.5 * p[2] + 0.5 * model.h2hPriorStrength) /
          (games + model.h2hPriorStrength));
      });
      var h2hPct = pairScores.length ? pairScores.reduce(function (a, b) { return a + b; }, 0) / pairScores.length : 0.5;
      t.factors.conferenceH2H = {
        score: h2hPct,
        wins: agg[0], losses: agg[1], ties: agg[2], opponentCount: pairScores.length
      };
      t.modelScore = rsWeight * t.factors.regularSeason.score +
        h2hWeight * h2hPct + draftWeight * t.factors.draftPosition.score;
      t.strength = Math.exp((t.modelScore - 0.5) * model.softmaxFactor);
      totalStrength += t.strength;
    });
    list.forEach(function (t) {
      var autoOdds = totalStrength ? cfg.playoffSpotsPerConference * t.strength / totalStrength : 0;
      autoOdds = Math.max(0.01, Math.min(0.99, autoOdds));
      var manual = t.oddsMode === 'MANUELL' && isNum(t.oddsOverride);
      var manualValue = manual && t.oddsOverride > 1 ? t.oddsOverride / 100 : t.oddsOverride;
      t.earlyOdds = manual ? manualValue : autoOdds;
      t.oddsSource = manual ? 'MANUELL' : 'AUTO_V2';
      result.conferences[conf].push(t);
    });
    result.conferences[conf].sort(function (a, b) { return b.earlyOdds - a.earlyOdds; });
  });
  result.teams.sort(function (a, b) { return a.draftPosition - b.draftPosition; });
  return result;
}

function enhancePayloadPhaseV1(data, cfg) {
  data.appConfig = cfg;
  data.draft = buildDraftDataPhaseV2(cfg, data.eternal && data.eternal.RS, data.duels);
  return data;
}

function clearCache() {
  var cache = CacheService.getScriptCache();
  cache.remove(DATA_CACHE_PREFIX + 'idx');
  cache.remove(CONFIG_CACHE_KEY_PHASE_V1);
  cache.remove(EARLY_ODDS_MODEL_CACHE_PHASE_V2);
  try { SpreadsheetApp.getActive().toast('Cache geleert'); } catch (e) {}
}

function onEdit(e) {
  try {
    var name = e && e.range ? e.range.getSheet().getName() : '';
    var cache = CacheService.getScriptCache();
    if (name === CONFIG_SHEET_PHASE_V1 || name === CONFIG_SHEET) {
      cache.remove(CONFIG_CACHE_KEY_PHASE_V1);
      cache.remove(CONFIG_CACHE_KEY);
    }
    if (name === EARLY_ODDS_MODEL_SHEET_PHASE_V2) cache.remove(EARLY_ODDS_MODEL_CACHE_PHASE_V2);
  } catch (err) {}
}

function testEarlyOddsModelPhaseV2() {
  clearCache();
  var d = getPayload(false);
  var out = {
    phase: d.appConfig.effectivePhase,
    model: d.draft.model,
    East: d.draft.conferences.East.map(function (t) {
      return { team: t.team, odds: t.earlyOdds, factors: t.factors };
    }),
    West: d.draft.conferences.West.map(function (t) {
      return { team: t.team, odds: t.earlyOdds, factors: t.factors };
    })
  };
  console.log(JSON.stringify(out));
  return JSON.stringify(out);
}



/* ================= FBA ANALYTICS V1 =================
 * Historische Saison-/Wochenauswahl fuer Power Ranking, Performance Watch
 * und Team Stats. Quelle und Freigabe werden ueber App_Analytics gesteuert.
 */
var ANALYTICS_CONFIG_SHEET_V1 = 'App_Analytics';
var ANALYTICS_CACHE_KEY_V1 = 'fba_analytics_history_v1';

function buildAnalyticsHistoryV1() {
  var cache = CacheService.getScriptCache();
  var saved = cache.get(ANALYTICS_CACHE_KEY_V1);
  if (saved) { try { return JSON.parse(saved); } catch (e) {} }
  var g = grid(ANALYTICS_CONFIG_SHEET_V1);
  var out = { version: 2, seasons: [] };
  if (!g || g.length < 2) return out;
  var h = {};
  for (var c = 0; c < g[0].length; c++) h[String(g[0][c] || '').trim().toUpperCase()] = c;
  for (var r = 1; r < g.length; r++) {
    var row = g[r], status = String(row[h.STATUS] || 'AKTIV').toUpperCase();
    if (status !== 'AKTIV') continue;
    var key = String(row[h.SAISON_CODE] || '').trim();
    if (!key) continue;
    var regularSeasonEnd = Number(row[h.RS_ENDE] || row[h.RS_WOCHEN] || 18);
    var maxWeek = Number(row[h.SAISON_ENDE] || regularSeasonEnd);
    var postSeasonStart = Number(row[h.PS_AB] || (regularSeasonEnd + 1));
    var games = statsRaw(key).filter(function (m) {
      return Number(m.week) >= 1 && Number(m.week) <= maxWeek;
    });
    out.seasons.push({
      key: key,
      label: String(row[h.ANZEIGE] || key),
      regularSeasonEnd: regularSeasonEnd,
      postSeasonStart: postSeasonStart,
      maxWeek: maxWeek,
      games: games
    });
  }
  try { cache.put(ANALYTICS_CACHE_KEY_V1, JSON.stringify(out), 21600); } catch (e2) {}
  return out;
}

/* Letzte Definition gewinnt bewusst: Early Odds V2 bleiben erhalten,
   Analytics wird ergaenzt. */
function enhancePayloadPhaseV1(data, cfg) {
  data.appConfig = cfg;
  data.draft = buildDraftDataPhaseV2(cfg, data.eternal && data.eternal.RS, data.duels);
  data.analytics = buildAnalyticsHistoryV1();
  data.espnSync = getEspnSyncStatus_();
  return data;
}

function onEdit(e) {
  try {
    var name = e && e.range ? e.range.getSheet().getName() : '';
    var cache = CacheService.getScriptCache();
    if (name === CONFIG_SHEET_PHASE_V1 || name === CONFIG_SHEET) {
      cache.remove(CONFIG_CACHE_KEY_PHASE_V1);
      cache.remove(CONFIG_CACHE_KEY);
    }
    if (name === EARLY_ODDS_MODEL_SHEET_PHASE_V2) cache.remove(EARLY_ODDS_MODEL_CACHE_PHASE_V2);
    if (name === ANALYTICS_CONFIG_SHEET_V1 || / StatsRaw$/.test(name)) {
      cache.remove(ANALYTICS_CACHE_KEY_V1);
    }
    if (name === CONFIG_SHEET_PHASE_V1 || name === CONFIG_SHEET ||
        name === EARLY_ODDS_MODEL_SHEET_PHASE_V2 || name === ANALYTICS_CONFIG_SHEET_V1 || name === 'ESPN_Draft_Prognose' ||
        / StatsRaw$/.test(name) || /^S\d{2}_\d{2} Draft$/.test(name)) {
      cache.remove(DATA_CACHE_PREFIX + 'idx');
    }
  } catch (err) {}
}

function testAnalyticsHistoryV1() {
  CacheService.getScriptCache().remove(ANALYTICS_CACHE_KEY_V1);
  var a = buildAnalyticsHistoryV1();
  var result = a.seasons.map(function (s) {
    return {
      season: s.key,
      label: s.label,
      regularSeasonEnd: s.regularSeasonEnd,
      postSeasonStart: s.postSeasonStart,
      maxWeek: s.maxWeek,
      games: s.games.length
    };
  });
  console.log(JSON.stringify(result));
  return JSON.stringify(result);
}


/* ================= ESPN AUTO-SYNC v1 =================
 * Öffentliche ESPN Fantasy Basketball Liga -> S26_27 StatsRaw.
 *
 * Sicherheitsprinzipien:
 *  - keine Passwörter oder Cookies nötig
 *  - vorhandene Daten werden nur für dieselbe Saison/Begegnung aktualisiert
 *  - bei ESPN-Fehlern bleibt der letzte gültige Tabellenstand erhalten
 *  - Postseason-Werte werden vollständig gespeichert; eine Halbierung gehört
 *    ausschließlich in die vergleichende Analytics-Schicht
 */
var ESPN_SYNC_V1 = {
  leagueId: '1152091056',
  seasonId: 2027,
  seasonKey: 'S26_27',
  seasonLabel: '2026/27',
  statsSheet: 'S26_27 StatsRaw',
  scheduleSheet: 'S26_27 Schedule',
  nbaScheduleSheet: 'ESPN_NBA_Schedule',
  resultsSheet: 'S26_27 Results',
  logSheet: 'ESPN_Sync',
  analyticsSheet: 'App_Analytics',
  configSheet: 'App_Steuerung',
  timezone: 'Europe/Berlin',
  staleMinutes: 60,
  regularSeasonEnd: 18,
  seasonEnd: 20,
  postseasonStart: 19
};

var ESPN_TEAM_ID_MAP_V1 = {
  '1': 'Balingen Lions',
  '2': 'Karlsruhe Unicorns',
  '3': 'Bishkek Easy Snipers',
  '4': 'Guardians of Rhinos',
  '5': 'East Bay Pirates',
  '6': 'Toronto Polar Bears',
  '7': 'BlackForest Mad Wolves',
  '8': 'Dormettingen Eagles'
};

var ESPN_STATS_HEADER_V1 = [
  'Woche', 'Matchup', 'Team A', 'Team B',
  'PTS_A', 'PTS_B', 'REB_A', 'REB_B', 'AST_A', 'AST_B',
  '3PM_A', '3PM_B', 'STL_A', 'STL_B', 'BLK_A', 'BLK_B',
  'FG%_A', 'FG%_B', 'FT%_A', 'FT%_B', 'Quelle/Link/Notiz'
];

var ESPN_SCHEDULE_HEADER_V1 = [
  'season_id', 'week', 'matchup_id', 'date_start', 'date_end', 'away_team', 'home_team'
];

var ESPN_NBA_SCHEDULE_HEADER_V33 = [
  'season_id', 'event_id', 'nba_date', 'away_team', 'home_team', 'status',
  'scoring_period', 'source', 'last_seen', 'last_changed'
];

var ESPN_RESULTS_HEADER_V1 = [
  'Week', 'Phase', 'Matchup', 'Away', 'Home', 'Away Cats', 'Home Cats', 'Winner'
];

function espnEndpointV1_() {
  return 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/' +
    ESPN_SYNC_V1.seasonId + '/segments/0/leagues/' + ESPN_SYNC_V1.leagueId +
    '?view=mMatchup&view=mMatchupScore&view=mTeam&view=mSettings';
}

function espnPropertiesV1_() {
  return PropertiesService.getScriptProperties();
}

function getEspnSyncStatus_() {
  var p = espnPropertiesV1_();
  return {
    enabled: p.getProperty('FBA_ESPN_ENABLED') === '1',
    leagueId: ESPN_SYNC_V1.leagueId,
    seasonId: ESPN_SYNC_V1.seasonId,
    seasonKey: ESPN_SYNC_V1.seasonKey,
    lastAttempt: p.getProperty('FBA_ESPN_LAST_ATTEMPT') || null,
    lastSuccess: p.getProperty('FBA_ESPN_LAST_SUCCESS') || null,
    lastStatus: p.getProperty('FBA_ESPN_LAST_STATUS') || 'NOCH_NICHT_AUSGEFUEHRT',
    lastRows: Number(p.getProperty('FBA_ESPN_LAST_ROWS') || 0),
    lastError: p.getProperty('FBA_ESPN_LAST_ERROR') || null
  };
}

function syncEspnIfStale_(force) {
  var p = espnPropertiesV1_();
  if (!force && p.getProperty('FBA_ESPN_ENABLED') !== '1') return getEspnSyncStatus_();
  var last = p.getProperty('FBA_ESPN_LAST_ATTEMPT');
  if (!force && last) {
    var age = Date.now() - new Date(last).getTime();
    if (!isNaN(age) && age < ESPN_SYNC_V1.staleMinutes * 60000) return getEspnSyncStatus_();
  }
  return syncEspnData();
}

function syncEspnScheduled() {
  return syncEspnIfStale_(false);
}

function installEspnSync() {
  ensureEspnSheetsV1_();
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncEspnScheduled') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('syncEspnScheduled').timeBased().everyHours(2).create();
  espnPropertiesV1_().setProperty('FBA_ESPN_ENABLED', '1');
  var result = syncEspnData();
  try {
    SpreadsheetApp.getUi().alert(
      'ESPN-Automatik aktiv',
      'Die Liga wird automatisch geprüft. Status: ' + result.lastStatus +
      '\nAktualisierte Matchups: ' + result.lastRows,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
  return result;
}

function uninstallEspnSync() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncEspnScheduled') ScriptApp.deleteTrigger(trigger);
  });
  espnPropertiesV1_().setProperty('FBA_ESPN_ENABLED', '0');
  return getEspnSyncStatus_();
}

function syncEspnData() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1500)) return getEspnSyncStatus_();
  var props = espnPropertiesV1_();
  var stamp = Utilities.formatDate(new Date(), ESPN_SYNC_V1.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  props.setProperty('FBA_ESPN_LAST_ATTEMPT', stamp);
  props.deleteProperty('FBA_ESPN_LAST_ERROR');
  try {
    ensureEspnSheetsV1_();
    var response = UrlFetchApp.fetch(espnEndpointV1_(), {
      method: 'get',
      headers: { Accept: 'application/json' },
      muteHttpExceptions: true,
      followRedirects: true
    });
    var code = response.getResponseCode();
    if (code !== 200) throw new Error('ESPN HTTP ' + code + ': ' + response.getContentText().slice(0, 240));
    var league = JSON.parse(response.getContentText());
    if (!league || String(league.id) !== String(ESPN_SYNC_V1.leagueId)) {
      throw new Error('ESPN-Antwort gehört nicht zur erwarteten Liga.');
    }
    var playerResult = { status: 'NICHT_AUSGEFUEHRT', players: 0, roster: 0, transactions: 0, dailyRows: 0 };
    try {
      playerResult = syncEspnPlayerHubV2_(stamp, league);
    } catch (playerErr) {
      playerResult.status = 'TEILFEHLER';
      playerResult.error = String(playerErr && playerErr.message ? playerErr.message : playerErr).slice(0, 400);
      props.setProperties({
        FBA_ESPN_PLAYER_STATUS: playerResult.status,
        FBA_ESPN_PLAYER_ERROR: playerResult.error
      });
    }
    var nbaScheduleResult = null, nbaScheduleError = '';
    try { nbaScheduleResult = refreshEspnNbaScheduleV33_(false, true); }
    catch (nbaScheduleErr) { nbaScheduleError = String(nbaScheduleErr && nbaScheduleErr.message ? nbaScheduleErr.message : nbaScheduleErr).slice(0, 300); }
    var scheduleRows = buildEspnScheduleRowsV1_(league);
    var rows = buildEspnStatsRowsV1_(league, stamp);
    upsertEspnScheduleRowsV1_(scheduleRows);
    var written = upsertEspnStatsRowsV1_(rows);
    upsertEspnResultsRowsV1_(buildEspnResultsRowsV1_(rows));
    var status = rows.length ? 'OK' : 'BEREIT_KEINE_MATCHUP_DATEN';
    props.setProperties({
      FBA_ESPN_LAST_SUCCESS: stamp,
      FBA_ESPN_LAST_STATUS: status,
      FBA_ESPN_LAST_ROWS: String(written),
      FBA_ESPN_PLAYER_STATUS: playerResult.status,
      FBA_ESPN_PLAYER_LAST_SUCCESS: playerResult.status === 'TEILFEHLER' ? (props.getProperty('FBA_ESPN_PLAYER_LAST_SUCCESS') || '') : stamp,
      FBA_ESPN_PLAYER_COUNT: String(playerResult.players || 0),
      FBA_ESPN_ROSTER_COUNT: String(playerResult.roster || 0),
      FBA_ESPN_TRANSACTION_COUNT: String(playerResult.transactions || 0),
      FBA_ESPN_DAILY_COUNT: String(playerResult.dailyRows || 0)
    });
    if (rows.length) updateCurrentSeasonControlV1_(rows);
    clearEspnDependentCachesV1_();
    appendEspnLogV1_(stamp, status, rows.length, written,
      (rows.length ? 'ESPN-Matchups übernommen.' : 'Liga erreichbar; Saison noch ohne Matchup-Werte.') +
      ' Player Hub: ' + playerResult.status + ' · Spieler ' + (playerResult.players || 0) +
      ' · Kader ' + (playerResult.roster || 0) + ' · Transaktionen ' + (playerResult.transactions || 0) +
      ' · neue NBA-Zeilen ' + (playerResult.dailyRows || 0) +
      ' · NBA-Spielplan ' + (nbaScheduleResult ? (nbaScheduleResult.games.length + ' Spiele') : ('Fehler: ' + (nbaScheduleError || 'unbekannt'))) +
      (playerResult.error ? ' · ' + playerResult.error : ''));
    return getEspnSyncStatus_();
  } catch (err) {
    var message = String(err && err.message ? err.message : err).slice(0, 500);
    props.setProperties({ FBA_ESPN_LAST_STATUS: 'FEHLER', FBA_ESPN_LAST_ERROR: message });
    appendEspnLogV1_(stamp, 'FEHLER', 0, 0, message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function ensureEspnSheetsV1_() {
  var ss = book();
  var stats = ss.getSheetByName(ESPN_SYNC_V1.statsSheet);
  if (!stats) stats = ss.insertSheet(ESPN_SYNC_V1.statsSheet);
  var currentHeader = stats.getRange(1, 1, 1, ESPN_STATS_HEADER_V1.length).getValues()[0];
  var headerMissing = !currentHeader[0] || currentHeader[0] !== ESPN_STATS_HEADER_V1[0];
  if (headerMissing) {
    stats.getRange(1, 1, 1, ESPN_STATS_HEADER_V1.length).setValues([ESPN_STATS_HEADER_V1]);
    stats.setFrozenRows(1);
    stats.getRange(1, 1, 1, ESPN_STATS_HEADER_V1.length)
      .setFontWeight('bold').setBackground('#EAEAEA').setHorizontalAlignment('center');
    stats.getRange(2, 17, Math.max(1, stats.getMaxRows() - 1), 4).setNumberFormat('0.0000');
  }
  var log = ss.getSheetByName(ESPN_SYNC_V1.logSheet);
  if (!log) log = ss.insertSheet(ESPN_SYNC_V1.logSheet);
  if (!log.getRange(1, 1).getValue()) {
    log.getRange(1, 1, 1, 6).setValues([['ZEIT', 'STATUS', 'SAISON', 'MATCHUPS', 'ZEILEN', 'DETAIL']]);
    log.setFrozenRows(1);
    log.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#EAEAEA');
  }
  ensureSimpleEspnSheetV1_(ESPN_SYNC_V1.scheduleSheet, ESPN_SCHEDULE_HEADER_V1);
  ensureSimpleEspnSheetV1_(ESPN_SYNC_V1.nbaScheduleSheet, ESPN_NBA_SCHEDULE_HEADER_V33);
  ensureSimpleEspnSheetV1_(ESPN_SYNC_V1.resultsSheet, ESPN_RESULTS_HEADER_V1);
  ensureAnalyticsSeasonV1_();
}

function ensureSimpleEspnSheetV1_(name, header) {
  var sh = book().getSheetByName(name);
  if (!sh) sh = book().insertSheet(name);
  if (!sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#EAEAEA');
  }
  return sh;
}

function ensureAnalyticsSeasonV1_() {
  var sh = book().getSheetByName(ESPN_SYNC_V1.analyticsSheet);
  if (!sh) return;
  var values = sh.getDataRange().getValues();
  if (!values.length) return;
  var h = {};
  values[0].forEach(function (v, i) { h[String(v || '').trim().toUpperCase()] = i; });
  var found = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][h.SAISON_CODE] || '') === ESPN_SYNC_V1.seasonKey) { found = r + 1; break; }
  }
  var row = [
    ESPN_SYNC_V1.seasonKey, ESPN_SYNC_V1.seasonLabel, ESPN_SYNC_V1.statsSheet,
    ESPN_SYNC_V1.regularSeasonEnd, ESPN_SYNC_V1.seasonEnd, ESPN_SYNC_V1.postseasonStart,
    'JA', 'JA', 'JA', 'AKTIV'
  ];
  if (found < 0) sh.appendRow(row);
}

function buildEspnStatsRowsV1_(league, stamp) {
  var schedule = league.schedule || [];
  var names = {};
  (league.teams || []).forEach(function (team) {
    var id = String(team.id);
    var raw = team.name || [team.location, team.nickname].filter(Boolean).join(' ');
    names[id] = ESPN_TEAM_ID_MAP_V1[id] || raw;
  });
  var statIds = inferEspnStatIdsV1_(schedule);
  var grouped = {};
  schedule.forEach(function (game) {
    var week = Number(game.matchupPeriodId || 0);
    if (!week || !game.away || !game.home || !game.away.teamId || !game.home.teamId) return;
    var awayScores = espnScoreMapV1_(game.away);
    var homeScores = espnScoreMapV1_(game.home);
    if (!Object.keys(awayScores).length && !Object.keys(homeScores).length) return;
    if (!grouped[week]) grouped[week] = [];
    grouped[week].push({ game: game, away: awayScores, home: homeScores });
  });
  var rows = [];
  Object.keys(grouped).map(Number).sort(function (a, b) { return a - b; }).forEach(function (week) {
    grouped[week].sort(function (x, y) { return Number(x.game.id || 0) - Number(y.game.id || 0); });
    grouped[week].forEach(function (entry, index) {
      var game = entry.game;
      var a = names[String(game.away.teamId)] || ('ESPN Team ' + game.away.teamId);
      var b = names[String(game.home.teamId)] || ('ESPN Team ' + game.home.teamId);
      var matchup = 'W' + week + '-' + (index + 1);
      var phase = week >= ESPN_SYNC_V1.postseasonStart ? 'Postseason' : 'Regular Season';
      rows.push([
        week, matchup, a, b,
        espnStatValueV1_(entry.away, statIds.PTS), espnStatValueV1_(entry.home, statIds.PTS),
        espnStatValueV1_(entry.away, statIds.REB), espnStatValueV1_(entry.home, statIds.REB),
        espnStatValueV1_(entry.away, statIds.AST), espnStatValueV1_(entry.home, statIds.AST),
        espnStatValueV1_(entry.away, statIds['3PM']), espnStatValueV1_(entry.home, statIds['3PM']),
        espnStatValueV1_(entry.away, statIds.STL), espnStatValueV1_(entry.home, statIds.STL),
        espnStatValueV1_(entry.away, statIds.BLK), espnStatValueV1_(entry.home, statIds.BLK),
        espnStatValueV1_(entry.away, statIds['FG%']), espnStatValueV1_(entry.home, statIds['FG%']),
        espnStatValueV1_(entry.away, statIds['FT%']), espnStatValueV1_(entry.home, statIds['FT%']),
        'ESPN Auto-Sync · ' + phase + ' · ' + stamp
      ]);
    });
  });
  return rows;
}

function buildEspnScheduleRowsV1_(league) {
  var names = {};
  (league.teams || []).forEach(function (team) {
    var id = String(team.id);
    var raw = team.name || [team.location, team.nickname].filter(Boolean).join(' ');
    names[id] = ESPN_TEAM_ID_MAP_V1[id] || raw;
  });
  var grouped = {};
  (league.schedule || []).forEach(function (game) {
    var week = Number(game.matchupPeriodId || 0);
    if (!week || week > ESPN_SYNC_V1.regularSeasonEnd || !game.away || !game.home || !game.away.teamId || !game.home.teamId) return;
    if (!grouped[week]) grouped[week] = [];
    grouped[week].push(game);
  });
  var rows = [];
  Object.keys(grouped).map(Number).sort(function (a, b) { return a - b; }).forEach(function (week) {
    grouped[week].sort(function (a, b) { return Number(a.id || 0) - Number(b.id || 0); });
    grouped[week].forEach(function (game, index) {
      rows.push([
        ESPN_SYNC_V1.seasonLabel,
        week,
        'W' + week + '-' + (index + 1),
        fantasyWeekWindowV30_(week).start,
        null,
        names[String(game.away.teamId)] || ('ESPN Team ' + game.away.teamId),
        names[String(game.home.teamId)] || ('ESPN Team ' + game.home.teamId)
      ]);
    });
  });
  return rows;
}

function buildEspnResultsRowsV1_(statsRows) {
  return (statsRows || []).map(function (row) {
    var a = 0, b = 0, compared = 0;
    for (var i = 4; i <= 19; i += 2) {
      var x = row[i], y = row[i + 1];
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      compared++;
      if (x > y) a++; else b++; // Gleichstand geht bewusst ans Heimteam.
    }
    var phase = Number(row[0]) >= ESPN_SYNC_V1.postseasonStart ? 'Postseason' : 'Regular Season';
    var winner = compared ? (a > b ? row[2] : row[3]) : null;
    return [row[0], phase, row[1], row[2], row[3], a, b, winner];
  });
}

function espnScoreMapV1_(side) {
  var src = side && side.cumulativeScore && side.cumulativeScore.scoreByStat;
  if (!src || typeof src !== 'object') return {};
  var out = {};
  Object.keys(src).forEach(function (key) {
    var value = src[key];
    if (value && typeof value === 'object' && value.score !== undefined) value = value.score;
    value = Number(value);
    if (!isNaN(value)) out[String(key)] = value;
  });
  return out;
}

function inferEspnStatIdsV1_(schedule) {
  var out = { PTS: '0', BLK: '1', STL: '2', AST: '3', REB: '6', '3PM': '12', 'FG%': '17', 'FT%': '18' };
  var samples = {};
  (schedule || []).forEach(function (game) {
    [game.away, game.home].forEach(function (side) {
      var map = espnScoreMapV1_(side);
      Object.keys(map).forEach(function (key) {
        if (!samples[key]) samples[key] = [];
        samples[key].push(map[key]);
      });
    });
  });
  var fixed = { '0': true, '1': true, '2': true, '3': true, '6': true };
  var candidates = Object.keys(samples).filter(function (key) { return !fixed[key] && samples[key].length; });
  function median(list) {
    var x = list.slice().sort(function (a, b) { return a - b; });
    return x[Math.floor(x.length / 2)];
  }
  var pct = candidates.filter(function (key) {
    var nonZero = samples[key].filter(function (v) { return v > 0; });
    return nonZero.length && median(nonZero) <= 1.2;
  }).sort(function (a, b) { return median(samples[a]) - median(samples[b]); });
  if (pct.length >= 2) {
    out['FG%'] = pct[0];
    out['FT%'] = pct[pct.length - 1];
  }
  var used = {};
  [out.PTS, out.BLK, out.STL, out.AST, out.REB, out['FG%'], out['FT%']].forEach(function (id) { used[String(id)] = true; });
  var counting = candidates.filter(function (key) {
    return !used[key] && samples[key].some(function (v) { return v > 1.2; });
  });
  if (counting.length === 1) out['3PM'] = counting[0];
  return out;
}

function espnStatValueV1_(map, statId) {
  if (statId === null || statId === undefined || map[String(statId)] === undefined) return null;
  return map[String(statId)];
}

function upsertEspnStatsRowsV1_(rows) {
  if (!rows.length) return 0;
  var sh = book().getSheetByName(ESPN_SYNC_V1.statsSheet);
  var last = Math.max(1, sh.getLastRow());
  var existing = last > 1 ? sh.getRange(2, 1, last - 1, ESPN_STATS_HEADER_V1.length).getValues() : [];
  var byKey = {};
  existing.forEach(function (row, index) {
    if (!row[0] || !row[2] || !row[3]) return;
    byKey[String(row[0]) + '|' + row[2] + '|' + row[3]] = index + 2;
  });
  var append = [], updated = 0;
  rows.forEach(function (row) {
    var key = String(row[0]) + '|' + row[2] + '|' + row[3];
    var rowNo = byKey[key];
    if (rowNo) sh.getRange(rowNo, 1, 1, row.length).setValues([row]);
    else append.push(row);
    updated++;
  });
  if (append.length) sh.getRange(sh.getLastRow() + 1, 1, append.length, ESPN_STATS_HEADER_V1.length).setValues(append);
  sh.getRange(2, 17, Math.max(1, sh.getLastRow() - 1), 4).setNumberFormat('0.0000');
  return updated;
}

function validateEspnScheduleRowsV33_(rows) {
  var gamesPerWeek = 4, expectedRows = ESPN_SYNC_V1.regularSeasonEnd * gamesPerWeek;
  if (!Array.isArray(rows) || rows.length !== expectedRows) {
    throw new Error('ESPN-FBA-Spielplan unvollständig: erwartet werden exakt ' + expectedRows + ' Matchups aus 18 Wochen mit je vier Paarungen.');
  }
  var byWeek = {}, matchupIds = {}, referenceTeams = '';
  rows.forEach(function (row, index) {
    var week = Number(row && row[1]), matchupId = String(row && row[2] || '').trim();
    var away = String(row && row[5] || '').trim(), home = String(row && row[6] || '').trim();
    if (String(row && row[0] || '') !== ESPN_SYNC_V1.seasonLabel || week !== Math.floor(week) || week < 1 || week > ESPN_SYNC_V1.regularSeasonEnd) {
      throw new Error('ESPN-FBA-Spielplan fehlerhaft: ungültige Saison oder Woche in Zeile ' + (index + 1) + '.');
    }
    if (!matchupId || matchupIds[matchupId]) throw new Error('ESPN-FBA-Spielplan fehlerhaft: Matchup-ID fehlt oder ist doppelt (' + matchupId + ').');
    if (!away || !home || away === home) throw new Error('ESPN-FBA-Spielplan fehlerhaft: ungültige Paarung in Woche ' + week + '.');
    matchupIds[matchupId] = true;
    if (!byWeek[week]) byWeek[week] = { count: 0, teams: {} };
    if (byWeek[week].teams[away] || byWeek[week].teams[home]) {
      throw new Error('ESPN-FBA-Spielplan fehlerhaft: Team in Woche ' + week + ' mehrfach angesetzt.');
    }
    byWeek[week].count++;
    byWeek[week].teams[away] = true;
    byWeek[week].teams[home] = true;
  });
  for (var week = 1; week <= ESPN_SYNC_V1.regularSeasonEnd; week++) {
    var bucket = byWeek[week], teams = bucket ? Object.keys(bucket.teams).sort() : [];
    if (!bucket || bucket.count !== gamesPerWeek || teams.length !== 8) {
      throw new Error('ESPN-FBA-Spielplan unvollständig: Woche ' + week + ' braucht vier Paarungen und acht eindeutige Teams.');
    }
    var signature = teams.join('|');
    if (!referenceTeams) referenceTeams = signature;
    else if (signature !== referenceTeams) throw new Error('ESPN-FBA-Spielplan fehlerhaft: der Teamkreis wechselt in Woche ' + week + '.');
  }
  return rows;
}

function upsertEspnScheduleRowsV1_(rows) {
  validateEspnScheduleRowsV33_(rows);
  var sh = book().getSheetByName(ESPN_SYNC_V1.scheduleSheet);
  if (!sh) throw new Error('ESPN-FBA-Spielplan-Sheet fehlt.');
  var previousLast = sh.getLastRow();
  sh.getRange(2, 1, rows.length, ESPN_SCHEDULE_HEADER_V1.length).setValues(rows);
  if (previousLast > rows.length + 1) {
    sh.getRange(rows.length + 2, 1, previousLast - rows.length - 1, ESPN_SCHEDULE_HEADER_V1.length).clearContent();
  }
  return rows.length;
}

function upsertEspnResultsRowsV1_(rows) {
  var sh = book().getSheetByName(ESPN_SYNC_V1.resultsSheet);
  if (!sh || !rows.length) return 0;
  var last = sh.getLastRow();
  var existing = last > 1 ? sh.getRange(2, 1, last - 1, ESPN_RESULTS_HEADER_V1.length).getValues() : [];
  var byKey = {};
  existing.forEach(function (row, index) { if (row[0] && row[2]) byKey[row[0] + '|' + row[2]] = index + 2; });
  var append = [];
  rows.forEach(function (row) {
    var key = row[0] + '|' + row[2], rowNo = byKey[key];
    if (rowNo) sh.getRange(rowNo, 1, 1, row.length).setValues([row]);
    else append.push(row);
  });
  if (append.length) sh.getRange(sh.getLastRow() + 1, 1, append.length, ESPN_RESULTS_HEADER_V1.length).setValues(append);
  return rows.length;
}

function updateCurrentSeasonControlV1_(rows) {
  var sh = book().getSheetByName(ESPN_SYNC_V1.configSheet);
  if (!sh || !rows.length) return;
  var values = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 2).getValues();
  var index = {};
  values.forEach(function (row, i) { if (row[0]) index[String(row[0]).toUpperCase()] = i + 2; });
  var currentWeek = rows.reduce(function (max, row) { return Math.max(max, Number(row[0]) || 0); }, 0);
  var phase = currentWeek >= ESPN_SYNC_V1.postseasonStart ? 'POSTSEASON' : 'REGULAR_SEASON';
  var updates = {
    AKTUELLE_SAISON: ESPN_SYNC_V1.seasonLabel,
    SAISON_CODE: ESPN_SYNC_V1.seasonKey,
    AKTUELLE_WOCHE: currentWeek,
    PHASE: phase,
    LETZTE_AENDERUNG: Utilities.formatDate(new Date(), ESPN_SYNC_V1.timezone, 'dd.MM.yyyy HH:mm') + ' · ESPN Auto-Sync'
  };
  Object.keys(updates).forEach(function (key) {
    if (index[key]) sh.getRange(index[key], 2).setValue(updates[key]);
  });
}

function appendEspnLogV1_(stamp, status, matchups, rows, detail) {
  try {
    var sh = book().getSheetByName(ESPN_SYNC_V1.logSheet);
    sh.appendRow([stamp, status, ESPN_SYNC_V1.seasonKey, matchups, rows, detail]);
    if (sh.getLastRow() > 201) sh.deleteRows(2, sh.getLastRow() - 201);
  } catch (e) {}
}

function clearEspnDependentCachesV1_() {
  var cache = CacheService.getScriptCache();
  cache.remove(DATA_CACHE_PREFIX + 'idx');
  cache.remove(ANALYTICS_CACHE_KEY_V1);
  cache.remove(CONFIG_CACHE_KEY_PHASE_V1);
  if (typeof MATCHUP_MONSTER_V30 !== 'undefined' && MATCHUP_MONSTER_V30.scheduleCacheKey) {
    for (var week = 1; week <= MATCHUP_MONSTER_V30.maxWeek; week++) cache.remove(MATCHUP_MONSTER_V30.scheduleCacheKey + week);
  }
  _g = {};
  _map = null;
}

function applyConfiguredSeasonV1_(cfg) {
  if (!cfg || !cfg.seasonCode) return;
  var sh = book().getSheetByName(cfg.seasonCode + ' StatsRaw');
  if (!sh || sh.getLastRow() < 2) return;
  var rows = sh.getRange(2, 1, Math.min(sh.getLastRow() - 1, 20), Math.min(sh.getLastColumn(), 20)).getValues();
  var hasStats = rows.some(function (row) {
    if (!row[0]) return false;
    for (var c = 4; c < row.length; c++) if (typeof row[c] === 'number') return true;
    return false;
  });
  if (!hasStats) return;
  SEASON = String(cfg.seasonCode);
  SEASON_LABEL = String(cfg.currentSeason || cfg.seasonCode).replace('/', '-');
  if (SEASON_KEYS.indexOf(SEASON) < 0) SEASON_KEYS.push(SEASON);
}

function showEspnSyncStatus() {
  var s = getEspnSyncStatus_();
  var text = 'Automatik: ' + (s.enabled ? 'AKTIV' : 'NICHT INSTALLIERT') +
    '\nLiga: ' + s.leagueId + ' · Saison ' + s.seasonId +
    '\nLetzter Versuch: ' + (s.lastAttempt || '–') +
    '\nLetzter Erfolg: ' + (s.lastSuccess || '–') +
    '\nStatus: ' + s.lastStatus +
    '\nMatchups: ' + s.lastRows +
    '\nPlayer Hub: ' + (s.playerStatus || '–') +
    '\nSpieler / Kader / Transaktionen: ' + (s.playerCount || 0) + ' / ' + (s.rosterCount || 0) + ' / ' + (s.transactionCount || 0) +
    '\nNächster Prüftakt: ' + (s.nextIntervalMinutes || 60) + ' Minuten' +
    (s.lastError ? '\nFehler: ' + s.lastError : '');
  try { SpreadsheetApp.getUi().alert('ESPN Sync', text, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return text;
}

/* ================= ESPN PLAYER HUB v2 =================
 * Eigenständige Erweiterung des stabilen Matchup-Syncs:
 *  - Fantasy-Spielerpool, Kader und Transaktionen
 *  - tägliche NBA-Boxscores für ALLE Spieler (inkl. Free Agents)
 *  - Spieler des Abends, positionslose Starting Five und Pick-up Score
 *
 * Fällt dieses Modul aus, wird der bestehende Matchup-Sync trotzdem beendet.
 * Bilder bleiben als ESPN-CDN-URLs referenziert und werden nicht in die App kopiert.
 */
var ESPN_PLAYER_HUB_V2 = {
  playersSheet: 'ESPN_Players',
  rosterSheet: 'ESPN_Roster_Current',
  rosterHistorySheet: 'ESPN_Roster_History',
  transactionsSheet: 'ESPN_Transactions',
  dailySheet: 'ESPN_Player_Daily',
  nbaTimezone: 'America/New_York',
  nightStartHour: 20,
  nightEndHour: 10,
  nightIntervalMinutes: 30,
  dayIntervalMinutes: 60
};

var ESPN_PLAYER_HEADERS_V2 = [
  'season_id','player_id','full_name','nba_team_id','positions','injury_status',
  'ownership_status','owner_team_id','owner_team','headshot_url','last_seen'
];
var ESPN_ROSTER_HEADERS_V2 = [
  'season_id','scoring_period','matchup_period','team_id','team','player_id','player_name',
  'lineup_slot_id','active_lineup','acquisition_type','acquisition_date','headshot_url','last_seen'
];
var ESPN_ROSTER_HISTORY_HEADERS_V2 = ['snapshot_id','snapshot_time'].concat(ESPN_ROSTER_HEADERS_V2);
var ESPN_TRANSACTION_HEADERS_V2 = [
  'season_id','transaction_id','processed_at','scoring_period','matchup_period','status','transaction_type',
  'event_type','player_id','player_name','from_team_id','from_team','to_team_id','to_team',
  'from_slot_id','to_slot_id','bid_amount','last_seen'
];
var ESPN_DAILY_HEADERS_V2 = [
  'season_id','nba_date','scoring_period','matchup_period','event_id','event_status','player_id','player_name',
  'nba_team','owner_team_id','owner_team','lineup_slot_id','active_lineup',
  'PTS','REB','AST','3PM','STL','BLK','FGM','FGA','FTM','FTA','FG%','FT%','headshot_url','updated_at'
];

function espnHeadshotV2_(playerId) {
  return playerId ? 'https://a.espncdn.com/i/headshots/nba/players/full/' + encodeURIComponent(String(playerId)) + '.png' : '';
}

function ensureEspnPlayerHubSheetsV2_() {
  ensureSimpleEspnSheetV1_(ESPN_PLAYER_HUB_V2.playersSheet, ESPN_PLAYER_HEADERS_V2);
  ensureSimpleEspnSheetV1_(ESPN_PLAYER_HUB_V2.rosterSheet, ESPN_ROSTER_HEADERS_V2);
  ensureSimpleEspnSheetV1_(ESPN_PLAYER_HUB_V2.rosterHistorySheet, ESPN_ROSTER_HISTORY_HEADERS_V2);
  ensureSimpleEspnSheetV1_(ESPN_PLAYER_HUB_V2.transactionsSheet, ESPN_TRANSACTION_HEADERS_V2);
  ensureSimpleEspnSheetV1_(ESPN_PLAYER_HUB_V2.dailySheet, ESPN_DAILY_HEADERS_V2);
  ensureDraftPredictionSheetV3_();
}

function replaceEspnRowsV2_(sheetName, header, rows) {
  var sh = ensureSimpleEspnSheetV1_(sheetName, header);
  var oldRows = Math.max(0, sh.getLastRow() - 1);
  if (oldRows) sh.getRange(2, 1, oldRows, header.length).clearContent();
  if (rows && rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  return rows ? rows.length : 0;
}

function appendUniqueEspnRowsV2_(sheetName, header, rows, keyIndexes) {
  if (!rows || !rows.length) return 0;
  var sh = ensureSimpleEspnSheetV1_(sheetName, header), last = sh.getLastRow(), existing = {};
  if (last > 1) {
    sh.getRange(2, 1, last - 1, header.length).getValues().forEach(function (row) {
      existing[keyIndexes.map(function (i) { return String(row[i] == null ? '' : row[i]); }).join('|')] = true;
    });
  }
  var fresh = rows.filter(function (row) {
    var key = keyIndexes.map(function (i) { return String(row[i] == null ? '' : row[i]); }).join('|');
    if (existing[key]) return false;
    existing[key] = true;
    return true;
  });
  if (fresh.length) sh.getRange(sh.getLastRow() + 1, 1, fresh.length, header.length).setValues(fresh);
  return fresh.length;
}

function upsertEspnRowsV2_(sheetName, header, rows, keyIndexes, preserveIndexes) {
  if (!rows || !rows.length) return 0;
  var sh = ensureSimpleEspnSheetV1_(sheetName, header), last = sh.getLastRow(), existing = [], byKey = {};
  if (last > 1) existing = sh.getRange(2, 1, last - 1, header.length).getValues();
  existing.forEach(function (row, i) {
    byKey[keyIndexes.map(function (x) { return String(row[x] == null ? '' : row[x]); }).join('|')] = i;
  });
  rows.forEach(function (incoming) {
    var key = keyIndexes.map(function (x) { return String(incoming[x] == null ? '' : incoming[x]); }).join('|');
    var idx = byKey[key];
    if (idx === undefined) {
      byKey[key] = existing.length;
      existing.push(incoming);
    } else {
      var merged = incoming.slice();
      (preserveIndexes || []).forEach(function (p) {
        if (existing[idx][p] !== '' && existing[idx][p] != null) merged[p] = existing[idx][p];
      });
      existing[idx] = merged;
    }
  });
  replaceEspnRowsV2_(sheetName, header, existing);
  return rows.length;
}

function fetchEspnJsonV2_(url, headers) {
  var res = UrlFetchApp.fetch(url, {
    method: 'get', headers: headers || { Accept: 'application/json' }, muteHttpExceptions: true, followRedirects: true
  });
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('ESPN Player Hub HTTP ' + code + ': ' + res.getContentText().slice(0, 220));
  return JSON.parse(res.getContentText());
}

function espnFantasyPlayerEndpointV2_() {
  return 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/' + ESPN_SYNC_V1.seasonId +
    '/segments/0/leagues/' + ESPN_SYNC_V1.leagueId +
    '?view=kona_player_info&view=mTeam&view=mRoster&view=mTransactions2&view=mSettings';
}

function fetchEspnFantasyHubV2_() {
  return fetchEspnJsonV2_(espnFantasyPlayerEndpointV2_(), {
    Accept: 'application/json',
    'X-Fantasy-Filter': JSON.stringify({
      players: { limit: 2500, sortPercOwned: { sortPriority: 1, sortAsc: false } },
      transactions: { limit: 1000 }
    })
  });
}

function fantasyTeamNamesV2_(league) {
  var out = {};
  (league.teams || []).forEach(function (team) {
    out[String(team.id)] = ESPN_TEAM_ID_MAP_V1[String(team.id)] ||
      String(((team.location || '') + ' ' + (team.nickname || '')).trim() || team.name || ('Team ' + team.id));
  });
  return out;
}

function normalizeFantasyPlayerV2_(entry) {
  var pool = entry && entry.playerPoolEntry ? entry.playerPoolEntry : entry || {};
  var p = pool.player || entry.player || entry || {};
  var id = p.id != null ? p.id : (pool.playerId != null ? pool.playerId : entry.playerId);
  var fullName = p.fullName || p.displayName || p.name || entry.playerName || '';
  var slots = p.eligibleSlots || pool.eligibleSlots || [];
  var positions = (p.defaultPositionId != null ? [p.defaultPositionId] : []).concat(slots || []);
  var headshot = p.headshot && typeof p.headshot === 'object' ? p.headshot.href : p.headshot;
  headshot = headshot || espnHeadshotV2_(id);
  return {
    id: id == null ? '' : String(id), name: String(fullName || ''), proTeamId: p.proTeamId == null ? '' : p.proTeamId,
    positions: positions.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(','),
    injuryStatus: p.injuryStatus || p.injuryDesignation || '', status: pool.status || entry.status || '',
    onTeamId: pool.onTeamId == null ? (entry.onTeamId == null ? '' : entry.onTeamId) : pool.onTeamId,
    headshot: String(headshot || '')
  };
}

function collectFantasyPlayersV2_(league, stamp) {
  var names = fantasyTeamNamesV2_(league), seen = {}, rows = [];
  function add(entry) {
    var p = normalizeFantasyPlayerV2_(entry || {}); if (!p.id || !p.name || seen[p.id]) return;
    seen[p.id] = true;
    var ownerId = p.onTeamId === '' || Number(p.onTeamId) < 0 ? '' : String(p.onTeamId);
    rows.push([ESPN_SYNC_V1.seasonId,p.id,p.name,p.proTeamId,p.positions,p.injuryStatus,
      ownerId ? 'ROSTERED' : (p.status || 'FREE AGENT'),ownerId,ownerId ? (names[ownerId] || '') : '',p.headshot,stamp]);
  }
  (league.players || []).forEach(add);
  (league.teams || []).forEach(function (team) {
    (((team.roster || {}).entries) || []).forEach(add);
  });
  return rows;
}

function collectFantasyRosterV2_(league, stamp) {
  var names = fantasyTeamNamesV2_(league), scoring = Number((league.status || {}).currentScoringPeriod || 0),
    matchup = Number((league.status || {}).currentMatchupPeriod || 0), rows = [];
  (league.teams || []).forEach(function (team) {
    (((team.roster || {}).entries) || []).forEach(function (entry) {
      var p = normalizeFantasyPlayerV2_(entry), slot = entry.lineupSlotId == null ? '' : Number(entry.lineupSlotId);
      rows.push([ESPN_SYNC_V1.seasonId,scoring,matchup,String(team.id),names[String(team.id)] || '',p.id,p.name,slot,
        slot !== '' && slot <= 11,entry.acquisitionType || '',entry.acquisitionDate || '',p.headshot,stamp]);
    });
  });
  return rows;
}

function collectFantasyTransactionsV2_(league, stamp) {
  var names = fantasyTeamNamesV2_(league), players = {}, matchup = Number((league.status || {}).currentMatchupPeriod || 0), rows = [];
  collectFantasyPlayersV2_(league, stamp).forEach(function (r) { players[String(r[1])] = r[2]; });
  var txs = league.transactions || league.recentActivity || [];
  txs.forEach(function (tx) {
    var txId = tx.id == null ? (tx.transactionId == null ? '' : tx.transactionId) : tx.id;
    var processed = tx.processDate || tx.proposedDate || tx.executionDate || '';
    if (typeof processed === 'number') processed = new Date(processed).toISOString();
    var items = tx.items || tx.actions || [];
    if (!items.length && tx.playerId != null) items = [tx];
    items.forEach(function (item, idx) {
      var pid = item.playerId != null ? item.playerId : ((item.player || {}).id || '');
      var fromId = item.fromTeamId == null || Number(item.fromTeamId) < 0 ? '' : String(item.fromTeamId);
      var toId = item.toTeamId == null || Number(item.toTeamId) < 0 ? '' : String(item.toTeamId);
      var eventType = String(item.type || item.action || tx.type || '').toUpperCase();
      if (!eventType && toId) eventType = 'ADD';
      if (!eventType && fromId) eventType = 'DROP';
      var itemKey = txId !== '' ? String(txId) + ':' + idx : [processed,eventType,pid,fromId,toId,idx].join(':');
      rows.push([ESPN_SYNC_V1.seasonId,itemKey,processed,tx.scoringPeriodId || '',
        tx.matchupPeriodId || matchup,tx.status || '',tx.type || '',eventType,String(pid),players[String(pid)] || item.playerName || '',
        fromId,fromId ? (names[fromId] || '') : '',toId,toId ? (names[toId] || '') : '',
        item.fromLineupSlotId == null ? '' : item.fromLineupSlotId,item.toLineupSlotId == null ? '' : item.toLineupSlotId,
        tx.bidAmount == null ? '' : tx.bidAmount,stamp]);
    });
  });
  return rows;
}

function nbaScoreboardUrlV2_(dateKey) {
  return 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=100&dates=' + dateKey;
}
function nbaSummaryUrlV2_(eventId) {
  return 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=' + encodeURIComponent(String(eventId));
}
function dateKeysForNbaSyncV2_() {
  var now = new Date(), yesterday = new Date(now.getTime() - 86400000);
  return [Utilities.formatDate(yesterday, ESPN_PLAYER_HUB_V2.nbaTimezone, 'yyyyMMdd'),
    Utilities.formatDate(now, ESPN_PLAYER_HUB_V2.nbaTimezone, 'yyyyMMdd')];
}
function numberV2_(v) {
  if (v === '' || v == null || v === '--') return null;
  var n = Number(String(v).replace('%','')); return isNaN(n) ? null : n;
}
function splitMadeAttemptedV2_(value) {
  var m = String(value == null ? '' : value).match(/([0-9]+)\s*-\s*([0-9]+)/);
  return m ? [Number(m[1]),Number(m[2])] : [null,null];
}
function statIndexV2_(labels, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var idx = labels.indexOf(candidates[i]); if (idx >= 0) return idx;
  }
  return -1;
}
function parseNbaSummaryRowsV2_(summary, eventMeta, ownerMap, stamp, scoring, matchup) {
  var rows = [], eventId = String(eventMeta.id || ''), eventStatus = eventMeta.status || '', nbaDate = eventMeta.nbaDate || '';
  (((summary || {}).boxscore || {}).players || []).forEach(function (teamBlock) {
    var nbaTeam = ((teamBlock.team || {}).abbreviation || (teamBlock.team || {}).shortDisplayName || '');
    (teamBlock.statistics || []).forEach(function (group) {
      var labels = (group.names || group.labels || []).map(function (x) { return String(x || '').toUpperCase(); });
      var iPts=statIndexV2_(labels,['PTS']),iReb=statIndexV2_(labels,['REB']),iAst=statIndexV2_(labels,['AST']),
        iStl=statIndexV2_(labels,['STL']),iBlk=statIndexV2_(labels,['BLK']),iFg=statIndexV2_(labels,['FG']),
        iFt=statIndexV2_(labels,['FT']),iThree=statIndexV2_(labels,['3PT','3PM']);
      (group.athletes || []).forEach(function (ath) {
        var a = ath.athlete || ath, stats = ath.stats || [], id = a.id == null ? '' : String(a.id);
        if (!id || iPts < 0 || numberV2_(stats[iPts]) == null) return;
        var fg=splitMadeAttemptedV2_(iFg < 0 ? '' : stats[iFg]),ft=splitMadeAttemptedV2_(iFt < 0 ? '' : stats[iFt]),
          three=splitMadeAttemptedV2_(iThree < 0 ? '' : stats[iThree]), owner=ownerMap[id] || {};
        var fgp=fg[1] ? fg[0]/fg[1] : null, ftp=ft[1] ? ft[0]/ft[1] : null;
        rows.push([ESPN_SYNC_V1.seasonId,nbaDate,scoring,matchup,eventId,eventStatus,id,a.displayName || a.fullName || '',nbaTeam,
          owner.teamId || '',owner.team || '',owner.slotId == null ? '' : owner.slotId,owner.active === true,
          numberV2_(stats[iPts]),numberV2_(stats[iReb]),numberV2_(stats[iAst]),three[0],numberV2_(stats[iStl]),numberV2_(stats[iBlk]),
          fg[0],fg[1],ft[0],ft[1],fgp,ftp,(a.headshot || {}).href || espnHeadshotV2_(id),stamp]);
      });
    });
  });
  return rows;
}

function fetchNbaDailyRowsV2_(league, rosterRows, stamp) {
  var ownerMap = {};
  (rosterRows || []).forEach(function (r) { ownerMap[String(r[5])] = { teamId:r[3],team:r[4],slotId:r[7],active:r[8] === true }; });
  var scoring = Number((league.status || {}).currentScoringPeriod || 0), matchup = Number((league.status || {}).currentMatchupPeriod || 0),
    props = espnPropertiesV1_(), events = [];
  dateKeysForNbaSyncV2_().forEach(function (dateKey) {
    var board = fetchEspnJsonV2_(nbaScoreboardUrlV2_(dateKey));
    (board.events || []).forEach(function (event) {
      var type = ((event.status || {}).type || {}), state = String(type.state || '').toLowerCase();
      if (state === 'pre') return;
      var doneKey = 'FBA_NBA_EVENT_DONE_' + event.id;
      if (type.completed && props.getProperty(doneKey) === '1') return;
      var competition = (event.competitions || [])[0] || {};
      events.push({id:event.id,completed:!!type.completed,status:type.completed?'FINAL':String(type.detail || type.description || state).toUpperCase(),
        nbaDate:Utilities.formatDate(new Date(competition.date || event.date),ESPN_PLAYER_HUB_V2.nbaTimezone,'yyyy-MM-dd'),doneKey:doneKey});
    });
  });
  if (!events.length) return [];
  var requests = events.map(function (e) { return {url:nbaSummaryUrlV2_(e.id),method:'get',headers:{Accept:'application/json'},muteHttpExceptions:true,followRedirects:true}; });
  var responses = UrlFetchApp.fetchAll(requests), rows = [];
  responses.forEach(function (response, i) {
    if (response.getResponseCode() !== 200) return;
    try {
      var parsed = JSON.parse(response.getContentText());
      var eventRows = parseNbaSummaryRowsV2_(parsed, events[i], ownerMap, stamp, scoring, matchup);
      if (eventRows.length) {
        rows = rows.concat(eventRows);
        if (events[i].completed) props.setProperty(events[i].doneKey, '1');
      }
    } catch (e) {}
  });
  return rows;
}

function saveRosterHistoryV2_(rosterRows, stamp) {
  if (!rosterRows || !rosterRows.length) return 0;
  var signatureInput = rosterRows.map(function (r) { return [r[3],r[5],r[7]].join(':'); }).sort().join('|');
  var digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, signatureInput));
  var props = espnPropertiesV1_();
  if (props.getProperty('FBA_ROSTER_LAST_HASH') === digest) return 0;
  props.setProperty('FBA_ROSTER_LAST_HASH', digest);
  var snapshotId = String(ESPN_SYNC_V1.seasonId) + '-' + String(Date.now());
  var rows = rosterRows.map(function (r) { return [snapshotId,stamp].concat(r); });
  var sh = ensureSimpleEspnSheetV1_(ESPN_PLAYER_HUB_V2.rosterHistorySheet, ESPN_ROSTER_HISTORY_HEADERS_V2);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, ESPN_ROSTER_HISTORY_HEADERS_V2.length).setValues(rows);
  return rows.length;
}

function syncEspnPlayerHubV2_(stamp, coreLeague) {
  ensureEspnPlayerHubSheetsV2_();
  var result = {status:'OK',players:0,roster:0,transactions:0,dailyRows:0,errors:[]}, fantasy = coreLeague || {};
  try { fantasy = fetchEspnFantasyHubV2_(); }
  catch (e) { result.errors.push('Fantasy: ' + String(e && e.message ? e.message : e)); }
  var playerRows = [], rosterRows = [], transactionRows = [];
  try {
    playerRows = collectFantasyPlayersV2_(fantasy, stamp);
    rosterRows = collectFantasyRosterV2_(fantasy, stamp);
    transactionRows = collectFantasyTransactionsV2_(fantasy, stamp);
    if (playerRows.length) replaceEspnRowsV2_(ESPN_PLAYER_HUB_V2.playersSheet, ESPN_PLAYER_HEADERS_V2, playerRows);
    if (rosterRows.length || ((fantasy || {}).teams || []).length) replaceEspnRowsV2_(ESPN_PLAYER_HUB_V2.rosterSheet, ESPN_ROSTER_HEADERS_V2, rosterRows);
    saveRosterHistoryV2_(rosterRows, stamp);
    appendUniqueEspnRowsV2_(ESPN_PLAYER_HUB_V2.transactionsSheet, ESPN_TRANSACTION_HEADERS_V2, transactionRows, [0,1]);
    result.players = playerRows.length; result.roster = rosterRows.length; result.transactions = transactionRows.length;
  } catch (e2) { result.errors.push('Kader/Transaktionen: ' + String(e2 && e2.message ? e2.message : e2)); }
  try {
    var dailyRows = fetchNbaDailyRowsV2_(fantasy, rosterRows, stamp);
    /* Besitzer, Slot und Aktivstatus des ersten Abrufs nach Spielbeginn bleiben erhalten. */
    upsertEspnRowsV2_(ESPN_PLAYER_HUB_V2.dailySheet, ESPN_DAILY_HEADERS_V2, dailyRows, [0,1,4,6], [9,10,11,12]);
    result.dailyRows = dailyRows.length;
  } catch (e3) { result.errors.push('NBA-Boxscores: ' + String(e3 && e3.message ? e3.message : e3)); }
  if (result.errors.length) { result.status = result.players || result.roster || result.dailyRows ? 'TEILERFOLG' : 'TEILFEHLER'; result.error = result.errors.join(' | ').slice(0,500); }
  espnPropertiesV1_().setProperties({
    FBA_ESPN_PLAYER_STATUS:result.status,FBA_ESPN_PLAYER_ERROR:result.error || '',FBA_ESPN_PLAYER_COUNT:String(result.players),
    FBA_ESPN_ROSTER_COUNT:String(result.roster),FBA_ESPN_TRANSACTION_COUNT:String(result.transactions),FBA_ESPN_DAILY_COUNT:String(result.dailyRows)
  });
  return result;
}

function sheetObjectsV2_(sheetName) {
  var sh = book().getSheetByName(sheetName); if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getDataRange().getValues(), header = values.shift().map(function (h) { return String(h || ''); });
  return values.filter(function (r) { return r.some(function (v) { return v !== '' && v != null; }); }).map(function (r) {
    var out = {}; header.forEach(function (h, i) { out[h] = r[i]; }); return out;
  });
}
function meanV2_(values) { return values.length ? values.reduce(function (a,b) { return a+b; },0)/values.length : 0; }
function stdV2_(values, mean) {
  if (values.length < 2) return 1;
  var v = Math.sqrt(values.reduce(function (s,x) { return s + Math.pow(x-mean,2); },0)/values.length); return v || 1;
}
function scorePlayerGroupsV2_(rows) {
  var groups = {};
  (rows || []).forEach(function (r) {
    var id=String(r.player_id || ''),g=groups[id]; if (!id) return;
    if (!g) g=groups[id]={id:id,name:r.player_name || '',photo:r.headshot_url || espnHeadshotV2_(id),owner:r.owner_team || 'FREE AGENT',games:0,
      PTS:0,REB:0,AST:0,'3PM':0,STL:0,BLK:0,FGM:0,FGA:0,FTM:0,FTA:0};
    g.games++;
    ['PTS','REB','AST','3PM','STL','BLK','FGM','FGA','FTM','FTA'].forEach(function (k) { g[k] += Number(r[k] || 0); });
    g.owner = r.owner_team || 'FREE AGENT'; if (r.headshot_url) g.photo = r.headshot_url;
  });
  var list=Object.keys(groups).map(function (k) { return groups[k]; }); if (!list.length) return [];
  var totalFgm=list.reduce(function(s,p){return s+p.FGM;},0),totalFga=list.reduce(function(s,p){return s+p.FGA;},0),
    totalFtm=list.reduce(function(s,p){return s+p.FTM;},0),totalFta=list.reduce(function(s,p){return s+p.FTA;},0),
    leagueFg=totalFga?totalFgm/totalFga:0,leagueFt=totalFta?totalFtm/totalFta:0;
  list.forEach(function(p){p.FG_IMPACT=p.FGM-leagueFg*p.FGA;p.FT_IMPACT=p.FTM-leagueFt*p.FTA;});
  var metrics=['PTS','REB','AST','3PM','STL','BLK','FG_IMPACT','FT_IMPACT'],stats={};
  metrics.forEach(function(k){var vals=list.map(function(p){return Number(p[k]||0);});var m=meanV2_(vals);stats[k]={mean:m,std:stdV2_(vals,m)};});
  list.forEach(function(p){p.rawScore=metrics.reduce(function(s,k){return s+(Number(p[k]||0)-stats[k].mean)/stats[k].std;},0);});
  list.sort(function(a,b){return b.rawScore-a.rawScore||b.PTS-a.PTS||a.name.localeCompare(b.name);});
  var n=list.length;
  list.forEach(function(p,i){p.rank=i+1;p.score=n===1?100:Math.round((n-1-i)/(n-1)*100);p.stats={PTS:p.PTS,REB:p.REB,AST:p.AST,'3PM':p['3PM'],STL:p.STL,BLK:p.BLK};});
  return list;
}
function displayNbaDateV2_(iso) {
  var m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3]+'.'+m[2]+'.'+m[1] : String(iso||'');
}

function transactionTimeV2_(tx) {
  var v=tx.processed_at;if(v instanceof Date)return v.getTime();var t=new Date(v).getTime();return isNaN(t)?0:t;
}
function dayEndTimeV2_(iso) { var t=new Date(String(iso||'')+'T23:59:59Z').getTime();return isNaN(t)?0:t; }
function pickupFantasyValueV2_(r) {
  var fgImpact=Number(r.FGM||0)-0.47*Number(r.FGA||0),ftImpact=Number(r.FTM||0)-0.79*Number(r.FTA||0);
  return Number(r.PTS||0)+1.2*Number(r.REB||0)+1.5*Number(r.AST||0)+0.7*Number(r['3PM']||0)+3*Number(r.STL||0)+3*Number(r.BLK||0)+2.4*fgImpact+1.8*ftImpact;
}
function percentileMetricV2_(list, key, value) {
  var vals=list.map(function(x){return Number(x[key]||0);}).sort(function(a,b){return a-b;});if(!vals.length)return 0;
  var below=vals.filter(function(x){return x<value;}).length,equal=vals.filter(function(x){return x===value;}).length;
  return vals.length===1?100:100*(below+Math.max(0,equal-1)/2)/(vals.length-1);
}
function buildPickupPayloadV2_(daily, transactions) {
  var matchup=daily.reduce(function(m,r){return Math.max(m,Number(r.matchup_period||0));},0),weekRows=daily.filter(function(r){return Number(r.matchup_period||0)===matchup;});
  var txs=(transactions||[]).filter(function(t){return !matchup||!t.matchup_period||Number(t.matchup_period)===matchup;}).sort(function(a,b){return transactionTimeV2_(a)-transactionTimeV2_(b);});
  var teams=Object.keys(ESPN_TEAM_ID_MAP_V1).map(function(id){return ESPN_TEAM_ID_MAP_V1[id];}),metrics=[];
  teams.forEach(function(team){
    var adds=txs.filter(function(t){return String(t.event_type).toUpperCase().indexOf('ADD')>=0&&t.to_team===team;}),
      drops=txs.filter(function(t){return String(t.event_type).toUpperCase().indexOf('DROP')>=0&&t.from_team===team;}),
      activeGames=0,availableGames=0,pickupValue=0,regretValue=0,best=null,worst=null;
    adds.forEach(function(add){
      var start=transactionTimeV2_(add),nextDrop=txs.find(function(t){return transactionTimeV2_(t)>start&&String(t.player_id)===String(add.player_id)&&t.from_team===team&&String(t.event_type).toUpperCase().indexOf('DROP')>=0;}),end=nextDrop?transactionTimeV2_(nextDrop):Infinity;
      var playerRows=weekRows.filter(function(r){var time=dayEndTimeV2_(r.nba_date);return String(r.player_id)===String(add.player_id)&&time>=start&&time<end;});
      var actual=playerRows.filter(function(r){return r.owner_team===team&&(r.active_lineup===true||String(r.active_lineup).toUpperCase()==='TRUE');});
      var val=actual.reduce(function(s,r){return s+pickupFantasyValueV2_(r);},0);availableGames+=playerRows.length;activeGames+=actual.length;pickupValue+=val;
      if(!best||val>best.value)best={name:add.player_name||'',value:val,games:actual.length};
    });
    drops.forEach(function(drop){
      var start=transactionTimeV2_(drop),readd=txs.find(function(t){return transactionTimeV2_(t)>start&&String(t.player_id)===String(drop.player_id)&&t.to_team===team&&String(t.event_type).toUpperCase().indexOf('ADD')>=0;}),end=readd?transactionTimeV2_(readd):Infinity;
      var val=weekRows.filter(function(r){var time=dayEndTimeV2_(r.nba_date);return String(r.player_id)===String(drop.player_id)&&time>=start&&time<end;})
        .reduce(function(s,r){return s+pickupFantasyValueV2_(r);},0);regretValue+=val;if(!worst||val>worst.value)worst={name:drop.player_name||'',value:val};
    });
    metrics.push({team:team,moves:adds.length,gamesAdded:activeGames,availableGames:availableGames,lineupHitRate:availableGames?activeGames/availableGames:0,
      pickupValue:pickupValue,dropRegretValue:regretValue,netImpact:pickupValue-regretValue,efficiency:adds.length?(pickupValue-regretValue)/adds.length:0,bestPickup:best,dropRegret:worst});
  });
  var scored=metrics.filter(function(x){return x.moves>0;});
  scored.forEach(function(x){x.score=Math.max(0,Math.min(100,Math.round(.45*percentileMetricV2_(scored,'netImpact',x.netImpact)+.25*percentileMetricV2_(scored,'efficiency',x.efficiency)+.20*percentileMetricV2_(scored,'gamesAdded',x.gamesAdded)+.10*percentileMetricV2_(scored,'lineupHitRate',x.lineupHitRate))));x.netImpactLabel=(x.netImpact>=0?'+':'')+Math.round(x.netImpact);});
  scored.sort(function(a,b){return b.score-a.score||b.netImpact-a.netImpact||a.team.localeCompare(b.team);});scored.forEach(function(x,i){x.rank=i+1;});
  var byTeam={};metrics.forEach(function(x){byTeam[x.team]=x;});
  return {label:matchup?'Matchup '+matchup:'Bereit ab Woche 1',matchupPeriod:matchup,rankings:scored,teams:byTeam,
    model:{status:'BETA',weights:{netImpact:.45,efficiency:.25,gamesAdded:.20,lineupHitRate:.10}}};
}

function buildPlayerHubPayloadV2_() {
  try {
    var daily=sheetObjectsV2_(ESPN_PLAYER_HUB_V2.dailySheet),tx=sheetObjectsV2_(ESPN_PLAYER_HUB_V2.transactionsSheet),props=espnPropertiesV1_(),awards={};
    if(daily.length){
      var lastDate=daily.reduce(function(m,r){return String(r.nba_date)>m?String(r.nba_date):m;},''),dayRows=daily.filter(function(r){return String(r.nba_date)===lastDate;}),day=scorePlayerGroupsV2_(dayRows)[0],
        matchup=daily.reduce(function(m,r){return Math.max(m,Number(r.matchup_period||0));},0),week=scorePlayerGroupsV2_(daily.filter(function(r){return Number(r.matchup_period||0)===matchup;}));
      if(day)awards.daily={date:lastDate,label:displayNbaDateV2_(lastDate),player:day,score:day.score,stats:day.stats};
      if(week.length)awards.weekly={matchupPeriod:matchup,label:'Matchup '+matchup,players:week.slice(0,5)};
    }
    return {status:{lastSuccess:props.getProperty('FBA_ESPN_PLAYER_LAST_SUCCESS')||null,lastStatus:props.getProperty('FBA_ESPN_PLAYER_STATUS')||'BEREIT',players:Number(props.getProperty('FBA_ESPN_PLAYER_COUNT')||0),
      roster:Number(props.getProperty('FBA_ESPN_ROSTER_COUNT')||0),transactions:Number(props.getProperty('FBA_ESPN_TRANSACTION_COUNT')||0),dailyRows:daily.length},awards:awards,pickup:buildPickupPayloadV2_(daily,tx)};
  } catch(e){return {status:{lastStatus:'PAYLOAD_FEHLER',error:String(e)},awards:{},pickup:{label:'Bereit ab Woche 1',rankings:[],teams:{}}};}
}

/* Letzte Definition gewinnt: der bestehende Payload erhält nur ein Zusatzmodul. */
function enhancePayloadPhaseV1(data, cfg) {
  data.appConfig = cfg;
  data.draft = buildDraftDataPhaseV2(cfg, data.eternal && data.eternal.RS, data.duels);
  data.analytics = buildAnalyticsHistoryV1();
  data.espnSync = getEspnSyncStatus_();
  data.playerHub = buildPlayerHubPayloadV2_();
  data.draftPredictions = buildDraftPredictionsV3_();
  data.draftTop10 = buildDraftTop10V5_();
  data.draftTop3 = data.draftTop10.slice(0,3);
  return data;
}

/* Aktueller externer Draft-Konsens. Bewusst getrennt von Maiks persönlicher
 * Acht-Pick-Prognose. score = transparenter Heat-Index, keine Wahrscheinlichkeit. */
function buildDraftTop10V5_() {
  return [
    {rank:1,id:'3112335',name:'Nikola Jokić',nba:'DEN',score:99,adp:'1,8',reason:'Sicherster Allrounder: Elite bei Punkten, Rebounds, Assists und beiden Quoten.',report:'Jokić bleibt der verlässlichste 1.01-Kandidat: Vor der vergangenen Saison hatte er fünf Jahre in Folge als Nummer 1 beendet. Hashtag projiziert 28,4 Punkte, 12,7 Rebounds und 10,4 Assists bei 57,3 % aus dem Feld – praktisch kein anderer Spieler greift so breit in das FBA-Duell ein.',strengths:'Punkte · Rebounds · Assists · FG% · Steals',risk:'Er verpasste zuletzt erstmals deutlich mehr Spiele (17); bei Pick 1 ist Verfügbarkeit der einzige echte Vorbehalt.',fit:'Sicherster Teamanker ohne erzwungene Schwachstelle.',active:true},
    {rank:2,id:'5104157',name:'Victor Wembanyama',nba:'SAS',score:97,adp:'2,9',reason:'Historischer Blocks-Vorteil plus Dreier und starke Quoten; realer 1.01-Kandidat.',report:'Wembanyama kann einen kompletten FBA-Punkt nahezu allein drehen: projiziert sind 3,2 Blocks bei gleichzeitig 25,6 Punkten, 11,8 Rebounds und 2,2 Dreiern. Sein Profil aus Ringbeschützer, Shooter und gutem Freiwurfschützen ist einzigartig und besitzt sogar noch Entwicklungspotenzial.',strengths:'Blocks · Rebounds · Punkte · Dreier · FT%',risk:'In jeder seiner ersten drei Saisons fehlte er länger; Hashtag kalkuliert vorsichtig mit 66 Spielen.',fit:'Höchste Decke im Draft und sofortiger Blocks-Anker.',active:true},
    {rank:3,id:'4278073',name:'Shai Gilgeous-Alexander',nba:'OKC',score:91,adp:'3,1',reason:'Elite-Scoring und Effizienz ohne echte Schwäche im FBA-Profil.',report:'SGA gilt bei RotoWire als klarer dritter Spieler hinter Jokić und Wemby. Projiziert werden 32,1 Punkte bei 53,4 % FG und 88,9 % FT sowie 1,6 Steals – dazu kommen eine stabile Rolle in OKC und eine starke Verfügbarkeitsbilanz.',strengths:'Punkte · FG% · FT% · Steals · Assists',risk:'Weniger Rebound- und Dreier-Volumen als einige direkte Konkurrenten; an Pick 3 ist sein fast fehlerfreies Profil bereits voll eingepreist.',fit:'Ideal für einen ausgeglichenen Build ohne spätere Reparaturarbeit.',active:true},
    {rank:4,id:'3945274',name:'Luka Dončić',nba:'LAL',score:90,adp:'4,6',reason:'Ohne Turnovers wird sein Monster-Volumen noch wertvoller: Punkte, Assists, Rebounds und Dreier.',report:'Nach LeBrons Wechsel nach Philadelphia läuft die Lakers-Offense noch klarer durch Luka. Hashtag projiziert 32,7 Punkte, 8,7 Rebounds, 8,8 Assists und 4,0 Dreier; weil Ballverluste in der FBA nicht zählen, rückt er sehr nah an Shai heran.',strengths:'Punkte · Assists · Rebounds · Dreier · Steals',risk:'46,5 % FG, 78,1 % FT und wenig Blocks können die enorme Produktion an einzelnen Stellen bremsen; zusätzlich nur 68 projizierte Spiele.',fit:'Perfekt, wenn der Draft danach gezielt Quoten und Defense ergänzt.',active:true},
    {rank:5,id:'4432166',name:'Cade Cunningham',nba:'DET',score:85,adp:'8,2',reason:'Assist-Motor mit 25/10-Upside; ohne Turnovers ein klarer Top-5-Kandidat.',report:'Detroit hat mehr Shooting um Cade gestellt, was sauberere Abschlüsse und noch mehr Assists ermöglichen soll. Nach 17,3 potenziellen Assists pro Spiel im Vorjahr projiziert Hashtag 25,0 Punkte und 9,8 Assists – sein größter üblicher Nachteil, die Ballverluste, existiert in der FBA nicht.',strengths:'Assists · Punkte · Rebounds · FT%',risk:'Die FG% bleibt weniger stabil als bei den Top 3; seine frühere Verletzungshistorie verhindert völlige Sicherheit.',fit:'Starker Guard-Anker mit echter Chance auf Liga-Spitze bei Assists.',active:true},
    {rank:6,id:'4065648',name:'Jayson Tatum',nba:'BOS',score:81,adp:'11,4',reason:'Breites Profil mit Dreiern, Rebounds und Assists – wieder klare Nummer 1 in Boston.',report:'Tatum stand nach seinem Achillessehnenriss bereits am Ende der vergangenen Saison wieder auf dem Feld. Nach dem Brown-Trade baut Boston erneut eindeutig um ihn; projiziert werden 26,1 Punkte, 8,8 Rebounds, 6,1 Assists und 3,3 Dreier.',strengths:'Punkte · Dreier · Rebounds · Assists · FT%',risk:'Belastungssteuerung nach dem Achillessehnenriss und eine projizierte FG% von 46,4 %.',fit:'Sehr stabiler First-Rounder, der in fast jedem Aufbau funktioniert.',active:true},
    {rank:7,id:'4594268',name:'Anthony Edwards',nba:'MIN',score:78,adp:'6,8',reason:'Elite-Scoring und Dreier, hohe Verfügbarkeit und zusätzlicher Pace-Schub mit LaMelo.',report:'Edwards’ Scoring stieg bislang in jeder Saison; Hashtag erwartet 28,7 Punkte, 3,7 Dreier und starke 48,7 % FG. LaMelo Ball dürfte das Tempo erhöhen und ihm leichtere Looks verschaffen, während Edwards weiterhin zu den verlässlichsten Stars bei den Spielen zählt.',strengths:'Punkte · Dreier · FG% · Verfügbarkeit',risk:'Rebounds und Assists sind zuletzt gesunken; die neue High-Usage-Kombination mit LaMelo muss sich einspielen.',fit:'Premium-Scorer, der früh Big-Man- und Assist-Hilfe braucht.',active:true},
    {rank:8,id:'3032977',name:'Giannis Antetokounmpo',nba:'MIA',score:76,adp:'5,3',reason:'Massive Punkte-, Rebound- und FG%-Basis; Turnovers spielen in der FBA keine Rolle.',report:'In Miami bleibt Giannis die Nummer 1 und Hashtag projiziert 31,4 Punkte, 11,9 Rebounds, 6,5 Assists sowie 60,8 % FG. Der Wegfall der Turnovers hilft ihm in eurem Format enorm, trotzdem verlangt sein Profil einen klaren Plan für die Quoten.',strengths:'Punkte · Rebounds · FG% · Assists · Blocks',risk:'Nur 62,8 % FT, kaum Dreier und ein neues Frontcourt-Fit mit Bam; zudem spielte er vergangene Saison nur 36 Partien.',fit:'Dominanter Punt-FT%-Anker mit enormer physischer Produktion.',active:true},
    {rank:9,id:'4431678',name:'Tyrese Maxey',nba:'PHI',score:74,adp:'16,6',reason:'Punkte, Dreier, Elite-FT% und Steals – aber neues Star-Gedränge in Philadelphia.',report:'Maxey lieferte zuletzt 28,3 Punkte, 6,6 Assists, 1,9 Steals und 89,2 % FT. Mit LeBron James und Jaylen Brown erwartet RotoWire jedoch weniger Ballbesitz und eventuell weniger Minuten; deshalb bleibt sein Potenzial erstklassig, aber seine Rolle weniger sicher.',strengths:'Punkte · FT% · Dreier · Steals · Assists',risk:'Deutlich mehr Konkurrenz um Würfe und Spielmacher-Anteile in Philadelphia.',fit:'Sehr sauberer Guard-Baustein am Ende der ersten Runde.',active:true},
    {rank:10,id:'4701230',name:'Jalen Johnson',nba:'ATL',score:72,adp:'32,3',reason:'Allround-Breakout mit fast 23/10/8 – starke Rebounds, Assists und FG%.',report:'Johnson spielte 72 Partien und kam laut ESPN auf 22,5 Punkte, 10,3 Rebounds und 7,9 Assists bei 48,9 % FG. RotoWire sieht diese Entwicklung als nachhaltig und Atlanta klar als sein Team; der extrem späte ESPN-ADP macht ihn zugleich zum auffälligsten Value-Namen des Radars.',strengths:'Rebounds · Assists · Punkte · FG% · Steals',risk:'Der Markt ist noch uneins (ESPN-ADP 32,3); FT% und defensive Zahlen sind nicht auf Top-10-Niveau.',fit:'Der mögliche Value-Steal der ersten Runde.',active:true}
  ];
}

/* ================= MATCHUP MONSTER v29 =================
 * Privater, dauerhafter Gerätezugang. Der Einmal-PIN wird ausschließlich
 * einem Tabellen-Editor im Apps-Script-Menü angezeigt. Der Browser speichert
 * den zufälligen Schlüssel lokal; serverseitig liegt nur dessen SHA-256-Hash.
 * Alle Geräte lassen sich jederzeit gesammelt über das FBA-App-Menü sperren.
 */
var MATCHUP_MONSTER_V29 = {
  pinCacheKey: 'FBA_MONSTER_PIN_V29',
  deviceHashesKey: 'FBA_MONSTER_DEVICES_V29',
  pinSeconds: 600,
  maxDevices: 8,
  scheduleCacheKey: 'FBA_MONSTER_NBA_SCHEDULE_V29_',
  seasonStartCacheKey: 'FBA_MONSTER_NBA_START_V29'
};

function monsterHashV29_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), Utilities.Charset.UTF_8)
    .map(function (b) { var n=(b+256)%256; return ('0'+n.toString(16)).slice(-2); }).join('');
}

function createMatchupMonsterPin() {
  var pin=String(Math.floor(100000+Math.random()*900000));
  CacheService.getScriptCache().put(MATCHUP_MONSTER_V29.pinCacheKey,monsterHashV29_(pin),MATCHUP_MONSTER_V29.pinSeconds);
  SpreadsheetApp.getUi().alert('Matchup Monster',
    'Dein Einmal-PIN lautet: '+pin+'\n\nEr gilt 10 Minuten und kann genau einmal verwendet werden. Dieses Gerät bleibt danach dauerhaft freigeschaltet, bis du alle Geräte im FBA-App-Menü sperrst.',
    SpreadsheetApp.getUi().ButtonSet.OK);
  return true;
}

function monsterDeviceHashesV29_() {
  var raw=PropertiesService.getScriptProperties().getProperty(MATCHUP_MONSTER_V29.deviceHashesKey),list=[];
  try { list=raw?JSON.parse(raw):[]; } catch(e) { list=[]; }
  return Array.isArray(list)?list.filter(function(x){return typeof x==='string'&&x.length===64;}):[];
}

function resetMatchupMonsterDevices() {
  var ui=SpreadsheetApp.getUi(),choice=ui.alert('Matchup Monster',
    'Wirklich alle dauerhaft freigeschalteten Geräte sperren? Mac und iPhone benötigen danach jeweils einen neuen Einmal-PIN.',
    ui.ButtonSet.YES_NO);
  if(choice!==ui.Button.YES)return false;
  PropertiesService.getScriptProperties().deleteProperty(MATCHUP_MONSTER_V29.deviceHashesKey);
  ui.alert('Matchup Monster','Alle Geräte wurden gesperrt.',ui.ButtonSet.OK);
  return true;
}

function monsterJsonResponseV29_(payload, callback) {
  var json=JSON.stringify(payload),cb=String(callback||'');
  if (cb && /^[A-Za-z_$][0-9A-Za-z_$]{0,80}$/.test(cb)) {
    return ContentService.createTextOutput(cb+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function createMonsterDeviceV29_(pin) {
  var cache=CacheService.getScriptCache(),expected=cache.get(MATCHUP_MONSTER_V29.pinCacheKey);
  if (!expected || expected !== monsterHashV29_(pin)) return null;
  cache.remove(MATCHUP_MONSTER_V29.pinCacheKey);
  var token=Utilities.getUuid()+Utilities.getUuid();
  var hashes=monsterDeviceHashesV29_(),hash=monsterHashV29_(token);
  hashes=hashes.filter(function(x){return x!==hash;}).slice(-(MATCHUP_MONSTER_V29.maxDevices-1));
  hashes.push(hash);
  PropertiesService.getScriptProperties().setProperty(MATCHUP_MONSTER_V29.deviceHashesKey,JSON.stringify(hashes));
  return token;
}

function validMonsterDeviceV29_(token) {
  if (!token || String(token).length < 40) return false;
  return monsterDeviceHashesV29_().indexOf(monsterHashV29_(token))>=0;
}

function monsterFbaScheduleV29_() {
  var sh=book().getSheetByName(ESPN_SYNC_V1.scheduleSheet);if(!sh||sh.getLastRow()<2)return [];
  var values=sh.getDataRange().getValues(),header=values.shift().map(function(h){
    return String(h||'').toUpperCase().replace(/[^A-Z0-9%]+/g,'_').replace(/^_|_$/g,'');
  });
  function indexOfAny(names,fallback){for(var i=0;i<names.length;i++){var idx=header.indexOf(names[i]);if(idx>=0)return idx;}return fallback;}
  var iw=indexOfAny(['WOCHE','WEEK'],1),im=indexOfAny(['MATCHUP','MATCHUP_ID'],2),is=indexOfAny(['START','DATE_START'],3),
    ie=indexOfAny(['ENDE','END','DATE_END'],-1),ist=indexOfAny(['STATUS'],4),ia=indexOfAny(['AWAY','AWAY_TEAM'],5),ih=indexOfAny(['HOME','HOME_TEAM'],6);
  return values.map(function(r){return {week:Number(r[iw]||0),mu:String(r[im]||''),away:String(r[ia]||''),home:String(r[ih]||''),
    start:is>=0?String(r[is]||''):'',end:ie>=0?String(r[ie]||''):'',status:ist>=0?String(r[ist]||''):''};})
    .filter(function(r){return r.week>=1&&r.week<=ESPN_SYNC_V1.regularSeasonEnd&&r.away&&r.home;});
}

function nbaSeasonStartV29_() {
  var cache=CacheService.getScriptCache(),cached=cache.get(MATCHUP_MONSTER_V29.seasonStartCacheKey);
  if(cached)return cached;
  var url='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/bos/schedule?season='+ESPN_SYNC_V1.seasonId,
    response=UrlFetchApp.fetch(url,{method:'get',headers:{Accept:'application/json'},muteHttpExceptions:true,followRedirects:true});
  if(response.getResponseCode()!==200)return '';
  var parsed;try{parsed=JSON.parse(response.getContentText());}catch(e){return '';}
  var dates=(parsed.events||[]).filter(function(event){
    var st=event.seasonType||{},type=Number(st.type||st.id||0),d=new Date(event.date||0),m=d.getUTCMonth();
    return !isNaN(d.getTime())&&(type===2||(!type&&(m>=9||m<=5)));
  }).map(function(event){return new Date(event.date);}).sort(function(a,b){return a-b;});
  if(!dates.length)return '';
  var iso=Utilities.formatDate(dates[0],ESPN_PLAYER_HUB_V2.nbaTimezone,'yyyy-MM-dd');
  try{cache.put(MATCHUP_MONSTER_V29.seasonStartCacheKey,iso,21600);}catch(e2){}
  return iso;
}

function nbaWeekScheduleV29_(requestedWeek) {
  var week=Math.max(1,Math.min(20,Number(requestedWeek)||1)),cache=CacheService.getScriptCache(),
    cacheKey=MATCHUP_MONSTER_V29.scheduleCacheKey+week,cached=cache.get(cacheKey);
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  var tz=ESPN_PLAYER_HUB_V2.nbaTimezone,startIso='';
  try{startIso=nbaSeasonStartV29_();}catch(startErr){}
  var anchor=startIso?new Date(startIso+'T12:00:00Z'):new Date(),weekday=Number(Utilities.formatDate(anchor,tz,'u')),
    monday=new Date(anchor.getTime()-(weekday-1)*86400000+(week-1)*7*86400000),games=[],requests=[];
  for (var i=0;i<8;i++) {
    var day=new Date(monday.getTime()+i*86400000),dateKey=Utilities.formatDate(day,tz,'yyyyMMdd');
    requests.push({url:nbaScoreboardUrlV2_(dateKey),method:'get',headers:{Accept:'application/json'},muteHttpExceptions:true,followRedirects:true});
  }
  UrlFetchApp.fetchAll(requests).forEach(function(response){
    if(response.getResponseCode()!==200)return;var board;
    try{board=JSON.parse(response.getContentText());}catch(parseErr){return;}
    (board.events||[]).forEach(function (event) {
      var comp=(event.competitions||[])[0]||{},teams=(comp.competitors||[]).map(function (c) {
        return String(((c.team||{}).abbreviation)||((c.team||{}).shortDisplayName)||'');
      }).filter(Boolean);
      if (teams.length===2) games.push({id:String(event.id||''),date:Utilities.formatDate(new Date(comp.date||event.date),tz,'yyyy-MM-dd'),teams:teams,status:String((((event.status||{}).type||{}).name)||'')});
    });
  });
  var byTeam={};games.forEach(function(g){g.teams.forEach(function(t){(byTeam[t]||(byTeam[t]=[])).push(g.date);});});
  var backToBack=[];Object.keys(byTeam).sort().forEach(function(team){
    var dates=byTeam[team].filter(function(v,i,a){return a.indexOf(v)===i;}).sort();
    for(var j=1;j<dates.length;j++){
      var delta=(new Date(dates[j]+'T12:00:00Z')-new Date(dates[j-1]+'T12:00:00Z'))/86400000;
      if(delta===1)backToBack.push({team:team,first:dates[j-1],second:dates[j],crossWeek:(new Date(dates[j-1]+'T12:00:00Z').getUTCDay()===0)});
    }
  });
  var out={generated:new Date().toISOString(),source:'ESPN NBA Schedule',matchupWeek:week,
    rangeStart:Utilities.formatDate(monday,tz,'yyyy-MM-dd'),rangeEnd:Utilities.formatDate(new Date(monday.getTime()+7*86400000),tz,'yyyy-MM-dd'),games:games,backToBack:backToBack};
  try { cache.put(cacheKey,JSON.stringify(out),21600); } catch(e2) {}
  return out;
}

function buildMonsterPayloadV29_(requestedWeek) {
  var players=sheetObjectsV2_(ESPN_PLAYER_HUB_V2.playersSheet),roster=sheetObjectsV2_(ESPN_PLAYER_HUB_V2.rosterSheet),playerMap={};
  players.forEach(function(p){playerMap[String(p.player_id||'')]=p;});
  var compactRoster=roster.map(function(r){var p=playerMap[String(r.player_id||'')]||{};return {
    team:String(r.team||''),teamId:String(r.team_id||''),playerId:String(r.player_id||''),name:String(r.player_name||p.full_name||''),
    nbaTeam:nbaAbbreviationV3_(p.nba_team_id),slot:Number(r.lineup_slot_id),active:r.active_lineup===true||String(r.active_lineup).toUpperCase()==='TRUE',
    injuryStatus:String(p.injury_status||''),photo:String(r.headshot_url||p.headshot_url||espnHeadshotV2_(r.player_id))
  };}).filter(function(r){return r.team&&r.playerId;});
  var schedule=monsterFbaScheduleV29_();
  return {
    ok:true,version:29,generated:new Date().toISOString(),roster:compactRoster,schedule:schedule,nbaSchedule:nbaWeekScheduleV29_(requestedWeek),
    scheduleMeta:{season:ESPN_SYNC_V1.seasonLabel,matchups:schedule.length,weeks:schedule.reduce(function(m,r){return Math.max(m,r.week||0);},0)},
    sourceStatus:[
      {id:'espn',label:'ESPN Liga, Kader, '+schedule.length+' Matchups und Spielerstatus',active:true},
      {id:'fantasypros',label:'FantasyPros Projektionen – Adapter bereit, Lizenz/API-Schlüssel fehlt',active:false},
      {id:'hashtag',label:'Hashtag Basketball – Adapter bereit, Premium-Export fehlt',active:false}
    ]
  };
}

function matchupMonsterResponseV29_(p) {
  var action=String(p.monster||'');
  if(action==='login'){
    var token=createMonsterDeviceV29_(p.pin||'');
    return monsterJsonResponseV29_(token?{ok:true,token:token,persistent:true}:{ok:false,error:'PIN ungültig oder abgelaufen.'},p.callback);
  }
  if(action==='data'){
    if(!validMonsterDeviceV29_(p.token||''))return monsterJsonResponseV29_({ok:false,error:'Gerät nicht freigeschaltet.',locked:true},p.callback);
    try{return monsterJsonResponseV29_(buildMonsterPayloadV29_(p.week),p.callback);}catch(err){return monsterJsonResponseV29_({ok:false,error:String(err)},p.callback);}
  }
  return monsterJsonResponseV29_({ok:false,error:'Unbekannte Monster-Aktion.'},p.callback);
}

/* ================= MATCHUP MONSTER v34 =================
 * ESPN Fantasy und die ESPN-Site-API bezeichnen 2026/27 als Saison 2027.
 * Die FBA-Zeiträume sind feste Matchup-Fenster; niemals wird das heutige
 * Datum als stiller Ersatz verwendet. Für die ersten beiden Wochen liegt
 * zusätzlich ein am 04.09.2026 gegen NBA.com verifizierter Fallback vor.
 * v33 hält den vollständigen ESPN-Fantasy-NBA-Spielplan als validierten
 * Last-known-good-Snapshot vor; v34 prüft tagsüber stündlich und in der
 * NBA-Kernzeit alle 30 Minuten, ohne einen quota-riskanten Minutentakt.
 */
var MATCHUP_MONSTER_V30 = {
  nbaSiteSeasons: [2027],
  firstWeekStart: '2026-10-20',
  firstWeekEnd: '2026-10-25',
  scheduleCacheKey: 'FBA_MONSTER_NBA_SCHEDULE_V33_',
  nbaScheduleLastSuccessKey: 'FBA_ESPN_NBA_SCHEDULE_LAST_SUCCESS_V33',
  nbaScheduleSource: 'ESPN Fantasy proTeamSchedules_wl',
  nbaScheduleMaxAgeMs: 86400000,
  nbaScheduleMinimumGames: 1200,
  nbaScheduleTeamCount: 30,
  nbaScheduleMinimumTeamGames: 80,
  nbaScheduleMaximumTeamGames: 82,
  nbaScheduleLockWaitMs: 5000,
  maxWeek: 20,
  nbaTeamSlugs: ['atl','bos','bkn','cha','chi','cle','dal','den','det','gs','hou','ind','lac','lal','mem','mia','mil','min','no','ny','okc','orl','phi','phx','por','sac','sa','tor','utah','wsh']
};

function isoDateV30_(date) {
  return Utilities.formatDate(new Date(date), 'UTC', 'yyyy-MM-dd');
}

function fantasyWeekWindowV30_(requestedWeek) {
  var week=Math.max(1,Math.min(MATCHUP_MONSTER_V30.maxWeek,Number(requestedWeek)||1));
  if (week===1) {
    return {week:1,start:MATCHUP_MONSTER_V30.firstWeekStart,end:MATCHUP_MONSTER_V30.firstWeekEnd,lookaheadEnd:'2026-10-26'};
  }
  var start=new Date('2026-10-26T12:00:00Z');
  start=new Date(start.getTime()+(week-2)*7*86400000);
  var end=new Date(start.getTime()+6*86400000),lookahead=new Date(start.getTime()+7*86400000);
  return {week:week,start:isoDateV30_(start),end:isoDateV30_(end),lookaheadEnd:isoDateV30_(lookahead)};
}

function monsterDateCellV30_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return isoDateV30_(value);
  var raw=String(value==null?'':value).trim(),match=raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  var parsed=new Date(raw);return raw&&!isNaN(parsed.getTime())?isoDateV30_(parsed):'';
}

function monsterFbaScheduleV30_() {
  return monsterFbaScheduleV29_().filter(function(row){
    return Number(row.week)>=1&&Number(row.week)<=ESPN_SYNC_V1.regularSeasonEnd;
  }).map(function(row){
    var window=fantasyWeekWindowV30_(row.week);
    row.start=monsterDateCellV30_(row.start)||window.start;
    row.end=monsterDateCellV30_(row.end)||window.end;
    return row;
  });
}

function normalizeNbaAbbreviationV30_(value) {
  var raw=String(value||'').toUpperCase().replace(/[^A-Z]/g,''),aliases={GS:'GSW',GSW:'GSW',WSH:'WAS',WAS:'WAS',SA:'SAS',SAS:'SAS',NO:'NOP',NOP:'NOP',NY:'NYK',NYK:'NYK',UTAH:'UTA'};
  return aliases[raw]||raw;
}

function espnGameV30_(event) {
  var comp=(event&&event.competitions||[])[0]||{},date=new Date(comp.date||event.date||0);
  if (isNaN(date.getTime())) return null;
  var teams=(comp.competitors||[]).map(function(c){
    var team=c.team||{};return normalizeNbaAbbreviationV30_(team.abbreviation||team.shortDisplayName||'');
  }).filter(Boolean);
  if (teams.length!==2) return null;
  return {id:String(event.id||comp.id||''),date:Utilities.formatDate(date,ESPN_PLAYER_HUB_V2.nbaTimezone,'yyyy-MM-dd'),teams:teams,status:String((((event.status||comp.status||{}).type||{}).name)||'')};
}

function dedupeNbaGamesV30_(games) {
  var seen={};return (games||[]).filter(function(game){
    if(!game)return false;var key=game.id||[game.date].concat(game.teams.slice().sort()).join(':');
    if(seen[key])return false;seen[key]=true;return true;
  }).sort(function(a,b){return a.date.localeCompare(b.date)||a.id.localeCompare(b.id);});
}

function espnFantasyNbaScheduleEndpointV33_() {
  return 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/' +
    ESPN_SYNC_V1.seasonId + '?view=proTeamSchedules_wl';
}

function espnFantasyNbaDateV33_(value) {
  var raw = value instanceof Date ? value : value;
  if (typeof raw === 'string' && /^\d{11,}$/.test(raw)) raw = Number(raw);
  var date = new Date(raw);
  return isNaN(date.getTime()) ? '' : Utilities.formatDate(date, ESPN_PLAYER_HUB_V2.nbaTimezone, 'yyyy-MM-dd');
}

function espnFantasyNbaStatusV33_(game) {
  if (game && game.suspended === true) return 'STATUS_SUSPENDED';
  if (game && game.postponed === true) return 'STATUS_POSTPONED';
  if (game && game.startTimeTBD === true) return 'STATUS_TIME_TBD';
  var raw = game && (game.status || game.gameStatus || game.state);
  if (raw && typeof raw === 'object') raw = ((raw.type || {}).name || (raw.type || {}).state || raw.name || raw.state || '');
  if (/suspend/i.test(String(raw || ''))) return 'STATUS_SUSPENDED';
  if (/postpon/i.test(String(raw || ''))) return 'STATUS_POSTPONED';
  if (/time.?tbd|start.?tbd/i.test(String(raw || ''))) return 'STATUS_TIME_TBD';
  if (raw) return String(raw);
  return game && game.statsOfficial ? 'STATUS_FINAL' : 'STATUS_SCHEDULED';
}

function parseEspnFantasyNbaScheduleV33_(payload) {
  var proTeams = ((payload || {}).settings || {}).proTeams || (payload || {}).proTeams || [];
  var proTeamIds = {}, gameTeams = {}, gamesById = {};
  (proTeams || []).forEach(function (team) {
    var teamId = Number(team && team.id), abbreviation = nbaAbbreviationV3_(teamId);
    if (!abbreviation) return;
    proTeamIds[String(teamId)] = true;
    var periods = team.proGamesByScoringPeriod || {};
    Object.keys(periods).forEach(function (periodKey) {
      var periodGames = periods[periodKey];
      if (!Array.isArray(periodGames)) periodGames = periodGames ? Object.keys(periodGames).map(function (key) { return periodGames[key]; }) : [];
      periodGames.forEach(function (game) {
        var eventId = String(game && (game.id || game.gameId) || '').trim();
        if (!eventId) return;
        var away = nbaAbbreviationV3_(game.awayProTeamId), home = nbaAbbreviationV3_(game.homeProTeamId);
        var date = espnFantasyNbaDateV33_(game.date || game.startTime);
        if (!date || !away || !home || away === home) return;
        var candidate = {
          id: eventId,
          date: date,
          teams: [away, home],
          awayTeam: away,
          homeTeam: home,
          status: String(espnFantasyNbaStatusV33_(game) || '').trim().toUpperCase(),
          scoringPeriod: Number(game.scoringPeriodId || periodKey || 0)
        };
        if (gamesById[eventId]) {
          var existing = gamesById[eventId];
          var existingSignature = [existing.date,existing.awayTeam,existing.homeTeam,existing.status,existing.scoringPeriod].join('|');
          var candidateSignature = [candidate.date,candidate.awayTeam,candidate.homeTeam,candidate.status,candidate.scoringPeriod].join('|');
          if (candidateSignature !== existingSignature) {
            throw new Error('ESPN-Saisonspielplan widersprüchlich: Event-ID ' + eventId + ' enthält abweichende Termin-, Team- oder Statusdaten.');
          }
          return;
        }
        gamesById[eventId] = candidate;
        gameTeams[away] = true;
        gameTeams[home] = true;
      });
    });
  });
  var games = Object.keys(gamesById).map(function (id) { return gamesById[id]; });
  games.sort(function (a, b) { return a.date.localeCompare(b.date) || a.id.localeCompare(b.id); });
  return {
    seasonId: ESPN_SYNC_V1.seasonId,
    season: ESPN_SYNC_V1.seasonLabel,
    source: MATCHUP_MONSTER_V30.nbaScheduleSource,
    teamCount: Object.keys(gameTeams).length,
    proTeamCount: Object.keys(proTeamIds).length,
    gameCount: games.length,
    games: games
  };
}

function validateEspnFantasyNbaScheduleV33_(snapshot) {
  var games = snapshot && snapshot.games;
  if (!snapshot || !Array.isArray(games)) throw new Error('ESPN-Saisonspielplan unvollständig: keine prüfbare Spieleliste.');
  if (snapshot.seasonId != null && Number(snapshot.seasonId) !== ESPN_SYNC_V1.seasonId) {
    throw new Error('ESPN-Saisonspielplan fehlerhaft: falsche Saison-ID.');
  }
  var allowedTeams = {}, teamGames = {}, unique = {}, fixtureSignatures = {}, derivedTeams = {};
  for (var teamId = 1; teamId <= MATCHUP_MONSTER_V30.nbaScheduleTeamCount; teamId++) {
    var abbreviation = nbaAbbreviationV3_(teamId);
    allowedTeams[abbreviation] = true;
    teamGames[abbreviation] = 0;
  }
  games.forEach(function (game) {
    var id = String(game && game.id || '').trim(), date = String(game && game.date || '').trim();
    var away = String(game && game.awayTeam || '').trim().toUpperCase(), home = String(game && game.homeTeam || '').trim().toUpperCase();
    var status = String(game && game.status || '').trim(), scoringPeriod = Number(game && game.scoringPeriod);
    if (!id || unique[id]) throw new Error('ESPN-Saisonspielplan fehlerhaft: Event-ID fehlt oder ist doppelt (' + id + ').');
    unique[id] = true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('ESPN-Saisonspielplan fehlerhaft: ungültiges NBA-Datum in Event ' + id + '.');
    var parsedDate = new Date(date + 'T00:00:00Z');
    if (isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== date || date < '2026-10-20' || date > '2027-06-30') {
      throw new Error('ESPN-Saisonspielplan fehlerhaft: NBA-Datum außerhalb der Saison in Event ' + id + '.');
    }
    if (!allowedTeams[away] || !allowedTeams[home]) throw new Error('ESPN-Saisonspielplan fehlerhaft: unbekanntes NBA-Team in Event ' + id + '.');
    if (away === home) throw new Error('ESPN-Saisonspielplan fehlerhaft: Heim- und Auswärtsteam sind identisch in Event ' + id + '.');
    var fixtureSignature = date + '|' + [away, home].sort().join('|');
    if (fixtureSignatures[fixtureSignature] && fixtureSignatures[fixtureSignature] !== id) {
      throw new Error('ESPN-Saisonspielplan widersprüchlich: derselbe NBA-Termin steht unter verschiedenen Event-IDs (' + fixtureSignatures[fixtureSignature] + ', ' + id + ').');
    }
    fixtureSignatures[fixtureSignature] = id;
    if (game.teams && (!Array.isArray(game.teams) || game.teams.length !== 2 || String(game.teams[0]).toUpperCase() !== away || String(game.teams[1]).toUpperCase() !== home)) {
      throw new Error('ESPN-Saisonspielplan fehlerhaft: Teamfelder widersprechen sich in Event ' + id + '.');
    }
    if (!status || scoringPeriod !== Math.floor(scoringPeriod) || scoringPeriod < 1 || scoringPeriod > 366) {
      throw new Error('ESPN-Saisonspielplan fehlerhaft: Status oder Scoring-Tag ungültig in Event ' + id + '.');
    }
    derivedTeams[away] = true;
    derivedTeams[home] = true;
    teamGames[away]++;
    teamGames[home]++;
  });
  var gameCount = Object.keys(unique).length, teamCount = Object.keys(derivedTeams).length;
  if (snapshot.gameCount != null && Number(snapshot.gameCount) !== gameCount) {
    throw new Error('ESPN-Saisonspielplan unvollständig: gameCount ' + snapshot.gameCount + ' passt nicht zu ' + gameCount + ' eindeutigen Spielen.');
  }
  if (games.length !== gameCount || (snapshot.teamCount != null && Number(snapshot.teamCount) !== teamCount) ||
      (snapshot.proTeamCount != null && Number(snapshot.proTeamCount) !== MATCHUP_MONSTER_V30.nbaScheduleTeamCount) ||
      teamCount !== MATCHUP_MONSTER_V30.nbaScheduleTeamCount || gameCount < MATCHUP_MONSTER_V30.nbaScheduleMinimumGames) {
    throw new Error('ESPN-Saisonspielplan unvollständig: ' + teamCount + '/30 Teams, ' + gameCount + '/' + MATCHUP_MONSTER_V30.nbaScheduleMinimumGames + ' eindeutige Spiele.');
  }
  Object.keys(teamGames).forEach(function (team) {
    if (teamGames[team] < MATCHUP_MONSTER_V30.nbaScheduleMinimumTeamGames || teamGames[team] > MATCHUP_MONSTER_V30.nbaScheduleMaximumTeamGames) {
      throw new Error('ESPN-Saisonspielplan unplausibel: ' + team + ' hat ' + teamGames[team] + ' Spiele.');
    }
  });
  snapshot.gameCount = gameCount;
  snapshot.teamCount = teamCount;
  snapshot.complete = true;
  return snapshot;
}

function fetchEspnFantasyNbaScheduleV33_() {
  var response = UrlFetchApp.fetch(espnFantasyNbaScheduleEndpointV33_(), {
    method: 'get', headers: { Accept: 'application/json' }, muteHttpExceptions: true, followRedirects: true
  });
  if (!response || response.getResponseCode() !== 200) throw new Error('ESPN-Saisonspielplan HTTP ' + (response ? response.getResponseCode() : 'ohne Antwort'));
  var parsed;
  try { parsed = JSON.parse(response.getContentText()); }
  catch (parseError) { throw new Error('ESPN-Saisonspielplan enthält kein gültiges JSON.'); }
  return validateEspnFantasyNbaScheduleV33_(parseEspnFantasyNbaScheduleV33_(parsed));
}

function ensureEspnNbaScheduleSheetV33_() {
  var sh = ensureSimpleEspnSheetV1_(ESPN_SYNC_V1.nbaScheduleSheet, ESPN_NBA_SCHEDULE_HEADER_V33);
  var current = sh.getRange(1, 1, 1, ESPN_NBA_SCHEDULE_HEADER_V33.length).getValues()[0];
  if (current.join('|') !== ESPN_NBA_SCHEDULE_HEADER_V33.join('|')) {
    sh.getRange(1, 1, 1, ESPN_NBA_SCHEDULE_HEADER_V33.length).setValues([ESPN_NBA_SCHEDULE_HEADER_V33]);
  }
  return sh;
}

function readPersistedEspnNbaScheduleV33_() {
  var sh = book().getSheetByName(ESPN_SYNC_V1.nbaScheduleSheet);
  if (!sh || sh.getLastRow() < 2) return null;
  var values = sh.getRange(1, 1, sh.getLastRow(), ESPN_NBA_SCHEDULE_HEADER_V33.length).getValues(), header = {};
  values[0].forEach(function (value, index) { header[String(value || '').trim().toLowerCase()] = index; });
  if (header.event_id === undefined || header.nba_date === undefined || header.away_team === undefined || header.home_team === undefined) return null;
  var games = [], teams = {}, source = '', lastSeen = '', lastChanged = '';
  values.slice(1).forEach(function (row) {
    if (header.season_id !== undefined && String(row[header.season_id] || '') !== String(ESPN_SYNC_V1.seasonId)) return;
    var id = String(row[header.event_id] || '').trim(), date = monsterDateCellV30_(row[header.nba_date]);
    var away = normalizeNbaAbbreviationV30_(row[header.away_team]), home = normalizeNbaAbbreviationV30_(row[header.home_team]);
    if (!id || !date || !away || !home) return;
    games.push({id:id,date:date,teams:[away,home],awayTeam:away,homeTeam:home,
      status:String(header.status === undefined ? '' : row[header.status] || ''),
      scoringPeriod:Number(header.scoring_period === undefined ? 0 : row[header.scoring_period] || 0)});
    teams[away] = true; teams[home] = true;
    if (!source && header.source !== undefined) source = String(row[header.source] || '');
    if (header.last_seen !== undefined && String(row[header.last_seen] || '') > lastSeen) lastSeen = String(row[header.last_seen] || '');
    if (header.last_changed !== undefined && String(row[header.last_changed] || '') > lastChanged) lastChanged = String(row[header.last_changed] || '');
  });
  var snapshot = {seasonId:ESPN_SYNC_V1.seasonId,season:ESPN_SYNC_V1.seasonLabel,
    source:source || MATCHUP_MONSTER_V30.nbaScheduleSource,teamCount:Object.keys(teams).length,
    gameCount:games.length,games:dedupeNbaGamesV30_(games),lastSeen:lastSeen,lastChanged:lastChanged,persisted:true};
  try { return validateEspnFantasyNbaScheduleV33_(snapshot); } catch (invalidStoredSchedule) { return null; }
}

function persistEspnNbaScheduleV33_(snapshot) {
  validateEspnFantasyNbaScheduleV33_(snapshot);
  var sh = ensureEspnNbaScheduleSheetV33_(), previousLast = sh.getLastRow(), oldById = {};
  if (previousLast > 1) {
    sh.getRange(2, 1, previousLast - 1, ESPN_NBA_SCHEDULE_HEADER_V33.length).getValues().forEach(function (row) {
      if (row[1]) oldById[String(row[1])] = row;
    });
  }
  var stamp = new Date().toISOString(), rows = snapshot.games.map(function (game) {
    var old = oldById[String(game.id)], signature = [game.date,game.awayTeam,game.homeTeam,game.status,Number(game.scoringPeriod||0)].join('|');
    var oldSignature = old ? [monsterDateCellV30_(old[2]),String(old[3]||''),String(old[4]||''),String(old[5]||''),Number(old[6]||0)].join('|') : '';
    var changed = old && signature === oldSignature && old[9] ? String(old[9]) : stamp;
    return [ESPN_SYNC_V1.seasonId,String(game.id),game.date,game.awayTeam,game.homeTeam,String(game.status||''),
      Number(game.scoringPeriod||0),snapshot.source || MATCHUP_MONSTER_V30.nbaScheduleSource,stamp,changed];
  });
  var requiredRows = rows.length + 1;
  if (sh.getMaxRows() < requiredRows) sh.insertRowsAfter(sh.getMaxRows(), requiredRows - sh.getMaxRows());
  sh.getRange(2, 2, rows.length, 2).setNumberFormat('@');
  sh.getRange(2, 1, rows.length, ESPN_NBA_SCHEDULE_HEADER_V33.length).setValues(rows);
  if (previousLast > rows.length + 1) sh.getRange(rows.length + 2, 1, previousLast - rows.length - 1, ESPN_NBA_SCHEDULE_HEADER_V33.length).clearContent();
  espnPropertiesV1_().setProperties({
    FBA_ESPN_NBA_SCHEDULE_LAST_SUCCESS_V33: stamp,
    FBA_ESPN_NBA_SCHEDULE_GAME_COUNT_V33: String(rows.length),
    FBA_ESPN_NBA_SCHEDULE_SOURCE_V33: snapshot.source || MATCHUP_MONSTER_V30.nbaScheduleSource
  });
  var cache = CacheService.getScriptCache();
  for (var week = 1; week <= MATCHUP_MONSTER_V30.maxWeek; week++) cache.remove(MATCHUP_MONSTER_V30.scheduleCacheKey + week);
  snapshot.lastSeen = stamp;
  snapshot.lastChanged = rows.reduce(function (latest, row) { return String(row[9]) > latest ? String(row[9]) : latest; }, '');
  snapshot.persisted = true;
  return snapshot;
}

function refreshEspnNbaScheduleV33_(force, scriptLockAlreadyHeld) {
  // syncEspnData() hält bereits denselben nicht-reentranten Script-Lock und
  // übergibt deshalb explizit true. Alle anderen Aufrufer serialisieren hier
  // Fetch, LKG-Vergleich und Persistenz in einem einzigen kritischen Abschnitt.
  var lock = scriptLockAlreadyHeld ? null : LockService.getScriptLock();
  var locked = scriptLockAlreadyHeld === true || (lock && lock.tryLock(MATCHUP_MONSTER_V30.nbaScheduleLockWaitMs));
  if (!locked) {
    var waitingFallback = readPersistedEspnNbaScheduleV33_();
    if (waitingFallback) {
      waitingFallback.persistedFallback = true;
      waitingFallback.error = 'ESPN-Saisonspielplan wird gerade parallel aktualisiert; letzter gültiger Stand wird verwendet.';
      return waitingFallback;
    }
    throw new Error('ESPN-Saisonspielplan konnte nicht exklusiv aktualisiert werden.');
  }
  try {
    var stored = readPersistedEspnNbaScheduleV33_(), props = espnPropertiesV1_();
    var lastSuccess = props.getProperty(MATCHUP_MONSTER_V30.nbaScheduleLastSuccessKey) || (stored && stored.lastSeen) || '';
    var age = lastSuccess ? Date.now() - new Date(lastSuccess).getTime() : NaN;
    if (!force && stored && !isNaN(age) && age >= 0 && age < MATCHUP_MONSTER_V30.nbaScheduleMaxAgeMs) return stored;
    try {
      var fresh = fetchEspnFantasyNbaScheduleV33_();
      if (stored && fresh.gameCount < stored.gameCount) {
        throw new Error('ESPN-Saisonspielplan geschrumpft: ' + fresh.gameCount + ' statt ' + stored.gameCount + ' Spielen.');
      }
      return persistEspnNbaScheduleV33_(fresh);
    }
    catch (error) {
      if (stored) {
        stored.persistedFallback = true;
        stored.error = String(error && error.message ? error.message : error).slice(0, 400);
        return stored;
      }
      throw error;
    }
  }
  finally { if (lock) lock.releaseLock(); }
}

function parseEspnGamesV30_(responses,window) {
  var games=[];(responses||[]).forEach(function(response){
    if(!response||response.getResponseCode()!==200)return;var parsed;
    try{parsed=JSON.parse(response.getContentText());}catch(e){return;}
    (parsed.events||[]).forEach(function(event){
      var game=espnGameV30_(event);if(game&&game.date>=window.start&&game.date<=window.lookaheadEnd)games.push(game);
    });
  });
  return dedupeNbaGamesV30_(games);
}

var NBA_OFFICIAL_TEST_SCHEDULE_V31 = [
  '2026-10-20,BOS,DET;2026-10-20,PHI,NYK;2026-10-20,OKC,SAS;2026-10-21,MIN,MIA;2026-10-21,GSW,LAL;2026-10-21,ATL,ORL;2026-10-21,MIL,WAS;2026-10-21,CHA,BKN;2026-10-21,CHI,TOR;2026-10-21,UTA,MEM;2026-10-21,IND,NOP;2026-10-21,DAL,HOU;2026-10-21,PHX,POR;2026-10-21,SAC,LAC',
  '2026-10-22,CLE,PHI;2026-10-22,DEN,OKC;2026-10-23,NYK,BOS;2026-10-23,HOU,SAS;2026-10-23,ATL,CHA;2026-10-23,DAL,IND;2026-10-23,MIN,ORL;2026-10-23,TOR,WAS;2026-10-23,DET,MIA;2026-10-23,CHI,MIL;2026-10-23,NOP,UTA;2026-10-23,MEM,GSW;2026-10-23,LAC,LAL;2026-10-23,POR,SAC',
  '2026-10-24,MIA,CHA;2026-10-24,BKN,CLE;2026-10-24,MIL,PHI;2026-10-24,HOU,ATL;2026-10-24,WAS,CHI;2026-10-24,SAS,DAL;2026-10-24,NOP,DEN;2026-10-24,GSW,PHX;2026-10-25,LAL,UTA;2026-10-25,IND,BKN;2026-10-25,ORL,NYK;2026-10-25,TOR,MIN;2026-10-25,LAC,OKC;2026-10-25,DET,PHI;2026-10-25,MEM,SAC',
  '2026-10-26,WAS,CHA;2026-10-26,MIN,CLE;2026-10-26,CHI,BOS;2026-10-26,DAL,MIA;2026-10-26,IND,MIL;2026-10-26,PHX,OKC;2026-10-26,ATL,HOU;2026-10-26,MEM,UTA;2026-10-26,GSW,DEN;2026-10-27,BKN,BOS;2026-10-27,DET,NYK;2026-10-27,SAC,SAS;2026-10-27,POR,LAL',
  '2026-10-28,MIA,ATL;2026-10-28,WAS,CLE;2026-10-28,CHA,DET;2026-10-28,PHI,IND;2026-10-28,ORL,TOR;2026-10-28,NYK,CHI;2026-10-28,HOU,MIL;2026-10-28,GSW,MIN;2026-10-28,DEN,NOP;2026-10-28,SAS,UTA;2026-10-28,OKC,DAL;2026-10-28,LAL,LAC;2026-10-29,CLE,ATL;2026-10-29,SAC,NOP;2026-10-29,MEM,POR',
  '2026-10-30,CHA,WAS;2026-10-30,CHI,BOS;2026-10-30,DET,BKN;2026-10-30,NYK,PHI;2026-10-30,ORL,TOR;2026-10-30,IND,MIA;2026-10-30,HOU,DAL;2026-10-30,LAC,MIN;2026-10-30,LAL,GSW;2026-10-30,DEN,PHX;2026-10-31,POR,UTA;2026-10-31,PHI,CHA;2026-10-31,ATL,NOP;2026-10-31,SAC,MEM;2026-10-31,CLE,MIL;2026-10-31,MIN,SAS;2026-10-31,OKC,HOU',
  '2026-11-01,BOS,ORL;2026-11-01,BKN,IND;2026-11-01,LAC,GSW;2026-11-01,TOR,LAL;2026-11-02,OKC,CLE;2026-11-02,DET,CHA;2026-11-02,ATL,IND;2026-11-02,BKN,NYK;2026-11-02,WAS,ORL;2026-11-02,CHI,PHI;2026-11-02,SAC,DAL;2026-11-02,NOP,MEM;2026-11-02,MIL,MIN;2026-11-02,BOS,HOU;2026-11-02,UTA,SAS;2026-11-02,POR,DEN;2026-11-02,PHX,GSW;2026-11-02,TOR,LAC;2026-11-02,MIA,LAL'
].join(';');

function officialScheduleDateV31_(value) {
  var raw=String(value||''),iso=raw.match(/^\d{4}-\d{2}-\d{2}/),us=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return iso?iso[0]:(us?us[3]+'-'+us[1]+'-'+us[2]:'');
}

function officialNbaScheduleGamesV31_(window) {
  var response=UrlFetchApp.fetch('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json',{
    method:'get',headers:{Accept:'application/json','User-Agent':'Mozilla/5.0','Referer':'https://www.nba.com/'},muteHttpExceptions:true,followRedirects:true
  });
  if(!response||response.getResponseCode()!==200)throw new Error('HTTP '+(response?response.getResponseCode():'ohne Antwort'));
  var parsed=JSON.parse(response.getContentText()),league=parsed.leagueSchedule||parsed.schedule||{},groups=league.gameDates||[],games=[];
  groups.forEach(function(group){(group.games||[]).forEach(function(game){
    var date=officialScheduleDateV31_(game.gameDateEst||group.gameDate||game.gameDate),away=normalizeNbaAbbreviationV30_(((game.awayTeam||{}).teamTricode)||((game.awayTeam||{}).teamCode)),home=normalizeNbaAbbreviationV30_(((game.homeTeam||{}).teamTricode)||((game.homeTeam||{}).teamCode));
    if(date>=window.start&&date<=window.lookaheadEnd&&away&&home)games.push({id:String(game.gameId||''),date:date,teams:[away,home],status:String(game.gameStatusText||game.gameStatus||'STATUS_SCHEDULED')});
  });});
  return dedupeNbaGamesV30_(games);
}

function officialSnapshotGamesV31_(window) {
  if(window.week!==1&&window.week!==2)return [];
  return NBA_OFFICIAL_TEST_SCHEDULE_V31.split(';').map(function(row,index){
    var cells=row.split(','),date=cells[0];
    return date>=window.start&&date<=window.lookaheadEnd?{id:'nba-official-v31-'+index,date:date,teams:[cells[1],cells[2]],status:'STATUS_SCHEDULED'}:null;
  }).filter(Boolean);
}

function monsterBackToBackV30_(games,rangeEnd) {
  var byTeam={};(games||[]).filter(function(game){
    return !/POSTPONED|SUSPENDED|CANCELLED|CANCELED|REMOVED/i.test(String(game&&game.status||''));
  }).forEach(function(game){
    (game.teams||[]).forEach(function(team){(byTeam[team]||(byTeam[team]=[])).push(game.date);});
  });
  var rows=[];Object.keys(byTeam).sort().forEach(function(team){
    var dates=byTeam[team].filter(function(value,index,array){return array.indexOf(value)===index;}).sort();
    for(var i=1;i<dates.length;i++){
      var delta=(new Date(dates[i]+'T12:00:00Z')-new Date(dates[i-1]+'T12:00:00Z'))/86400000;
      if(delta===1&&dates[i-1]<=rangeEnd)rows.push({team:team,first:dates[i-1],second:dates[i],crossWeek:dates[i]>rangeEnd});
    }
  });
  return rows;
}

function espnScoreboardGamesV30_(window) {
  var from=window.start.replace(/-/g,''),to=window.lookaheadEnd.replace(/-/g,''),response=UrlFetchApp.fetch(
    'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=500&dates='+from+'-'+to,
    {method:'get',headers:{Accept:'application/json'},muteHttpExceptions:true,followRedirects:true}
  );
  if(!response||response.getResponseCode()!==200)throw new Error('HTTP '+(response?response.getResponseCode():'ohne Antwort'));
  return parseEspnGamesV30_([response],window);
}

function espnTeamScheduleGamesV30_(window,season) {
  var requests=MATCHUP_MONSTER_V30.nbaTeamSlugs.map(function(team){return {url:'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/'+team+'/schedule?season='+season+'&seasontype=2',method:'get',headers:{Accept:'application/json'},muteHttpExceptions:true,followRedirects:true};});
  return parseEspnGamesV30_(UrlFetchApp.fetchAll(requests),window);
}

function nbaWeekScheduleV30_(requestedWeek,force,providedSeasonSnapshot,providedSeasonError) {
  var window=fantasyWeekWindowV30_(requestedWeek),cache=CacheService.getScriptCache(),cacheKey=MATCHUP_MONSTER_V30.scheduleCacheKey+window.week,cached=cache.get(cacheKey);
  if(!force&&cached){try{return JSON.parse(cached);}catch(e){}}
  var games=[],source=MATCHUP_MONSTER_V30.nbaScheduleSource,errors=[],siteSeason=null,officialFallback=false,seasonSnapshot=null;
  if(arguments.length>=3){seasonSnapshot=providedSeasonSnapshot;if(providedSeasonError)errors.push('ESPN Fantasy Saisonplan: '+String(providedSeasonError));}
  else {try{seasonSnapshot=refreshEspnNbaScheduleV33_(force);}catch(seasonErr){errors.push('ESPN Fantasy Saisonplan: '+String(seasonErr));}}
  if(seasonSnapshot&&seasonSnapshot.games){
    source=seasonSnapshot.source+(seasonSnapshot.persistedFallback?' · letzter gültiger Stand':'');
    if(seasonSnapshot.error)errors.push('ESPN Fantasy Saisonplan: '+String(seasonSnapshot.error));
    games=seasonSnapshot.games.filter(function(game){return game.date>=window.start&&game.date<=window.lookaheadEnd;});
    siteSeason=seasonSnapshot.seasonId||ESPN_SYNC_V1.seasonId;
  }
  if(!games.length){
    source='ESPN NBA Scoreboard';
    try{games=espnScoreboardGamesV30_(window);}catch(scoreboardErr){errors.push('ESPN Scoreboard: '+String(scoreboardErr));}
  }
  if(!games.length){
    source='NBA.com Official Schedule';
    try{games=officialNbaScheduleGamesV31_(window);}catch(nbaErr){errors.push('NBA.com Feed: '+String(nbaErr));}
  }
  if(!games.length){
    for(var seasonIndex=0;seasonIndex<MATCHUP_MONSTER_V30.nbaSiteSeasons.length&&!games.length;seasonIndex++){
      siteSeason=MATCHUP_MONSTER_V30.nbaSiteSeasons[seasonIndex];source='ESPN NBA Team Schedules · '+siteSeason;
      try{games=espnTeamScheduleGamesV30_(window,siteSeason);}catch(teamErr){errors.push('Team Schedules '+siteSeason+': '+String(teamErr));}
    }
  }
  if(!games.length){
    games=officialSnapshotGamesV31_(window);
    if(games.length){source='NBA.com Official Schedule · verifizierter Test-Fallback';officialFallback=true;}
  }
  var inWeekGames=games.filter(function(game){return game.date>=window.start&&game.date<=window.end&&!/POSTPONED|SUSPENDED|CANCELLED|CANCELED|REMOVED/i.test(String(game.status||''));}),teamGames={};
  inWeekGames.forEach(function(game){game.teams.forEach(function(team){teamGames[team]=(teamGames[team]||0)+1;});});
  var out={generated:new Date().toISOString(),source:source,nbaSiteSeason:siteSeason,matchupWeek:window.week,
    rangeStart:window.start,rangeEnd:window.end,lookaheadEnd:window.lookaheadEnd,games:games,teamGames:teamGames,
    backToBack:monsterBackToBackV30_(games,window.end),officialFallback:officialFallback,scheduleUrl:'https://www.nba.com/schedule',
    dataIssue:games.length?'':'Für diesen Zeitraum konnte noch kein offizieller NBA-Spielplan geladen werden.',errors:errors};
  try{cache.put(cacheKey,JSON.stringify(out),games.length?21600:180);}catch(e2){}
  return out;
}

function compactEspnNbaSeasonScheduleV33_(snapshot,error) {
  var games=snapshot&&snapshot.games||[];
  return {season:ESPN_SYNC_V1.seasonLabel,seasonId:ESPN_SYNC_V1.seasonId,
    source:snapshot&&snapshot.source||MATCHUP_MONSTER_V30.nbaScheduleSource,
    lastSeen:snapshot&&snapshot.lastSeen||null,lastChanged:snapshot&&snapshot.lastChanged||null,
    complete:!!(snapshot&&snapshot.complete),gameCount:games.length,teamCount:Number(snapshot&&snapshot.teamCount||0),
    persistedFallback:!!(snapshot&&snapshot.persistedFallback),warning:String(snapshot&&snapshot.error||''),games:games.map(function(game){return {
      gameId:String(game.id||''),date:String(game.date||''),away:String(game.awayTeam||(game.teams||[])[0]||''),
      home:String(game.homeTeam||(game.teams||[])[1]||''),status:String(game.status||''),scoringPeriod:Number(game.scoringPeriod||0)
    };}),dataIssue:games.length?'':String(error||'Kein vollständig validierter ESPN-Saisonspielplan verfügbar.')};
}

function buildMonsterPayloadV30_(requestedWeek,force) {
  var players=sheetObjectsV2_(ESPN_PLAYER_HUB_V2.playersSheet),roster=sheetObjectsV2_(ESPN_PLAYER_HUB_V2.rosterSheet),playerMap={};
  players.forEach(function(player){playerMap[String(player.player_id||'')]=player;});
  var compactRoster=roster.map(function(row){var player=playerMap[String(row.player_id||'')]||{};return {
    team:String(row.team||''),teamId:String(row.team_id||''),playerId:String(row.player_id||''),name:String(row.player_name||player.full_name||''),
    nbaTeam:nbaAbbreviationV3_(player.nba_team_id),slot:Number(row.lineup_slot_id),active:row.active_lineup===true||String(row.active_lineup).toUpperCase()==='TRUE',
    injuryStatus:String(player.injury_status||''),photo:String(row.headshot_url||player.headshot_url||espnHeadshotV2_(row.player_id))
  };}).filter(function(row){return row.team&&row.playerId;});
  var seasonSnapshot=null,seasonError='';
  try{seasonSnapshot=refreshEspnNbaScheduleV33_(force);}catch(error){seasonError=String(error&&error.message?error.message:error);}
  var schedule=monsterFbaScheduleV30_(),nbaSchedule=nbaWeekScheduleV30_(requestedWeek,force,seasonSnapshot,seasonError);
  var nbaSeasonSchedule=compactEspnNbaSeasonScheduleV33_(seasonSnapshot,seasonError);
  return {ok:true,version:34,generated:new Date().toISOString(),roster:compactRoster,schedule:schedule,nbaSchedule:nbaSchedule,nbaSeasonSchedule:nbaSeasonSchedule,
    scheduleMeta:{season:ESPN_SYNC_V1.seasonLabel,matchups:schedule.length,weeks:schedule.reduce(function(max,row){return Math.max(max,row.week||0);},0),source:'ESPN Fantasy Schedule'},
    sourceStatus:[
      {id:'espn',label:'ESPN Liga, Kader und '+schedule.length+' FBA-Matchups',active:true},
      {id:'nba',label:nbaSchedule.source+' · '+nbaSchedule.games.length+' NBA-Spiele inkl. Montag-Lookahead · Saison '+nbaSeasonSchedule.gameCount,active:!!nbaSchedule.games.length},
      {id:'fantasypros',label:'FantasyPros Projektionen – Adapter bereit, Lizenz/API-Schlüssel fehlt',active:false},
      {id:'hashtag',label:'Hashtag Basketball – Adapter bereit, Premium-Export fehlt',active:false}
    ]};
}

function matchupMonsterResponseV30_(p) {
  var action=String(p.monster||'');
  if(action==='login'){
    var token=createMonsterDeviceV29_(p.pin||'');
    return monsterJsonResponseV29_(token?{ok:true,token:token,persistent:true}:{ok:false,error:'PIN ungültig oder abgelaufen.'},p.callback);
  }
  if(action==='data'){
    if(!validMonsterDeviceV29_(p.token||''))return monsterJsonResponseV29_({ok:false,error:'Gerät nicht freigeschaltet.',locked:true},p.callback);
    try{return monsterJsonResponseV29_(buildMonsterPayloadV30_(p.week,String(p.refresh||'')==='1'),p.callback);}catch(err){return monsterJsonResponseV29_({ok:false,error:String(err)},p.callback);}
  }
  return monsterJsonResponseV29_({ok:false,error:'Unbekannte Monster-Aktion.'},p.callback);
}

function espnSyncIntervalMinutesV2_() {
  var hour=Number(Utilities.formatDate(new Date(),ESPN_SYNC_V1.timezone,'H'));
  return hour>=ESPN_PLAYER_HUB_V2.nightStartHour||hour<ESPN_PLAYER_HUB_V2.nightEndHour?ESPN_PLAYER_HUB_V2.nightIntervalMinutes:ESPN_PLAYER_HUB_V2.dayIntervalMinutes;
}
function syncEspnIfStale_(force) {
  var p=espnPropertiesV1_();if(!force&&p.getProperty('FBA_ESPN_ENABLED')!=='1')return getEspnSyncStatus_();
  var last=p.getProperty('FBA_ESPN_LAST_ATTEMPT'),interval=espnSyncIntervalMinutesV2_();
  if(!force&&last){var age=Date.now()-new Date(last).getTime();if(!isNaN(age)&&age<interval*60000)return getEspnSyncStatus_();}
  return syncEspnData();
}
function syncEspnScheduled(){return syncEspnIfStale_(false);}
function installEspnSync() {
  ensureEspnSheetsV1_();ensureEspnPlayerHubSheetsV2_();
  ScriptApp.getProjectTriggers().forEach(function(trigger){if(trigger.getHandlerFunction()==='syncEspnScheduled')ScriptApp.deleteTrigger(trigger);});
  ScriptApp.newTrigger('syncEspnScheduled').timeBased().everyMinutes(30).create();
  espnPropertiesV1_().setProperty('FBA_ESPN_ENABLED','1');
  var result=syncEspnData();
  try{SpreadsheetApp.getUi().alert('ESPN-Automatik aktiv','Tagsüber Prüfung stündlich, nachts alle 30 Minuten.\nStatus: '+result.lastStatus+'\nMatchups: '+result.lastRows+'\nPlayer Hub: '+result.playerStatus,SpreadsheetApp.getUi().ButtonSet.OK);}catch(e){}
  return result;
}
function getEspnSyncStatus_() {
  var p=espnPropertiesV1_();return {enabled:p.getProperty('FBA_ESPN_ENABLED')==='1',leagueId:ESPN_SYNC_V1.leagueId,seasonId:ESPN_SYNC_V1.seasonId,seasonKey:ESPN_SYNC_V1.seasonKey,
    lastAttempt:p.getProperty('FBA_ESPN_LAST_ATTEMPT')||null,lastSuccess:p.getProperty('FBA_ESPN_LAST_SUCCESS')||null,lastStatus:p.getProperty('FBA_ESPN_LAST_STATUS')||'NOCH_NICHT_AUSGEFUEHRT',
    lastRows:Number(p.getProperty('FBA_ESPN_LAST_ROWS')||0),lastError:p.getProperty('FBA_ESPN_LAST_ERROR')||null,playerStatus:p.getProperty('FBA_ESPN_PLAYER_STATUS')||'NOCH_NICHT_AUSGEFUEHRT',
    playerLastSuccess:p.getProperty('FBA_ESPN_PLAYER_LAST_SUCCESS')||null,playerCount:Number(p.getProperty('FBA_ESPN_PLAYER_COUNT')||0),rosterCount:Number(p.getProperty('FBA_ESPN_ROSTER_COUNT')||0),
    transactionCount:Number(p.getProperty('FBA_ESPN_TRANSACTION_COUNT')||0),dailyCount:Number(p.getProperty('FBA_ESPN_DAILY_COUNT')||0),
    nbaScheduleLastSuccess:p.getProperty('FBA_ESPN_NBA_SCHEDULE_LAST_SUCCESS_V33')||null,
    nbaScheduleGameCount:Number(p.getProperty('FBA_ESPN_NBA_SCHEDULE_GAME_COUNT_V33')||0),
    nbaScheduleSource:p.getProperty('FBA_ESPN_NBA_SCHEDULE_SOURCE_V33')||null,nextIntervalMinutes:espnSyncIntervalMinutesV2_()};
}

/* ================ DRAFT-PROGNOSE v3 ================
 * Nach diesem einmaligen Ausbau ist die Prognose ohne Netlify-Deploy direkt
 * im Blatt ESPN_Draft_Prognose änderbar. Die ESPN_PLAYER_ID ist die Quelle;
 * Name, Kürzel, NBA-Team und Headshot werden nach Möglichkeit automatisch aus
 * ESPN_Players ergänzt.
 */
var ESPN_DRAFT_PREDICTION_SHEET_V3 = 'ESPN_Draft_Prognose';
var ESPN_DRAFT_PREDICTION_HEADERS_V3 = ['PICK','ESPN_PLAYER_ID','SPIELER_FALLBACK','KURZNAME_FALLBACK','NBA_TEAM_FALLBACK','AKTIV'];
var ESPN_DRAFT_PREDICTION_DEFAULTS_V3 = [
  [1,'3112335','Nikola Jokić','Jokić','DEN',true],
  [2,'5104157','Victor Wembanyama','Wembanyama','SAS',true],
  [3,'3945274','Luka Dončić','Dončić','LAL',true],
  [4,'4278073','Shai Gilgeous-Alexander','Shai','OKC',true],
  [5,'3032977','Giannis Antetokounmpo','Giannis','MIL',true],
  [6,'4432166','Cade Cunningham','Cade','DET',true],
  [7,'4594268','Anthony Edwards','Edwards','MIN',true],
  [8,'4065648','Jayson Tatum','Tatum','BOS',true]
];

function ensureDraftPredictionSheetV3_() {
  var sh = book().getSheetByName(ESPN_DRAFT_PREDICTION_SHEET_V3);
  if (!sh) sh = book().insertSheet(ESPN_DRAFT_PREDICTION_SHEET_V3);
  var first = sh.getRange(1,1).getValue();
  if (!first) {
    sh.getRange(1,1,1,ESPN_DRAFT_PREDICTION_HEADERS_V3.length).setValues([ESPN_DRAFT_PREDICTION_HEADERS_V3]);
    sh.getRange(2,1,ESPN_DRAFT_PREDICTION_DEFAULTS_V3.length,ESPN_DRAFT_PREDICTION_HEADERS_V3.length).setValues(ESPN_DRAFT_PREDICTION_DEFAULTS_V3);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,ESPN_DRAFT_PREDICTION_HEADERS_V3.length).setFontWeight('bold').setBackground('#F4712C').setFontColor('#FFFFFF');
    sh.getRange(2,2,Math.max(1,sh.getMaxRows()-1),1).setNumberFormat('@');
    sh.setColumnWidth(1,70);sh.setColumnWidth(2,145);sh.setColumnWidth(3,210);sh.setColumnWidth(4,170);sh.setColumnWidth(5,155);sh.setColumnWidth(6,80);
  }
  return sh;
}

function nbaAbbreviationV3_(proTeamId) {
  var map={1:'ATL',2:'BOS',3:'NOP',4:'CHI',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GSW',10:'HOU',11:'IND',12:'LAC',13:'LAL',14:'MIA',15:'MIL',16:'MIN',17:'BKN',18:'NYK',19:'ORL',20:'PHI',21:'PHX',22:'POR',23:'SAC',24:'SAS',25:'OKC',26:'UTA',27:'WAS',28:'TOR',29:'MEM',30:'CHA'};
  return map[Number(proTeamId)] || '';
}
function shortPlayerNameV3_(fullName, fallback) {
  var name=String(fullName||'').trim();if(!name)return String(fallback||'');
  if(/^Shai\b/i.test(name))return 'Shai';
  var parts=name.split(/\s+/);return parts.length>1?parts[parts.length-1]:name;
}
function activePredictionV3_(value) {
  if (value === false || Number(value) === 0) return false;
  var s=String(value==null?'':value).trim().toUpperCase();return s!== 'NEIN' && s!== 'FALSE' && s!== 'AUS';
}
function buildDraftPredictionsV3_() {
  var sh=book().getSheetByName(ESPN_DRAFT_PREDICTION_SHEET_V3);if(!sh||sh.getLastRow()<2)return [];
  var values=sh.getDataRange().getValues(),header={};
  values[0].forEach(function(v,i){header[String(v||'').trim().toUpperCase()]=i;});
  var playerRows=sheetObjectsV2_(ESPN_PLAYER_HUB_V2.playersSheet),players={};
  playerRows.forEach(function(p){players[String(p.player_id||'')]=p;});
  return values.slice(1).map(function(row){
    var pick=Number(row[header.PICK]),id=String(row[header.ESPN_PLAYER_ID]==null?'':row[header.ESPN_PLAYER_ID]).trim(),player=players[id]||{},
      fallbackName=String(row[header.SPIELER_FALLBACK]||''),fallbackShort=String(row[header.KURZNAME_FALLBACK]||''),fallbackNba=String(row[header.NBA_TEAM_FALLBACK]||'');
    if(!pick||!id)return null;
    var name=String(player.full_name||fallbackName||('ESPN Spieler '+id));
    return {position:pick,id:id,name:name,short:player.full_name?shortPlayerNameV3_(name,fallbackShort):(fallbackShort||shortPlayerNameV3_(name,'')),
      nba:nbaAbbreviationV3_(player.nba_team_id)||fallbackNba||'NBA',active:activePredictionV3_(row[header.AKTIV])};
  }).filter(function(x){return x;}).sort(function(a,b){return a.position-b.position;});
}
