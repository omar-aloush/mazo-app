import { expect, test } from 'bun:test';
import { computeBond, stageFor } from './bond';
import type { MindInsight } from '@/types';

const ins = (o: Partial<MindInsight>): MindInsight => ({
  id: 'x', text: 't', face: 'identity', status: 'confirmed',
  confidence: 0.9, learnedAt: 0, timesUsed: 0, ...o,
});

test('empty insights → stranger, score 0', () => {
  const r = computeBond([]);
  expect(r.score).toBe(0);
  expect(r.stage).toBe('stranger');
  expect(r.confirmedCount).toBe(0);
});

test('proposed and dismissed insights do not count', () => {
  const r = computeBond([ins({ status: 'proposed' }), ins({ status: 'dismissed' })]);
  expect(r.confirmedCount).toBe(0);
  expect(r.score).toBe(0);
});

test('breadth across faces grows faster than the same face repeated', () => {
  const same = computeBond([ins({ id: '1' }), ins({ id: '2' }), ins({ id: '3' })]);
  const wide = computeBond([
    ins({ id: '1', face: 'identity' }),
    ins({ id: '2', face: 'ambition' }),
    ins({ id: '3', face: 'obstacle' }),
  ]);
  expect(wide.score).toBeGreaterThan(same.score);
});

test('corrections and usage raise the score', () => {
  const base = computeBond([ins({ id: '1' })]);
  const taught = computeBond([ins({ id: '1', status: 'corrected', timesUsed: 4 })]);
  expect(taught.score).toBeGreaterThan(base.score);
});

test('stage thresholds are correct at the boundaries', () => {
  expect(stageFor(0)).toBe('stranger');
  expect(stageFor(9)).toBe('stranger');
  expect(stageFor(10)).toBe('getting_to_know');
  expect(stageFor(39)).toBe('getting_to_know');
  expect(stageFor(40)).toBe('knows_you_well');
  expect(stageFor(74)).toBe('knows_you_well');
  expect(stageFor(75)).toBe('gets_you');
  expect(stageFor(100)).toBe('gets_you');
});
