import { expect, test } from 'bun:test';
import { isNovelInsight } from './mindInsights';
import type { MindInsight } from '@/types';

const e = (text: string): MindInsight => ({
  id: text, text, face: 'workstyle', status: 'confirmed',
  confidence: 1, learnedAt: 0, timesUsed: 0,
});

test('novel when unrelated to anything known', () => {
  expect(isNovelInsight('You think best late at night', [e('You love mornings')])).toBe(true);
});

test('not novel when it overlaps an existing insight', () => {
  expect(isNovelInsight('mornings are your peak', [e('Your mornings are your peak time')])).toBe(false);
});

test('empty or whitespace text is never novel', () => {
  expect(isNovelInsight('   ', [])).toBe(false);
});

test('first-ever insight on an empty mind is novel', () => {
  expect(isNovelInsight('You avoid conflict to keep the peace', [])).toBe(true);
});
