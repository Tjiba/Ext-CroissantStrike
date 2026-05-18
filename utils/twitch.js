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

const LIVE_URL = 'https://api.tjiba.fr/live';

export async function fetchStreamStatus() {
  const resp = await fetch(LIVE_URL, {
    cache: 'no-store',
  });
  if (!resp.ok) throw new Error(`Worker error: ${resp.status}`);
  const data = await resp.json();

  return {
    isLive: data.isLive ?? false,
    streamTitle: data.title ?? '',
    viewerCount: data.viewerCount ?? 0,
    startedAt: data.startedAt ?? null,
    liveMatches: data.liveMatches ?? [],
    pastMatches: data.pastMatches ?? [],
    thumbnailUrl: data.isLive
      ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${TWITCH_CHANNEL}-336x189.jpg?t=${Date.now()}`
      : null,
  };
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
