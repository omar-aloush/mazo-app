import { MazoState } from '@/types';

const EMOTION_PATTERNS = {
    celebrating: [
        /congratulations/i,
        /amazing/i,
        /excellent/i,
        /great job/i,
        /well done/i,
        /proud of you/i,
        /you did it/i,
        /incredible/i,
        /fantastic/i,
        /brilliant/i,
        /nailed it/i,
        /perfect/i,
        /outstanding/i,
        /you crushed it/i,
        /knocked it out/i,
        /🎉|🎊|🏆|⭐|🌟/,
    ],
    encouraging: [
        /you can do/i,
        /you've got this/i,
        /believe in you/i,
        /keep going/i,
        /don't give up/i,
        /you're capable/i,
        /i know you can/i,
        /trust yourself/i,
        /go for it/i,
        /you're ready/i,
        /take that step/i,
        /you're stronger/i,
        /one step at a time/i,
        /small steps/i,
        /progress/i,
        /momentum/i,
        /making strides/i,
        /on the right track/i,
        /💪|🚀|✨|🔥/,
    ],
    empathetic: [
        /i understand/i,
        /that's hard/i,
        /it's okay to feel/i,
        /i hear you/i,
        /that must be/i,
        /i'm here/i,
        /it's normal to/i,
        /that sounds (tough|difficult|challenging)/i,
        /take your time/i,
        /be gentle with yourself/i,
        /it's valid/i,
        /completely natural/i,
        /no rush/i,
        /that makes sense/i,
        /your feelings matter/i,
        /i get it/i,
        /be kind to yourself/i,
        /💙|🤗|💚|🌱/,
    ],
    happy: [
        /happy to hear/i,
        /that's wonderful/i,
        /love that/i,
        /exciting/i,
        /that's great/i,
        /good for you/i,
        /how cool/i,
        /nice work/i,
        /sounds fun/i,
        /looking forward/i,
        /😊|☺️|😄|🙂/,
    ],
};

export function detectMazoEmotion(text: string): MazoState | null {
    for (const pattern of EMOTION_PATTERNS.celebrating) {
        if (pattern.test(text)) return 'celebrating';
    }

    for (const pattern of EMOTION_PATTERNS.encouraging) {
        if (pattern.test(text)) return 'encouraging';
    }

    for (const pattern of EMOTION_PATTERNS.empathetic) {
        if (pattern.test(text)) return 'empathetic';
    }

    for (const pattern of EMOTION_PATTERNS.happy) {
        if (pattern.test(text)) return 'happy';
    }

    return null;
}

export function getMazoStateForContext(
    isLoading: boolean,
    isRecording: boolean,
    lastAIMessage: string | null,
    messageCount: number
): MazoState {
    if (isRecording) return 'listening';
    if (isLoading) return 'thinking';

    if (lastAIMessage) {
        const emotion = detectMazoEmotion(lastAIMessage);
        if (emotion) return emotion;
    }

    if (messageCount > 0) return 'responding';

    return 'idle';
}

export function getMazoStateForScreen(
    screen: 'welcome' | 'chat' | 'memory' | 'tasks' | 'coaches' | 'celebration'
): MazoState {
    switch (screen) {
        case 'welcome':
            return 'happy';
        case 'chat':
            return 'idle';
        case 'memory':
            return 'memory_save';
        case 'tasks':
            return 'plan_ready';
        case 'coaches':
            return 'idle';
        case 'celebration':
            return 'celebrating';
        default:
            return 'idle';
    }
}
