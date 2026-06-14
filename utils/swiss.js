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
