const SEPARATORS = /\s+vs\.?\s+|\s+versus\s+/i;
const NOISE = /[|—–\[\]()]/g;

export function extractTeamNames(streamTitle) {
  const clean = streamTitle.replace(NOISE, ' ').trim();
  const parts = clean.split(SEPARATORS);
  if (parts.length < 2) return [];
  const teamA = parts[0].trim().toLowerCase();
  const teamB = parts[1].split(/\s{2,}/)[0].trim().toLowerCase();
  return [teamA, teamB];
}

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function acronym(str) {
  return str.split(/\s+/).map(w => w[0]).join('').toLowerCase();
}

function teamMatches(matchTeam, candidate) {
  const m = normalize(matchTeam);
  const c = normalize(candidate);
  if (m.includes(c) || c.includes(m)) return true;
  // "NAVI" matches "Natus Vincere" via acronym
  if (acronym(m) === c || acronym(c) === m) return true;
  // token overlap: any word from candidate in matchTeam
  const mTokens = m.split(' ');
  const cTokens = c.split(' ').filter(t => t.length > 2);
  return cTokens.some(t => mTokens.some(mt => mt.includes(t) || t.includes(mt)));
}

export function findMatchId(streamTitle, matches) {
  const [teamA, teamB] = extractTeamNames(streamTitle);
  if (!teamA) return null;

  for (const match of matches) {
    const straight = teamMatches(match.teamA, teamA) && teamMatches(match.teamB, teamB);
    const reversed = teamMatches(match.teamA, teamB) && teamMatches(match.teamB, teamA);
    if (straight || reversed) return match.id;
  }
  return null;
}
