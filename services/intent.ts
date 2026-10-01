import { generateObject } from '@/services/openai';
import { z } from 'zod';
import { DetectedIntent, IntentAction, SchedulingData, GeneratedSchedule, TimeBlock, Memory } from '@/types';

const intentSchema = z.object({
  primaryIntent: z.enum([
    'scheduling',
    'goal_setting',
    'reflection',
    'preference_sharing',
    'problem_solving',
    'planning',
    'focus_timer',
    'general',
  ]),
  confidence: z.number().min(0).max(1),
  extractedData: z.object({
    preferences: z.array(z.object({
      key: z.string(),
      value: z.string(),
      category: z.enum(['like', 'dislike', 'value', 'habit', 'interest', 'other']),
    })).optional(),
    schedulingInfo: z.object({
      availableTime: z.string().optional(),
      activities: z.array(z.string()).optional(),
      constraints: z.array(z.string()).optional(),
    }).optional(),
    goalInfo: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
    }).optional(),
    focusData: z.object({
      durationMinutes: z.number().optional(),
      task: z.string().optional(),
    }).optional(),
  }).optional(),
  suggestedAction: z.object({
    label: z.string(),
    description: z.string(),
    isReady: z.boolean(),
  }).optional(),
});

export const detectIntentFromMessage = async (
  message: string,
  conversationContext: string
): Promise<{
  intent: DetectedIntent;
  action: IntentAction | null;
  extractedPreferences: { key: string; value: string; category: string }[];
  schedulingInfo: Partial<SchedulingData>;
}> => {
  const prompt = `Analyze this user message in the context of a coaching conversation.

Conversation context:
${conversationContext}

Latest message:
${message}

Determine:
1. The primary intent (scheduling, goal_setting, reflection, preference_sharing, problem_solving, planning, general)
2. Any preferences the user mentioned (things they like, dislike, value, habits, interests)
3. Any scheduling-related information (available time, activities to schedule, constraints)
4. If there's a clear action the app should suggest

For scheduling intent: user talks about wanting to create a schedule, plan their day/week, organize time
For preference_sharing: user mentions things they love, hate, enjoy, prefer, value
For goal_setting: user talks about what they want to achieve, goals, objectives
For reflection: user is processing emotions, thinking through decisions, seeking clarity
For problem_solving: user has a specific challenge they need help with
For planning: user wants to make plans (not time-based schedules)
For focus_timer: user asks to start a timer, focus for a specific amount of time, study session, work sprint, pomodoro
For general: casual conversation, questions, or unclear intent

Be conservative - only suggest an action if there's clear intent.`;

  try {
    const result = await generateObject({
      messages: [{ role: 'user', content: prompt }],
      schema: intentSchema,
    });

    const now = Date.now();
    let action: IntentAction | null = null;

    if (result.suggestedAction && result.confidence > 0.6) {
      action = {
        id: `action-${now}`,
        type: result.primaryIntent,
        label: result.suggestedAction.label,
        description: result.suggestedAction.description,
        isReady: result.suggestedAction.isReady,
        data: result.extractedData?.focusData || undefined,
      };
    }

    return {
      intent: result.primaryIntent,
      action,
      extractedPreferences: result.extractedData?.preferences || [],
      schedulingInfo: result.extractedData?.schedulingInfo || {},
    };
  } catch (error) {
    console.warn('[Intent] Error detecting intent:', error);
    return {
      intent: 'general',
      action: null,
      extractedPreferences: [],
      schedulingInfo: {},
    };
  }
};

const scheduleSchema = z.object({
  title: z.string(),
  timeBlocks: z.array(z.object({
    startTime: z.string(),
    endTime: z.string(),
    activity: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })),
  notes: z.string(),
});

export const generateSchedule = async (
  schedulingData: SchedulingData,
  memory: Memory,
  userContext?: { name?: string; values?: string; currentFocus?: string; constraints?: string }
): Promise<GeneratedSchedule | null> => {
  const userInfo = userContext?.name ? `User's name: ${userContext.name}\n` : '';
  const userValues = userContext?.values ? `Core values: ${userContext.values}\n` : '';
  const userFocus = userContext?.currentFocus ? `Current focus: ${userContext.currentFocus}\n` : '';
  const userConstraints = userContext?.constraints ? `Personal constraints: ${userContext.constraints}\n` : '';

  const prompt = `Create a practical schedule based on the user's information.

${userInfo}${userValues}${userFocus}${userConstraints}Available time: ${schedulingData.availableTime || 'Not specified'}
Activities to include: ${schedulingData.activities?.join(', ') || 'Not specified'}
Constraints: ${schedulingData.constraints?.join(', ') || 'None'}

User's goals: ${memory.goals.filter(g => g.status === 'active').map(g => g.title).join(', ') || 'None'}
User's pending tasks: ${memory.tasks.filter(t => t.status === 'pending').map(t => t.title).join(', ') || 'None'}
User's preferences: ${memory.preferences.map(p => `${p.key}: ${p.value}`).join(', ') || 'None'}

Create a realistic, balanced schedule that aligns with their values and focus. Include specific time blocks, breaks, and consider energy levels throughout the day. Be practical and actionable.`;

  try {
    const result = await generateObject({
      messages: [{ role: 'user', content: prompt }],
      schema: scheduleSchema,
    });

    const now = Date.now();
    const timeBlocks: TimeBlock[] = result.timeBlocks.map((block, i) => ({
      id: `block-${now}-${i}`,
      startTime: block.startTime,
      endTime: block.endTime,
      activity: block.activity,
      priority: block.priority,
    }));

    return {
      id: `schedule-${now}`,
      title: result.title,
      timeBlocks,
      notes: result.notes,
      generatedAt: now,
    };
  } catch (error) {
    console.warn('[Intent] Error generating schedule:', error);
    return null;
  }
};

const scheduleParseSchema = z.object({
  hasSchedule: z.boolean(),
  scheduleType: z.enum(['daily', 'weekly', 'flexible']),
  schedule: z.object({
    title: z.string(),
    timeBlocks: z.array(z.object({
      startTime: z.string(),
      endTime: z.string(),
      activity: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
      day: z.string().optional(),
    })),
    notes: z.string(),
  }).optional(),
});

export const parseScheduleFromResponse = async (
  response: string
): Promise<GeneratedSchedule | null> => {
  const prompt = `Analyze this AI coaching response and EXTRACT any schedule, study plan, or time-based activities.

Response to analyze:
${response}

YOUR TASK: Convert ANY schedule-like content into structured time blocks.

Look for:
1. Explicit times: "9:00 AM - 10:00 AM: Study"
2. Duration-based: "30-45 minutes of review", "1 hour deep work"
3. Day-based: "Monday: Focus on X", "Mon-Fri routine"
4. Session-based: "After lecture (30 min)", "Morning session", "Evening review"
5. Recurring patterns: "Daily 60-90 min study session"

CONVERSION RULES:
- "Morning" = 8:00-9:00
- "After lecture" or "Post-class" = 14:00-15:00  
- "Deep study session 60-90 min" = 16:00-17:30
- "Evening review" = 19:00-20:00
- "30-45 min review" = create a 45 min block
- For day-based schedules (Mon, Tue, etc), assign times: Mon=9:00, Tue=10:00, etc.
- If duration is given without time, space them throughout the day starting at 9:00

IMPORTANT: If the response contains ANY study plan, routine, or schedule structure, return hasSchedule: true and create proper time blocks.
Be generous in interpretation - convert vague schedules into concrete times.
For scheduleType: use 'daily' for single-day plans, 'weekly' for week overviews, 'flexible' for recurring/routine plans.`;

  try {
    const result = await generateObject({
      messages: [{ role: 'user', content: prompt }],
      schema: scheduleParseSchema,
    });

    if (__DEV__) console.log('[Intent] Schedule parse result:', result?.schedule?.timeBlocks?.length ?? 0, 'items');

    if (result.hasSchedule && result.schedule && result.schedule.timeBlocks.length > 0) {
      const now = Date.now();
      const timeBlocks: TimeBlock[] = result.schedule.timeBlocks.map((block, i) => {
        const normalizedStart = normalizeTime(block.startTime);
        const normalizedEnd = normalizeTime(block.endTime);

        return {
          id: `block-${now}-${i}`,
          startTime: normalizedStart,
          endTime: normalizedEnd,
          activity: block.activity,
          priority: block.priority,
        };
      });

      return {
        id: `schedule-${now}`,
        title: result.schedule.title,
        timeBlocks,
        notes: result.schedule.notes,
        generatedAt: now,
      };
    }

    return null;
  } catch (error) {
    console.warn('[Intent] Error parsing schedule from response:', error);
    return null;
  }
};

const normalizeTime = (timeStr: string): string => {
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    return timeStr;
  }

  const match12h = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)/i);
  if (match12h) {
    let hour = parseInt(match12h[1], 10);
    const minutes = match12h[2] || '00';
    const period = match12h[3].toUpperCase();

    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    return `${hour.toString().padStart(2, '0')}:${minutes}`;
  }

  const hourMatch = timeStr.match(/^(\d{1,2})$/);
  if (hourMatch) {
    return `${hourMatch[1].padStart(2, '0')}:00`;
  }

  return timeStr;
};

export const getActionLabel = (intent: DetectedIntent): { label: string; description: string } => {
  const labels: Record<DetectedIntent, { label: string; description: string }> = {
    scheduling: {
      label: 'Get Your Schedule',
      description: 'Generate a personalized schedule based on your conversation',
    },
    goal_setting: {
      label: 'Save Goal',
      description: 'Add this goal to your system',
    },
    reflection: {
      label: 'Save Insight',
      description: 'Remember this reflection',
    },
    preference_sharing: {
      label: 'Save to Memory',
      description: 'Remember your preferences',
    },
    problem_solving: {
      label: 'Track Challenge',
      description: 'Add this to your challenges',
    },
    planning: {
      label: 'Create Plan',
      description: 'Generate an action plan',
    },
    focus_timer: {
      label: 'Start Focus Session',
      description: 'Begin a deep work timer with accountability',
    },
    general: {
      label: 'Continue',
      description: 'Keep the conversation going',
    },
  };

  return labels[intent];
};

