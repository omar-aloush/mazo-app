import { generateObject } from '@/services/openai';
import { z } from 'zod';
import { getLanguage, getAvailableLanguages } from '@/i18n/i18n';

// We do not actually need all these types if they are not exported, let's just stick to what was already there plus our i18n imports.
import { Memory, DailyPlan, WeeklyDirection } from '@/types';

const extractionSchema = z.object({
  goals: z.array(z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['short-term', 'long-term']),
    priority: z.enum(['high', 'medium', 'low']),
  })).optional(),
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']),
    estimatedMinutes: z.number().optional(),
  })).optional(),
  habits: z.array(z.object({
    title: z.string(),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
  })).optional(),
  ideas: z.array(z.object({
    content: z.string(),
    category: z.string().optional(),
  })).optional(),
  problems: z.array(z.object({
    description: z.string(),
    urgency: z.enum(['high', 'medium', 'low']),
  })).optional(),
  constraints: z.array(z.object({
    type: z.enum(['time', 'energy', 'deadline', 'other']),
    description: z.string(),
  })).optional(),
  preferences: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })).optional(),
});

export const extractMemoryFromConversation = async (
  conversationText: string,
  existingMemory: Memory
): Promise<Partial<Memory>> => {
  if (!conversationText.trim()) return {};

  const currentLangCode = getLanguage();
  const langName = getAvailableLanguages().find((l: any) => l.code === currentLangCode)?.nativeName || 'the same language as the conversation';

  const systemPrompt = `You are the memory manager for Mazō, an AI coaching app.
Your job is to analyze the conversation and extract permanent, actionable memory items:
1. LONG-TERM GOALS: Big picture objectives the user is working towards
2. ACTIVE CHALLENGES/PROBLEMS: Core issues they are currently fighting
3. NEXT FLIGHT TASKS: Specific, concrete actions they agreed to do
4. INSIGHTS: Fundamental realisations or shifts in perspective

[LANGUAGE — CRITICAL INSTRUCTION]
YOU MUST EXTRACT AND WRITE ALL OUTPUT FIELD TEXT IN THIS LANGUAGE: ${langName} (${currentLangCode}).
You must not translate to English unless the user's text was explicitly in English. If the user's input is in Arabic, all goals, challenges, tasks, and insights MUST be written in Arabic.

[CURRENT KNOWLEDGE STATE]
If the user already has any active goals or challenges, updating them is better than duplicating them.
Current Memory State (JSON if available): ${existingMemory ? JSON.stringify(existingMemory) : 'None'}

[FORMATTING RULES]
- Keep titles short and punchy.
- Keep descriptions concise but specific.
- Only extract things clearly stated or strongly implied by the user in this conversation.
- If no new items are found, simply return empty arrays. DO NOT invent items.

Conversation:
${conversationText}

Extract any of the following if mentioned (only new items):
- Goals (things they want to achieve)
- Tasks (specific things to do)
- Habits (recurring behaviors they want to build)
- Ideas (thoughts, concepts, inspirations)
- Problems (challenges, frustrations)
- Constraints (time limits, energy levels, deadlines)
- Preferences (likes, dislikes, values)

Only include items explicitly or clearly implied from the conversation. Do not invent or assume.`;

  try {
    const rawRes = await generateObject({
      messages: [{ role: 'user', content: systemPrompt }],
      schema: extractionSchema,
    });
    const result = extractionSchema.parse((rawRes as any)?.object || rawRes || {});

    const now = Date.now();
    const extracted: Partial<Memory> = { lastExtractedAt: now };

    if (Array.isArray(result.goals) && result.goals.length) {
      extracted.goals = result.goals.map((g: any, i: number) => ({
        id: `goal-${now}-${i}`,
        title: (g.title || g.description || g.goal || 'Goal').trim(),
        description: g.description || '',
        type: g.type || 'short-term',
        priority: g.priority || 'medium',
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      })).filter((g: any) => g.title);
    }

    if (Array.isArray(result.tasks) && result.tasks.length) {
      extracted.tasks = result.tasks.map((t: any, i: number) => ({
        id: `task-${now}-${i}`,
        title: (t.title || t.description || t.task || t.name || 'Task').trim(),
        description: t.description || '',
        priority: t.priority || 'medium',
        status: 'pending' as const,
        estimatedMinutes: t.estimatedMinutes,
        createdAt: now,
      })).filter((t: any) => t.title);
    }

    if (result.habits?.length) {
      extracted.habits = result.habits.map((h, i) => ({
        id: `habit-${now}-${i}`,
        title: h.title,
        frequency: h.frequency,
        createdAt: now,
      }));
    }

    if (result.ideas?.length) {
      extracted.ideas = result.ideas.map((idea, i) => ({
        id: `idea-${now}-${i}`,
        content: idea.content,
        category: idea.category,
        createdAt: now,
      }));
    }

    if (result.problems?.length) {
      extracted.problems = result.problems.map((p, i) => ({
        id: `problem-${now}-${i}`,
        description: p.description,
        urgency: p.urgency,
        status: 'open' as const,
        createdAt: now,
      }));
    }

    if (result.constraints?.length) {
      extracted.constraints = result.constraints.map((c, i) => ({
        id: `constraint-${now}-${i}`,
        type: c.type,
        description: c.description,
        createdAt: now,
      }));
    }

    return extracted;
  } catch (error) {
    console.warn('[Memory] Error extracting memory:', error);
    return { lastExtractedAt: Date.now() };
  }
};

const dailyPlanSchema = z.object({
  focus: z.string(),
  suggestedTasks: z.array(z.object({
    title: z.string(),
    reason: z.string(),
    estimatedMinutes: z.number(),
  })),
  insights: z.array(z.string()),
});

export const generateDailyPlan = async (
  memory: Memory,
  availableTime?: string,
  userContext?: { name?: string; values?: string; currentFocus?: string; constraints?: string }
): Promise<DailyPlan | null> => {
  const activeGoals = memory.goals.filter(g => g.status === 'active');
  const pendingTasks = memory.tasks.filter(t => t.status === 'pending');
  const openProblems = memory.problems.filter(p => p.status === 'open');

  const userInfo = userContext?.name ? `User's name: ${userContext.name}\n` : '';
  const userValues = userContext?.values ? `Core values: ${userContext.values}\n` : '';
  const userFocus = userContext?.currentFocus ? `Current focus: ${userContext.currentFocus}\n` : '';
  const userConstraints = userContext?.constraints ? `Personal constraints: ${userContext.constraints}\n` : '';

  const prompt = `Based on this user's current situation, create a focused daily plan.

${userInfo}${userValues}${userFocus}${userConstraints}Goals: ${activeGoals.map(g => `${g.title} (${g.priority} priority)`).join(', ') || 'None set'}
Pending tasks: ${pendingTasks.map(t => `${t.title} (${t.priority})`).join(', ') || 'None'}
Current problems: ${openProblems.map(p => p.description).join(', ') || 'None'}
Constraints: ${memory.constraints.map(c => c.description).join(', ') || 'None'}
${availableTime ? `Available time today: ${availableTime}` : ''}

Create a realistic, focused daily plan that aligns with their values and current focus. Prioritize what moves them forward most. Be concise and practical.`;

  try {
    const rawPlan = await generateObject({
      messages: [{ role: 'user', content: prompt }],
      schema: dailyPlanSchema,
    });
    const result = dailyPlanSchema.parse((rawPlan as any)?.object || rawPlan || {});

    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    return {
      date: today,
      focus: result.focus,
      tasks: result.suggestedTasks.map((t, i) => ({
        id: `daily-task-${now}-${i}`,
        title: t.title,
        description: t.reason,
        priority: 'medium' as const,
        status: 'pending' as const,
        estimatedMinutes: t.estimatedMinutes,
        createdAt: now,
      })),
      insights: result.insights,
      generatedAt: now,
    };
  } catch (error) {
    console.warn('[Memory] Error generating daily plan:', error);
    return null;
  }
};

const weeklyDirectionSchema = z.object({
  mainGoals: z.array(z.string()),
  priorities: z.array(z.string()),
  insights: z.array(z.string()),
});

export const generateWeeklyDirection = async (
  memory: Memory,
  userContext?: { name?: string; values?: string; currentFocus?: string; constraints?: string }
): Promise<WeeklyDirection | null> => {
  const activeGoals = memory.goals.filter(g => g.status === 'active');

  const userInfo = userContext?.name ? `User's name: ${userContext.name}\n` : '';
  const userValues = userContext?.values ? `Core values: ${userContext.values}\n` : '';
  const userFocus = userContext?.currentFocus ? `Current focus: ${userContext.currentFocus}\n` : '';

  const prompt = `Based on this user's goals and situation, provide weekly direction.

${userInfo}${userValues}${userFocus}Goals: ${activeGoals.map(g => `${g.title}: ${g.description}`).join('\n') || 'None set'}
Current problems: ${memory.problems.filter(p => p.status === 'open').map(p => p.description).join(', ') || 'None'}
Constraints: ${memory.constraints.map(c => c.description).join(', ') || 'None'}

Provide clear weekly direction aligned with their values and current focus. Include 2-3 main goals for the week, key priorities to focus on, and strategic insights. Be concise and actionable.`;

  try {
    const rawDir = await generateObject({
      messages: [{ role: 'user', content: prompt }],
      schema: weeklyDirectionSchema,
    });
    const result = (rawDir as any)?.object || rawDir || {};

    const now = Date.now();
    const weekStart = getWeekStart();

    return {
      weekStart,
      mainGoals: result.mainGoals,
      priorities: result.priorities,
      insights: result.insights,
      generatedAt: now,
    };
  } catch (error) {
    console.warn('[Memory] Error generating weekly direction:', error);
    return null;
  }
};

const getWeekStart = (): string => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
};
