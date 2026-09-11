/* Local, hypothetical one-for-one roster moves. No transaction endpoint. */
const MONSTER_MOVES = { status: "idle", token: 0, mode: "season", result: null, error: "" };

function monsterMoveRoto(result) {
  const rows = result.rows.map(({ team }) => {
    const totals = Object.fromEntries(MONSTER_PROJECTION_STATS.map(field => [field, 0]));
    Object.values(result.weekly[team]).forEach(week => {
      MONSTER_PROJECTION_STATS.forEach(field => { totals[field] += week[field]; });
    });
    if (!(totals.FGA > 0 && totals.FTA > 0)) throw new Error("Roto-Vergleich wartet auf vollständiges Wurfvolumen.");
    return { team, ...totals, "FG%": totals.FGM / totals.FGA, "FT%": totals.FTM / totals.FTA, points: {}, score: 0 };
  });
  rows.forEach(row => DRAFT_CATS.forEach(cat => {
    const below = rows.filter(other => other[cat] < row[cat]).length;
    const tied = rows.filter(other => other[cat] === row[cat]).length;
    row.points[cat] = 1 + below + (tied - 1) / 2;
    row.score += row.points[cat];
  }));
  return rows;
}

function monsterMoveSummary(base, result, team, beforeRoto) {
  const before = base.rows.find(row => row.team === team), after = result.rows.find(row => row.team === team);
  beforeRoto = beforeRoto || monsterMoveRoto(base).find(row => row.team === team);
  const afterRoto = monsterMoveRoto(result).find(row => row.team === team);
  const previous = new Map(base.matchupResults.filter(game => game.away === team || game.home === team).map(game => [game.week, game]));
  const weeks = result.matchupResults.filter(game => game.away === team || game.home === team).map(game => {
    const old = previous.get(game.week), away = game.away === team;
    const beforePoints = away ? old.awayPoints : old.homePoints, afterPoints = away ? game.awayPoints : game.homePoints;
    return { week: game.week, opponent: away ? game.home : game.away, before: beforePoints, after: afterPoints, delta: afterPoints - beforePoints, seeded: game.seeded };
  });
  return { before, after, beforeRoto, afterRoto, weeks, fbaDelta: after.fbaFor - before.fbaFor, rotoDelta: afterRoto.score - beforeRoto.score };
}

function monsterMoveCompare(mode, a, b) {
  const primary = mode === "roto" ? "rotoDelta" : "fbaDelta", secondary = mode === "roto" ? "fbaDelta" : "rotoDelta";
  return b[primary] - a[primary] || b[secondary] - a[secondary] || a.add.name.localeCompare(b.add.name) || a.drop.name.localeCompare(b.drop.name) || a.drop.id.localeCompare(b.drop.id);
}

function monsterMoveKeepBest(list, move, mode) {
  const metric = mode === "roto" ? "rotoDelta" : "fbaDelta";
  if (move[metric] <= 0) return list;
  const same = list.find(row => row.add.id === move.add.id);
  if (same && monsterMoveCompare(mode, same, move) <= 0) return list;
  return [...list.filter(row => row.add.id !== move.add.id), move].sort((a, b) => monsterMoveCompare(mode, a, b)).slice(0, 3);
}

function monsterMoveCandidateRows(input, pool) {
  const owned = new Set(input.roster.map(row => String(row.id))), seen = new Set(), candidates = [], skipped = [];
  const records = new Map((input.projectionEngine.players || []).map(row => [monsterProjectionRecordId(row), row]));
  pool.forEach(player => {
    const id = String(player.id || "");
    if (!id || seen.has(id) || owned.has(id)) return;
    seen.add(id);
    const record = records.get(id), issue = monsterProjectionRecordIssue(record);
    if (issue) { skipped.push({ name: player.name, issue }); return; }
    const stats = monsterProjectionBase(record), nba = monsterProjectionRecordNba(record);
    if (!nba || MONSTER_PROJECTION_STATS.some(field => Number(stats[field]) < 0)) {
      skipped.push({ name: player.name, issue: "NBA-Team oder Statistikbasis ungültig." }); return;
    }
    candidates.push({ id, name: player.name || record.name || id, nba, stats, projectionReady: true, engineProjection: record });
  });
  return { candidates, skipped };
}

function monsterMoveInput(input, team, drop, add, effectiveWeek, cache) {
  if (input.roster.some(row => row.id === add.id)) throw new Error("Der Spieler ist bereits vergeben.");
  const index = input.roster.findIndex(row => row.team === team && row.id === drop.id);
  if (index < 0) throw new Error("Der Drop gehört nicht zum Analyse-Team.");
  const roster = input.roster.slice();
  roster[index] = { ...add, team, pickupDropEngineProjection: drop.engineProjection, pickupEffectiveWeek: effectiveWeek };
  return { ...input, roster, moveSearchCache: cache };
}

async function monsterMoveSearch(input, base, team, pool, effectiveWeek, hooks = {}) {
  if (base.projectionMode !== "engine") throw new Error("Move-Vorschläge brauchen bestätigte Projektionen einschließlich projected GP.");
  if (!Number.isInteger(effectiveWeek) || effectiveWeek < 1 || effectiveWeek > 18) throw new Error("Aktuelle FBA-Woche fehlt oder die Regular Season ist beendet.");
  const drops = input.roster.filter(row => row.team === team);
  if (drops.length !== 13) throw new Error("Für die Suche werden die 13 Spieler deines Teams benötigt.");
  const { candidates, skipped } = monsterMoveCandidateRows(input, pool), cache = {};
  const output = { season: [], roto: [], tested: 0, total: candidates.length * drops.length, candidates: candidates.length, skipped, effectiveWeek };
  const beforeRoto = monsterMoveRoto(base).find(row => row.team === team);
  const pause = hooks.pause || (() => new Promise(resolve => setTimeout(resolve, 0)));
  let lastYield = Date.now();
  for (const add of candidates) {
    for (const drop of drops) {
      if (hooks.cancelled && hooks.cancelled()) return null;
      const result = monsterSeasonProjectionCalculate(monsterMoveInput(input, team, drop, add, effectiveWeek, cache));
      const move = { ...monsterMoveSummary(base, result, team, beforeRoto), add, drop, result };
      output.season = monsterMoveKeepBest(output.season, move, "season");
      output.roto = monsterMoveKeepBest(output.roto, move, "roto");
      output.tested++;
      // Yield during a large search; the caller can cancel on a changed roster.
      if (Date.now() - lastYield >= 45) {
        if (hooks.progress) hooks.progress(output.tested, output.total);
        await pause(); lastYield = Date.now();
      }
    }
  }
  return output;
}

function monsterMoveContextKey() {
  const data = MONSTER_STATE.data || {};
  return JSON.stringify([MONSTER_STATE.teamA, MONSTER_SEASON_PROJECTION_STATE.fingerprint, data.currentMatchupPeriod,
    data.projectionEngine, DRAFT_STATE.picks, draftPool().map(row => [row.id, row.name])]);
}

function cancelMonsterMoves() {
  MONSTER_MOVES.token++; MONSTER_MOVES.status = "idle"; MONSTER_MOVES.result = null; MONSTER_MOVES.error = ""; render();
}

function setMonsterMovesMode(mode) {
  if (mode !== "season" && mode !== "roto") return;
  MONSTER_MOVES.mode = mode; render();
}

async function runMonsterMoves() {
  const lifecycle = monsterSeasonProjectionLifecycle(), state = MONSTER_SEASON_PROJECTION_STATE;
  if (!lifecycle.engineAllowed || state.status !== "ready" || state.fingerprint !== monsterSeasonProjectionFingerprint()) return;
  const token = ++MONSTER_MOVES.token, key = monsterMoveContextKey(), original = state.result;
  const source = MONSTER_STATE.data, team = MONSTER_STATE.teamA, picks = JSON.stringify(DRAFT_STATE.picks);
  Object.assign(MONSTER_MOVES, { status: "loading", result: null, error: "", key, base: original, tested: 0, total: 0 });
  render();
  await new Promise(resolve => setTimeout(resolve, 0));
  const cancelled = () => token !== MONSTER_MOVES.token || original !== MONSTER_SEASON_PROJECTION_STATE.result || source !== MONSTER_STATE.data || team !== MONSTER_STATE.teamA || picks !== JSON.stringify(DRAFT_STATE.picks);
  try {
    if (cancelled()) return;
    // The projection cache never sees changing live data or changing draft picks.
    const input = JSON.parse(JSON.stringify(monsterSeasonProjectionInputs())), actual = input.projectionEngine.actual || {};
    const effectiveWeek = lifecycle.seasonRunning ? Number((MONSTER_STATE.data || {}).currentMatchupPeriod || actual.currentMatchupPeriod) : 1;
    const result = await monsterMoveSearch(input, original, MONSTER_STATE.teamA, draftPool(), effectiveWeek, {
      cancelled,
      progress: (tested, total) => {
        if (cancelled()) return;
        MONSTER_MOVES.tested = tested; MONSTER_MOVES.total = total;
        const progress = document.getElementById("monster-moves-progress"), label = document.getElementById("monster-moves-progress-label");
        if (progress) { progress.max = total || 1; progress.value = tested; }
        if (label) label.textContent = `${tested} von ${total} Moves geprüft`;
      }
    });
    if (cancelled() || !result || key !== monsterMoveContextKey()) return;
    MONSTER_MOVES.status = "ready"; MONSTER_MOVES.result = result;
  } catch (error) {
    if (cancelled()) return;
    MONSTER_MOVES.status = "error"; MONSTER_MOVES.error = error.message || String(error);
  } finally {
    if (token === MONSTER_MOVES.token) {
      if (cancelled() || key !== monsterMoveContextKey()) { MONSTER_MOVES.status = "idle"; MONSTER_MOVES.result = null; }
      render();
    }
  }
}

function monsterMoveCard(move, index) {
  const { before, after, beforeRoto, afterRoto } = move, changed = move.weeks.filter(week => week.delta);
  const delta = value => monsterSeasonDelta(value, Number.isInteger(value) ? 0 : 1);
  const tone = value => monsterSeasonImpactTone(value);
  const gained = changed.reduce((sum, week) => sum + Math.max(0, week.delta), 0), lost = changed.reduce((sum, week) => sum + Math.max(0, -week.delta), 0);
  const explanation = move.fbaDelta > 0 ? `${gained} zusätzliche und ${lost} verlorene Punkte in ${changed.length} veränderten Wochen.` : move.fbaDelta < 0 ? "Die Roto-Wertung steigt, die Wochensimulation fällt schlechter aus." : "Die Wochensimulation bleibt bei denselben Saisonpunkten.";
  return `<article class="monster-move-card">
    <div class="monster-move-title"><span class="monster-move-number">${index + 1}</span><div><small>ABGEBEN</small><b>${E(move.drop.name)}</b></div><span aria-hidden="true">→</span><div><small>AUFNEHMEN</small><b>${E(move.add.name)}</b></div></div>
    <div class="monster-move-metrics">
      <div class="${tone(move.fbaDelta)}"><small>Saisonpunkte W1–18</small><b>${E(before.fbaFor)}–${E(before.fbaAgainst)} → ${E(after.fbaFor)}–${E(after.fbaAgainst)}</b><span>${E(delta(move.fbaDelta))} Punkte · ${E(monsterSeasonDelta((after.fbaWinPct - before.fbaWinPct) * 100, 1))} Pp. WIN%</span></div>
      <div class="${tone(move.rotoDelta)}"><small>Roto-Wertung W1–18</small><b>${E(de(beforeRoto.score, 1))} → ${E(de(afterRoto.score, 1))} / 64</b><span>${E(delta(move.rotoDelta))} Roto-Punkte</span></div>
    </div><p>${E(explanation)}</p>
    <details><summary>Warum dieser Move?</summary><p>Projizierte GP der gesamten NBA-Saison: ${E(move.drop.name)} ${E(move.drop.engineProjection.projectedGp)} → ${E(move.add.name)} ${E(move.add.engineProjection.projectedGp)}. Für beide Vergleiche zählen die daraus erwarteten Einsätze in W1–18.</p>
      <div class="monster-move-breakdown">${DRAFT_CATS.map(cat => `<span>${E(cat)} <b class="${tone(afterRoto.points[cat] - beforeRoto.points[cat])}">${E(delta(afterRoto.points[cat] - beforeRoto.points[cat]))}</b></span>`).join("")}</div>
      <p>Veränderung der Roto-Punkte je Wert. FG% und FT% berücksichtigen das gesamte Wurfvolumen.</p>
      ${changed.length ? `<div class="monster-move-weeks">${changed.map(week => `<span>W${week.week} · ${E(T(week.opponent).s || week.opponent)} <b class="${tone(week.delta)}">${week.before}:${8 - week.before} → ${week.after}:${8 - week.after}</b></span>`).join("")}</div>` : ""}
    </details></article>`;
}

function monsterSeasonMovesMarkup(base) {
  const lifecycle = monsterSeasonProjectionLifecycle(), heading = `<div class="monster-season-journey-head"><div><h3>Saison verbessern</h3><p>Welche Free Agents machen ${E(T(MONSTER_STATE.teamA).s || MONSTER_STATE.teamA)} stärker?</p></div></div>`;
  const wrap = body => `<section class="monster-season-moves" data-testid="monster-season-moves">${heading}${body}</section>`;
  if (!lifecycle.engineAllowed || base.projectionMode !== "engine") return wrap(`<p>Move-Vorschläge warten auf bestätigte Saisonprojektionen mit individuellen projected GP. Der Ersatzmodus mit voller Verfügbarkeit reicht dafür nicht aus.</p>`);
  let state = MONSTER_MOVES;
  if (state.base !== base || state.key !== monsterMoveContextKey()) state = { status: "idle" };
  if (state.status === "loading") return wrap(`<div role="status" aria-live="polite"><span id="monster-moves-progress-label">${state.tested || 0} von ${state.total || "…"} Moves geprüft</span><progress id="monster-moves-progress" value="${state.tested || 0}" max="${state.total || 1}" aria-label="Move-Suche"></progress></div><button type="button" onclick="cancelMonsterMoves()">Suche abbrechen</button>`);
  const notes = `<p class="monster-moves-note">Jeder Vorschlag ist ein einzelner Tausch aus deinem Ausgangskader. Alle acht Teams bleiben sonst gleich. Das Modell zählt die 13 Kaderspieler ohne tägliche Aufstellungsoptimierung; Waiver-Fristen und Transaktionslimits sind nicht eingerechnet. Verfügbarkeit gilt für den geladenen Kaderstand.</p>`;
  if (state.status !== "ready") return wrap(`${state.error ? `<p role="alert">${E(state.error)}</p>` : ""}<p>Alle Spieler deines Teams werden einzeln gegen die nicht vergebenen Spieler im geladenen Pool geprüft – mit projizierten Einsätzen, allen acht Teams und jedem Wochen-Matchup.</p><button type="button" onclick="runMonsterMoves()">Moves finden</button>${notes}`);
  const result = state.result, mode = MONSTER_MOVES.mode, rows = result[mode];
  return wrap(`<div class="monster-move-tabs" role="group" aria-label="Vorschläge sortieren"><button type="button" aria-pressed="${mode === "season"}" onclick="setMonsterMovesMode('season')">Saisonpunkte</button><button type="button" aria-pressed="${mode === "roto"}" onclick="setMonsterMovesMode('roto')">Roto-Wertung</button></div>
    <p>${result.tested} Moves · ${result.candidates} nicht vergebene Spieler · ab W${result.effectiveWeek}. ${result.skipped.length ? `${result.skipped.length} Spieler ohne vollständige Projektion ausgelassen.` : ""}</p>
    <div class="monster-move-list">${rows.length ? rows.map(monsterMoveCard).join("") : `<p>Kein geprüfter Einzeltausch verbessert ${mode === "roto" ? "deine Roto-Wertung" : "deine projizierten Saisonpunkte"}. ${result.candidates ? "Auch den anderen Vergleich ansehen." : "Im geladenen Pool fehlen geeignete Free Agents mit vollständigen Projektionen."}</p>`}</div>
    ${rows.length ? `<p>Die besten ${rows.length} geprüften Optionen nach ${mode === "roto" ? "Roto-Wertung" : "Saisonpunkten"}; pro Free Agent ein Drop. Modellprognosen, keine zugesicherten Verbesserungen.</p>` : ""}
    ${notes}<button type="button" onclick="runMonsterMoves()">Moves neu prüfen</button>`);
}
