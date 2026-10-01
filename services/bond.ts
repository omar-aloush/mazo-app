import type { MindInsight, BondStage } from '@/types';

export interface BondResult {
  score: number;          // 0..100
  stage: BondStage;
  confirmedCount: number;
}

export function stageFor(score: number): BondStage {
  if (score < 10) return 'stranger';
  if (score < 40) return 'getting_to_know';
  if (score < 75) return 'knows_you_well';
  return 'gets_you';
}

export const BOND_STAGE_LABELS: Record<BondStage, string> = {
  stranger: 'Stranger',
  getting_to_know: 'Getting to know you',
  knows_you_well: 'Knows you well',
  gets_you: 'Gets you',
};

/**
 * Derives the relationship depth from confirmed insights.
 * Rewards: count of confirmed/corrected insights, breadth across the four
 * faces, active teaching (corrections), and applied knowledge (timesUsed).
 * Proposed and dismissed insights never count toward the bond.
 */
export function computeBond(insights: MindInsight[]): BondResult {
  const confirmed = insights.filter(i => i.status === 'confirmed' || i.status === 'corrected');
  const confirmedCount = confirmed.length;
  const facesCovered = new Set(confirmed.map(i => i.face)).size;
  const corrections = insights.filter(i => i.status === 'corrected').length;
  const timesUsed = confirmed.reduce((sum, i) => sum + (i.timesUsed || 0), 0);

  const raw =
    confirmedCount * 5 +
    facesCovered * 6 +
    corrections * 3 +
    Math.min(timesUsed, 20) * 1.5;

  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return { score, stage: stageFor(score), confirmedCount };
}
