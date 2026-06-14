import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEventStageInfo, pickOngoingStage, matchOutcome, buildColumns, computeZones } from './swiss.js';

const major = {
  name: 'IEM Cologne Major 2026',
  stages: [
    { name: 'Stage 1', rounds: [
      { record: '0-0', matches: [{ teamA: 'M80', teamB: 'LV', logoA: 'a', logoB: 'b', scoreA: 13, scoreB: 8, status: 'finished' }] },
      { record: '2-0', matches: [{ teamA: 'Spirit', teamB: '9z', logoA: 'c', logoB: 'd', scoreA: 2, scoreB: 1, status: 'finished' }] },
      { record: '0-2', matches: [{ teamA: 'Aurora', teamB: 'FURIA', logoA: 'e', logoB: 'f', scoreA: 0, scoreB: 2, status: 'finished' }] },
    ]},
    { name: 'Stage 2', rounds: [
      { record: '0-0', matches: [{ teamA: 'G2', teamB: 'NAVI', logoA: 'g', logoB: 'h', scoreA: 0, scoreB: 0, status: 'upcoming' }] },
      { record: '2-2', matches: [{ teamA: 'VIT', teamB: 'MOUZ', logoA: 'i', logoB: 'j', scoreA: 1, scoreB: 0, status: 'live' }] },
    ]},
  ],
};

test('getEventStageInfo : event de stage → son stage', () => {
  assert.equal(getEventStageInfo({ name: 'Iem Cologne Major 2026 Stage 1' }, major)?.stageLabel, 'Stage 1');
});
test('getEventStageInfo : event parent → stage en cours', () => {
  assert.equal(getEventStageInfo({ name: 'Iem Cologne Major 2026' }, major)?.stageLabel, 'Stage 2');
});
test('getEventStageInfo : event hors major → null', () => {
  assert.equal(getEventStageInfo({ name: 'Blast Bounty 2026 Season 2' }, major), null);
});
test('getEventStageInfo : majorStages absent → null', () => {
  assert.equal(getEventStageInfo({ name: 'Iem Cologne Major 2026' }, null), null);
});
test('pickOngoingStage : premier stage non terminé', () => {
  assert.equal(pickOngoingStage(major.stages)?.name, 'Stage 2');
});
test('matchOutcome : vainqueur par le score', () => {
  const o = matchOutcome({ teamA: 'A', teamB: 'B', logoA: 'la', logoB: 'lb', scoreA: 13, scoreB: 8, status: 'finished' });
  assert.equal(o.winner.name, 'A');
  assert.equal(o.loser.name, 'B');
});
test('matchOutcome : match non joué → null', () => {
  assert.equal(matchOutcome({ scoreA: 0, scoreB: 0, status: 'upcoming' }), null);
});

test('buildColumns : data-driven, seulement les records présents', () => {
  const cols = buildColumns(major.stages[0]);
  const recs = cols.flat().map(c => c.record);
  assert.deepEqual(recs, ['0-0', '2-0', '0-2']);
  assert.ok(!recs.includes('1-0'));
});
test('computeZones : vainqueurs 2-0 → qualifiés 3-0', () => {
  const z = computeZones(major.stages[0]);
  assert.equal(z.qualified.find(g => g.record === '3-0').teams[0].name, 'Spirit');
});
test('computeZones : perdants 0-2 → éliminés 0-3', () => {
  const z = computeZones(major.stages[0]);
  assert.equal(z.eliminated.find(g => g.record === '0-3').teams[0].name, 'Aurora');
});
test('computeZones : match non joué → placeholder', () => {
  const z = computeZones(major.stages[1]);
  assert.equal(z.qualified.find(g => g.record === '3-2').teams[0].placeholder, true);
});
