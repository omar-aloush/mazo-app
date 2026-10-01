import { z } from 'zod';
import type { Memory, MindInsight, ActionPlan, MazoAction } from '@/types';

/**
 * Day Architect proposal generator. Reads the user's Mind (confirmed insights)
 * + active goals and proposes 1-3 concrete, approvable actions for the day.
 * Returns null when there's not enough to work with. AI SDK is lazy-loaded so
 * this stays importable without booting the native toolkit.
 */

const actionSchema = z.object({
    kind: z.enum(['alarm', 'calendar', 'reminder']),
    title: z.string(),
    detail: z.string(),
    hour: z.number().min(0).max(23),
    minute: z.number().min(0).max(59).optional(),
    endHour: z.number().min(0).max(23).optional(), // calendar blocks
    weekdaysOnly: z.boolean().optional(),
});

const proposalSchema = z.object({
    why: z.string(),
    actions: z.array(actionSchema).max(3),
});

const WEEKDAYS = [1, 2, 3, 4, 5];

/** Next occurrence of hour:minute — today if still ahead, else tomorrow. */
function nextOccurrenceISO(hour: number, minute: number): string {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d.toISOString();
}

export async function generateDayProposal(
    memory: Memory,
    mindInsights: MindInsight[],
    userContext?: { name?: string; currentFocus?: string },
): Promise<ActionPlan | null> {
    const known = (mindInsights ?? []).filter(i => i.status === 'confirmed' || i.status === 'corrected');
    const activeGoals = memory.goals.filter(g => g.status === 'active');
    if (known.length === 0 && activeGoals.length === 0) return null;

    const mindText = known.map(i => `- ${i.text}`).join('\n') || 'Not much yet';
    const goals = activeGoals.map(g => g.title).join(', ') || 'None';
    const now = new Date();

    const system = `You are Mazō's Day Architect. Using what you know about this person, propose 1-3 concrete actions to set up their day so it protects what matters to them. Each action is an alarm, a calendar focus-block, or a reminder.
Make it realistic and personal — tie each action to what you know about them.
Current local time: ${now.toLocaleString()}.
Times are 24h: give "hour" (and optional "minute"). For a calendar block also give "endHour". Set "weekdaysOnly" true for work routines.
Write a short "why" — one warm second-person sentence that connects the plan to what you've learned.

What you know about them:
${mindText}
Active goals: ${goals}
${userContext?.currentFocus ? `Current focus: ${userContext.currentFocus}` : ''}`;

    try {
        const { generateObject } = await import('@/services/openai');
        const r = await generateObject({ messages: [{ role: 'user', content: system }], schema: proposalSchema });
        if (!r.actions?.length) return null;

        const actions: MazoAction[] = r.actions.map((a, i) => {
            const id = `da-${Date.now()}-${i}`;
            const minute = a.minute ?? 0;
            if (a.kind === 'alarm') {
                return { id, kind: 'alarm', title: a.title, detail: a.detail, hour: a.hour, minute, days: a.weekdaysOnly ? WEEKDAYS : [] };
            }
            if (a.kind === 'calendar') {
                const startISO = nextOccurrenceISO(a.hour, minute);
                const end = new Date(startISO);
                end.setHours(a.endHour ?? a.hour + 1, minute, 0, 0);
                return { id, kind: 'calendar', title: a.title, detail: a.detail, startISO, endISO: end.toISOString() };
            }
            return { id, kind: 'reminder', title: a.title, detail: a.detail, dueISO: nextOccurrenceISO(a.hour, minute) };
        });

        return { understood: 'Set up your day', why: r.why, actions };
    } catch (e) {
        console.warn('[DayArchitect] generateDayProposal failed', e);
        return null;
    }
}

