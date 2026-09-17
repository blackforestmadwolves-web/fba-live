/* Context for homepage reports only. Reads real rosters, never local test picks. */
(function () {
  'use strict';
  const cats = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FG%', 'FT%'];
  const countNames = { PTS: 'Punkte', REB: 'Rebounds', AST: 'Assists', '3PM': 'Dreier', STL: 'Steals', BLK: 'Blocks' };
  const teamIds = { 1: 'Balingen Lions', 2: 'Karlsruhe Unicorns', 3: 'Bishkek Easy Snipers', 4: 'Guardians of Rhinos', 5: 'East Bay Pirates', 6: 'Toronto Polar Bears', 7: 'BlackForest Mad Wolves', 8: 'Dormettingen Eagles' };
  const state = { roster: null, pending: false, attempted: 0, refreshWeek: -1 };
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const key = v => {
    const s = String(v || ''), m = s.match(/^S(\d{2})_(\d{2})$/i) || s.match(/^20(\d{2})[\/_-](?:20)?(\d{2})$/);
    return m ? `20${m[1]}-${m[2]}` : /^20\d{2}$/.test(s) ? `${Number(s) - 1}-${s.slice(-2)}` : '';
  };
  const canon = v => String(typeof canonicalTeamName === 'function' ? canonicalTeamName(v) || '' : v || '').trim();
  const short = v => typeof T === 'function' ? T(v).s || v : v;
  const named = v => Object.values(teamIds).includes(v) || v === 'Wild Cheetahs' ? `die ${short(v)}` : short(v);
  const stamp = v => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const fresh = (v, now) => v && Number.isFinite(Date.parse(v)) && now - Date.parse(v) >= -300000 && now - Date.parse(v) <= 36 * 3600000;

  // The report week follows the existing FBA calendar. Its Monday edition
  // turns over at 08:00 Europe/Berlin, even before the first stats arrive.
  function calendarWeek(data, live, now = Date.now()) {
    const season = key(data.appConfig && (data.appConfig.seasonCode || data.appConfig.currentSeason));
    if (!season) return 0;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
    const p = Object.fromEntries(parts.map(x => [x.type, x.value])), today = `${p.year}-${p.month}-${p.day}`;
    const currentNames = (data.draft && data.draft.teams || []).map(t => canon(t.team));
    const fallbackAllowed = season === '2026-27' && Object.values(teamIds).every(t => currentNames.includes(t)) && (!data.espnSync || !data.espnSync.leagueId || String(data.espnSync.leagueId) === '1152091056');
    const liveSeason = key(live && live.scheduleMeta && (live.scheduleMeta.seasonCode || live.scheduleMeta.season));
    const rows = live && live.ok && liveSeason === season && Array.isArray(live.schedule) ? live.schedule : Array.isArray(data.schedule) ? data.schedule.filter(r => key(r.seasonCode || r.season || r.season_id || data.meta && data.meta.season) === season) : [];
    let current = 0;
    for (let week = 1; week <= 18; week++) {
      const starts = [...new Set(rows.filter(r => Number(r.week) === week).map(r => String(r.start || r.date_start || '')).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
      const start = starts.length === 1 ? starts[0] : starts.length === 0 && fallbackAllowed && typeof monsterFallbackWeekDates === 'function' ? monsterFallbackWeekDates(week).start : '';
      if (start && (start < today || start === today && Number(p.hour) >= 8)) current = week;
    }
    return current;
  }
  function currentWeek(data, live, now = Date.now()) {
    const season = key(data.appConfig && (data.appConfig.seasonCode || data.appConfig.currentSeason));
    const fromEspn = state.roster && state.roster.season === season && fresh(state.roster.updatedAt, now) ? state.roster.currentWeek : 0;
    return calendarWeek(data, live, now) || fromEspn || 0;
  }

  // Season/week-specific aliases from the supplied Team_Mapping sheet. Keep
  // different franchises separate, particularly Snipers and Wild Cheetahs.
  function historicalName(value, season, week) {
    let name = canon(value);
    if (/^Bishkek (?:Bishkek )?Easy\$?s?nipers$/i.test(name)) return 'Bishkek Easy Snipers';
    const rules = season === '2019-20' ? [
      ['Desischsuppa', 1, 10, 'Dormettingen Eagles'], ['Franchise Killer', 1, 5, 'BlackForest Mad Wolves'],
      ['Wolf of Statsheet', 6, 13, 'BlackForest Mad Wolves'], ['BGV Badische Versicherungen', 1, 13, 'Karlsruhe Unicorns'],
      ['Deutschland Dragon Slayer', 1, 13, 'Guardians of Rhinos'], ['BBC Losters 08', 1, 13, 'Balingen Lions'],
      ['Trossingen Wilde Kerle', 1, 13, 'Wild Cheetahs'], ['Chinas Bricks', 1, 13, 'East Bay Pirates']
    ] : season === '2020-21' ? [
      ['Walter White Sox', 1, 18, 'Balingen Lions'], ['BGV Badische Versicherungen', 1, 5, 'Karlsruhe Unicorns'],
      ['SV Tasmania Berlin', 6, 9, 'Karlsruhe Unicorns'], ['New Balance Kahwaii Five-O', 10, 18, 'Karlsruhe Unicorns']
    ] : [];
    const rule = rules.find(r => r[0] === name && week >= r[1] && week <= r[2]);
    return rule ? rule[3] : name;
  }
  function historyRows(data, catalog, season, week, current) {
    const grouped = new Map();
    function add(row, s, raw) {
      const sk = key(s.key || s.season), w = Number(row.week);
      if (!sk || sk > season || !Number.isInteger(w) || w < 1 || /all.?star/i.test(String(row.phase || '') + String(row.mu || ''))) return;
      if (sk === season && w >= Math.min(week, current)) return;
      if (sk === season && /^(LIVE|IN_PROGRESS|SCHEDULED|NOT_STARTED|WAITING)$/i.test(String(row.status || ''))) return;
      const away = historicalName(raw ? row.a : row.away, sk, w), home = historicalName(raw ? row.b : row.home, sk, w);
      if (!away || !home || away === home) return;
      let score = [row.a, row.h];
      if (raw) {
        if (!cats.every(c => Array.isArray(row[c]) && row[c].length === 2 && row[c].every(v => finite(v) && v >= 0 && (!c.includes('%') || v <= 1)))) return;
        if (!cats.slice(0, 6).some(c => row[c].some(v => v > 0))) return;
        const a = cats.filter(c => row[c][0] > row[c][1]).length;
        score = [a, 8 - a];
      }
      if (!score.every(v => finite(v) && Number.isInteger(v) && v >= 0) || score[0] + score[1] !== 8) return;
      const id = `${sk}|${w}|${[away, home].sort().join('|')}`, entry = { season: sk, week: w, away, home, score, raw };
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(entry);
    }
    (data.seasons || []).forEach(s => (s.results || []).forEach(r => add(r, s, false)));
    (catalog.seasons || []).forEach(s => (s.games || []).forEach(r => add(r, s, true)));
    (data.statsRaw || []).forEach(r => {
      const sk = r.seasonCode || r.season || r.season_id || data.meta && data.meta.season;
      if (key(sk) === season) add(r, { key: sk }, true);
    });
    const feed = data.matchupHome;
    if (feed && feed.schema === 1 && key(feed.seasonCode) === season) (feed.weeks || []).forEach(w => {
      if (w.status === 'DATA_ISSUE') return;
      (w.matches || []).filter(m => m.status === 'FINAL').forEach(m => {
        const row = { week: Number(w.week), a: m.away, b: m.home, status: 'FINAL' };
        (m.points || []).forEach(p => { if (cats.includes(p.key)) row[p.key] = p.values; });
        const computed = cats.every(c => Array.isArray(row[c]) && row[c].length === 2 && row[c].every(finite)) ? cats.filter(c => row[c][0] > row[c][1]).length : null;
        if (computed !== null && Array.isArray(m.score) && m.score[0] === computed && m.score[1] === 8 - computed) add(row, { key: season }, true);
      });
    });
    // Raw categories use the app's home-team tie rule. Ignore conflicting
    // duplicate source rows instead of inventing an outcome.
    return [...grouped.values()].flatMap(rows => {
      const preferred = rows.some(r => r.raw) ? rows.filter(r => r.raw) : rows;
      const first = preferred[0];
      const agrees = preferred.every(r => r.away === first.away ? r.score[0] === first.score[0] : r.score[1] === first.score[0]);
      return agrees ? [first] : [];
    }).sort((a, b) => a.season.localeCompare(b.season) || a.week - b.week);
  }
  function history(rows, away, home, baseline) {
    const games = rows.filter(r => r.away === away && r.home === home || r.away === home && r.home === away);
    const saved = baseline && baseline.matrix[away] && baseline.matrix[away][home];
    const validSaved = Array.isArray(saved) && saved.length === 3 && saved.every(v => finite(v) && Number.isInteger(v) && v >= 0);
    const record = validSaved ? saved.slice() : [0, 0, 0];
    games.filter(g => !validSaved || g.season > baseline.through).forEach(g => { const a = g.away === away ? g.score[0] : g.score[1], h = 8 - a; record[a > h ? 0 : a < h ? 1 : 2]++; });
    let streak = 0, winner = '';
    for (let i = games.length - 1; i >= 0; i--) {
      const g = games[i], name = g.score[0] === g.score[1] ? '' : g.score[0] > g.score[1] ? g.away : g.home;
      if (!name || winner && winner !== name) break;
      winner = name; streak++;
    }
    return { games, record, total: record.reduce((a, b) => a + b, 0), streak, winner, last: games[games.length - 1] || null };
  }

  function seasonForm(rows, team, season, through) {
    const own = rows.filter(r => r.season === season && r.week <= through && (r.away === team || r.home === team));
    const games = [];
    for (let week = 1; week <= through; week++) {
      const found = own.filter(g => g.week === week);
      if (found.length !== 1) continue;
      const g = found[0], points = g.score[g.away === team ? 0 : 1];
      games.push({ ...g, result: points > 4 ? 'W' : points < 4 ? 'L' : 'T', points });
    }
    const wins = games.filter(g => g.result === 'W').length, losses = games.filter(g => g.result === 'L').length, ties = games.length - wins - losses;
    let streak = 0, streakType = '';
    for (let week = through; week >= 1; week--) {
      const g = games.find(r => r.week === week);
      if (!g || g.result === 'T' || streakType && g.result !== streakType) break;
      streakType = g.result; streak++;
    }
    return { team, through, games, played: games.length, wins, losses, ties, complete: games.length === through, streak, streakType };
  }
  function formSentence(f) {
    const name = short(f.team);
    if (!f.through) return '';
    if (!f.played) return `Für ${name} stehen die Ergebnisse der bisherigen Saisonwochen noch aus.`;
    const record = `${f.wins} ${f.wins === 1 ? 'Sieg' : 'Siege'}${f.ties ? ', ' : ' und '}${f.losses} ${f.losses === 1 ? 'Niederlage' : 'Niederlagen'}${f.ties ? ` und ${f.ties} Unentschieden` : ''}`;
    if (!f.complete) return `Für ${name} ${f.played === 1 ? 'ist' : 'sind'} ${f.played} von ${f.through} bisherigen Saisonduellen bestätigt: ${record}.`;
    if (f.wins === f.played) return `${name}: ${f.wins} ${f.wins === 1 ? 'Sieg aus einem Duell' : `Siege aus ${f.played} Duellen`}${f.wins >= 3 ? ' – eine makellose Serie zum Saisonstart' : ''}.`;
    let text = `Die Saisonbilanz von ${name}: ${record}`;
    if (f.streak >= 2) text += f.streakType === 'W' ? `. Zuletzt gab es ${f.streak} Siege in Folge` : `. Zuletzt gab es ${f.streak} Niederlagen in Folge`;
    else if (f.played >= 3 && f.losses > f.wins) text += ' – bislang ein wackeliger Saisonstart';
    else if (!f.losses && f.wins) text += ' – weiterhin ungeschlagen';
    return text + '.';
  }

  function parseRoster(payload, data, retrievedAt) {
    const season = key(data.appConfig && (data.appConfig.seasonCode || data.appConfig.currentSeason));
    const league = String(data.espnSync && data.espnSync.leagueId || '1152091056');
    if (!payload || String(payload.id) !== league || key(payload.seasonId) !== season || !Array.isArray(payload.teams)) return null;
    const teams = (data.draft && data.draft.teams || []).map(r => canon(r.team));
    if (teams.length !== 8 || payload.teams.length !== 8 || new Set(payload.teams.map(t => t.id)).size !== 8 || !payload.teams.every(t => teams.includes(teamIds[t.id]))) return null;
    const drafted = payload.draftDetail && payload.draftDetail.drafted === true;
    const roster = [], ids = new Set();
    for (const team of payload.teams) {
      if (drafted && (!team.roster || !Array.isArray(team.roster.entries))) return null;
      for (const entry of drafted ? team.roster.entries : []) {
        const p = entry.playerPoolEntry && entry.playerPoolEntry.player;
        if (!p || p.id == null || !p.fullName || ids.has(String(p.id))) return null;
        ids.add(String(p.id));
        roster.push({ playerId: String(p.id), team: teamIds[team.id], name: p.fullName, injuryStatus: String(p.injuryStatus || ''), injured: p.injured === true });
      }
    }
    return { season, league, drafted, roster, updatedAt: retrievedAt, currentWeek: Number(payload.status && payload.status.currentMatchupPeriod) || 0 };
  }
  function source(data, live, season, now) {
    if (state.roster && state.roster.season === season && fresh(state.roster.updatedAt, now)) return state.roster;
    const sync = data.espnSync || {}, updatedAt = live && live.rosterUpdatedAt || sync.rosterLastSuccess || sync.lastSuccess;
    const draftReady = live && live.drafted === true || ['REGULAR_SEASON', 'REGULAR', 'PLAYOFFS', 'POSTSEASON'].includes(String(data.appConfig && (data.appConfig.effectivePhase || data.appConfig.phase)));
    if (live && live.ok && key(live.scheduleMeta && live.scheduleMeta.season) === season && draftReady && Array.isArray(live.roster) && fresh(updatedAt, now)) return { season, drafted: true, roster: live.roster, updatedAt };
    return null;
  }
  function statusText(row) {
    const status = String(row.injuryStatus || '').toUpperCase().replace(/[ _]+/g, '-');
    if (/^(OUT|OFS|IR|INJURED-RESERVE|INJURY-RESERVE|OUT-FOR-SEASON)$/.test(status)) return { certain: true, text: 'wird bei ESPN als ausfallend geführt' };
    if (/^(QUESTIONABLE|GTD|DAY-TO-DAY|DTD|DOUBTFUL)$/.test(status)) return { certain: false, text: status === 'DOUBTFUL' ? 'wird bei ESPN als voraussichtlich nicht einsatzfähig geführt' : 'ist laut ESPN für den nächsten Einsatz fraglich' };
    return null;
  }
  function injuries(match, ctx) {
    if (!ctx.source || !ctx.source.drafted || ctx.week !== ctx.current || match.status === 'FINAL') return [];
    const engine = ctx.live && ctx.live.projectionEngine;
    const baseline = engine && engine.baseline || {};
    const ratesReady = engine && engine.active === true && key(baseline.season || baseline.seasonId || engine.season) === ctx.season && /^READY(?:_|$)|^OK$/.test(String(baseline.status || ''));
    const rows = ctx.source.roster || [], seen = new Set();
    return [match.away, match.home].flatMap((team, side) => {
      const found = rows.filter(p => canon(p.team) === team).flatMap(p => {
        const id = String(p.playerId || p.id || ''), status = statusText(p);
        if (!id || !p.name || !status || seen.has(id)) return [];
        seen.add(id);
        const record = ratesReady && (engine.players || []).find(r => String(r.id || r.playerId || r.player_id) === id);
        const base = record && (record.base || record.baseline), gaps = match.points || [];
        const impact = base && gaps.filter(c => countNames[c.key] && finite(base[c.key]) && base[c.key] > 0 && c.values.every(finite)).map(c => ({ cat: c.key, gap: Math.abs(c.values[0] - c.values[1]), perGame: base[c.key] })).filter(c => c.gap <= c.perGame * 2).sort((a, b) => a.gap / a.perGame - b.gap / b.perGame)[0];
        let text = `${p.name} ${status.text} – das betrifft ${short(team)}.`;
        if (impact) text += ` ${status.certain ? 'Das ist für dieses Duell besonders bitter' : 'Ein Ausfall wäre für dieses Duell besonders bitter'}: Bei den ${countNames[impact.cat]} trennen ${short(match.away)} und ${short(match.home)} nur ${impact.gap.toLocaleString('de-DE')} ${countNames[impact.cat]}; seine Projektion liegt bei ${impact.perGame.toLocaleString('de-DE', { maximumFractionDigits: 1 })} pro Spiel.`;
        else if (!status.certain) text += ' Ob er tatsächlich fehlt, steht noch nicht fest.';
        return [{ text, priority: (impact ? 10 : 0) + (status.certain ? 1 : 0), name: p.name, side }];
      }).sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
      return found.slice(0, 1);
    });
  }
  function context(data, model, phase, live, now = Date.now()) {
    const catalog = typeof analyticsCatalog === 'function' ? analyticsCatalog() : data.analytics || { seasons: [] };
    // Reuse the app's verified legacy H2H totals (including its Snipers
    // corrections) when they predate this season. Never use today's cumulative
    // matrix as the history of an earlier week in the same season.
    const through = key(data.meta && data.meta.season);
    const catalogPast = (catalog.seasons || []).every(s => key(s.key) <= through || !(s.games || []).some(g => Number(g.week) >= Number(s.postSeasonStart || 19)));
    const teams = [...new Set([...(data.duels && data.duels.teams || []).map(canon), ...(data.draft && data.draft.teams || []).map(r => canon(r.team))])];
    const baseline = through && through < model.season && catalogPast && typeof duelMatrixForMode === 'function' ? { through, matrix: duelMatrixForMode('ALL', teams) } : null;
    return { season: model.season, week: model.week, current: model.current, through: Math.max(0, Math.min(model.week, model.current) - 1), future: model.week > model.current, phase, live, updatedAt: model.updatedAt, baseline, rows: historyRows(data, catalog, model.season, model.week, model.current), source: source(data, live, model.season, now) };
  }
  function compose(match, week, ctx = {}) {
    const h = history(ctx.rows || [], match.away, match.home, ctx.baseline), a = short(match.away), b = short(match.home);
    const score = match.score, final = match.status === 'FINAL', preview = !score;
    const through = Math.max(0, Math.min(week, ctx.current || week) - 1);
    const forms = [match.away, match.home].map(team => seasonForm(ctx.rows || [], team, ctx.season, through));
    const underdog = h.total && h.record[0] === 0 ? match.away : h.total && h.record[1] === 0 ? match.home : '';
    const leading = score && score[0] !== score[1] ? score[0] > score[1] ? match.away : match.home : '';
    let title = preview ? `${a} gegen ${b}: Das steht auf dem Spiel` : leading ? `${short(leading)} ${final ? 'entscheidet das Duell' : 'liegt vorne'}` : 'Dieses Duell ist ausgeglichen';
    if (preview && forms.every(f => f.complete) && through >= 3) {
      const hot = forms.findIndex(f => f.streakType === 'W' && f.streak >= 3);
      if (hot !== -1 && forms[1 - hot].wins < forms[hot].wins) title = `Kann ${short(forms[1 - hot].team)} den Lauf von ${short(forms[hot].team)} stoppen?`;
    }
    if (underdog && (preview || leading === underdog)) title = final ? `${short(underdog)} durchbricht die Serie` : `${short(underdog)}: Gelingt der erste Sieg?`;
    const result = score && `${Math.max(...score)}:${Math.min(...score)}`;
    const lines = [preview ? `In Woche ${week} treffen ${a} und ${b} aufeinander.` : leading ? final ? `Woche ${week} endet mit einem ${result}-Sieg für ${named(leading)} gegen ${named(leading === match.away ? match.home : match.away)}.` : `Aktuell steht es ${result} für ${named(leading)} gegen ${named(leading === match.away ? match.home : match.away)}.` : `${a} und ${b} ${final ? `beenden Woche ${week} mit einem ${result}-Unentschieden` : `liegen beim ${result} gleichauf`}.`];
    if (h.total) {
      lines.push(`Die Bilanz aus ${h.total} direkten Duellen in Regular Season und Postseason: ${h.record[0]} ${h.record[0] === 1 ? 'Sieg' : 'Siege'} für ${named(match.away)}, ${h.record[1]} für ${named(match.home)}${h.record[2] ? ` und ${h.record[2]} Unentschieden` : ''}.`);
      if (underdog) lines.push(`${short(underdog)} hat in diesen Begegnungen noch keinen Sieg geholt${leading === underdog ? final ? ' und schafft es diesmal, diese Serie zu beenden' : ' und liegt jetzt vorne – eine Chance auf den ersten Erfolg, aber noch keine Entscheidung' : '. Genau das macht dieses Aufeinandertreffen besonders spannend'}.`);
      else if (h.streak >= 2) lines.push(`${short(h.winner)} gewann die letzten ${h.streak} erfassten Aufeinandertreffen in Folge${leading && leading !== h.winner ? final ? '; diesmal setzt sich die andere Seite durch' : '; im laufenden Duell führt allerdings die andere Seite' : ''}.`);
      else if (h.last) {
        const last = h.last, winner = last.score[0] > last.score[1] ? last.away : last.home;
        lines.push(`Das letzte Duell in Woche ${last.week} der Saison ${last.season.replace('-', '/')} endete ${last.score[0] === last.score[1] ? `${last.score[0]}:${last.score[1]} unentschieden zwischen ${short(last.away)} und ${short(last.home)}` : `mit einem ${Math.max(...last.score)}:${Math.min(...last.score)}-Sieg für ${named(winner)}`}.`);
      }
    } else lines.push('Für dieses Duell liegt noch keine belastbare gemeinsame Ergebnishistorie vor.');
    const historyLength = lines.length;
    if (through) lines.push(...forms.map(formSentence));
    if (preview) {
      if (match.status === 'WAITING') lines.push('Die Spieldaten sind noch nicht vollständig; ein Zwischenstand lässt sich deshalb noch nicht einordnen.');
      else if (!through && h.total && h.record[0] === h.record[1]) lines.push(`Der direkte Vergleich ist ausgeglichen. Ein Sieg würde ${a} oder ${b} die Führung in dieser Rivalität bringen.`);
      else if (!through && h.total && !underdog) lines.push(`${h.record[0] > h.record[1] ? a : b} kann den Vorsprung im direkten Vergleich ausbauen; ${h.record[0] > h.record[1] ? b : a} hat die Chance, den Abstand zu verkürzen.`);
      else if (!through) lines.push('Zum Saisonauftakt kann dieses Duell die erste Geschichte des Jahres schreiben.');
    } else {
      const closest = (match.points || []).filter(p => countNames[p.key]).slice().sort((x, y) => Math.abs(x.values[0] - x.values[1]) / Math.max(...x.values, 1) - Math.abs(y.values[0] - y.values[1]) / Math.max(...y.values, 1))[0];
      if (closest) lines.push(`Bei den ${countNames[closest.key]} ${final ? 'lagen' : 'liegen'} beide besonders dicht zusammen: ${closest.values[0].toLocaleString('de-DE')} für ${a}, ${closest.values[1].toLocaleString('de-DE')} für ${b}.`);
      if (match.gp && match.gp.every(finite) && match.gp[0] !== match.gp[1]) lines.push(`Der Spielstand entstand mit ${match.gp[0]} gewerteten Einsätzen für ${a} und ${match.gp[1]} für ${b}; das unterschiedliche Spielvolumen gehört zur Einordnung dazu.`);
    }
    const news = injuries(match, ctx);
    lines.push(...news.map(r => r.text));
    if (!preview && !news.length && match.performance && match.performance.every(p => p.status === 'READY')) {
      const pw = p => `${p.value > 0 ? '+' : ''}${(p.value * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })}%`;
      lines.push(`Die Team-PW pro Einsatz liegt bei ${pw(match.performance[0])} für ${a} und ${pw(match.performance[1])} für ${b}${week === 2 ? ' – nach einer Vergleichswoche eine erste Tendenz' : ''}.`);
    }
    if (preview && !through) lines.push(ctx.future ? 'Bis zu diesem Aufeinandertreffen wird sich zeigen, welches Team mit mehr Rückenwind antritt.' : 'Gesucht ist der bessere Start in die Saison.');
    else if (!preview && !final) lines.push('Die kommenden Einsätze entscheiden, wer die engen Punkte auf seine Seite zieht.');
    const seasonLabel = through ? `Saisonstand nach Woche ${through}${forms.every(f => f.complete) ? '' : ' · noch unvollständig'}` : 'Vor Saisonstart';
    return { title, paragraphs: [lines.slice(0, historyLength).join(' '), lines.slice(historyLength).join(' ')].filter(Boolean), label: preview ? ctx.future ? 'Frühe Vorschau' : 'Wochenvorschau' : final ? 'Abschlussbericht' : 'Wochenbericht', seasonLabel, updatedAt: preview ? '' : ctx.updatedAt || '', injuryUpdatedAt: news.length ? ctx.source.updatedAt : '', historyLabel: h.total ? `Historie vor Woche ${week}` : '' };
  }

  async function maybeRefresh(data, live) {
    const edition = currentWeek(data, live);
    if (typeof fetch !== 'function' || typeof CUR === 'undefined' || CUR !== 'ueber' || document.hidden || state.pending || state.refreshWeek === edition && Date.now() - state.attempted < 900000) return;
    const config = data.appConfig || {}, season = key(config.seasonCode || config.currentSeason), league = String(data.espnSync && data.espnSync.leagueId || '1152091056');
    if (season !== '2026-27' || league !== '1152091056') return;
    state.pending = true; state.attempted = Date.now(); state.refreshWeek = edition;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2027/segments/0/leagues/${league}?view=mRoster&view=mTeam&view=mSettings`;
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
      if (!response.ok) return;
      const parsed = parseRoster(await response.json(), data, new Date().toISOString());
      if (parsed) { state.roster = parsed; state.refreshWeek = currentWeek(data, live); if (CUR === 'ueber' && !document.hidden && typeof render === 'function') render(); }
    } catch (_) { /* Keep the last confirmed context; never fabricate news. */ }
    finally { clearTimeout(timeout); state.pending = false; }
  }
  window.FBA_MATCHUP_REPORTS = { context, compose, history, historyRows, seasonForm, injuries, parseRoster, maybeRefresh, stamp, calendarWeek, currentWeek };
})();
