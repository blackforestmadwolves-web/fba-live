/* Monday previews use the existing projection math and authenticated source.
   Forecasts never enter actual scores, PW, archive results or testdraft state. */
(function () {
  'use strict';
  const cats = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FG%', 'FT%'];
  const fields = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FGM', 'FGA', 'FTM', 'FTA'];
  const state = { data: null, key: '', token: '', fetched: 0, attempted: 0, pending: null, error: '', model: null, publicData: null, phase: null };
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const canon = v => String(typeof canonicalTeamName === 'function' ? canonicalTeamName(v) || '' : v || '').trim();
  const sk = v => {
    const s = String(v || ''), m = s.match(/^S(\d{2})_(\d{2})$/i) || s.match(/^20(\d{2})[\/_-](?:20)?(\d{2})$/);
    return m ? `20${m[1]}-${m[2]}` : s === '2027' ? '2026-27' : '';
  };
  function localDate(now) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
  }
  function edition(model, now = Date.now()) {
    if (!model || model.season !== '2026-27' || !Number.isInteger(model.week) || model.week < 1 || model.week > 18 || typeof monsterFallbackWeekDates !== 'function') return null;
    const dates = monsterFallbackWeekDates(model.week), start = new Date(`${dates.start}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    const monday = start.toISOString().slice(0, 10), today = localDate(now);
    if (today.day < monday || today.day > dates.end || today.day === monday && today.hour < 8) return null;
    return { key: `${model.season}|${model.week}|${monday}`, monday, ...dates };
  }
  function access() {
    return typeof monsterUnlocked === 'function' && monsterUnlocked() && typeof monsterToken === 'function' ? monsterToken() : '';
  }
  function fresh(stamp, now, age = 1800000) {
    const time = Date.parse(stamp);
    return Number.isFinite(time) && now - time >= -300000 && now - time <= age;
  }
  function calculate(data, model, source, now = Date.now()) {
    const fail = message => { throw new Error(message); }, release = edition(model, now);
    if (!release) fail('Die Wochenprognose erscheint am Montag ab 08:00 Uhr.');
    if (!data || !data.ok || sk(data.scheduleMeta && (data.scheduleMeta.seasonCode || data.scheduleMeta.season)) !== model.season) fail('Aktueller Saisonstand für die Prognose fehlt.');
    const pairings = (data.schedule || []).filter(g => Number(g.week) === model.week);
    if (pairings.length !== 4 || model.matches.length !== 4 || model.matches.some(m => pairings.filter(g => canon(g.away) === m.away && canon(g.home) === m.home).length !== 1)) fail('Die aktuellen FBA-Paarungen werden noch abgeglichen.');
    if (!source || source.drafted !== true || source.season !== model.season || !fresh(source.updatedAt, now, 36 * 3600000)) fail('Ein bestätigter aktueller ESPN-Kader fehlt noch.');
    if (Number(data.nbaSchedule && data.nbaSchedule.matchupWeek) !== model.week) fail('Der NBA-Spielplan dieser Woche wird benötigt.');
    const scheduleIssue = monsterProjectionSeasonScheduleIssue(data);
    if (scheduleIssue) fail('Der NBA-Saisonspielplan ist noch unvollständig.');
    const games = monsterProjectionScheduleGames(data);
    const seen = new Set();
    for (const g of games) {
      const id = String(g.gameId || g.id || g.eventId || '');
      if (!id || seen.has(id) || !/^\d{4}-\d{2}-\d{2}$/.test(g.date) || g.away === g.home) fail('Der NBA-Spielplan ist noch nicht eindeutig.');
      seen.add(id);
      const expected = monsterProjectionWeekForDate(g.date);
      if (expected && Number(g.week) !== expected) fail('Ein NBA-Spiel ist einer widersprüchlichen Woche zugeordnet.');
    }
    const weekly = games.filter(g => Number(g.week) === model.week && !monsterProjectionUnavailableGame(g));
    if (!weekly.length) fail('Die NBA-Termine dieser Woche fehlen noch.');
    // Once this NBA week is underway the pregame forecast stops. Actual scores
    // from the normal homepage feed always have priority.
    if (weekly.some(g => !monsterProjectionFutureGame(g) || freshTipoffPassed(g, now))) return { status: 'STARTED', matches: [] };
    const allRoster = (source.roster || []).map(p => ({ ...p, id: String(p.playerId || p.id || ''), team: canon(p.team) }));
    const ids = new Set();
    for (const p of allRoster) { if (!p.id || ids.has(p.id)) fail('Der aktuelle Kader enthält unklare Spielerzuordnungen.'); ids.add(p.id); }
    const runtime = {};
    const matches = model.matches.map(match => {
      if (match.score) return { away: match.away, home: match.home, status: 'ACTUAL' };
      try {
        const roster = allRoster.filter(p => p.team === match.away || p.team === match.home);
        if ([match.away, match.home].some(team => roster.filter(p => p.team === team).length !== 13)) fail('Für beide Teams werden vollständige Kader mit je 13 Spielern benötigt.');
        const engineState = monsterExpertProjectionState(data, roster);
        if (!engineState.ready) fail(engineState.issue || 'Vollständige Projektionen und bestätigte Spieldaten werden noch benötigt.');
        const engine = engineState.engine, records = engine.players || [];
        const totals = [match.away, match.home].map(team => {
          const total = { team, games: 0, scheduled: 0, ...Object.fromEntries(fields.map(f => [f, 0])) };
          for (const p of roster.filter(r => r.team === team)) {
            const found = records.filter(r => String(r.id || r.playerId || r.player_id || '') === p.id);
            if (found.length !== 1) fail('Eine Spielerprojektion fehlt oder ist doppelt.');
            const record = found[0], rosterMeta = (data.roster || []).find(r => String(r.playerId || r.id || '') === p.id && canon(r.team) === team);
            const nba = monsterNbaKey(p.nba || p.nbaTeam || rosterMeta && (rosterMeta.nba || rosterMeta.nbaTeam)) || monsterProjectionRecordNba(record);
            if (!nba || !games.some(g => monsterProjectionOpponent(g, nba))) fail('Ein NBA-Team ist noch nicht eindeutig zugeordnet.');
            if (fields.some(f => !finite(Number(monsterProjectionBase(record)[f])) || Number(monsterProjectionBase(record)[f]) < 0)) fail('Eine Spielerprojektion ist unvollständig.');
            if (monsterProjectionWeekActual(record, model.week).gp > 0) fail('Für diese Woche liegen bereits echte Einsätze vor.');
            const week = monsterProjectionWeeklyPlayer(record, model.week, games, engine, nba, runtime);
            if (!week.scheduledRemainingGames) fail('Für einen Kaderspieler fehlen noch die NBA-Wochentermine.');
            total.games += week.remainingGames; total.scheduled += week.scheduledRemainingGames;
            fields.forEach(f => { total[f] += week.futureTotals[f]; });
          }
          if (!(total.FGA > 0) || !(total.FTA > 0)) fail('Die Wurfvolumina reichen für eine vollständige Prognose noch nicht aus.');
          total['FG%'] = total.FGM / total.FGA; total['FT%'] = total.FTM / total.FTA;
          if (fields.concat(['FG%', 'FT%']).some(f => !finite(total[f]) || total[f] < 0)) fail('Die Wochenwerte sind noch nicht vollständig.');
          return total;
        });
        const points = cats.map(key => ({ key, values: totals.map(t => t[key]) }));
        const away = points.filter(p => p.values[0] > p.values[1]).length;
        return { away: match.away, home: match.home, status: 'READY', score: [away, 8 - away], points, games: totals.map(t => t.games), scheduled: totals.map(t => t.scheduled), updatedAt: data.generated || source.updatedAt };
      } catch (error) { return { away: match.away, home: match.home, status: 'WAITING', message: error.message }; }
    });
    return { status: 'READY', matches };
  }
  function freshTipoffPassed(game, now) {
    const stamp = [game.startTime, game.startDate, game.date].find(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value));
    if (stamp && Number.isFinite(Date.parse(stamp))) return Date.parse(stamp) <= now;
    const ny = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
    const p = Object.fromEntries(ny.map(x => [x.type, x.value]));
    return game.date < `${p.year}-${p.month}-${p.day}`;
  }
  function context(data, model, phase, now = Date.now()) {
    if (!edition(model, now) || model.matches.every(m => m.score)) return { status: 'OFF', matches: [] };
    const token = access();
    if (!token) { state.data = null; return { status: 'LOCKED', matches: [], message: 'Prognose mit vorhandener Monster-Freischaltung verfügbar.' }; }
    const active = state.data && state.key === edition(model, now).key && state.token === token && now - state.fetched < 1800000 ? state.data : null;
    if (!active) return { status: state.pending ? 'LOADING' : 'WAITING', matches: [], message: state.error || 'Die Wochenprognose wird geladen.' };
    const source = window.FBA_MATCHUP_REPORTS.context(data, model, phase, active, now).source;
    try { return calculate(active, model, source, now); }
    catch (error) { return { status: 'WAITING', matches: [], message: error.message }; }
  }
  function maybeRefresh(data, model, phase, now = Date.now()) {
    state.model = model; state.publicData = data; state.phase = phase;
    if (typeof CUR === 'undefined' || CUR !== 'ueber' || document.hidden) return Promise.resolve();
    const release = edition(model, now), token = access();
    if (!release || !token || model.matches.every(m => m.score) || typeof monsterJsonp !== 'function') return Promise.resolve();
    if (state.pending) return state.pending;
    if (state.key === release.key && state.token === token && now - state.attempted < 300000) return Promise.resolve();
    if (context(data, model, phase, now).status === 'STARTED') return Promise.resolve();
    if (state.key !== release.key || state.token !== token) { state.data = null; state.fetched = 0; }
    state.key = release.key; state.token = token; state.attempted = now; state.error = '';
    state.pending = Promise.resolve().then(async () => {
      try {
        const result = await monsterJsonp({ monster: 'data', token, week: model.week });
        if (access() !== token || state.key !== release.key) return;
        if (!result || !result.ok || Number(result.nbaSchedule && result.nbaSchedule.matchupWeek) !== model.week) throw new Error('Die Wochenprognose konnte noch nicht geladen werden.');
        if (!fresh(result.generated, Date.now(), 6 * 3600000)) throw new Error('Die Prognosedaten werden aktualisiert.');
        state.data = result; state.fetched = Date.now();
      } catch (error) { state.error = error.message || 'Prognose derzeit nicht verfügbar.'; state.data = null; }
      finally { state.pending = null; if (CUR === 'ueber' && !document.hidden && typeof render === 'function') render(); }
    });
    return state.pending;
  }
  function pick(ctx, match) { return ctx && ctx.matches && ctx.matches.find(m => m.away === match.away && m.home === match.home && m.status === 'READY') || null; }
  function details(ctx, match) {
    if (match.score || !ctx || ['OFF', 'STARTED'].includes(ctx.status)) return '';
    const forecast = pick(ctx, match);
    if (!forecast) {
      const issue = ctx.matches && ctx.matches.find(m => m.away === match.away && m.home === match.home);
      return `<p class="fmh-forecast-note">${E(issue && issue.message || ctx.message || 'Die Wochenprognose wird vorbereitet.')}${ctx.status === 'LOCKED' ? ' <button type="button" onclick="openMonsterGate()">Freischaltung öffnen</button>' : ''}</p>`;
    }
    const short = team => typeof T === 'function' ? T(team).s || team : team;
    const format = (key, value) => `${(key.includes('%') ? value * 100 : value).toLocaleString('de-DE', { maximumFractionDigits: key.includes('%') ? 2 : 1 })}${key.includes('%') ? '%' : ''}`;
    return `<details class="fmh-point-details fmh-forecast-details"><summary>Prognose im Detail <span aria-hidden="true">⌄</span></summary><p class="fmh-point-note">${E(short(match.away))} links · ${E(short(match.home))} rechts. Aktuelle Kader und NBA-Wochentermine · ohne zusätzliche Pickups.</p><div class="fmh-point-grid">${forecast.points.map(p => `<div><small>${E(p.key)}</small><b><span class="${p.values[0] > p.values[1] ? 'winner' : ''}">${format(p.key, p.values[0])}</span><i>:</i><span class="${p.values[1] >= p.values[0] ? 'winner' : ''}">${format(p.key, p.values[1])}</span></b></div>`).join('')}</div><p class="fmh-point-note">Erwartete Einsätze: ${forecast.games.map(v => format('GP', v)).join(' : ')} · Prognose, kein Spielstand.</p></details>`;
  }
  function refresh() {
    if (state.model && state.publicData && typeof CUR !== 'undefined' && CUR === 'ueber' && !document.hidden) maybeRefresh(state.publicData, state.model, state.phase);
  }
  window.FBA_MATCHUP_FORECAST = { edition, calculate, context, maybeRefresh, pick, details, refresh };
})();
