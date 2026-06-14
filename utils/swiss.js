// Logique pure de l'arbre suisse — testable sans DOM ni chrome.

function norm(s) {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Vainqueur / perdant d'un match terminé (par le score). null si non joué ou nul.
export function matchOutcome(m) {
  if (!m || m.status !== 'finished' || m.scoreA == null || m.scoreB == null) return null;
  if (m.scoreA === m.scoreB) return null;
  const aWins = m.scoreA > m.scoreB;
  return {
    winner: { name: aWins ? m.teamA : m.teamB, logo: aWins ? m.logoA : m.logoB },
    loser:  { name: aWins ? m.teamB : m.teamA, logo: aWins ? m.logoB : m.logoA },
  };
}

// Stage "en cours" pour la ligne du major parent : premier stage non terminé
// (les stages se jouent séquentiellement), sinon le dernier.
export function pickOngoingStage(stages) {
  if (!stages?.length) return null;
  const complete = s => (s.rounds ?? []).every(r => (r.matches ?? []).every(m => m.status === 'finished'));
  return stages.find(s => !complete(s)) ?? stages[stages.length - 1];
}

// Détecte si un event est dépliable et quel stage afficher. → { stage, stageLabel } ou null.
export function getEventStageInfo(event, majorStages) {
  if (!event || !majorStages || !majorStages.name || !Array.isArray(majorStages.stages)) return null;
  const major = norm(majorStages.name);
  const name = norm(event.name);
  const m = name.match(/^(.+?)\s+stage\s+(\d+)$/);
  const base = m ? m[1] : name;
  if (base !== major) return null;
  if (m) {
    const wanted = `stage ${m[2]}`;
    const stage = majorStages.stages.find(s => norm(s.name) === wanted);
    return stage ? { stage, stageLabel: stage.name } : null;
  }
  const stage = pickOngoingStage(majorStages.stages);
  return stage ? { stage, stageLabel: stage.name } : null;
}

// Regroupe les matchs d'un stage par record ("0-0" → [matchs]).
function byRecord(stage) {
  const map = {};
  for (const r of stage?.rounds ?? []) map[r.record] = r.matches ?? [];
  return map;
}

// Colonnes de matchs (data-driven : uniquement les records présents).
const COLUMN_LAYOUT = [
  ['0-0'],
  ['1-0', '0-1'],
  ['2-0', '1-1', '0-2'],
  ['2-1', '1-2'],
  ['2-2'],
];
export function buildColumns(stage) {
  const rec = byRecord(stage);
  return COLUMN_LAYOUT
    .map(records => records.filter(r => rec[r]).map(r => ({ record: r, matches: rec[r] })))
    .filter(col => col.length);
}

// Zones qualifiés / éliminés, dérivées des buckets terminaux.
export function computeZones(stage) {
  const rec = byRecord(stage);
  const winnersOf = r => (rec[r] ?? []).map(m => { const o = matchOutcome(m); return o ? o.winner : { placeholder: true }; });
  const losersOf  = r => (rec[r] ?? []).map(m => { const o = matchOutcome(m); return o ? o.loser  : { placeholder: true }; });
  const qualified = [
    { record: '3-0', teams: winnersOf('2-0') },
    { record: '3-1', teams: winnersOf('2-1') },
    { record: '3-2', teams: winnersOf('2-2') },
  ].filter(z => z.teams.length);
  const eliminated = [
    { record: '0-3', teams: losersOf('0-2') },
    { record: '1-3', teams: losersOf('1-2') },
    { record: '2-3', teams: losersOf('2-2') },
  ].filter(z => z.teams.length);
  return { qualified, eliminated };
}
