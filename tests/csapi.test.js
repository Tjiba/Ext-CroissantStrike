import { parseMatchLatest, parseMatchDetail } from '../utils/csapi.js';

describe('parseMatchLatest', () => {
  test('normalise un tableau de matchs', () => {
    const data = [
      { id: 101, team1: { name: 'Team Vitality' }, team2: { name: 'NAVI' }, event: 'ESL S21', winner: null, date: '2026-05-15T20:00:00Z' },
      { id: 102, team1: { name: 'FaZe' }, team2: { name: 'G2' }, event: 'Blast', winner: { id: 1, name: 'FaZe' }, date: '2026-05-15T18:00:00Z' },
    ];
    const result = parseMatchLatest(data);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 101, teamA: 'Team Vitality', teamB: 'NAVI', event: 'ESL S21', winner: null, date: '2026-05-15T20:00:00Z' });
    expect(result[1].winner).toBe('FaZe');
  });

  test('retourne [] si data non-tableau', () => {
    expect(parseMatchLatest(null)).toEqual([]);
    expect(parseMatchLatest(undefined)).toEqual([]);
  });
});

describe('parseMatchDetail', () => {
  test('extrait les scores par map et la map en cours', () => {
    const data = {
      id: 101,
      team1: { name: 'Team Vitality' },
      team2: { name: 'NAVI' },
      winner: null,
      date: '2026-05-15T20:00:00Z',
      maps: [
        { name: 'Inferno', team1_score: 16, team2_score: 12 },
        { name: 'Nuke', team1_score: 8, team2_score: 6 },
      ],
      event: 'ESL S21',
    };
    const result = parseMatchDetail(data);
    expect(result.teamA).toBe('Team Vitality');
    expect(result.maps[0]).toEqual({ name: 'Inferno', scoreA: 16, scoreB: 12, completed: true });
    expect(result.maps[1].completed).toBe(false);
    expect(result.currentMap).toBe('Nuke');
    expect(result.date).toBe('2026-05-15T20:00:00Z');
  });

  test('toutes les maps complètes quand le match a un winner', () => {
    const data = {
      id: 102,
      team1: { name: 'FaZe' }, team2: { name: 'G2' },
      winner: { id: 1, name: 'FaZe' },
      date: '2026-05-15T18:00:00Z',
      maps: [
        { name: 'Inferno', team1_score: 13, team2_score: 8 },
        { name: 'Dust2', team1_score: 10, team2_score: 13 },
        { name: 'Nuke', team1_score: 13, team2_score: 9 },
      ],
      event: 'Blast',
    };
    const result = parseMatchDetail(data);
    expect(result.winner).toBe('FaZe');
    expect(result.maps.every(m => m.completed)).toBe(true);
  });

  test('retourne null si data null', () => {
    expect(parseMatchDetail(null)).toBeNull();
  });
});
