import { fetchStreamStatus, fetchLiveMatches } from './utils/twitch.js';

const ALARM_NAME = 'cs-poll';
const HLTV_URL = 'https://api.tjiba.fr';

async function fetchHltvResults() {
  const r = await fetch(`${HLTV_URL}/matches/results`, {
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`HLTV: ${r.status}`);
  const body = await r.json();
  const results = body.results ?? body ?? [];

  const mapped = results.map(m => ({
    hltvMatchId: m.matchId ?? m.id,
    teamA: m.teamA,
    teamB: m.teamB,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winner: m.winner ?? null,
    event: m.event,
    stage: m.stage ?? null,
    playoff: m.playoff ?? null,
    endedAt: m.endedAt ?? m.date ?? null,
    hltvUrl: m.url ?? m.hltvUrl ?? null,
    logoA: m.logoA ?? null,
    logoB: m.logoB ?? null,
    maps: m.maps ?? [],
    veto: m.veto ?? [],
  }));

  return { hltvLogo: body.hltvLogo ?? null, results: mapped };
}

// Guard: only create alarms if they don't exist yet.
// Without this, chrome.alarms.create resets the timer every time the service worker restarts
// (e.g. every popup open), so the alarm would never fire if the popup is opened frequently.
chrome.alarms.get(ALARM_NAME, a => { if (!a) chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 }); });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) poll();
});

// Poll immediately on service worker start (covers reload + first popup open).
// Cooldown: skip if a poll ran in the last 55 seconds to avoid double-polling with the alarm.
chrome.storage.local.get('lastPollAt', ({ lastPollAt }) => {
  if (!lastPollAt || Date.now() - lastPollAt > 55000) poll();
});

chrome.runtime.onInstalled.addListener(() => poll());
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'poll') {
    poll().then(async () => {
      const { liveState, hltvResults, hltvLogo, scheduleData, eventsData } = await chrome.storage.local.get(['liveState', 'hltvResults', 'hltvLogo', 'scheduleData', 'eventsData']);
      sendResponse({ ...(liveState ?? {}), hltvResults: hltvResults ?? [], hltvLogo: hltvLogo ?? null, scheduleData: scheduleData ?? null, eventsData: eventsData ?? null });
    }).catch(() => sendResponse({}));
    return true;
  }
  if (msg.type === 'fetchResults') {
    fetchHltvResults().then(data => {
      chrome.storage.local.set({ hltvResults: data.results, hltvLogo: data.hltvLogo });
      sendResponse({ hltvResults: data.results, hltvLogo: data.hltvLogo });
    }).catch(() => sendResponse({}));
    return true;
  }
  if (msg.type === 'fetchMajorStages') {
    fetchMajorStages().then(data => {
      chrome.storage.local.set({ majorStages: data });
      sendResponse(data);
    }).catch(() => sendResponse(null));
    return true;
  }
  if (msg.type === 'fetchBracket') {
    fetchBracket(msg.eventId).then(data => sendResponse(data)).catch(() => sendResponse(null));
    return true;
  }
});

async function fetchSchedule() {
  const r = await fetch(`${HLTV_URL}/matches/upcoming`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Schedule: ${r.status}`);
  return await r.json();
}

async function fetchEvents() {
  const r = await fetch(`${HLTV_URL}/events`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Events: ${r.status}`);
  return await r.json();
}

async function fetchMajorStages() {
  const r = await fetch(`${HLTV_URL}/major/stages`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`MajorStages: ${r.status}`);
  return await r.json();
}

async function fetchBracket(eventId) {
  const r = await fetch(`${HLTV_URL}/events/${encodeURIComponent(eventId)}/bracket`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Bracket: ${r.status}`);
  return await r.json();
}

async function poll() {
  try {
    chrome.storage.local.set({ lastPollAt: Date.now() });
    const [streamResult, liveMatchesResult, hltvResult, scheduleResult, eventsResult] = await Promise.allSettled([
      fetchStreamStatus(),
      fetchLiveMatches(),
      fetchHltvResults(),
      fetchSchedule(),
      fetchEvents(),
    ]);

    if (hltvResult.status === 'fulfilled') {
      chrome.storage.local.set({
        hltvResults: hltvResult.value.results,
        hltvLogo: hltvResult.value.hltvLogo,
      });
    }

    if (scheduleResult.status === 'fulfilled') {
      chrome.storage.local.set({ scheduleData: scheduleResult.value });
    }

    if (eventsResult.status === 'fulfilled') {
      chrome.storage.local.set({ eventsData: eventsResult.value });
    }

    const streamStatus = streamResult.status === 'fulfilled' ? streamResult.value : null;
    const liveMatches = liveMatchesResult.status === 'fulfilled' ? liveMatchesResult.value : [];
    if (!streamStatus) return;

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

    await chrome.storage.local.set({
      liveState: {
        isLive: true,
        streamTitle: streamStatus.streamTitle,
        viewerCount: streamStatus.viewerCount,
        startedAt,
        thumbnailUrl: streamStatus.thumbnailUrl,
        liveMatches,
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
