import { generateText } from '@/services/openai';
import { Coach, UserContext, Message, Memory, SessionPhase } from '@/types';
import { buildPhaseAwarePrompt, detectPhaseTransition } from '@/constants/session-phases';

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

const isNetworkError = (error: unknown): boolean => {
  if (error instanceof NetworkError) return true;
  if (!(error instanceof Error)) return false;

  const message = (error?.message || '').toLowerCase();
  const networkPatterns = [
    'network',
    'fetch',
    'request',
    'connection',
    'timeout',
    'econnrefused',
    'enotfound',
    'etimedout',
    'failed to fetch',
  ];

  return networkPatterns.some(pattern => message.includes(pattern));
};

const isClientError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const message = (error?.message || '').toLowerCase();
  return message.includes('invalid') ||
    message.includes('authentication') ||
    message.includes('unauthorized') ||
    message.includes('forbidden');
};

const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> => {
  let lastError: Error | null = null;
  const delays = [1000, 2000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (isClientError(error)) {
        throw error;
      }

      if (attempt < maxRetries && isNetworkError(error)) {
        const delay = delays[attempt] || 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Unknown error');
};

const withTimeout = async <T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> => {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError('Response timed out. Please try again.')),
        timeoutMs
      )
    ),
  ]);
};

const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/\0/g, '')
    .substring(0, 5000);
};

interface CoachingRequest {
  coach: Coach;
  messages: Message[];
  userContext: UserContext;
  memory?: Memory;
  currentPhase?: SessionPhase;  // Current coaching phase
  phaseStartedAt?: number;      // When current phase started
}

const buildContextBlock = (userContext: UserContext, memory?: Memory): string => {
  const parts: string[] = [];

  if (userContext.name?.trim()) {
    parts.push(`User's name: ${userContext.name}`);
  }
  if (userContext.age?.trim()) {
    parts.push(`User's age: ${userContext.age}`);
  }
  if (userContext.values.trim()) {
    parts.push(`Core values: ${userContext.values}`);
  }
  if (userContext.beliefs?.trim()) {
    parts.push(`Beliefs & principles: ${userContext.beliefs}`);
  }
  if (userContext.currentProjects?.trim()) {
    parts.push(`Active projects: ${userContext.currentProjects}`);
  }
  if (userContext.currentFocus.trim()) {
    parts.push(`Current focus: ${userContext.currentFocus}`);
  }
  if (userContext.constraints.trim()) {
    parts.push(`Constraints: ${userContext.constraints}`);
  }
  if (userContext.workStyle) {
    const workStyleMap = { morning: 'morning person', evening: 'night owl', flexible: 'flexible schedule' };
    parts.push(`Work style: ${workStyleMap[userContext.workStyle] || userContext.workStyle}`);
  }
  if (userContext.energyLevel) {
    parts.push(`Current energy: ${userContext.energyLevel}`);
  }

  if (memory) {
    const activeGoals = memory.goals.filter(g => g.status === 'active');
    if (activeGoals.length > 0) {
      parts.push(`Active goals: ${activeGoals.map(g => g.title).join(', ')}`);
    }

    const pendingTasks = memory.tasks.filter(t => t.status === 'pending');
    if (pendingTasks.length > 0) {
      parts.push(`Pending tasks: ${pendingTasks.slice(0, 5).map(t => t.title).join(', ')}`);
    }

    if (memory.preferences.length > 0) {
      const likes = memory.preferences.filter(p => p.category === 'like');
      const values = memory.preferences.filter(p => p.category === 'value');
      const interests = memory.preferences.filter(p => p.category === 'interest');

      if (likes.length > 0) {
        parts.push(`Things they like: ${likes.map(p => p.value).join(', ')}`);
      }
      if (values.length > 0) {
        parts.push(`What they value: ${values.map(p => p.value).join(', ')}`);
      }
      if (interests.length > 0) {
        parts.push(`Interests: ${interests.map(p => p.value).join(', ')}`);
      }
    }

    const openProblems = memory.problems.filter(p => p.status === 'open');
    if (openProblems.length > 0) {
      parts.push(`Current challenges: ${openProblems.slice(0, 3).map(p => p.description).join(', ')}`);
    }

    if (memory.constraints.length > 0) {
      parts.push(`Known constraints: ${memory.constraints.slice(0, 3).map(c => c.description).join(', ')}`);
    }
  }

  if (parts.length === 0) return '';

  return `\n\n[User Context - use this knowledge naturally to personalize your guidance, but don't explicitly list these facts back to the user]\n${parts.join('\n')}`;
};

const formatMessages = (messages: Message[]): { role: 'user' | 'assistant'; content: string }[] => {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
};

export interface CoachResponseResult {
  response: string;
  suggestedPhase: SessionPhase | null;  // Suggested next phase, or null if no change
}

export const generateCoachResponse = async ({
  coach,
  messages,
  userContext,
  memory,
  currentPhase = 'opening',
  phaseStartedAt = Date.now(),
}: CoachingRequest): Promise<CoachResponseResult> => {
  if (!coach) {
    throw new Error('Coach is required');
  }

  if (messages.length === 0) {
    return {
      response: 'How can I help you today?',
      suggestedPhase: null,
    };
  }

  const contextBlock = buildContextBlock(userContext, memory);

  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const phaseExchangeCount = messages.filter(
    m => m.role === 'user' && m.timestamp >= phaseStartedAt
  ).length;

  const phaseAwarePrompt = buildPhaseAwarePrompt(
    coach.systemPrompt,
    currentPhase,
    phaseExchangeCount,
    userMessageCount
  );

  const systemPrompt = phaseAwarePrompt + contextBlock;
  const formattedMessages = formatMessages(messages);

  const lastMessage = messages[messages.length - 1];
  const sanitizedLastContent = lastMessage ? sanitizeInput(lastMessage.content) : '';

  const allMessages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: `[System: ${systemPrompt}]\n\nPlease respond as ${coach.name}.` },
    ...formattedMessages.slice(0, -1),
    ...((lastMessage && lastMessage.role === 'user')
      ? [{ role: 'user' as const, content: sanitizedLastContent }]
      : (formattedMessages.length > 0 ? [formattedMessages[formattedMessages.length - 1]] : [])),
  ];

  try {
    const response = await withTimeout(
      () => withRetry(() => generateText({
        messages: allMessages,
      }), 2),
      30000
    );

    const suggestedPhase = detectPhaseTransition(
      currentPhase,
      messages,
      userMessageCount
    );

    return {
      response,
      suggestedPhase,
    };
  } catch (error) {
    console.warn('[AI] Error generating coach response:', error);

    if (error instanceof TimeoutError) {
      throw new Error('Response took too long. Tap to retry.');
    }

    if (isNetworkError(error)) {
      throw new Error('Connection lost. Check your network and try again.');
    }

    throw new Error('Something went wrong. Tap to retry.');
  }
};

export const generateInitialMessage = async (
  coach: Coach,
  userContext: UserContext
): Promise<string> => {
  const contextBlock = buildContextBlock(userContext);
  const systemPrompt = coach.systemPrompt + contextBlock;

  const prompt = `${systemPrompt}

Start a new coaching conversation. Send your opening message - it should be warm but not overly enthusiastic, and invite the user to share what's on their mind. Keep it to 1-2 sentences. Don't introduce yourself by name or role, just start naturally.`;

  try {
    const response = await withTimeout(
      () => generateText({
        messages: [{ role: 'user', content: prompt }],
      }),
      30000
    );

    return response;
  } catch (error) {
    console.warn('[AI] Error generating initial message:', error);
    return getDefaultInitialMessage(coach);
  }
};

const getDefaultInitialMessage = (coach: Coach): string => {
  const defaults: Record<string, string> = {
    clarifier: "What's weighing on your mind right now?",
    strategist: "What are you trying to move forward on?",
    reflector: "Take a breath. What would be most helpful to explore today?",
    energizer: "What's been on your mind lately?",
    sage: "What brings you here today?",
    scholar: "What topic are we mastering today?",
  };

  return defaults[coach.id] || "What would you like to explore?";
};

/**
 * AI-powered validation: checks if coaching instructions are meaningful.
 * Returns { valid: true } if OK, or { valid: false, reason: string } if gibberish.
 */
export const validateCoachInstructions = async (instructions: string): Promise<{ valid: boolean; reason?: string }> => {
  try {
    const response = await withTimeout(
      () => generateText({
        messages: [{
          role: 'user',
          content: `You are a content validator. Analyze the following text that someone submitted as "coaching instructions" for an AI coach. Determine if it is meaningful coaching instructions or gibberish/random text.

Rules:
- Meaningful instructions describe HOW the coach should behave, what topics to focus on, or what tone to use
- Gibberish includes random letters, keyboard smashing, or text with no coherent meaning
- Instructions can be in ANY language (English, Arabic, etc.) — non-English is NOT gibberish
- Short but meaningful instructions like "Be motivating and positive" are VALID

Text to validate:
"${instructions}"

Reply with EXACTLY one line:
VALID - if the text contains meaningful coaching instructions
INVALID - followed by a brief reason if the text is gibberish or not coaching-related`
        }],
      }),
      15000
    );

    const trimmed = response.trim().toUpperCase();
    if (trimmed.startsWith('VALID')) {
      return { valid: true };
    }
    return { valid: false, reason: 'These instructions don\'t appear to be meaningful coaching directions. Please describe how the coach should behave, what to focus on, and how to respond.' };
  } catch (error) {
    // If AI validation fails (network error etc.), allow creation — don't block on failure
    if (__DEV__) console.log('[AI] Validation failed, allowing creation:', error);
    return { valid: true };
  }
};


