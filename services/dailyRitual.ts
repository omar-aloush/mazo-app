/**
 * Daily Ritual service — computes today's personalized focus from memory state.
 * Pure functions, no side-effects, no async. Fast and always available.
 */

type TFunction = (key: string, params?: Record<string, string | number>) => string;

interface MemoryState {
    goals: Array<{ id: string; title: string; status: string }>;
    tasks: Array<{ id: string; title: string; status: string }>;
    preferences: Array<{ id: string; key: string; value: string }>;
    ideas: Array<{ id: string; content: string }>;
    problems: Array<{ id: string; description: string; status: string }>;
}

interface DailyFocus {
    headline: string;
    subtitle: string;
    cta: string;
    chatPrompt: string | null;
    type: 'goal' | 'tasks' | 'streak' | 'fresh';
}

/**
 * Compute today's personalized focus based on user's memory and streak.
 */
export function computeDailyFocus(
    memory: MemoryState,
    currentStreak: number,
    t: TFunction,
): DailyFocus {
    const activeGoals = memory.goals.filter((g) => g.status === 'active');
    const pendingTasks = memory.tasks.filter((t) => t.status === 'pending');

    // Priority 1: Active goal with pending tasks
    if (activeGoals.length > 0 && pendingTasks.length > 0) {
        const goal = activeGoals[0];
        return {
            headline: t('dailyRitual.continueGoal', { goal: goal.title }),
            subtitle: t('dailyRitual.tasksWaiting', { count: pendingTasks.length }),
            cta: t('dailyRitual.ctaContinue'),
            chatPrompt: t('dailyRitual.promptGoal', { goal: goal.title }),
            type: 'goal',
        };
    }

    // Priority 2: Pending tasks without goals
    if (pendingTasks.length > 0) {
        return {
            headline: t('dailyRitual.tasksReady', { count: pendingTasks.length }),
            subtitle: t('dailyRitual.tackleFirst'),
            cta: t('dailyRitual.ctaTasks'),
            chatPrompt: t('dailyRitual.promptTasks'),
            type: 'tasks',
        };
    }

    // Priority 3: Active streak
    if (currentStreak >= 2) {
        return {
            headline: t('dailyRitual.streakDay', { count: currentStreak }),
            subtitle: t('dailyRitual.keepMomentum'),
            cta: t('dailyRitual.ctaStreak'),
            chatPrompt: null,
            type: 'streak',
        };
    }

    // Priority 4: Fresh start
    return {
        headline: t('dailyRitual.freshStart'),
        subtitle: t('dailyRitual.fiveMinutes'),
        cta: t('dailyRitual.ctaStart'),
        chatPrompt: null,
        type: 'fresh',
    };
}

/**
 * Build a 7-day heatmap showing which of the last 7 days had a session.
 * Returns array of 7 booleans (index 0 = 6 days ago, index 6 = today).
 */
export function buildWeeklyHeatmap(sessionDates: string[]): boolean[] {
    const today = new Date();
    const heatmap: boolean[] = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        heatmap.push(sessionDates.includes(dateStr));
    }

    return heatmap;
}

/**
 * Get a short day label for the heatmap.
 */
export function getHeatmapDayLabels(t: TFunction): string[] {
    const today = new Date();
    const labels: string[] = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const day = date.toLocaleDateString('en-US', { weekday: 'narrow' });
        labels.push(day);
    }

    return labels;
}

/**
 * Generate a personalized notification body for tomorrow's check-in.
 */
export function getPersonalizedNotificationBody(
    memory: MemoryState,
    currentStreak: number,
    userName?: string,
): string {
    const activeGoals = memory.goals.filter((g) => g.status === 'active');
    const name = userName?.trim();

    if (currentStreak >= 2 && activeGoals.length > 0) {
        const prefix = name ? `${name}, ` : '';
        return `${prefix}Day ${currentStreak + 1} — let's build on "${activeGoals[0].title}"`;
    }

    if (currentStreak >= 2) {
        return name
            ? `${name}, day ${currentStreak + 1} awaits. Keep the streak alive! 🔥`
            : `Day ${currentStreak + 1} awaits. Keep the streak alive! 🔥`;
    }

    if (activeGoals.length > 0) {
        return name
            ? `${name}, your goal "${activeGoals[0].title}" is waiting. 5 minutes of clarity?`
            : `Your goal "${activeGoals[0].title}" is waiting. 5 minutes of clarity?`;
    }

    return name
        ? `${name}, a quick coaching session can change your whole day.`
        : `A quick coaching session can change your whole day.`;
}
