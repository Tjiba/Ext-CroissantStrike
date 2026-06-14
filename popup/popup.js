import { getEventStageInfo, buildColumns, computeZones, matchOutcome, seriesScore } from '../utils/swiss.js';

let majorStagesCache = null;

const TWITCH_URL = 'https://www.twitch.tv/croissantstrike';

const DARK_LOGOS = new Set(['Spirit', 'Team Spirit', 'paiN', 'paiN Gaming']);

function formatStageBadge(stage, playoff) {
  const s = (stage ?? '').toLowerCase().trim();
  if (/^final$|grand.?final/.test(s)) return { label: 'FINALE', cls: 'final' };
  if (/1\/2|semi/.test(s)) return { label: '½ FINALE', cls: 'playoff' };
  if (/1\/4|quarter/.test(s)) return { label: '¼ FINALE', cls: 'playoff' };
  if (/3rd.?place|third.?place/.test(s)) return { label: '3e PLACE', cls: 'playoff' };
  if (playoff === true) return { label: 'PLAYOFFS', cls: 'playoff' };
  if (playoff === false) return { label: 'GROUPES', cls: 'group' };
  return null;
}

let durationInterval = null;

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
      if (btn.dataset.tab === 'results') {
        chrome.runtime.sendMessage({ type: 'fetchResults' })
          .then(resp => { if (resp?.hltvResults) renderResults(resp.hltvResults, resp.hltvLogo ?? null); })
          .catch(() => null);
      }
    });
  });
}

function initLiensOverlay() {
  const overlay = document.getElementById('liens-overlay');
  document.getElementById('btn-liens').addEventListener('click', () => {
    overlay.classList.add('is-open');
  });
  document.getElementById('btn-liens-close').addEventListener('click', () => {
    overlay.classList.remove('is-open');
  });
}

async function init() {
  initTabs();
  initLiensOverlay();
  const { liveState, hltvResults, hltvLogo, scheduleData, eventsData, majorStages } =
    await chrome.storage.local.get(['liveState', 'hltvResults', 'hltvLogo', 'scheduleData', 'eventsData', 'majorStages']);
  majorStagesCache = majorStages ?? null;
  renderLive(liveState ?? { isLive: false });
  renderLiveMatches(liveState?.liveMatches ?? []);
  renderUpcoming(scheduleData?.upcoming ?? []);
  renderResults(hltvResults ?? [], hltvLogo ?? null);
  renderEvents(eventsData?.events ?? [], majorStagesCache);

  chrome.runtime.sendMessage({ type: 'poll' })
    .then(resp => {
      if (resp?.isLive != null) renderLive(resp);
      if (resp?.liveMatches != null) renderLiveMatches(resp.liveMatches);
      if (resp?.scheduleData?.upcoming != null) renderUpcoming(resp.scheduleData.upcoming);
      if (resp?.hltvResults) renderResults(resp.hltvResults, resp.hltvLogo ?? hltvLogo);
      if (resp?.eventsData?.events) renderEvents(resp.eventsData.events, majorStagesCache);
    })
    .catch(() => null);

  chrome.runtime.sendMessage({ type: 'fetchMajorStages' })
    .then(async ms => {
      if (!ms) return;
      majorStagesCache = ms;
      const { eventsData: ed } = await chrome.storage.local.get('eventsData');
      renderEvents(ed?.events ?? [], majorStagesCache);
    })
    .catch(() => null);
}

function renderLive(state) {
  // Reset conditional sections before re-rendering
  document.getElementById('thumbnail-wrap').classList.add('hidden');
  document.getElementById('match-section').classList.add('hidden');
  document.getElementById('offline-section').classList.add('hidden');
  document.getElementById('thumb-viewers').classList.add('hidden');
  document.getElementById('stream-duration').classList.add('hidden');

  if (state.isLive && state.thumbnailUrl) {
    const wrap = document.getElementById('thumbnail-wrap');
    document.getElementById('stream-thumbnail').src = state.thumbnailUrl;
    document.getElementById('thumbnail-link').onclick = e => { e.preventDefault(); openTwitch(); };
    document.getElementById('watch-btn-meta').onclick = openTwitch;
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
      if (durationInterval) clearInterval(durationInterval);
      durationInterval = setInterval(() => { durationEl.textContent = formatDuration(state.startedAt); }, 1000);
    }
    wrap.classList.remove('hidden');
  }

  const badge = document.getElementById('badge-live');
  badge.classList.remove('hidden');
  if (state.isLive) {
    const isRediff = (state.streamTitle ?? '').toUpperCase().includes('REDIFFUSION');
    badge.querySelector('.badge-label').textContent = isRediff ? 'REDIFFUSION' : 'EN DIRECT';
    badge.classList.toggle('badge-rediff', isRediff);
    badge.classList.remove('badge-offline');
    const featuredMatch = state.liveMatches?.[0];
    if (featuredMatch) {
      const badge = formatStageBadge(featuredMatch.stage, featuredMatch.playoff);
      const eventNameEl = document.getElementById('event-name');
      eventNameEl.textContent = featuredMatch.event;
      if (badge) {
        const s = document.createElement('span');
        s.textContent = ` · ${badge.label}`;
        s.style.cssText = `font-weight:800;color:${badge.cls === 'group' ? 'inherit' : 'var(--brand)'}`;
        eventNameEl.appendChild(s);
      }
      renderMatchCard(featuredMatch);
      document.getElementById('match-section').classList.remove('hidden');
      document.getElementById('watch-btn').onclick = openTwitch;
    }
  } else {
    badge.querySelector('.badge-label').textContent = 'HORS-LIGNE';
    badge.classList.add('badge-offline');
    badge.classList.remove('badge-rediff');
    document.getElementById('offline-section').classList.remove('hidden');
    document.getElementById('twitch-btn').onclick = openTwitch;
  }
}

function renderMatchCard(match) {
  document.getElementById('team-a-name').textContent = match.teamA;
  document.getElementById('team-b-name').textContent = match.teamB;
  document.getElementById('score-a').textContent = match.scoreA ?? 0;
  document.getElementById('score-b').textContent = match.scoreB ?? 0;
  document.getElementById('map-badge').textContent = match.bestOf ? `BO${match.bestOf}` : '';
  document.getElementById('map-scores').innerHTML = '';
}

function renderLiveMatches(matches) {
  const section = document.getElementById('global-live-section');
  const header = section.querySelector('.section-header');
  const list = document.getElementById('global-live-list');
  list.innerHTML = '';
  section.classList.remove('hidden');
  const active = (matches ?? []).filter(m => !m.finished && m.winnerId == null);
  if (!active.length) {
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
  active.forEach(m => {
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
    const badge = formatStageBadge(m.stage, m.playoff);
    if (badge) {
      const stageSpan = document.createElement('span');
      stageSpan.textContent = ` · ${badge.label}`;
      stageSpan.style.cssText = `font-weight:800;color:${badge.cls === 'group' ? 'var(--text-muted)' : 'var(--brand)'}`;
      eventEl.appendChild(stageSpan);
    }

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
  const sorted = [...matches].sort((a, b) => {
    const da = a.endedAt ? new Date(a.endedAt).getTime() : 0;
    const db = b.endedAt ? new Date(b.endedAt).getTime() : 0;
    return db - da;
  });
  sorted.forEach(m => {
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
    eventEl.style.cssText = 'font-size:9px;color:var(--text-muted);margin-top:2px;text-align:center';
    eventEl.textContent = m.event;
    const badge = formatStageBadge(m.stage, m.playoff);
    if (badge && badge.cls === 'final') {
      const stageSpan = document.createElement('span');
      stageSpan.textContent = ` · ${badge.label}`;
      stageSpan.style.cssText = 'font-weight:800;color:var(--brand)';
      eventEl.appendChild(stageSpan);
    }
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

  // MAPS — with stage/playoff chips right-aligned on the same row
  const mapsHeader = document.createElement('div');
  mapsHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin:0 0 4px';
  const mapsLabel = document.createElement('span');
  mapsLabel.className = 'dp-label';
  mapsLabel.style.margin = '0';
  mapsLabel.textContent = 'MAPS';
  mapsHeader.appendChild(mapsLabel);
  const badge = formatStageBadge(data.stage, data.playoff);
  if (badge && (badge.cls === 'final' || badge.label === '½ FINALE')) {
    const stageChip = document.createElement('span');
    stageChip.textContent = badge.label;
    stageChip.style.cssText = `font-size:9px;font-weight:800;letter-spacing:.5px;padding:2px 7px;border-radius:20px;${badge.cls === 'final' ? 'background:var(--brand);color:#111' : 'background:var(--brand-dim);color:var(--brand);border:1px solid rgba(255,165,0,0.3)'}`;
    mapsHeader.appendChild(stageChip);
  }
  el.appendChild(mapsHeader);
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
      const norm = s => (s ?? '').toLowerCase().trim();
      const logoSrc = norm(v.team) === norm(data.teamA) ? data.logoA
                    : norm(v.team) === norm(data.teamB) ? data.logoB
                    : null;
      if (logoSrc) {
        const logoEl = document.createElement('img');
        logoEl.className = 'dp-veto-logo';
        logoEl.src = logoSrc;
        logoEl.alt = v.team;
        if (DARK_LOGOS.has(v.team)) logoEl.style.filter = 'brightness(0) invert(1)';
        chip.appendChild(logoEl);
      } else {
        const teamEl = document.createElement('span');
        teamEl.className = 'dp-veto-team';
        teamEl.textContent = v.team;
        chip.appendChild(teamEl);
      }
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

function renderUpcoming(matches) {
  const section = document.getElementById('upcoming-section');
  const list = document.getElementById('upcoming-list');
  list.innerHTML = '';

  const now = Date.now();
  const filtered = (matches ?? []).filter(m => {
    if (!m.teamA) return false;
    // /matches/upcoming ne renvoie déjà que les matchs notables (★★+) du jour.
    // Pas de re-filtrage par étoiles ici : sinon on masque les matchs 2★ d'un Major
    // (quasi tous ses matchs de groupe/swiss), ne laissant que les rares 3★+.
    const t = m.startsAt ?? m.scheduledAt ?? null;
    if (!t) return true;
    return new Date(t).getTime() > now - 60 * 60 * 1000;
  });
  if (!filtered.length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  const mkLogo = (src, alt) => {
    const img = document.createElement('img');
    img.className = 'lm-logo';
    img.alt = alt;
    img.src = src ?? '';
    if (!src) img.style.visibility = 'hidden';
    if (DARK_LOGOS.has(alt)) img.style.filter = 'brightness(0) invert(1)';
    return img;
  };

  filtered.forEach(m => {
    const row = document.createElement('div');
    row.className = 'upcoming-match-row';

    const timeEl = document.createElement('span');
    timeEl.className = 'upcoming-time';
    timeEl.textContent = new Date(m.startsAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const teamsRow = document.createElement('div');
    teamsRow.className = 'lm-teams-row';

    const sideA = document.createElement('div');
    sideA.className = 'lm-side';
    const nameA = document.createElement('span');
    nameA.className = 'lm-team';
    nameA.textContent = m.teamA;
    sideA.append(mkLogo(m.logoA, m.teamA), nameA);

    const vsEl = document.createElement('span');
    vsEl.className = 'upcoming-vs';
    vsEl.textContent = 'vs';

    const sideB = document.createElement('div');
    sideB.className = 'lm-side lm-side-b';
    const nameB = document.createElement('span');
    nameB.className = 'lm-team';
    nameB.textContent = m.teamB;
    sideB.append(nameB, mkLogo(m.logoB, m.teamB));

    teamsRow.append(sideA, vsEl, sideB);

    const eventEl = document.createElement('div');
    eventEl.className = 'lm-event';
    eventEl.textContent = m.event;

    row.append(timeEl, teamsRow, eventEl);
    list.appendChild(row);
  });
}

function formatEventDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const monthShort = d => d.toLocaleDateString('fr-FR', { month: 'short' });
  if (sameMonth) return `${start.getDate()} – ${end.getDate()} ${monthShort(start)}`;
  return `${start.getDate()} ${monthShort(start)} – ${end.getDate()} ${monthShort(end)}`;
}

function getEventStatus(e) {
  const s = (e.status ?? '').toLowerCase();
  if (/ongoing|live|in.?progress|en.?cours/.test(s)) return 'ongoing';
  if (/termin|finished|ended|over/.test(s)) return 'terminated';
  return 'upcoming';
}

function renderEvents(events, majorStages) {
  const list = document.getElementById('events-list');
  list.innerHTML = '';
  if (!events?.length) {
    list.innerHTML = '<p class="no-matches-msg" style="padding:16px 0">Aucun événement</p>';
    return;
  }

  const groups = {};
  events.forEach(e => {
    const start = new Date(e.startDate);
    const key = `${start.getFullYear()}-${String(start.getMonth()).padStart(2,'0')}`;
    const label = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = { label, items: [] };
    groups[key].items.push(e);
  });

  Object.values(groups).forEach(group => {
    const monthEl = document.createElement('div');
    monthEl.className = 'events-month';
    monthEl.textContent = group.label;
    list.appendChild(monthEl);

    group.items.forEach(e => {
      const status = getEventStatus(e);
      const stageInfo = getEventStageInfo(e, majorStages);

      const logoBg = document.createElement('div');
      logoBg.className = 'event-logo-bg';
      if (status === 'terminated') logoBg.classList.add('event-logo-bg-terminated');
      const logo = document.createElement('img');
      logo.className = 'event-logo';
      logo.src = e.logoUrl;
      logo.alt = '';
      logo.style.filter = status === 'terminated' ? 'brightness(0) opacity(0.4)' : 'brightness(0)';
      logo.onerror = () => { logo.style.visibility = 'hidden'; };
      logoBg.appendChild(logo);

      const info = document.createElement('div');
      info.className = 'event-info';
      const nameEl = document.createElement('span');
      nameEl.className = 'event-name';
      nameEl.textContent = e.name;
      const dateEl = document.createElement('span');
      dateEl.className = 'event-date';
      dateEl.textContent = formatEventDateRange(e.startDate, e.endDate);
      info.append(nameEl, dateEl);

      let chip = null;
      if (status !== 'upcoming') {
        chip = document.createElement('span');
        chip.className = `event-status-chip chip-${status}`;
        chip.textContent = status === 'ongoing' ? 'EN COURS' : 'TERMINÉ';
      }

      if (!stageInfo) {
        const row = document.createElement('a');
        row.className = 'event-row';
        if (status === 'terminated') row.classList.add('event-row-terminated');
        row.href = e.url;
        row.target = '_blank';
        if (chip) row.append(logoBg, info, chip); else row.append(logoBg, info);
        list.appendChild(row);
        return;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'event-wrapper';

      const row = document.createElement('div');
      row.className = 'event-row event-row-expandable';
      if (status === 'terminated') row.classList.add('event-row-terminated');

      const hltv = document.createElement('a');
      hltv.className = 'event-hltv';
      hltv.href = e.url;
      hltv.target = '_blank';
      hltv.title = 'Voir sur HLTV';
      hltv.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';
      hltv.addEventListener('click', ev => ev.stopPropagation());

      const chevron = document.createElement('span');
      chevron.className = 'event-chevron';
      chevron.textContent = '▾';

      const panel = document.createElement('div');
      panel.className = 'event-swiss-panel';

      let rendered = false;
      row.addEventListener('click', () => {
        const open = panel.classList.toggle('open');
        chevron.textContent = open ? '▴' : '▾';
        if (open && !rendered) { renderSwissTree(stageInfo.stage, panel); rendered = true; }
      });

      const children = [logoBg, info];
      if (chip) children.push(chip);
      children.push(hltv, chevron);
      row.append(...children);
      wrapper.append(row, panel);
      list.appendChild(wrapper);
    });
  });
}

function swissLogo(team) {
  if (!team || team.placeholder || !team.logo) {
    const ph = document.createElement('span');
    ph.className = 'swiss-logo swiss-logo-ph';
    ph.textContent = '?';
    return ph;
  }
  const img = document.createElement('img');
  img.className = 'swiss-logo';
  img.src = team.logo;
  img.alt = team.name ?? '';
  img.onerror = () => { img.style.visibility = 'hidden'; };
  return img;
}

function recordToneClass(record) {
  const m = /^(\d+)-(\d+)$/.exec(record);
  if (!m) return 'swiss-rec-even';
  const net = (+m[1]) - (+m[2]);
  if (net >= 2) return 'swiss-rec-win2';
  if (net === 1) return 'swiss-rec-win1';
  if (net <= -2) return 'swiss-rec-lose2';
  if (net === -1) return 'swiss-rec-lose1';
  return 'swiss-rec-even';
}

function swissRecordLabel(record) {
  const el = document.createElement('div');
  el.className = 'swiss-record ' + recordToneClass(record);
  el.textContent = record;
  return el;
}

function swissMatchCell(m) {
  const cell = document.createElement('div');
  cell.className = 'swiss-cell';
  const a = swissLogo({ name: m.teamA, logo: m.logoA });
  const b = swissLogo({ name: m.teamB, logo: m.logoB });
  const o = matchOutcome(m);
  if (o) {
    if (o.loser.name === m.teamA) a.classList.add('swiss-loser');
    if (o.loser.name === m.teamB) b.classList.add('swiss-loser');
  }

  const score = seriesScore(m);
  const mid = document.createElement('span');
  if (score) {
    mid.className = 'swiss-score';
    const sa = document.createElement('b');
    sa.textContent = score.a;
    sa.className = score.a > score.b ? 'swiss-win' : 'swiss-lose';
    const sb = document.createElement('b');
    sb.textContent = score.b;
    sb.className = score.b > score.a ? 'swiss-win' : 'swiss-lose';
    mid.append(sa, document.createTextNode('–'), sb);
  } else {
    mid.className = 'swiss-vs';
    mid.textContent = 'vs';
  }

  cell.append(a, mid, b);
  if (m.hltvUrl) {
    cell.classList.add('swiss-cell-link');
    cell.addEventListener('click', () => chrome.tabs.create({ url: m.hltvUrl }));
  }
  return cell;
}

function swissZone(title, cls, groups) {
  const box = document.createElement('div');
  box.className = `swiss-zone ${cls}`;
  const head = document.createElement('div');
  head.className = 'swiss-zone-head';
  head.textContent = title;
  box.appendChild(head);
  groups.forEach(g => {
    const row = document.createElement('div');
    row.className = 'swiss-zone-row';
    const rec = document.createElement('span');
    rec.className = 'swiss-zone-rec';
    rec.textContent = g.record;
    row.appendChild(rec);
    g.teams.forEach(t => row.appendChild(swissLogo(t)));
    box.appendChild(row);
  });
  return box;
}

function renderSwissTree(stage, panelEl) {
  panelEl.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'swiss-board';

  buildColumns(stage).forEach(col => {
    if (col.length === 1 && col[0].record === '2-2') return;
    const colEl = document.createElement('div');
    colEl.className = 'swiss-col';
    col.forEach(group => {
      colEl.appendChild(swissRecordLabel(group.record));
      group.matches.forEach(m => colEl.appendChild(swissMatchCell(m)));
    });
    board.appendChild(colEl);
  });

  const zones = computeZones(stage);
  const finalCol = document.createElement('div');
  finalCol.className = 'swiss-col swiss-col-final';
  if (zones.qualified.length) finalCol.appendChild(swissZone('QUALIFIÉS', 'swiss-zone-q', zones.qualified));
  const r22 = (stage.rounds ?? []).find(r => r.record === '2-2');
  if (r22?.matches?.length) {
    finalCol.appendChild(swissRecordLabel('2-2'));
    r22.matches.forEach(m => finalCol.appendChild(swissMatchCell(m)));
  }
  if (zones.eliminated.length) finalCol.appendChild(swissZone('ÉLIMINÉS', 'swiss-zone-e', zones.eliminated));
  board.appendChild(finalCol);

  panelEl.appendChild(board);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.liveState) {
    const state = changes.liveState.newValue;
    if (state) renderLive(state);
  }
  if (changes.hltvResults) {
    chrome.storage.local.get('hltvLogo', ({ hltvLogo }) => {
      renderResults(changes.hltvResults.newValue ?? [], hltvLogo ?? null);
    });
  }
  if (changes.scheduleData) {
    const sd = changes.scheduleData.newValue;
    if (sd) renderUpcoming(sd.upcoming ?? []);
  }
  if (changes.eventsData) {
    renderEvents(changes.eventsData.newValue?.events ?? [], majorStagesCache);
  }
  if (changes.majorStages) {
    majorStagesCache = changes.majorStages.newValue ?? majorStagesCache;
    chrome.storage.local.get('eventsData', ({ eventsData }) => {
      renderEvents(eventsData?.events ?? [], majorStagesCache);
    });
  }
});

init().catch(console.error);
