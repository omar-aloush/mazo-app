/**
 * Session Phase Management for Structured Coaching
 * 
 * Implements the coaching flow with coach-specific overlays:
 * OPENING → EXPLORATION → ACTION → EXIT (+ FREEFORM mode)
 */

import { SessionPhase, Message } from '@/types';

// ========================================
// PHASE PROMPTS (Base prompts for each phase)
// ========================================

export const PHASE_PROMPTS: Record<SessionPhase, string> = {
    opening: `[PHASE: CONTEXT] Understand their situation. Ask meaningful questions. No advice yet — just listen, reflect, and gather information.`,

    exploration: `[PHASE: EXPLORE] Dig deeper into what actually matters. Ask clarifying questions. If the user asks for scheduling help, ask about their free time, existing commitments, and preferences BEFORE proposing any plan. Name the pattern or tension you see. Only move to action once you have enough information.`,

    action: `[PHASE: ACTION] You have enough context now. Provide a concrete, actionable plan or Action Block based on what you've learned.`,

    exit: `[PHASE: EXIT] Session is wrapping up. Send them off to act.`,

    freeform: `[FREEFORM MODE] Open conversation, user leads.`,
};

// ========================================
// COACH-SPECIFIC PHASE OVERLAYS
// Each coach has unique guidance for each phase
// ========================================

export type CoachId = 'clarifier' | 'strategist' | 'reflector' | 'energizer' | 'sage';

export interface CoachPhaseOverlay {
    opening: string;
    exploration: string;
    action: string;
    exit: string;
}

export const COACH_OVERLAYS: Record<CoachId, CoachPhaseOverlay> = {
    clarifier: {
        opening: "Lead with the real question and stakes. Seek the root of the confusion.",
        exploration: "Use clarity tools: assumptions, reversibility, smallest certainty.",
        action: "Choose the smallest step that reduces uncertainty.",
        exit: "Calm, crisp. Clarity comes from action.",
    },
    strategist: {
        opening: "Identify the bottleneck and the real objective.",
        exploration: "Use leverage thinking: 80/20, bottlenecks, time reality.",
        action: "One leveraged move, not a list.",
        exit: "Direct, no-nonsense. Execution beats planning.",
    },
    reflector: {
        opening: "Invite the user to name the feeling and values at stake.",
        exploration: "Mirror a pattern and check alignment with values.",
        action: "Propose one aligned micro-step.",
        exit: "Quiet confidence. Action is the next teacher.",
    },
    energizer: {
        opening: "Establish energy and momentum. What feels hardest to start?",
        exploration: "Find the smallest win and evidence of capability.",
        action: "A tiny step today that builds momentum.",
        exit: "Upbeat. Start now.",
    },
    sage: {
        opening: "Zoom out to time horizon and perspective.",
        exploration: "Use perspective shift or the mentor's voice.",
        action: "One wise next step tied to long-term alignment.",
        exit: "Grounded, timeless. Calm action.",
    },
};

// ========================================
// SESSION STATE TRACKING
// ========================================

export interface SessionState {
    phase: SessionPhase;
    messageCount: number;
    actionIdentified: boolean;
    sessionStartTime: number;
    lastActionBlockAt: number | null;
}

export const DEFAULT_SESSION_STATE: SessionState = {
    phase: 'opening',
    messageCount: 0,
    actionIdentified: false,
    sessionStartTime: Date.now(),
    lastActionBlockAt: null,
};

// ========================================
// PHASE TRANSITION LOGIC
// ========================================

// Detect freeform request
export const detectFreeformRequest = (message: string): boolean => {
    const freeformTriggers = [
        /open chat/i,
        /freeform/i,
        /just chat/i,
        /no structure/i,
        /let's just talk/i,
    ];
    return freeformTriggers.some(t => t.test(message));
};

// Determine session phase based on quality signals, not rigid counts
export const determineSessionPhase = (
    currentState: SessionState,
    userMessageCount: number,
    sessionDurationMinutes: number
): SessionPhase => {
    // Safety ceiling — absolute maximum to prevent runaway sessions
    // But this is a last resort, not the normal flow
    if (userMessageCount >= 25 || sessionDurationMinutes >= 30) {
        return 'exit';
    }

    // If action was already identified, we're in exit phase
    if (currentState.actionIdentified) {
        return 'exit';
    }

    // Soft nudge: at 10+ messages without action, push toward action phase
    // This is a hint, not a hard cutoff
    if (userMessageCount >= 10 && !currentState.actionIdentified) {
        return 'action';
    }

    // Normal quality-based progression
    if (userMessageCount < 3) return 'opening';
    if (userMessageCount < 6) return 'exploration';

    // After 6 messages, move to action if we haven't already
    if (!currentState.actionIdentified) return 'action';

    return 'exit';
};

// Detect phase transition based on user message
export const detectPhaseTransition = (
    currentPhase: SessionPhase,
    messages: Message[],
    userMessageCount: number
): SessionPhase | null => {
    if (currentPhase === 'freeform') return null; // Stay in freeform unless explicitly changed

    // Safely extract last user message text - handles both content and parts formats
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    const lastUserMessage = (
        lastUserMsg?.content ||
        (lastUserMsg as any)?.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ') ||
        ''
    ).toLowerCase();

    // Check for freeform request
    if (detectFreeformRequest(lastUserMessage)) {
        return 'freeform';
    }

    if ((currentPhase as SessionPhase) !== 'opening' && (currentPhase as SessionPhase) !== 'freeform') {
        const exitTriggers = [
            /thank(s| you)/i,
            /got it/i,
            /makes sense/i,
            /i('ll| will) do/i,
            /^(yes|yeah|yep|okay|ok)\.?$/i,
            /let's do it/i,
            /i'm ready/i,
        ];
        if (exitTriggers.some(t => t.test(lastUserMessage))) {
            return currentPhase === 'action' ? 'exit' : 'action';
        }
    }

    switch (currentPhase) {
        case 'opening':
            if (userMessageCount >= 2) return 'exploration';
            if (lastUserMessage.length > 150) return 'exploration';
            break;

        case 'exploration':
            if (userMessageCount >= 5) return 'action';
            const claritySignals = [
                /i think i (need|should|want) to/i,
                /i('ve| have) decided/i,
                /the real (issue|problem|question) is/i,
                /what i really (need|want)/i,
            ];
            if (claritySignals.some(t => t.test(lastUserMessage))) return 'action';
            break;

        case 'action':
            const commitmentSignals = [
                /^(yes|yeah|yep|okay|ok|sure|definitely)/i,
                /i('ll| will)/i,
                /let('s| me) do/i,
                /i('m| am) ready/i,
            ];
            if (commitmentSignals.some(t => t.test(lastUserMessage))) return 'exit';
            break;

        case 'exit':
            return null;
    }

    return null;
};

// ========================================
// ACTION BLOCK DETECTION
// ========================================

export const ACTION_BLOCK_PATTERN = /\*\*(?:Your Next Step|خطوتك القادمة):\*\*.*\n\*\*(?:When|متى):\*\*.*\n\*\*(?:Success looks like|النجاح شكله إيه):\*\*/i;

// Natural exit phrases that indicate session should close
const EXIT_PHRASES = [
    /close (this|the app)/i,
    /put (the )?phone down/i,
    /go (do|make|have|take)/i,
    /you know what to do/i,
    /you've got (this|clarity)/i,
    /go make it happen/i,
    /screen off/i,
    /take that (step|action)/i,
    /stop reading/i,
    /روح نفذها/,
    /عندك خطوتك/,
    /اقفل الجوال/,
    /روح اعمل/,
];

export const detectActionBlock = (response: string): boolean => {
    // Check for formal action block
    if (ACTION_BLOCK_PATTERN.test(response)) {
        return true;
    }

    // Check for natural exit phrases
    return EXIT_PHRASES.some(pattern => pattern.test(response));
};

export const extractActionFromBlock = (response: string): { action: string; when: string } | null => {
    // Try formal English pattern first
    const actionMatch = response.match(/\*\*(?:Your Next Step|خطوتك القادمة):\*\*\s*(.+)/i);
    const whenMatch = response.match(/\*\*(?:When|متى):\*\*\s*(.+)/i);

    if (actionMatch && whenMatch) {
        const action = actionMatch[1].trim();
        const when = whenMatch[1].trim();
        // Validate formal action is meaningful (at least 5 chars for Arabic which is more compact)
        if (action.length >= 5 && action.split(/\s+/).length >= 2) {
            return { action, when };
        }
        return null;
    }

    // For natural exit messages, extract the implied action
    // Look for action verbs — require meaningful length
    const naturalAction = response.match(/(?:go|close this and|put .* phone down and)\s+(.+?)(?:\.|$)/i);
    if (naturalAction) {
        const action = naturalAction[1].trim();
        // Reject vague matches like "do it", "it", "that" — require at least 10 chars and 3 words
        if (action.length >= 10 && action.split(/\s+/).length >= 3) {
            return { action, when: 'now' };
        }
    }

    // Arabic natural exit messages
    const naturalActionAr = response.match(/(?:روح|اقفل.*و)\s+(.+?)(?:\.|$)/);
    if (naturalActionAr) {
        const action = naturalActionAr[1].trim();
        if (action.length >= 5) {
            return { action, when: 'دلوقتي' };
        }
    }

    // No meaningful action found
    return null;
};

// ========================================
// PROMPT BUILDING
// ========================================

export const buildPhaseAwarePrompt = (
    basePrompt: string,
    currentPhase: SessionPhase,
    exchangeCount: number,
    totalExchanges: number,
    coachId?: string
): string => {
    const phasePrompt = PHASE_PROMPTS[currentPhase];

    // Get coach-specific overlay if available
    let coachOverlay = '';
    if (coachId && coachId in COACH_OVERLAYS && currentPhase !== 'freeform') {
        const overlays = COACH_OVERLAYS[coachId as CoachId];
        const overlayPhase = currentPhase === 'exit' ? 'exit' : currentPhase;
        coachOverlay = `\n\n[COACH STYLE]\n${overlays[overlayPhase as keyof CoachPhaseOverlay]}`;
    }

    // Add exchange-based coaching guidance (soft nudges, not cutoffs)
    let exchangeContext = '';
    if (currentPhase === 'exploration') {
        if (totalExchanges >= 8) {
            exchangeContext = '\n\n[COACHING NOTE: This is exchange 8+. If you feel you have enough context to identify a concrete next step, start moving toward ACTION. If the user still needs exploration, that\'s okay — but gently start steering toward clarity. Do NOT force action if the topic genuinely needs more discussion.]';
        }
    } else if (currentPhase === 'action') {
        if (totalExchanges >= 12) {
            exchangeContext = '\n\n[COACHING NOTE: 12+ exchanges. You should deliver a clear, actionable next step now. Format it as: **Your Next Step:** [specific action] **When:** [timeframe] **Success looks like:** [measurable outcome]. Be direct — the user has explored enough.]';
        } else if (totalExchanges >= 10) {
            exchangeContext = '\n\n[COACHING NOTE: 10+ exchanges. Time to start converging on a specific action. If you have enough information, propose a concrete next step. Keep it to ONE step, not a list.]';
        }
    }

    return `${basePrompt}\n\n${phasePrompt}${coachOverlay}${exchangeContext}`;
};

// Get phase exchange count
export const getPhaseExchangeCount = (
    messages: Message[],
    phaseStartedAt: number
): number => {
    return messages.filter(
        m => m.role === 'user' && m.timestamp >= phaseStartedAt
    ).length;
};

export default {
    PHASE_PROMPTS,
    COACH_OVERLAYS,
    detectPhaseTransition,
    detectFreeformRequest,
    determineSessionPhase,
    detectActionBlock,
    extractActionFromBlock,
    buildPhaseAwarePrompt,
    getPhaseExchangeCount,
    DEFAULT_SESSION_STATE,
};
