const CSAPI_BASE = 'https://api.csapi.de';

export function parseMatchLatest(data) {
  if (!Array.isArray(data)) return [];
  return data.map(m => ({
    id: m.id,
    teamA: m.team1?.name ?? 'TBD',
    teamB: m.team2?.name ?? 'TBD',
    event: m.event?.name ?? m.event ?? '',
    winner: m.winner?.name ?? m.winner ?? null,
    date: m.date ?? null,
  }));
}

export function parseMatchDetail(data) {
  if (!data) return null;
  const hasWinner = data.winner != null;
  const maps = (data.maps ?? []).map((m, i, arr) => ({
    name: m.name,
    scoreA: m.team1_score ?? 0,
    scoreB: m.team2_score ?? 0,
    completed: hasWinner || i < arr.length - 1,
  }));
  const currentMap = hasWinner
    ? maps[maps.length - 1]?.name ?? null
    : maps.find(m => !m.completed)?.name ?? maps[maps.length - 1]?.name ?? null;
  return {
    id: data.id,
    teamA: data.team1?.name ?? 'TBD',
    teamB: data.team2?.name ?? 'TBD',
    event: data.event?.name ?? data.event ?? '',
    winner: data.winner?.name ?? data.winner ?? null,
    date: data.date ?? null,
    maps,
    currentMap,
  };
}


export async function fetchLatestMatches() {
  const resp = await fetch(`${CSAPI_BASE}/matches/latest?limit=20`);
  if (!resp.ok) throw new Error(`csapi matches error: ${resp.status}`);
  return parseMatchLatest(await resp.json());
}

export async function fetchMatchById(matchId) {
  const resp = await fetch(`${CSAPI_BASE}/matches/${matchId}`);
  if (!resp.ok) throw new Error(`csapi match ${matchId} error: ${resp.status}`);
  return parseMatchDetail(await resp.json());
}

