import { fetchStreamStatus } from './utils/twitch.js';
import { fetchLatestMatches, fetchMatchById } from './utils/csapi.js';
import { findMatchId } from './utils/match.js';

const ALARM_NAME = 'cs-poll';
const HLTV_URL = 'https://api.tjiba.fr';
const HLTV_SECRET = 'Extcs3';

async function fetchHltvResults() {
  const r = await fetch(`${HLTV_URL}/extension?limit=10`, {
    headers: { 'x-secret': HLTV_SECRET },
  });
  if (!r.ok) throw new Error(`HLTV: ${r.status}`);
  const body = await r.json();
  const results = body.results ?? body ?? [];

  const mapped = results.map(m => ({
    hltvMatchId: m.matchId,
    teamA: m.teamA,
    teamB: m.teamB,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winner: m.winner ?? null,
    event: m.event,
    endedAt: m.endedAt ?? m.date ?? null,
    hltvUrl: m.url ?? m.hltvUrl ?? null,
    logoA: m.logoA ?? null,
    logoB: m.logoB ?? null,
    maps: m.maps ?? [],
    veto: m.veto ?? [],
  }));

  const FORCE_LOGO = new Set(['Vitality', 'Team Vitality']);

  const missingTeams = [...new Set(
    mapped.flatMap(m => [
      (!m.logoA || FORCE_LOGO.has(m.teamA)) ? m.teamA : null,
      (!m.logoB || FORCE_LOGO.has(m.teamB)) ? m.teamB : null,
    ].filter(Boolean))
  )];

  if (missingTeams.length) {
    try {
      const lr = await fetch(`${HLTV_URL}/logo?teams=${missingTeams.join(',')}&force=1`, {
        headers: { 'x-secret': HLTV_SECRET },
      });
      if (lr.ok) {
        const raw = await lr.json();
        mapped.forEach(m => {
          if ((!m.logoA || FORCE_LOGO.has(m.teamA)) && raw[m.teamA]) m.logoA = raw[m.teamA].split(' ')[0];
          if ((!m.logoB || FORCE_LOGO.has(m.teamB)) && raw[m.teamB]) m.logoB = raw[m.teamB].split(' ')[0];
        });
      }
    } catch {}
  }

  return { hltvLogo: body.hltvLogo ?? null, results: mapped };
}

chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) {
    poll();
    setTimeout(poll, 30000);
  }
});
chrome.runtime.onInstalled.addListener(() => poll());
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'poll') {
    poll().then(async () => {
      const { liveState, hltvResults, hltvLogo } = await chrome.storage.local.get(['liveState', 'hltvResults', 'hltvLogo']);
      sendResponse({ ...(liveState ?? {}), hltvResults: hltvResults ?? [], hltvLogo: hltvLogo ?? null });
    }).catch(() => sendResponse({}));
    return true;
  }
});

async function poll() {
  try {
    const [streamResult, hltvResult] = await Promise.allSettled([
      fetchStreamStatus(),
      fetchHltvResults(),
    ]);

    if (hltvResult.status === 'fulfilled') {
      chrome.storage.local.set({
        hltvResults: hltvResult.value.results,
        hltvLogo: hltvResult.value.hltvLogo,
      });
    }

    const streamStatus = streamResult.status === 'fulfilled' ? streamResult.value : null;
    if (!streamStatus) return;

    const liveMatches = streamStatus.liveMatches ?? [];

    if (!streamStatus.isLive) {
      await chrome.storage.local.set({
        liveState: { isLive: false, liveMatches, pastMatches: [] }
      });
      setIcon(false, '');
      return;
    }

    const { liveState: prevState } = await chrome.storage.local.get('liveState');
    const startedAt = streamStatus.startedAt
      ?? (prevState?.isLive ? prevState.startedAt : null)
      ?? new Date().toISOString();

    const matches = await fetchLatestMatches();
    const matchId = findMatchId(streamStatus.streamTitle, matches);
    const matchDetail = matchId ? await fetchMatchById(matchId) : null;

    await chrome.storage.local.set({
      liveState: {
        isLive: true,
        streamTitle: streamStatus.streamTitle,
        viewerCount: streamStatus.viewerCount,
        startedAt,
        thumbnailUrl: streamStatus.thumbnailUrl,
        matchId,
        matchDetail,
        liveMatches,
        pastMatches: [],
        updatedAt: Date.now(),
      }
    });
    setIcon(true, streamStatus.streamTitle);
  } catch (err) {
    console.error('[CroissantStrike] poll error:', err);
  }
}

function setIcon(isLive, streamTitle = '') {
  chrome.action.setIcon({ path: { 16: 'icons/icon-16.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' } });

  if (isLive) {
    const isRediff = streamTitle.toUpperCase().includes('REDIFFUSION');
    chrome.action.setBadgeText({ text: isRediff ? '' : 'LIVE' });
    chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}
