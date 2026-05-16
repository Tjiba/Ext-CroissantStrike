let cachedToken = null;

function fetchWithTimeout(url, options = {}, ms = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

async function getToken(env) {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  const r = await fetchWithTimeout('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${env.TWITCH_CLIENT_ID}&client_secret=${env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
  });
  const data = await r.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

async function fetchTwitchStream(env) {
  const token = await getToken(env);
  const r = await fetchWithTimeout('https://api.twitch.tv/helix/streams?user_login=croissantstrike', {
    headers: { 'Client-Id': env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` },
  });
  const { data } = await r.json();
  if (!data?.length) return { isLive: false };
  const s = data[0];
  return { isLive: true, title: s.title, viewerCount: s.viewer_count, startedAt: s.started_at };
}

function normalizeMatch(m) {
  const oppA = m.opponents?.[0]?.opponent;
  const oppB = m.opponents?.[1]?.opponent;
  const scoreA = m.results?.find(r => r.team_id === oppA?.id)?.score ?? 0;
  const scoreB = m.results?.find(r => r.team_id === oppB?.id)?.score ?? 0;

  const maps = (m.games ?? [])
    .filter(g => g.status === 'finished')
    .sort((a, b) => a.position - b.position)
    .map(g => {
      const tA = g.teams?.find(t => t.team?.id === oppA?.id);
      const tB = g.teams?.find(t => t.team?.id === oppB?.id);
      return {
        map: g.map?.name ?? 'Unknown',
        scoreA: tA?.score ?? null,
        scoreB: tB?.score ?? null,
        winner: g.winner?.name ?? null,
      };
    });

  return {
    id: m.id,
    teamA: oppA?.name ?? 'TBD',
    teamB: oppB?.name ?? 'TBD',
    teamAId: oppA?.id ?? null,
    teamBId: oppB?.id ?? null,
    logoA: oppA?.image_url ?? null,
    logoB: oppB?.image_url ?? null,
    scoreA,
    scoreB,
    event: [m.league?.name, m.serie?.name].filter(Boolean).join(' ').trim(),
    bestOf: m.number_of_games ?? 3,
    winnerId: m.winner?.id ?? null,
    endedAt: m.end_at ?? null,
    hltvUrl: m.official_url ?? null,
    maps,
  };
}

async function fetchLiveMatches(env) {
  const r = await fetchWithTimeout(
    'https://api.pandascore.co/csgo/matches/running?per_page=20&sort=begin_at',
    { headers: { 'Authorization': `Bearer ${env.PANDASCORE_TOKEN}` } }
  );
  const data = await r.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter(m => ['s', 'a'].includes(m.tournament?.tier))
    .map(normalizeMatch);
}


const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/debug-results') {
      const r = await fetchWithTimeout('https://api.tjiba.fr/results?limit=5', { headers: { 'x-secret': 'Extcs3' } }, 30000);
      const text = await r.text();
      return new Response(text, { status: r.status, headers: CORS });
    }

    const hltvMatchM = pathname.match(/^\/hltv-match\/(\d+)$/);
    if (hltvMatchM) {
      const upstream = await fetchWithTimeout(
        `https://api.tjiba.fr/match/${hltvMatchM[1]}`,
        { headers: { 'x-secret': 'Extcs3' } },
        20000
      );
      const data = await upstream.text();
      return new Response(data, {
        status: upstream.status,
        headers: { ...CORS, 'Cache-Control': 'no-store' },
      });
    }

    // GET /hltv-resolve?teamA=X&teamB=Y → matchId depuis les 30 derniers résultats HLTV
    if (pathname === '/hltv-resolve') {
      const upstream = await fetchWithTimeout(
        `https://api.tjiba.fr/resolve?${url.searchParams}`,
        { headers: { 'x-secret': 'Extcs3' } },
        20000
      );
      const data = await upstream.text();
      return new Response(data, {
        status: upstream.status,
        headers: { ...CORS, 'Cache-Control': 'public, max-age=120' },
      });
    }

    if (pathname === '/hltv-match-by-teams') {
      const norm = s => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const a = norm(url.searchParams.get('a'));
      const b = norm(url.searchParams.get('b'));
      if (!a || !b) return new Response(JSON.stringify({ error: 'Missing teams' }), { status: 400, headers: CORS });

      const cacheKey = new Request(request.url);
      const cached = await caches.default.match(cacheKey);
      if (cached) return new Response(await cached.text(), { headers: CORS });

      const hltvHeaders = { 'x-secret': 'Extcs3' };
      const eventsResp = await fetchWithTimeout('https://api.tjiba.fr/events', { headers: hltvHeaders }, 20000);
      const { events = [] } = await eventsResp.json();

      const eventMatches = await Promise.all(
        events.map(ev =>
          fetchWithTimeout(`https://api.tjiba.fr/event/${ev.id}`, { headers: hltvHeaders }, 20000)
            .then(r => r.json())
            .catch(() => ({ matches: [] }))
        )
      );

      let foundMatchId = null;
      for (const { matches = [] } of eventMatches) {
        const match = matches.find(m => {
          const t0 = norm(m.teams?.[0]);
          const t1 = norm(m.teams?.[1]);
          return (t0.includes(a) || a.includes(t0)) && (t1.includes(b) || b.includes(t1))
              || (t0.includes(b) || b.includes(t0)) && (t1.includes(a) || a.includes(t1));
        });
        if (match) { foundMatchId = match.matchId; break; }
      }

      if (!foundMatchId) return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404, headers: CORS });

      const detailResp = await fetchWithTimeout(`https://api.tjiba.fr/match/${foundMatchId}`, { headers: hltvHeaders }, 20000);
      const detail = await detailResp.text();

      ctx.waitUntil(caches.default.put(cacheKey, new Response(detail, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=600' },
      })));
      return new Response(detail, { headers: { ...CORS, 'Cache-Control': 'no-store' } });
    }

    // GET /logos?teams=A,B,C → PandaScore team logos
    if (pathname === '/logos') {
      const teamsParam = url.searchParams.get('teams') ?? '';
      const teamNames = teamsParam.split(',').map(t => t.trim()).filter(Boolean);
      if (!teamNames.length) return new Response('{}', { headers: CORS });

      const logoMap = {};
      await Promise.all(teamNames.map(async name => {
        try {
          const r = await fetchWithTimeout(
            `https://api.pandascore.co/csgo/teams?search[name]=${encodeURIComponent(name)}&per_page=3`,
            { headers: { 'Authorization': `Bearer ${env.PANDASCORE_TOKEN}` } }
          );
          if (!r.ok) return;
          const teams = await r.json();
          if (!Array.isArray(teams) || !teams.length) return;
          const exact = teams.find(t => t.name.toLowerCase() === name.toLowerCase());
          const team = exact ?? teams[0];
          if (team?.image_url) logoMap[name] = team.image_url;
        } catch {}
      }));

      return new Response(JSON.stringify(logoMap), {
        headers: { ...CORS, 'Cache-Control': 'public, s-maxage=3600' },
      });
    }

    // GET / → stream + live matches
    const cache = caches.default;
    const cacheKey = new Request(request.url);
    const cached = await cache.match(cacheKey);
    if (cached) return new Response(await cached.text(), { headers: CORS });

    try {
      const [twitchResult, liveResult] = await Promise.allSettled([
        fetchTwitchStream(env),
        fetchLiveMatches(env),
      ]);

      const stream = twitchResult.status === 'fulfilled' ? twitchResult.value : { isLive: false };
      const liveMatches = liveResult.status === 'fulfilled' ? liveResult.value : [];
      const body = JSON.stringify({ ...stream, liveMatches });

      ctx.waitUntil(cache.put(cacheKey, new Response(body, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=60' },
      })));

      return new Response(body, { headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ isLive: false, liveMatches: [] }), { headers: CORS });
    }
  },
};
