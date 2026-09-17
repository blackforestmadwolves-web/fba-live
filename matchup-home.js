/* Additive start-page module for the user-supplied v86. No draft or Monster state. */
(function () {
  'use strict';
  const cats = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FG%', 'FT%'];
  const counts = cats.slice(0, 6);
  // Confirmed 2026/27 calendar, read on 2026-09-13 from ESPN league 1152091056,
  // seasonId 2027, mMatchup. Same team-ID mapping as the existing ESPN sync.
  // Pairings only: no historical scores, rosters or projections are bundled here.
  const calendarTeams = ['', 'Balingen Lions', 'Karlsruhe Unicorns', 'Bishkek Easy Snipers', 'Guardians of Rhinos', 'East Bay Pirates', 'Toronto Polar Bears', 'BlackForest Mad Wolves', 'Dormettingen Eagles'];
  const calendar2026 = [
    [[5,7],[1,2],[3,6],[4,8]],
    [[1,5],[7,2],[4,3],[6,8]],
    [[2,5],[7,1],[3,8],[6,4]],
    [[3,2],[6,7],[4,1],[8,5]],
    [[7,3],[1,6],[5,4],[8,2]],
    [[3,1],[6,5],[4,2],[8,7]],
    [[5,3],[2,6],[7,4],[8,1]],
    [[7,5],[2,1],[6,3],[8,4]],
    [[5,1],[2,7],[3,4],[8,6]],
    [[5,2],[1,7],[8,3],[4,6]],
    [[2,3],[7,6],[1,4],[5,8]],
    [[3,7],[6,1],[4,5],[8,2]],
    [[1,3],[5,6],[2,4],[7,8]],
    [[3,5],[6,2],[4,7],[8,1]],
    [[2,7],[1,5],[3,6],[4,8]],
    [[1,2],[5,7],[4,3],[6,8]],
    [[2,5],[7,1],[3,8],[6,4]],
    [[2,3],[7,6],[1,4],[5,8]]
  ];
  const state = { season: '', week: null, currentWeek: 0, lastAttempt: Date.now() };
  const number = value => typeof value === 'number' && Number.isFinite(value);
  const seasonKey = value => {
    const text = String(value || '').trim();
    const short = text.match(/^S(\d{2})_(\d{2})$/i);
    const long = text.match(/^(20\d{2})[\/_-](\d{2}|20\d{2})$/);
    return short ? `20${short[1]}-${short[2]}` : long ? `${long[1]}-${long[2].slice(-2)}` : '';
  };
  const canonical = value => String(typeof canonicalTeamName === 'function' ? canonicalTeamName(value) || '' : value || '').trim();
  const pair = row => [canonical(row.away || row.a), canonical(row.home || row.b)];
  const teamKey = (a, b) => [a, b].sort().join('|');
  const stamp = value => {
    if (!value || !/^\d{4}-\d{2}-\d{2}/.test(String(value))) return '';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  };
  const valueText = (cat, value) => number(value) ? value.toLocaleString('de-DE', { minimumFractionDigits: cat.includes('%') ? 1 : 0, maximumFractionDigits: cat.includes('%') ? 1 : 1, ...(cat.includes('%') ? { style: 'percent' } : {}) }) : '–';
  const deltaText = value => { const n = Math.round(value * 1000) / 10 || 0; return `${n > 0 ? '+' : ''}${n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`; };
  const emptyPW = week => ({ value: null, baselineWeeks: 0, status: week === 1 ? 'FIRST_WEEK' : 'WAITING' });

  function scoped(row, season, parent) {
    const explicit = row && (row.seasonCode || row.season || row.seasonKey || row.season_id);
    return explicit ? seasonKey(explicit) === season : parent === season;
  }
  function pointsValid(points) {
    return Array.isArray(points) && points.length === 8 && new Set(points.map(p => p.key)).size === 8 && cats.every(cat => {
      const point = points.find(p => p.key === cat);
      return point && Array.isArray(point.values) && point.values.length === 2 && point.values.every(v => number(v) && v >= 0 && (!cat.includes('%') || v <= 1));
    });
  }
  function scorePoints(points) {
    let away = 0;
    points.forEach(p => { if (p.values[0] > p.values[1]) away++; });
    return [away, 8 - away];
  }
  function scheduleValid(matches, teams) {
    const names = matches.flatMap(pair);
    return matches.length === 4 && names.length === 8 && names.every(Boolean) && new Set(names).size === 8 && (!teams.length || names.every(name => teams.includes(name)));
  }
  function currentSchedule(data, live, season, parent, week, teams) {
    // Monster already carries the current ESPN calendar independently of the
    // historical public tables. Consume only its explicitly scoped pairings.
    const liveSeason = seasonKey(live && live.scheduleMeta && (live.scheduleMeta.seasonCode || live.scheduleMeta.season));
    const providers = [
      live && live.ok === true && liveSeason === season && Array.isArray(live.schedule) ? live.schedule.filter(row => scoped(row, season, liveSeason)) : [],
      (Array.isArray(data.schedule) ? data.schedule : []).filter(row => scoped(row, season, parent))
    ];
    for (const rows of providers) {
      const selected = rows.filter(row => Number(row.week) === week);
      if (scheduleValid(selected, teams)) return selected;
    }
    // The verified calendar also makes first visits and locked/offline devices
    // useful. It can never become a fallback for another season or team set.
    const league = data.espnSync && data.espnSync.leagueId;
    if (season !== '2026-27' || league && String(league) !== '1152091056' || teams.length !== 8 || !calendarTeams.slice(1).every(team => teams.includes(team))) return [];
    return (calendar2026[week - 1] || []).map(([away, home]) => ({ week, away: calendarTeams[away], home: calendarTeams[home] }));
  }
  function normalizedPW(p, week) {
    if (week === 1 || !p || p.status !== 'READY' || !number(p.value) || p.value < -1 || p.baselineWeeks !== week - 1) return emptyPW(week);
    return { value: p.value, status: 'READY', baselineWeeks: p.baselineWeeks };
  }

  // An optional GP-aware StatsRaw extension can supply this calculation without
  // changing the existing historical Performance page or its week-average model.
  function rawPerformance(rows, finals, team, week) {
    if (week === 1) return emptyPW(week);
    const own = [], base = { gp: 0, stats: Object.fromEntries([...counts, 'FGM', 'FGA', 'FTM', 'FTA'].map(key => [key, 0])) };
    for (let w = 1; w <= week; w++) {
      const found = rows.filter(row => Number(row.week) === w && pair(row).includes(team));
      if (found.length !== 1) return emptyPW(week);
      const row = found[0], index = pair(row).indexOf(team), gp = row.GP && row.GP[index];
      if (row.gpBasis !== 'SCORED_APPEARANCES' || !number(gp) || gp <= 0 || (w < week && !finals.has(`${w}|${teamKey(...pair(row))}`))) return emptyPW(week);
      const stats = {};
      for (const key of Object.keys(base.stats)) {
        const v = row[key] && row[key][index];
        if (!number(v) || v < 0) return emptyPW(week);
        stats[key] = v;
      }
      if (stats.FGM > stats.FGA || stats.FTM > stats.FTA || !stats.FGA || !stats.FTA) return emptyPW(week);
      for (const key of ['FG', 'FT']) {
        const quoted = row[key + '%'] && row[key + '%'][index];
        if (!number(quoted) || Math.abs(stats[key + 'M'] / stats[key + 'A'] - quoted) > .00051) return emptyPW(week);
      }
      if (w === week) own.push({ gp, stats });
      else { base.gp += gp; Object.keys(base.stats).forEach(key => { base.stats[key] += stats[key]; }); }
    }
    const current = own[0], deviations = cats.map(cat => {
      const prefix = cat.slice(0, 2);
      const a = cat.includes('%') ? current.stats[prefix + 'M'] / current.stats[prefix + 'A'] : current.stats[cat] / current.gp;
      const b = cat.includes('%') ? base.stats[prefix + 'M'] / base.stats[prefix + 'A'] : base.stats[cat] / base.gp;
      return b > 0 ? a / b - 1 : null;
    });
    return deviations.every(number) ? { status: 'READY', value: deviations.reduce((a, b) => a + b, 0) / 8, baselineWeeks: week - 1 } : emptyPW(week);
  }

  function build(data, phase, selectedWeek, live) {
    data = data || {};
    const config = data.appConfig || {}, meta = data.meta || {};
    const season = seasonKey(config.seasonCode || config.currentSeason), parent = seasonKey(meta.season || meta.seasonLabel);
    const teams = (data.draft && Array.isArray(data.draft.teams) ? data.draft.teams : []).map(row => canonical(row.team));
    const structured = data.matchupHome && data.matchupHome.schema === 1 && seasonKey(data.matchupHome.seasonCode) === season && Array.isArray(data.matchupHome.weeks) ? data.matchupHome : null;
    const reportWeek = window.FBA_MATCHUP_REPORTS && window.FBA_MATCHUP_REPORTS.currentWeek(data, live);
    const liveWeek = live && live.ok && seasonKey(live.scheduleMeta && live.scheduleMeta.season) === season && live.currentMatchupPeriod;
    const current = Number(reportWeek) || (/^(DRAFT|PRESEASON|OFFSEASON)$/.test(phase) ? 1 : Number(liveWeek || structured && structured.currentWeek || config.currentMatchupPeriod || config.currentWeek || (parent === season && meta.targetWeek)) || 1);
    const week = Math.min(18, Math.max(1, Number(selectedWeek) || current));
    const out = { season, label: config.currentSeason || season.replace('-', '/'), week, current, matches: [], status: 'WAITING', updatedAt: structured && structured.updatedAt || data.espnSync && data.espnSync.lastSuccess || (parent === season && meta.updatedAt) || '', issue: '' };
    if (!season) return out;
    const section = structured && structured.weeks.find(row => Number(row.week) === week);
    if (section) {
      if (section.status === 'DATA_ISSUE') { out.issue = section.issue || 'Paarungen und Spieldaten sind noch nicht eindeutig.'; return out; }
      const matches = Array.isArray(section.matches) ? section.matches : [];
      if (!scheduleValid(matches, teams)) return out;
      out.matches = matches.map(row => {
        const [away, home] = pair(row), points = (row.points || []).map(p => ({ key: p.key, values: p.values }));
        const complete = pointsValid(points), computed = complete ? scorePoints(points) : null;
        const confirmed = ['IN_PROGRESS', 'LIVE', 'FINAL'].includes(row.status) && computed && Array.isArray(row.score) && row.score.length === 2 && row.score.every((v, i) => number(v) && v === computed[i]) && points.some(p => !p.key.includes('%') && p.values.some(v => v > 0));
        return { away, home, points: confirmed ? points : [], score: confirmed ? computed : null, status: confirmed ? row.status === 'FINAL' ? 'FINAL' : 'LIVE' : row.status === 'NOT_STARTED' || row.status === 'SCHEDULED' ? 'SCHEDULED' : 'WAITING', gp: row.gp, performance: [0, 1].map(i => confirmed ? normalizedPW(row.performance && row.performance[i], week) : emptyPW(week)), report: confirmed && row.report && row.report.status === 'READY' ? row.report : null };
      });
      out.status = 'READY'; return out;
    }
    const schedule = currentSchedule(data, live, season, parent, week, teams);
    if (!scheduleValid(schedule, teams)) return out;
    const raw = (Array.isArray(data.statsRaw) ? data.statsRaw : []).filter(row => scoped(row, season, parent));
    const seasonResults = (data.seasons || []).find(row => seasonKey(row.key || row.season) === season);
    const results = seasonResults && Array.isArray(seasonResults.results) ? seasonResults.results : [];
    const finals = new Set();
    results.forEach(result => {
      if (results.filter(other => Number(other.week) === Number(result.week) && teamKey(canonical(other.away), canonical(other.home)) === teamKey(canonical(result.away), canonical(result.home))).length !== 1) return;
      const a = result.a, h = result.h, matches = raw.filter(row => Number(row.week) === Number(result.week) && teamKey(...pair(row)) === teamKey(result.away, result.home));
      if (!number(a) || !number(h) || !Number.isInteger(a) || !Number.isInteger(h) || a < 0 || h < 0 || a + h !== 8 || matches.length !== 1) return;
      const row = matches[0], index = pair(row)[0] === canonical(result.away) ? 0 : 1;
      const points = cats.map(key => ({ key, values: Array.isArray(row[key]) ? index ? [row[key][1], row[key][0]] : row[key] : null }));
      if (pointsValid(points) && scorePoints(points).every((v, i) => v === [a, h][i])) finals.add(`${Number(result.week)}|${teamKey(...pair(row))}`);
    });
    out.matches = schedule.map(game => {
      const [away, home] = pair(game), rows = raw.filter(row => Number(row.week) === week && teamKey(...pair(row)) === teamKey(away, home));
      const result = { away, home, score: null, points: [], status: 'SCHEDULED', performance: [emptyPW(week), emptyPW(week)], report: null };
      if (rows.length !== 1) { result.status = rows.length ? 'WAITING' : 'SCHEDULED'; return result; }
      const row = rows[0], reverse = pair(row)[0] !== away;
      const points = cats.map(key => ({ key, values: Array.isArray(row[key]) ? reverse ? [row[key][1], row[key][0]] : row[key] : null }));
      if (!pointsValid(points)) { result.status = 'WAITING'; return result; }
      if (!points.some(p => !p.key.includes('%') && p.values.some(v => v > 0))) return result;
      const isFinal = finals.has(`${week}|${teamKey(away, home)}`), declaredFinal = results.some(r => Number(r.week) === week && teamKey(canonical(r.away), canonical(r.home)) === teamKey(away, home));
      if (declaredFinal && !isFinal) { result.status = 'WAITING'; return result; }
      result.points = points; result.score = scorePoints(points); result.status = isFinal ? 'FINAL' : 'LIVE';
      result.performance = [away, home].map(team => rawPerformance(raw, finals, team, week));
      if (row.gpBasis === 'SCORED_APPEARANCES' && Array.isArray(row.GP) && row.GP.length === 2 && row.GP.every(v => number(v) && v >= 0)) result.gp = reverse ? [row.GP[1], row.GP[0]] : row.GP.slice();
      return result;
    });
    out.status = 'READY'; return out;
  }

  function report(match, week, context) {
    if (window.FBA_MATCHUP_REPORTS) return window.FBA_MATCHUP_REPORTS.compose(match, week, context);
    if (!match.score) return null;
    if (match.report && Array.isArray(match.report.paragraphs) && match.report.paragraphs.every(p => typeof p === 'string')) return { title: match.report.title || 'Das Duell im Überblick', paragraphs: match.report.paragraphs };
    const { away, home, score, points, performance } = match, tied = score[0] === score[1], leader = score[0] > score[1] ? away : home, final = match.status === 'FINAL';
    const title = tied ? 'Dieses Duell ist ausgeglichen' : `${shortName(leader)} ${final ? 'entscheidet das Duell' : 'liegt vorne'}`;
    const sentences = [final ? `${away} und ${home} beenden Woche ${week} mit ${score[0]}:${score[1]}.` : `${away} gegen ${home}: Der aktuelle Zwischenstand lautet ${score[0]}:${score[1]}.`];
    const close = points.filter(p => !p.key.includes('%')).sort((a, b) => Math.abs(a.values[0] - a.values[1]) / Math.max(...a.values, 1) - Math.abs(b.values[0] - b.values[1]) / Math.max(...b.values, 1))[0];
    if (close) sentences.push(close.values[0] === close.values[1] ? `Bei ${close.key} liegen beide gleichauf (${valueText(close.key, close.values[0])}).` : `Besonders eng ist es bei ${close.key}: ${valueText(close.key, close.values[0])} für ${shortName(away)} stehen ${valueText(close.key, close.values[1])} für ${shortName(home)} gegenüber.`);
    const shooting = points.find(p => p.key === 'FG%');
    if (shooting) sentences.push(`Die Feldwurfquoten liegen bei ${valueText('FG%', shooting.values[0])} für ${shortName(away)} und ${valueText('FG%', shooting.values[1])} für ${shortName(home)}.`);
    if (Array.isArray(match.gp) && match.gp.length === 2 && match.gp.every(v => number(v) && v >= 0)) sentences.push(`Bisher sind ${match.gp[0]} Einsätze für ${shortName(away)} und ${match.gp[1]} für ${shortName(home)} gewertet${match.gp[0] !== match.gp[1] ? ' – die unterschiedlichen Einsatzzahlen gehören zur Einordnung des Spielstands dazu' : ''}.`);
    if (performance.every(p => p.status === 'READY')) sentences.push(`Die Team-PW pro Einsatz steht bei ${deltaText(performance[0].value)} für ${shortName(away)} und ${deltaText(performance[1].value)} für ${shortName(home)}${week === 2 ? '; nach nur einer Vergleichswoche ist das eine erste Tendenz' : ''}.`);
    else sentences.push(week === 1 ? 'In Woche 1 gibt es noch keine Vergleichsbasis für Über- oder Unterperformance.' : 'Für eine verlässliche Team-PW fehlen noch vollständige Vergleichswerte pro gewertetem Einsatz.');
    sentences.push(final ? 'Diese Woche ist abgeschlossen; ihr Ergebnis steht fest.' : 'Die noch folgenden Einsätze können den Zwischenstand bis zum Ende der Woche verändern.');
    return { title, paragraphs: [sentences.slice(0, 3).join(' '), sentences.slice(3).join(' ')] };
  }
  function shortName(team) { return typeof T === 'function' ? T(team).s || team : team; }
  function badge(p, week) {
    const ready = p && p.status === 'READY', value = ready ? deltaText(p.value) : '–';
    const tone = ready ? Math.round(p.value * 1000) > 0 ? 'positive' : Math.round(p.value * 1000) < 0 ? 'negative' : 'neutral' : 'pending';
    const detail = ready ? `Teamleistung pro gewertetem Einsatz gegenüber ${p.baselineWeeks} abgeschlossenen Vorwochen${week === 2 ? ' · erste Tendenz' : ''}` : week === 1 ? 'Ab Woche 2: noch keine Vergleichswoche' : 'Vollständige Vergleichsdaten und gewertete Einsätze fehlen';
    return `<span class="fmh-pw ${tone}" title="${E(detail)}" aria-label="Performance Watch ${E(value)}. ${E(detail)}">PW ${E(value)}</span>`;
  }
  function logo(team) {
    const url = typeof logoOf === 'function' ? logoOf(team) : '';
    return url ? `<img src="${E(url)}" alt="" width="42" height="42" decoding="async">` : `<span class="fmh-placeholder" aria-hidden="true">?</span>`;
  }
  function markup(data, phase) {
    const season = seasonKey(data && data.appConfig && (data.appConfig.seasonCode || data.appConfig.currentSeason));
    if (state.season !== season) { state.season = season; state.week = null; }
    const model = build(data, phase, state.week, typeof MONSTER_STATE !== 'undefined' ? MONSTER_STATE.data : null);
    state.currentWeek = model.current;
    const reportsApi = window.FBA_MATCHUP_REPORTS;
    const reportContext = reportsApi && reportsApi.context(data, model, phase, typeof MONSTER_STATE !== 'undefined' ? MONSTER_STATE.data : null);
    if (reportsApi) reportsApi.maybeRefresh(data, typeof MONSTER_STATE !== 'undefined' ? MONSTER_STATE.data : null);
    const forecastApi = window.FBA_MATCHUP_FORECAST;
    if (forecastApi) forecastApi.maybeRefresh(data, model, phase);
    const forecastContext = forecastApi && forecastApi.context(data, model, phase);
    const updated = model.matches.some(match => match.score) ? stamp(model.updatedAt) : '';
    const selected = model.week, slots = Array.from({ length: 4 }, (_, index) => model.matches[index] || null);
    const cards = slots.map((match, index) => {
      const forecast = match && forecastApi && forecastApi.pick(forecastContext, match), displayScore = match && (match.score || forecast && forecast.score);
      const label = !match ? 'Paarung folgt' : match.status === 'FINAL' ? 'Endstand' : match.score ? 'Zwischenstand' : forecast ? 'Prognose' : match.status === 'WAITING' ? 'Werte folgen' : 'Noch nicht gestartet';
      const side = i => `<span class="fmh-team">${match ? logo(i ? match.home : match.away) : '<span class="fmh-placeholder" aria-hidden="true">?</span>'}<span class="fmh-team-copy"><b>${match ? E(shortName(i ? match.home : match.away)) : i ? 'Heimteam' : 'Auswärtsteam'}</b>${badge(match ? match.performance[i] : emptyPW(selected), selected)}</span><strong class="fmh-score ${displayScore && displayScore[i] > displayScore[1-i] ? 'leading' : ''}${forecast && !match.score ? ' forecast' : ''}">${displayScore ? displayScore[i] : '–'}</strong></span>`;
      return `<button type="button" class="fmh-card" ${!match ? 'disabled' : ''} onclick="FBA_MATCHUP_HOME.open(${index})" aria-label="${match ? E(`${match.away} gegen ${match.home}. ${displayScore ? `${label}: ${displayScore.join(' zu ')}` : label}. Zum Bericht`) : `Matchup ${index + 1}: Paarung folgt`}"><span class="fmh-card-top"><span>Matchup ${index + 1}</span><span class="fmh-status ${forecast && !match.score ? 'forecast' : ''}">${label}</span></span>${side(0)}${side(1)}<span class="fmh-card-foot">${match ? 'Zum Matchup-Bericht' : 'Spielplan wird erwartet'} <span aria-hidden="true">↗</span></span></button>`;
    }).join('');
    const reports = model.matches.map((match, index) => {
      const story = report(match, selected, reportContext);
      return `<article class="fmh-report" id="fmh-report-${index}" tabindex="-1"><div class="fmh-report-kicker">${E(shortName(match.away))} <span>vs.</span> ${E(shortName(match.home))}</div>${story && story.label ? `<div class="fmh-story-meta">${E(story.label)}${story.seasonLabel ? ` · ${E(story.seasonLabel)}` : ''}${story.updatedAt ? ` · Spieldaten ${E(stamp(story.updatedAt))}` : ''}${story.injuryUpdatedAt ? ` · Verletzungsstatus ${E(stamp(story.injuryUpdatedAt))}` : ''}</div>` : ''}<h3>${story ? E(story.title) : match.status === 'WAITING' ? 'Die Spieldaten werden vervollständigt' : 'Der erste Bericht folgt nach den ersten Spielen'}</h3>${story ? story.paragraphs.map(p => `<p>${E(p)}</p>`).join('') : `<p>Sobald bestätigte Werte für dieses Duell vorliegen, findest du hier Spielstand, Entwicklungen und die Einordnung der Teamleistung.</p>`}${forecastApi ? forecastApi.details(forecastContext, match) : ''}${window.FBA_DUEL_COMPARISON ? window.FBA_DUEL_COMPARISON.link(match.away, match.home) : ''}${match.points.length ? `<details class="fmh-point-details"><summary>Alle acht Punkte ansehen <span aria-hidden="true">⌄</span></summary><div class="fmh-point-grid">${match.points.map(p => `<div><small>${E(p.key)}</small><b><span class="${p.values[0] > p.values[1] ? 'winner' : ''}">${E(valueText(p.key, p.values[0]))}</span><i>:</i><span class="${p.values[1] >= p.values[0] ? 'winner' : ''}">${E(valueText(p.key, p.values[1]))}</span></b></div>`).join('')}</div><p class="fmh-point-note">${E(shortName(match.away))} links · ${E(shortName(match.home))} rechts.</p></details>` : ''}</article>`;
    }).join('');
    return `<section id="fba-matchup-home" aria-labelledby="fmh-heading"><header class="fmh-header"><div><span class="fmh-eyebrow">FBA · ${E(model.label)}</span><h1 id="fmh-heading">Diese Woche zählt.</h1><p>Alle vier Matchups. Spielstände und Geschichten deiner Liga.</p></div><label class="fmh-week-label">Matchup-Woche<select aria-label="Matchup-Woche auswählen" onchange="FBA_MATCHUP_HOME.select(this.value)">${Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}" ${selected === i + 1 ? 'selected' : ''}>Woche ${i + 1}${i + 1 === model.current ? ' · aktuell' : ''}</option>`).join('')}</select></label></header><div class="fmh-meta"><span>Woche ${selected} · ${updated ? `Datenstand ${E(updated)}` : 'Spieldaten werden erwartet'}</span><span>Auswärts oben · Heim unten</span></div><div class="fmh-scoreboard">${cards}</div><details class="fmh-explainer"><summary>Was zeigt die kleine PW-Zahl?</summary><p>Plus bedeutet über, Minus unter dem eigenen bisherigen Teamniveau – pro gewertetem Einsatz. In Woche 1 fehlt die Vergleichsbasis. Woche 2 zeigt eine erste Tendenz; mit weiteren abgeschlossenen Wochen wächst die Datenbasis. Spielstand und Performance sind zwei unterschiedliche Informationen.</p><p>Die sechs Zählwerte werden je Einsatz verglichen. FG% und FT% berücksichtigen Treffer und Versuche. Fehlende Vergleichsdaten bleiben als Strich sichtbar.</p></details><div class="fmh-report-heading"><div><span class="fmh-eyebrow">Daily Matchup Reports</span><h2>Die Geschichten hinter dem Spielstand</h2></div><span>Vorschau vor dem Start · Updates mit neuen Daten</span></div>${reports ? `<div class="fmh-reports">${reports}</div>` : `<div class="fmh-waiting"><b>Die neue Matchup-Woche wartet auf ihren Spielplan.</b><p>${E(model.issue || 'Sobald die vier Paarungen dieser Saison bestätigt sind, erscheinen hier die Duelle und ihre Berichte.')} Spielstände und Team-PW folgen mit den passenden Spieldaten.</p></div>`}</section>`;
  }
  function refresh() {
    if (typeof CUR === 'undefined' || CUR !== 'ueber' || document.hidden) return;
    if (window.FBA_MATCHUP_FORECAST) window.FBA_MATCHUP_FORECAST.refresh();
    const nextWeek = window.FBA_MATCHUP_REPORTS && typeof D !== 'undefined' ? window.FBA_MATCHUP_REPORTS.currentWeek(D, typeof MONSTER_STATE !== 'undefined' ? MONSTER_STATE.data : null) : 0;
    const weekChanged = nextWeek > 0 && nextWeek !== state.currentWeek;
    if (weekChanged) render();
    if (typeof loadLive !== 'function' || typeof PUBLIC_PENDING !== 'undefined' && PUBLIC_PENDING || !weekChanged && Date.now() - Math.max(state.lastAttempt, typeof PUBLIC_SAVED_AT === 'number' ? PUBLIC_SAVED_AT : 0) < 300000) return;
    if (window.FBA_MATCHUP_REPORTS && typeof D !== 'undefined') window.FBA_MATCHUP_REPORTS.maybeRefresh(D, typeof MONSTER_STATE !== 'undefined' ? MONSTER_STATE.data : null);
    if (typeof apiUrl !== 'function' || !apiUrl()) return;
    state.lastAttempt = Date.now();
    Promise.resolve(loadLive(null, true)).catch(() => {});
  }
  window.FBA_MATCHUP_HOME = {
    markup, build, report, rawPerformance,
    select(value) { const week = Number(value); if (!Number.isInteger(week) || week < 1 || week > 18) return; state.week = week; render(); },
    open(index) { const node = document.getElementById(`fmh-report-${Number(index)}`); if (node) { node.scrollIntoView({ behavior: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); node.focus({ preventScroll: true }); } }
  };
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
})();
