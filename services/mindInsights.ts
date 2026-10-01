import { z } from 'zod';
import type { MindInsight, MindInsightFace } from '@/types';

/**
 * True when `text` is not already represented in `existing` (substring-overlap
 * dedup, mirroring the memory dedup style). Pure — safe to unit test.
 */
export function isNovelInsight(text: string, existing: MindInsight[]): boolean {
  const t = (text || '').trim().toLowerCase();
  if (!t) return false;
  return !existing.some(e => {
    const x = (e?.text || '').trim().toLowerCase();
    return x === t || x.includes(t) || t.includes(x);
  });
}

const insightSchema = z.object({
  found: z.boolean(),
  text: z.string().optional(),
  face: z.enum(['identity', 'ambition', 'obstacle', 'workstyle']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Asks the model to surface ONE genuinely new, meaningful observation about the
 * person (not a task). Returns null when nothing novel/meaningful is found.
 * The AI SDK is imported lazily so this module stays unit-testable under bun.
 */
export async function phraseInsight(
  conversationText: string,
  existing: MindInsight[],
): Promise<{ text: string; face: MindInsightFace; confidence: number } | null> {
  if (!conversationText.trim()) return null;
  const known = existing.map(i => `- ${i.text}`).join('\n') || 'None yet';
  const system = `You are the perceptive inner voice of Mazō, a companion that learns who its person is.
From the conversation, surface AT MOST ONE genuinely new, meaningful thing you now understand about the PERSON — a trait, a value, how they work best, or what gets in their way. NEVER a task or to-do.
Write it as a warm, specific, second-person observation (e.g. "You do your sharpest thinking in the mornings"). Max 18 words. Pick the single most revealing one.
Return found:false if nothing new and meaningful is present, or if it only repeats something already known.

Already known about them:
${known}

Conversation:
${conversationText}`;
  try {
    const { generateObject } = await import('@/services/openai');
    const r = await generateObject({ messages: [{ role: 'user', content: system }], schema: insightSchema });
    if (!r.found || !r.text || !r.face) return null;
    if (!isNovelInsight(r.text, existing)) return null;
    return { text: r.text, face: r.face, confidence: r.confidence ?? 0.7 };
  } catch (err) {
    console.warn('[Mind] phraseInsight failed', err);
    return null;
  }
}


