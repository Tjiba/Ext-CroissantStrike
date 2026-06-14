const TWITCH_CHANNEL = 'croissantstrike';
// Client ID public du site Twitch — pas besoin de créer une app
const GQL_CLIENT_ID = 'ry50l161twqye6mjdh1ukev75i2nwn';

export function normalizeStreamTitle(title) {
  return title
    .toLowerCase()
    .replace(/[|—–\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseGqlResponse(data) {
  // data is the batched response array: [UseLive result, detail result]
  const stream = data?.[0]?.data?.user?.stream;
  if (!stream) return { isLive: false, streamTitle: null, viewerCount: 0, thumbnailUrl: null, startedAt: null };
  const detail = data?.[1]?.data?.user?.stream;
  return {
    isLive: true,
    streamTitle: detail?.title ?? stream.title ?? '',
    viewerCount: stream.viewersCount ?? 0,
    startedAt: detail?.createdAt ?? stream.createdAt ?? null,
    thumbnailUrl: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${TWITCH_CHANNEL}-336x189.jpg?t=${Date.now()}`,
  };
}

const STREAM_URL = 'https://api.tjiba.fr/stream';
const LIVE_MATCHES_URL = 'https://api.tjiba.fr/matches/live';

export async function fetchStreamStatus() {
  const resp = await fetch(STREAM_URL, {
    cache: 'no-store',
  });
  if (!resp.ok) throw new Error(`Stream: ${resp.status}`);
  const data = await resp.json();

  return {
    isLive: data.isLive ?? false,
    streamTitle: data.title ?? '',
    viewerCount: data.viewerCount ?? 0,
    startedAt: data.startedAt ?? null,
    thumbnailUrl: data.isLive
      ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${TWITCH_CHANNEL}-336x189.jpg?t=${Date.now()}`
      : null,
  };
}

// Matchs pro en cours sur la scène mondiale (scrapés HLTV) — endpoint dédié.
// Note : /matches/live renvoyait une liste vide au moment du branchement, la forme
// exacte d'un item n'a pas pu être observée ; on normalise défensivement vers les
// champs attendus par la popup (renderLiveMatches / renderMatchCard).
export async function fetchLiveMatches() {
  const resp = await fetch(LIVE_MATCHES_URL, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`Live matches: ${resp.status}`);
  const body = await resp.json();
  const matches = body.matches ?? body ?? [];

  return matches.map(m => ({
    teamA: m.teamA,
    teamB: m.teamB,
    scoreA: m.scoreA ?? 0,
    scoreB: m.scoreB ?? 0,
    logoA: m.logoA ?? null,
    logoB: m.logoB ?? null,
    event: m.event,
    stage: m.stage ?? null,
    playoff: m.playoff ?? null,
    bestOf: m.bestOf ?? null,
    finished: m.finished ?? false,
    winnerId: m.winnerId ?? m.winner ?? null,
  }));
}

// parseStreamStatus gardé pour compatibilité tests
export function parseStreamStatus(apiResponse) {
  if (!apiResponse.data || apiResponse.data.length === 0) {
    return { isLive: false, streamTitle: null, viewerCount: 0, thumbnailUrl: null };
  }
  const stream = apiResponse.data[0];
  return {
    isLive: true,
    streamTitle: stream.title,
    viewerCount: stream.viewer_count,
    thumbnailUrl: stream.thumbnail_url
      ?.replace('{width}', '336')
      .replace('{height}', '189') ?? null,
  };
}
