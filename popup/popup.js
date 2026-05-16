const TWITCH_URL = 'https://www.twitch.tv/croissantstrike';

const WORKER_URL = 'https://patient-wave-e2d7.tjiba.workers.dev/';

const DARK_LOGOS = new Set(['Spirit', 'Team Spirit', 'paiN', 'paiN Gaming']);

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    });
  });
}

async function init() {
  initTabs();
  const { liveState, hltvResults, hltvLogo } = await chrome.storage.local.get(['liveState', 'hltvResults', 'hltvLogo']);
  renderLive(liveState ?? { isLive: false });
  renderLiveMatches(liveState?.liveMatches ?? []);
renderResults(hltvResults ?? [], hltvLogo ?? null);

  chrome.runtime.sendMessage({ type: 'poll' })
    .then(resp => {
      if (resp?.liveMatches) renderLiveMatches(resp.liveMatches);
      if (resp?.hltvResults) renderResults(resp.hltvResults, resp.hltvLogo ?? hltvLogo);
    })
    .catch(() => null);
}

function renderLive(state) {
  if (state.isLive && state.thumbnailUrl) {
    const wrap = document.getElementById('thumbnail-wrap');
    document.getElementById('stream-thumbnail').src = state.thumbnailUrl;
    document.getElementById('thumbnail-link').addEventListener('click', e => {
      e.preventDefault(); openTwitch();
    });
    document.getElementById('watch-btn-meta').addEventListener('click', openTwitch);
    document.getElementById('stream-title').textContent = state.streamTitle || 'En direct';
    if (state.viewerCount != null) {
      const formatted = state.viewerCount.toLocaleString('fr-FR');
      document.getElementById('viewer-overlay-value').textContent = formatted;
      document.getElementById('thumb-viewers').classList.remove('hidden');
    }
    if (state.startedAt) {
      const durationEl = document.getElementById('duration-value');
      const durationWrap = document.getElementById('stream-duration');
      durationEl.textContent = formatDuration(state.startedAt);
      durationWrap.classList.remove('hidden');
      setInterval(() => { durationEl.textContent = formatDuration(state.startedAt); }, 1000);
    }
    wrap.classList.remove('hidden');
  }

  const badge = document.getElementById('badge-live');
  badge.classList.remove('hidden');
  if (state.isLive) {
    const isRediff = (state.streamTitle ?? '').toUpperCase().includes('REDIFFUSION');
    badge.querySelector('.badge-label').textContent = isRediff ? 'REDIFFUSION' : 'EN DIRECT';
    badge.classList.toggle('badge-rediff', isRediff);
    if (state.matchDetail) {
      document.getElementById('event-name').textContent = state.matchDetail.event;
      renderMatchCard(state.matchDetail);
      document.getElementById('match-section').classList.remove('hidden');
      document.getElementById('watch-btn').addEventListener('click', openTwitch);
    }
  } else {
    badge.querySelector('.badge-label').textContent = 'HORS-LIGNE';
    badge.classList.add('badge-offline');
    document.getElementById('offline-section').classList.remove('hidden');
    document.getElementById('twitch-btn').addEventListener('click', openTwitch);
  }
}

function renderMatchCard(match) {
  document.getElementById('team-a-name').textContent = match.teamA;
  document.getElementById('team-b-name').textContent = match.teamB;

  const maps = match.maps ?? [];
  const currentIdx = maps.findIndex(m => m.name === match.currentMap);
  const mapNum = currentIdx >= 0 ? currentIdx + 1 : maps.length;
  document.getElementById('map-badge').textContent =
    `MAP ${mapNum} · ${(match.currentMap ?? '').toUpperCase()}`;

  const currentMapData = maps.find(m => m.name === match.currentMap) ?? maps[maps.length - 1];
  document.getElementById('score-a').textContent = currentMapData?.scoreA ?? 0;
  document.getElementById('score-b').textContent = currentMapData?.scoreB ?? 0;

  const pillsEl = document.getElementById('map-scores');
  maps.forEach(m => {
    const pill = document.createElement('span');
    pill.className = `map-score-pill ${m.completed ? 'done' : 'ongoing'}`;
    pill.textContent = m.completed ? `${m.scoreA}-${m.scoreB}` : 'En cours';
    pillsEl.appendChild(pill);
  });
}

function renderLiveMatches(matches) {
  const section = document.getElementById('global-live-section');
  const header = section.querySelector('.section-header');
  const list = document.getElementById('global-live-list');
  list.innerHTML = '';
  section.classList.remove('hidden');
  if (!matches?.length) {
    header.classList.add('hidden');
    list.innerHTML = '<p class="no-matches-msg" style="text-align:center;padding:16px 0">Aucun match en cours</p>';
    return;
  }
  header.classList.remove('hidden');
  const mkLogo = (src, alt) => {
    const img = document.createElement('img');
    img.className = 'lm-logo';
    img.alt = alt;
    img.src = src ?? '';
    if (!src) img.style.visibility = 'hidden';
    if (DARK_LOGOS.has(alt)) img.style.filter = 'brightness(0) invert(1)';
    return img;
  };
  matches.forEach(m => {
    const row = document.createElement('div');
    row.className = 'live-match-row';

    const teamsRow = document.createElement('div');
    teamsRow.className = 'lm-teams-row';

    const sideA = document.createElement('div');
    sideA.className = 'lm-side';
    const nameA = document.createElement('span');
    nameA.className = 'lm-team';
    nameA.textContent = m.teamA;
    sideA.append(mkLogo(m.logoA, m.teamA), nameA);

    const scoreEl = document.createElement('span');
    scoreEl.className = 'lm-score';
    const sep = document.createElement('span');
    sep.className = 'lm-sep';
    sep.textContent = ':';
    scoreEl.append(document.createTextNode(`${m.scoreA} `), sep, document.createTextNode(` ${m.scoreB}`));

    const sideB = document.createElement('div');
    sideB.className = 'lm-side lm-side-b';
    const nameB = document.createElement('span');
    nameB.className = 'lm-team';
    nameB.textContent = m.teamB;
    sideB.append(nameB, mkLogo(m.logoB, m.teamB));

    teamsRow.append(sideA, scoreEl, sideB);

    const eventEl = document.createElement('div');
    eventEl.className = 'lm-event';
    eventEl.textContent = m.event;

    row.append(teamsRow, eventEl);
    list.appendChild(row);
  });
}


function renderResults(matches, hltvLogo) {
  const list = document.getElementById('results-list');
  list.innerHTML = '';
  if (!matches?.length) {
    list.innerHTML = '<p class="no-matches-msg">Aucun résultat récent</p>';
    return;
  }
  matches.forEach(m => {
    const scoreA = m.scoreA ?? 0;
    const scoreB = m.scoreB ?? 0;
    const winnerIsA = m.winner ? m.winner === m.teamA : scoreA > scoreB;
    const winnerIsB = m.winner ? m.winner === m.teamB : scoreB > scoreA;
    const endedAt = m.endedAt ? new Date(m.endedAt) : null;
    const dateStr = endedAt
      ? endedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      : '--';

    const year = m.endedAt ? new Date(m.endedAt).getFullYear() : new Date().getFullYear();
    const hltvQuery = [m.teamA, 'vs', m.teamB, m.event, year].filter(Boolean).join(' ');
    const hltvSearch = `https://www.hltv.org/search#query=${hltvQuery.replace(/ /g, '+')}`;
    const matchUrl = m.hltvUrl ?? hltvSearch;

    const wrapper = document.createElement('div');
    wrapper.className = 'result-wrapper';

    const item = document.createElement('div');
    item.className = 'recent-item';

    const dateEl = document.createElement('a');
    dateEl.className = 'recent-date';
    dateEl.href = matchUrl;
    dateEl.target = '_blank';
    dateEl.title = 'Voir sur HLTV';
    if (dateStr !== '--') {
      dateEl.textContent = dateStr;
    } else {
      const hltvIcon = document.createElement('img');
      hltvIcon.alt = 'HLTV';
      hltvIcon.className = 'hltv-favicon';
      hltvIcon.src = hltvLogo ?? '';
      if (!hltvLogo) hltvIcon.style.visibility = 'hidden';
      dateEl.appendChild(hltvIcon);
    }

    const teamsEl = document.createElement('div');
    teamsEl.className = 'recent-teams';

    const rowEl = document.createElement('div');
    rowEl.className = 'recent-teams-row';

    const mkLogo = (src, alt) => {
      const img = document.createElement('img');
      img.className = 'team-logo-sm';
      img.alt = alt;
      img.src = src ?? '';
      if (!src) img.style.visibility = 'hidden';
      if (DARK_LOGOS.has(alt)) img.style.filter = 'brightness(0) invert(1)';
      return img;
    };

    const spA = document.createElement('span');
    spA.textContent = m.teamA;
    spA.style.cssText = `color:${winnerIsA ? 'var(--text)' : 'var(--text-muted)'};font-weight:${winnerIsA ? '700' : '500'};overflow:hidden;text-overflow:ellipsis;min-width:0`;
    const spB = document.createElement('span');
    spB.textContent = m.teamB;
    spB.style.cssText = `color:${winnerIsB ? 'var(--text)' : 'var(--text-muted)'};font-weight:${winnerIsB ? '700' : '500'};overflow:hidden;text-overflow:ellipsis;min-width:0`;

    const sideA = document.createElement('div');
    sideA.className = 'rt-side rt-side-a';
    sideA.append(mkLogo(m.logoA, m.teamA), spA);

    const scoreEl = document.createElement('span');
    scoreEl.className = `recent-score ${winnerIsA ? 'win' : winnerIsB ? 'loss' : ''}`;
    scoreEl.textContent = `${scoreA} – ${scoreB}`;

    const sideB = document.createElement('div');
    sideB.className = 'rt-side rt-side-b';
    sideB.append(spB, mkLogo(m.logoB, m.teamB));

    rowEl.append(sideA, scoreEl, sideB);

    const eventEl = document.createElement('div');
    eventEl.textContent = m.event;
    eventEl.style.cssText = 'font-size:9px;color:var(--text-muted);margin-top:2px;text-align:center';
    teamsEl.append(rowEl, eventEl);

    const chevron = document.createElement('button');
    chevron.className = 'chevron-btn';
    chevron.textContent = '▾';

    const panel = document.createElement('div');
    panel.className = 'match-detail-panel';

    item.addEventListener('click', async (e) => {
      if (e.target === dateEl || dateEl.contains(e.target)) return;
      const isOpen = panel.classList.contains('open');
      if (isOpen) {
        panel.classList.remove('open');
        chevron.textContent = '▾';
        return;
      }
      panel.classList.add('open');
      chevron.textContent = '▴';
      if (panel.dataset.loaded) return;
      panel.dataset.loaded = 'true';
      renderHltvPanel(m, panel);
    });

    item.append(dateEl, teamsEl, chevron);
    wrapper.append(item, panel);
    list.appendChild(wrapper);
  });
}

function renderHltvPanel(data, el) {
  el.innerHTML = '';

  const mkLabel = text => {
    const d = document.createElement('div');
    d.className = 'dp-label';
    d.textContent = text;
    return d;
  };

  // MAPS
  el.appendChild(mkLabel('MAPS'));
  const mapsGrid = document.createElement('div');
  mapsGrid.className = 'dp-maps';
  (data.maps ?? []).filter(m => m.scoreA != null && m.scoreB != null).forEach(m => {
    const card = document.createElement('div');
    card.className = 'dp-map-card';

    const nameEl = document.createElement('span');
    nameEl.className = 'dp-map-name';
    nameEl.textContent = m.map.toUpperCase();

    const norm = s => (s ?? '').toLowerCase().trim();
    const winnerIsA = m.winner ? norm(m.winner) === norm(data.teamA) : m.scoreA > m.scoreB;
    const winnerIsB = m.winner ? norm(m.winner) === norm(data.teamB) : m.scoreB > m.scoreA;
    const scoreEl = document.createElement('span');
    scoreEl.className = 'dp-map-score';
    const sA = document.createElement('span');
    sA.textContent = m.scoreA;
    sA.className = winnerIsA ? 'dp-score-win' : 'dp-score-lose';
    const dash = document.createElement('span');
    dash.className = 'dp-score-sep';
    dash.textContent = '–';
    const sB = document.createElement('span');
    sB.textContent = m.scoreB;
    sB.className = winnerIsB ? 'dp-score-win' : 'dp-score-lose';
    scoreEl.append(sA, dash, sB);

    const pickEl = document.createElement('span');
    pickEl.className = 'dp-map-pick';
    pickEl.textContent = m.winner ?? '—';

    card.append(nameEl, scoreEl, pickEl);
    mapsGrid.appendChild(card);
  });
  el.appendChild(mapsGrid);

  // VETO
  el.appendChild(mkLabel('VETO'));
  const vetoFlow = document.createElement('div');
  vetoFlow.className = 'dp-veto';
  (data.veto ?? []).forEach(v => {
    const chip = document.createElement('div');
    chip.className = `dp-veto-chip dp-veto-${v.action}`;

    const mapEl = document.createElement('span');
    mapEl.className = 'dp-veto-map';
    mapEl.textContent = v.map;

    chip.append(mapEl);

    if (v.team) {
      const teamEl = document.createElement('span');
      teamEl.className = 'dp-veto-team';
      teamEl.textContent = v.team;
      chip.appendChild(teamEl);
    }

    vetoFlow.appendChild(chip);
  });
  el.appendChild(vetoFlow);
}

function formatDuration(startedAt) {
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function openTwitch() {
  chrome.tabs.create({ url: TWITCH_URL });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.liveState) return;
  const state = changes.liveState.newValue;
  if (!state) return;
  if (state.viewerCount != null) {
    const el = document.getElementById('viewer-overlay-value');
    if (el) el.textContent = state.viewerCount.toLocaleString('fr-FR');
  }
  renderLiveMatches(state.liveMatches ?? []);
});

init().catch(console.error);
