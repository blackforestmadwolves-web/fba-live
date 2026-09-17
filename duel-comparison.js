/* Direct team comparisons. Existing archive and league tables stay independent. */
(function () {
  'use strict';
  const state = { view: 'seasons', left: 'BlackForest Mad Wolves', right: 'Balingen Lions', season: 'ALL', phase: 'ALL' };
  const seasonKey = value => {
    const m = String(value || '').match(/^S(\d{2})_(\d{2})$/i) || String(value || '').match(/^20(\d{2})[\/_-](?:20)?(\d{2})$/);
    return m ? `20${m[1]}-${m[2]}` : '';
  };
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const scoreOK = score => Array.isArray(score) && score.length === 2 && score.every(v => finite(v) && v >= 0 && v <= 8 && Number.isInteger(v * 2)) && score[0] + score[1] === 8;
  const legacy = () => window.FBA_DUEL_HISTORY || { aliases: [], games: [] };
  const name = (value, season, week) => {
    let text = String(value || '').trim();
    // Documented spelling variants in the historical Results sheets.
    if (/^Bishkeks? (?:Bishkek )?Easy\$?s?nipers$/i.test(text)) text = 'Bishkek Easy Snipers';
    if (text === 'Deschischsuppa') text = 'Desischsuppa';
    const alias = legacy().aliases.find(a => a[0] === text && seasonKey(a[1]) === seasonKey(season) && week >= a[2] && week <= a[3]);
    if (alias) text = alias[4];
    return String(typeof canonicalTeamName === 'function' ? canonicalTeamName(text) : text);
  };
  const gameKey = g => `${g.season}|${g.week}|${[g.away, g.home].sort().join('|')}`;
  const short = team => typeof T === 'function' ? T(team).s || team : team;
  const number = value => Number(value).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  const record = value => value.join('–');
  const dateLabel = game => `Saison ${game.season.replace('-', '/')} · Woche ${game.week}`;
  const streakLabel = side => side.longestGames.map(g => `W${g.week} (${g.season.replace('-', '/')})`).join(' · ');

  function collect(data, catalog, now = Date.now()) {
    const api = window.FBA_MATCHUP_REPORTS;
    if (!api) return [];
    const season = seasonKey(data.appConfig && (data.appConfig.seasonCode || data.appConfig.currentSeason)) || seasonKey(data.meta && data.meta.season);
    const live = typeof MONSTER_STATE !== 'undefined' ? MONSTER_STATE.data : null;
    const datedWeek = api.currentWeek(data, live, now);
    const metaWeek = seasonKey(data.meta && data.meta.season) === season ? Number(data.meta.targetWeek) : 0;
    const current = Math.max(datedWeek, Number.isInteger(metaWeek) && metaWeek >= 1 && metaWeek <= 22 ? metaWeek : 0);
    const metadata = new Map();
    const normalized = { ...data, seasons: (data.seasons || []).map(s => ({ ...s, results: (s.results || []).map(r => {
      const g = { ...r, away: name(r.away, s.key, r.week), home: name(r.home, s.key, r.week) };
      metadata.set(gameKey({ ...g, season: seasonKey(s.key) }), g);
      return g;
    }) })) };
    const rows = api.historyRows(normalized, catalog, season, current, current);
    // Include the current matchup only when the public feed explicitly confirms
    // FINAL and all eight categories agree with the supplied final score.
    const feed = data.matchupHome;
    if (current && feed && feed.schema === 1 && seasonKey(feed.seasonCode) === season) {
      const finalOnly = { appConfig: data.appConfig, matchupHome: { ...feed, weeks: (feed.weeks || []).filter(w => Number(w.week) === current) } };
      rows.push(...api.historyRows(finalOnly, { seasons: [] }, season, current + 1, current + 1));
    }
    const games = new Map(rows.map(g => [gameKey(g), { ...g }]));
    // Older exports rounded split points. Use the exact, dated workbook result
    // only to fill missing/invalid legacy games; a valid updated result wins.
    for (const source of legacy().games) {
      const sk = seasonKey(source.season);
      if (!sk || sk >= season) continue;
      const g = { ...source, season: sk, away: name(source.away, source.season, source.week), home: name(source.home, source.season, source.week) };
      if (!scoreOK(g.score) || !g.away || !g.home || g.away === g.home) continue;
      const key = gameKey(g);
      if (!games.has(key)) games.set(key, g);
      if (!metadata.has(key)) metadata.set(key, g);
    }
    const seasons = catalog.seasons || [];
    return [...games.values()].map(g => {
      const source = metadata.get(gameKey(g)) || g;
      const settings = seasons.find(s => seasonKey(s.key) === g.season);
      const phaseText = String(source.phase || '');
      const ps = settings ? g.week >= Number(settings.postSeasonStart || Number(settings.regularSeasonEnd || 18) + 1) : /post|playoff|final|platz|^PS$/i.test(phaseText);
      return { ...g, phase: ps ? 'PS' : 'RS', mu: source.mu || '' };
    }).sort((a, b) => a.season.localeCompare(b.season) || a.week - b.week);
  }

  function compare(rows, left, right, season = 'ALL', phase = 'ALL') {
    const games = rows.filter(g => (g.away === left && g.home === right || g.away === right && g.home === left) && (season === 'ALL' || g.season === season) && (phase === 'ALL' || g.phase === phase));
    function side(team) {
      let wins = 0, ties = 0, points = 0, run = 0, longest = 0, longestGames = [], running = [], best = null;
      const outcomes = [];
      for (const g of games) {
        const score = g.away === team ? g.score : g.score.slice().reverse();
        const result = score[0] > score[1] ? 'W' : score[0] < score[1] ? 'L' : 'T';
        outcomes.push(result); points += score[0];
        if (result === 'T') ties++;
        if (result === 'W') {
          wins++; run++; running.push(g);
          if (run > longest) { longest = run; longestGames = running.slice(); }
          if (!best || score[0] - score[1] >= best.score[0] - best.score[1]) best = { ...g, score };
        } else { run = 0; running = []; }
      }
      const recent = outcomes.slice(-3);
      return { team, wins, ties, points, longest, longestGames, current: run, best,
        last3: [recent.filter(v => v === 'W').length, recent.filter(v => v === 'L').length, recent.filter(v => v === 'T').length] };
    }
    return { left: side(left), right: side(right), games, total: games.length };
  }
  function teamNames(data, rows) {
    return [...new Set([...(data.draft && data.draft.teams || []).map(t => name(t.team)), ...rows.flatMap(g => [g.away, g.home])])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de'));
  }
  function tabs() {
    return `<div class="toggle fdc-tabs" aria-label="Archivansicht"><button type="button" class="${state.view === 'seasons' ? 'on' : ''}" aria-pressed="${state.view === 'seasons'}" onclick="FBA_DUEL_COMPARISON.view('seasons')">Season-Archiv</button><button type="button" class="${state.view === 'duel' ? 'on' : ''}" aria-pressed="${state.view === 'duel'}" onclick="FBA_DUEL_COMPARISON.view('duel')">Direkter Vergleich</button></div>`;
  }
  function logo(team) {
    const url = typeof logoOf === 'function' ? logoOf(team) : '';
    return url ? `<img src="${E(url)}" alt="" width="60" height="60">` : `<span class="fdc-initials" aria-hidden="true">${E(short(team).slice(0, 2))}</span>`;
  }
  function markup(data, catalog) {
    const rows = collect(data, catalog), teams = teamNames(data, rows);
    if (!teams.includes(state.left)) state.left = teams[0] || '';
    if (!teams.includes(state.right) || state.right === state.left) state.right = teams.find(t => t !== state.left) || '';
    const seasons = [...new Set(rows.map(r => r.season))].sort().reverse();
    if (state.season !== 'ALL' && !seasons.includes(state.season)) state.season = 'ALL';
    const m = compare(rows, state.left, state.right, state.season, state.phase);
    const selector = side => `<label class="fdc-team-select"><span>Team ${side === 'left' ? 'links' : 'rechts'}</span><select id="fdc-${side}" aria-label="Team ${side === 'left' ? 'links' : 'rechts'} auswählen" onchange="FBA_DUEL_COMPARISON.select('${side}',this.value)">${teams.map(t => `<option value="${E(t)}" ${t === state[side] ? 'selected' : ''}>${E(t)}</option>`).join('')}</select></label>`;
    const cell = (text, sub = '', highlight = false) => `<td class="${highlight ? 'fdc-better' : ''}"><b>${E(text)}</b>${sub ? `<small>${E(sub)}</small>` : ''}</td>`;
    const metric = (label, a, b, subA = '', subB = '', values = null) => `<tr>${cell(a, subA, values && values[0] > values[1])}<th scope="row">${E(label)}</th>${cell(b, subB, values && values[1] > values[0])}</tr>`;
    const best = s => s.best ? s.best.score.map(number).join(':') : '–';
    const a = m.left, b = m.right;
    const lines = [
      metric('Siege', a.wins, b.wins, '', '', [a.wins, b.wins]),
      metric('Unentschieden', a.ties, b.ties),
      metric('Punkte', number(a.points), number(b.points), '', '', [a.points, b.points]),
      metric('Ø Punkte pro Duell', m.total ? number(a.points / m.total) : '–', m.total ? number(b.points / m.total) : '–'),
      metric(`${m.total === 1 ? 'Letztes Duell' : `Letzte ${Math.min(3, m.total)}`} · S–N–U`, record(a.last3), record(b.last3)),
      metric('Aktuelle Siegesserie', a.current, b.current, '', '', [a.current, b.current]),
      metric('Längste Siegesserie', a.longest, b.longest, streakLabel(a), streakLabel(b), [a.longest, b.longest]),
      metric('Höchster Sieg', best(a), best(b), a.best ? dateLabel(a.best) : '', b.best ? dateLabel(b.best) : '')
    ].join('');
    const history = m.games.slice().reverse().map(g => {
      const score = g.away === state.left ? g.score : g.score.slice().reverse();
      const winner = score[0] > score[1] ? state.left : score[1] > score[0] ? state.right : '';
      return `<li><button type="button" class="fdc-game" data-season="${E(g.season)}" data-week="${g.week}" data-away="${E(g.away)}" data-home="${E(g.home)}" onclick="FBA_DUEL_COMPARISON.openGame(this.dataset.season,Number(this.dataset.week),this.dataset.away,this.dataset.home)" aria-label="${E(dateLabel(g))}: ${E(short(state.left))} gegen ${E(short(state.right))}, Matchup-Details öffnen"><span class="fdc-game-date">${E(dateLabel(g))} · ${g.phase === 'PS' ? 'Postseason' : 'Regular Season'}</span><span class="fdc-game-score"><span class="fdc-game-team ${score[0] > score[1] ? 'fdc-better' : ''}">${logo(state.left)}<b>${E(short(state.left))}</b><strong>${number(score[0])}</strong></span><i>:</i><span class="fdc-game-team ${score[1] > score[0] ? 'fdc-better' : ''}"><strong>${number(score[1])}</strong><b>${E(short(state.right))}</b>${logo(state.right)}</span></span><small>${winner ? `Sieg für ${E(short(winner))}` : 'Unentschieden'} · Matchup öffnen ↗</small></button></li>`;
    }).join('');
    return `<section id="fba-duel-comparison" aria-labelledby="fdc-title"><header><span class="fdc-eyebrow">FBA Archiv</span><h1 id="fdc-title" tabindex="-1">Direkter Vergleich</h1><p>Zwei Teams. Ihre gemeinsame Geschichte.</p></header><div class="fdc-selectors">${selector('left')}<button type="button" class="fdc-swap" onclick="FBA_DUEL_COMPARISON.swap()" aria-label="Linkes und rechtes Team tauschen">⇄</button>${selector('right')}</div><div class="fdc-filters"><label><span>Zeitraum</span><select id="fdc-season" onchange="FBA_DUEL_COMPARISON.filter('season',this.value)"><option value="ALL">Alle Saisons</option>${seasons.map(s => `<option value="${E(s)}" ${s === state.season ? 'selected' : ''}>${E(s.replace('-', '/'))}</option>`).join('')}</select></label><label><span>Wettbewerb</span><select id="fdc-phase" onchange="FBA_DUEL_COMPARISON.filter('phase',this.value)">${[['ALL', 'Regular Season + Postseason'], ['RS', 'Regular Season'], ['PS', 'Postseason']].map(([value, label]) => `<option value="${value}" ${state.phase === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><div class="fdc-comparison"><div class="fdc-teams"><div>${logo(state.left)}<strong>${E(short(state.left))}</strong></div><span><b>${m.total}</b> ${m.total === 1 ? 'direktes Duell' : 'direkte Duelle'}</span><div>${logo(state.right)}<strong>${E(short(state.right))}</strong></div></div>${m.total ? `<table class="fdc-table" aria-label="Direkter Vergleich ${E(state.left)} gegen ${E(state.right)}"><colgroup><col><col><col></colgroup><thead><tr><th scope="col">${E(short(state.left))}</th><th scope="col">Kennzahl</th><th scope="col">${E(short(state.right))}</th></tr></thead><tbody>${lines}</tbody></table>` : '<p class="fdc-empty">Für diese Auswahl gibt es noch keine bestätigte Begegnung.</p>'}</div>${m.total ? `<details class="fdc-history"><summary>${m.total === 1 ? 'Die Begegnung ansehen' : `Alle ${m.total} Begegnungen ansehen`}</summary><ol>${history}</ol></details>` : ''}</section>`;
  }
  function rerender(focus) {
    if (typeof render === 'function') render();
    if (focus) document.getElementById(focus)?.focus({ preventScroll: true });
  }
  function open(left, right) {
    state.left = name(left); state.right = name(right); state.season = 'ALL'; state.phase = 'ALL'; state.view = 'duel';
    if (typeof navigatePage === 'function') navigatePage('archiv');
    document.getElementById('fdc-title')?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }
  function link(left, right) {
    return `<button type="button" class="fdc-report-link" data-duel-left="${E(left)}" data-duel-right="${E(right)}" onclick="FBA_DUEL_COMPARISON.open(this.dataset.duelLeft,this.dataset.duelRight)" aria-label="Historische Duell-Daten für ${E(left)} gegen ${E(right)} öffnen">Zu den Duell-Daten <span aria-hidden="true">↗</span></button>`;
  }
  function gameDetail(data, catalog, season, week, away, home) {
    const game = collect(data, catalog).find(g => g.season === season && g.week === week && g.away === away && g.home === home);
    if (!game) return null;
    const candidates = [];
    const add = (raw, sk) => {
      if (seasonKey(sk) !== season || Number(raw.week) !== week) return;
      const a = name(raw.a, sk, week), b = name(raw.b, sk, week);
      if (!(a === away && b === home || a === home && b === away)) return;
      const cats = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FG%', 'FT%'];
      const points = cats.map(key => ({ key, values: Array.isArray(raw[key]) ? (a === away ? raw[key] : raw[key].slice().reverse()) : [null, null] }));
      if (points.some(p => p.values.length !== 2 || !p.values.every(v => finite(v) && v >= 0 && (!p.key.includes('%') || v <= 1)))) return;
      const computed = points.filter(p => p.values[0] > p.values[1]).length;
      if (computed !== game.score[0] || 8 - computed !== game.score[1]) return;
      candidates.push(points);
    };
    (catalog.seasons || []).forEach(s => (s.games || []).forEach(raw => add(raw, s.key)));
    (data.statsRaw || []).forEach(raw => add(raw, raw.seasonCode || raw.season || raw.season_id || data.meta && data.meta.season));
    const feed = data.matchupHome;
    if (feed && feed.schema === 1) (feed.weeks || []).forEach(w => (w.matches || []).filter(m => m.status === 'FINAL').forEach(m => add({ week: w.week, a: m.away, b: m.home, ...Object.fromEntries((m.points || []).map(p => [p.key, p.values])) }, feed.seasonCode)));
    const first = candidates[0];
    const points = first && candidates.every(p => JSON.stringify(p) === JSON.stringify(first)) ? first : null;
    return { ...game, points };
  }
  function openGame(season, week, away, home) {
    const detail = gameDetail(D, analyticsCatalog(), season, week, away, home);
    if (!detail || typeof showMatchupModal !== 'function') return;
    const left = state.left === detail.home ? detail.home : detail.away, right = left === detail.away ? detail.home : detail.away;
    const score = left === detail.away ? detail.score : detail.score.slice().reverse();
    const winning = score[0] > score[1] ? left : score[1] > score[0] ? right : '';
    const stats = detail.points ? `<div class="matchup-block-title">Alle acht Punkte</div><div class="tblwrap"><table class="matchup-stats"><thead><tr><th>${E(short(left))}</th><th>Punkt</th><th>${E(short(right))}</th></tr></thead><tbody>${detail.points.map(p => {
      const values = left === detail.away ? p.values : p.values.slice().reverse(), winner = p.values[0] > p.values[1] ? detail.away : detail.home;
      const format = v => p.key.includes('%') ? `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%` : number(v);
      return `<tr><td class="${winner === left ? 'best' : ''}">${format(values[0])}</td><td>${E(p.key)}</td><td class="${winner === right ? 'best' : ''}">${format(values[1])}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="fdc-detail-note">Für dieses historische Duell ist nur das Endergebnis hinterlegt; die einzelnen Kategorien sind nicht verfügbar.</p>';
    showMatchupModal(`<div class="matchup-kicker">${E(dateLabel(detail))} · ${detail.phase === 'PS' ? 'Postseason' : 'Regular Season'}</div><h3 class="matchup-title">${E(short(left))} gegen ${E(short(right))}</h3><div class="matchup-scoreboard">${matchupTeamRow(left, number(score[0]), null, winning === left ? 'win' : winning ? 'lose' : '', false)}<div class="vs"></div>${matchupTeamRow(right, number(score[1]), null, winning === right ? 'win' : winning ? 'lose' : '', false)}</div><p class="fdc-detail-note">${winning ? `Sieg für ${E(short(winning))}` : 'Unentschieden'}</p>${stats}`);
  }
  window.FBA_DUEL_COMPARISON = { state, collect, compare, teamNames, markup, tabs, open, link, streakLabel, gameDetail, openGame,
    view(value) { if (!['seasons', 'duel'].includes(value)) return; state.view = value; rerender(); },
    select(side, value) { if (!['left', 'right'].includes(side)) return; const other = side === 'left' ? 'right' : 'left', previous = state[side]; state[side] = name(value); if (state[other] === state[side]) state[other] = previous; rerender(`fdc-${side}`); },
    swap() { [state.left, state.right] = [state.right, state.left]; rerender(); },
    filter(field, value) { if (field === 'phase' && ['ALL', 'RS', 'PS'].includes(value) || field === 'season' && (value === 'ALL' || seasonKey(value))) { state[field] = value; rerender(`fdc-${field}`); } }
  };
})();
