import { parseStreamStatus, parseGqlResponse, normalizeStreamTitle } from '../utils/twitch.js';

describe('parseStreamStatus (Helix fallback)', () => {
  test('retourne isLive true quand data non vide', () => {
    const response = {
      data: [{
        user_login: 'croissantstrike',
        title: 'Vitality vs NAVI | ESL Pro League S21',
        viewer_count: 4200,
        thumbnail_url: 'https://cdn.twitch.tv/live_user_croissantstrike-{width}x{height}.jpg',
      }]
    };
    const result = parseStreamStatus(response);
    expect(result.isLive).toBe(true);
    expect(result.streamTitle).toBe('Vitality vs NAVI | ESL Pro League S21');
    expect(result.viewerCount).toBe(4200);
    expect(result.thumbnailUrl).toBe('https://cdn.twitch.tv/live_user_croissantstrike-336x189.jpg');
  });

  test('retourne isLive false quand data vide', () => {
    const result = parseStreamStatus({ data: [] });
    expect(result.isLive).toBe(false);
    expect(result.streamTitle).toBeNull();
    expect(result.viewerCount).toBe(0);
  });
});

describe('parseGqlResponse', () => {
  test('retourne isLive true quand stream présent', () => {
    const data = [{ data: { user: { stream: { title: 'Vitality vs NAVI', viewersCount: 3200 } } } }];
    const result = parseGqlResponse(data);
    expect(result.isLive).toBe(true);
    expect(result.streamTitle).toBe('Vitality vs NAVI');
    expect(result.viewerCount).toBe(3200);
    expect(result.thumbnailUrl).toMatch(/live_user_croissantstrike-336x189\.jpg/);
  });

  test('retourne isLive false quand stream null', () => {
    const data = [{ data: { user: { stream: null } } }];
    const result = parseGqlResponse(data);
    expect(result.isLive).toBe(false);
  });

  test('retourne isLive false sur réponse vide', () => {
    expect(parseGqlResponse(null).isLive).toBe(false);
    expect(parseGqlResponse([]).isLive).toBe(false);
  });
});

describe('normalizeStreamTitle', () => {
  test('met en minuscule et collapse les séparateurs', () => {
    expect(normalizeStreamTitle('Vitality vs NAVI | ESL Pro League'))
      .toBe('vitality vs navi esl pro league');
  });

  test('gère les tirets longs', () => {
    expect(normalizeStreamTitle('FaZe vs G2 — Blast')).toBe('faze vs g2 blast');
  });
});
