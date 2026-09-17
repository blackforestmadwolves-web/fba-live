/* Team features use reviewed editorial data; they never fetch or infer rosters. */
const TEAM_PREVIEW_OPEN = new Set();

function teamPreviewData() {
  const collection = window.FBA_TEAM_PREVIEWS;
  if (!collection || !Array.isArray(collection.teams)) return null;
  return collection;
}

function rememberTeamPreview(details) {
  if (!details || !details.isConnected) return;
  const team = details.dataset.teamPreview;
  if (!(teamPreviewData()?.teams || []).some(row => row.team === team)) return;
  if (details.open) TEAM_PREVIEW_OPEN.add(team);
  else TEAM_PREVIEW_OPEN.delete(team);
}

function teamPreviewCard(row, reviewedAt) {
  const team = row.team, logo = logoOf(team), open = TEAM_PREVIEW_OPEN.has(team);
  const sections = Array.isArray(row.sections) ? row.sections : [];
  const facts = Array.isArray(row.facts) ? row.facts : [];
  return `<details class="team-story" data-team-preview="${E(team)}" ${open ? 'open' : ''} ontoggle="rememberTeamPreview(this)">
    <summary class="team-story-cover">
      <span class="team-story-identity">${logo ? `<img src="${E(logo)}" alt="" loading="lazy" decoding="async" width="112" height="112">` : `<span class="team-story-initial">${E(T(team).a)}</span>`}</span>
      <span class="team-story-copy"><span class="team-story-kicker">${E(row.conference)} Conference</span><span class="team-story-team">${E(team)}</span><h3>${E(row.title)}</h3><span class="team-story-teaser">${E(row.teaser)}</span><span class="team-story-read"><span class="team-story-closed-label">Bericht lesen</span><span class="team-story-open-label">Bericht schließen</span><i aria-hidden="true">⌄</i></span></span>
    </summary>
    <div class="team-story-body">
      ${facts.length ? `<dl class="team-story-facts">${facts.map(fact => `<div><dt>${E(fact.label)}</dt><dd>${E(fact.value)}</dd></div>`).join('')}</dl>` : ''}
      <div class="team-story-article">${sections.map(section => `<section><h4>${E(section.heading)}</h4>${String(section.text || '').split(/\n\s*\n/).filter(Boolean).map(text => `<p>${E(text)}</p>`).join('')}</section>`).join('')}</div>
      <footer class="team-story-footer"><span>Redaktioneller Ausblick · Stand ${E(reviewedAt)}<small>Historie aus dem FBA-Archiv · Einschätzung vor dem Draft</small></span><button type="button" data-team="${E(team)}" onclick="openTeam(this.dataset.team)">Zum Team-Center <span aria-hidden="true">↗</span></button></footer>
    </div>
  </details>`;
}

function teamPreviewsHome(season) {
  const collection = teamPreviewData();
  if (!collection || !collection.teams.length) return '';
  if (season && String(season).replace('-', '/') !== collection.season) return '';
  const date = String(collection.reviewedAt || '').split('-');
  const reviewedAt = date.length === 3 ? `${date[2]}.${date[1]}.${date[0]}` : collection.reviewedAt || 'ohne Datum';
  return `<section class="team-previews" aria-label="FBA-Teamberichte ${E(collection.season)}">
    ${sect('Season Preview', `${collection.teams.length} Teams · ${E(collection.season)}`)}
    <p class="team-previews-intro">Titel, Rivalitäten und neue Chancen: die Geschichten hinter den Teams – und die Fragen vor dem nächsten Draft.</p>
    <div class="team-story-grid">${collection.teams.map(row => teamPreviewCard(row, reviewedAt)).join('')}</div>
  </section>`;
}
