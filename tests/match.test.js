import { extractTeamNames, findMatchId } from '../utils/match.js';

describe('extractTeamNames', () => {
  test('extrait avec "vs"', () => {
    expect(extractTeamNames('Vitality vs NAVI | ESL')).toEqual(['vitality', 'navi']);
  });

  test('extrait avec noms composés', () => {
    expect(extractTeamNames('FaZe Clan vs G2 Esports — Blast')).toEqual(['faze clan', 'g2 esports']);
  });

  test('retourne [] si pas de "vs"', () => {
    expect(extractTeamNames('CroissantStrike est en live')).toEqual([]);
  });
});

describe('findMatchId', () => {
  const matches = [
    { id: 101, teamA: 'Team Vitality', teamB: 'NAVI' },
    { id: 102, teamA: 'FaZe Clan', teamB: 'G2 Esports' },
  ];

  test('trouve le match par noms partiels', () => {
    expect(findMatchId('Vitality vs NAVI | ESL Pro League', matches)).toBe(101);
  });

  test('matching insensible à la casse', () => {
    expect(findMatchId('faze vs g2 esports', matches)).toBe(102);
  });

  test('retourne null si aucun match trouvé', () => {
    expect(findMatchId('Cloud9 vs Complexity', matches)).toBeNull();
  });

  test('accepte les équipes dans l\'ordre inversé', () => {
    expect(findMatchId('NAVI vs Vitality', matches)).toBe(101);
  });
});
