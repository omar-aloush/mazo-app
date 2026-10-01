/**
 * Chat screen constants — extracted from chat/index.tsx for maintainability.
 * Pure data, no React dependencies.
 */

import { AIQuestion } from '@/types';

// ── Suggested Prompts ──────────────────────────────────
// ── Suggested Prompts ──────────────────────────────────
export const SUGGESTED_PROMPTS = [
    { id: '1', text: 'chat.prompts.decision', icon: 'target' },
    { id: '2', text: 'chat.prompts.think', icon: 'message-circle' },
    { id: '3', text: 'chat.prompts.plan', icon: 'clipboard-list' },
    { id: '4', text: 'chat.prompts.clarity', icon: 'sparkles' },
];

export const QUICK_CHECKIN_PROMPTS = [
    "chat.prompts.focus",
    "chat.prompts.feeling",
    "chat.prompts.reset",
    "chat.prompts.win",
];

export const DAILY_PROMPTS = [
    { text: "chat.daily.great", icon: 'sun' },
    { text: "chat.daily.grateful", icon: 'heart' },
    { text: "chat.daily.challenge", icon: 'mountain' },
    { text: "chat.daily.puttingOff", icon: 'clock' },
    { text: "chat.daily.showUp", icon: 'flame' },
    { text: "chat.daily.futureSelf", icon: 'star' },
    { text: "chat.daily.draining", icon: 'battery' },
    { text: "chat.daily.boundary", icon: 'shield' },
];

// ── Mode Colors (light & dark) ─────────────────────────
export const MODE_COLORS: Record<string, { start: string; end: string }> = {
    decision: { start: '#E8D5B7', end: 'transparent' },
    clarity: { start: '#D5E0F0', end: 'transparent' },
    planning: { start: '#D8E8D5', end: 'transparent' },
    reflection: { start: '#E0D5E8', end: 'transparent' },
    freeform: { start: 'transparent', end: 'transparent' },
};

export const MODE_COLORS_DARK: Record<string, { start: string; end: string }> = {
    decision: { start: '#2A2418', end: 'transparent' },
    clarity: { start: '#18202A', end: 'transparent' },
    planning: { start: '#1A2A18', end: 'transparent' },
    reflection: { start: '#221A2A', end: 'transparent' },
    freeform: { start: 'transparent', end: 'transparent' },
};

// ── Time-based Greetings ───────────────────────────────
export function getTimeGreeting(userName?: string): string {
    const hour = new Date().getHours();
    const name = userName?.trim();
    if (hour < 6) return name ? 'chat.greetings.night' : 'chat.greetings.nightAnon';
    if (hour < 12) return name ? 'chat.greetings.morning' : 'chat.greetings.morningAnon';
    if (hour < 17) return name ? 'chat.greetings.afternoon' : 'chat.greetings.afternoonAnon';
    if (hour < 21) return name ? 'chat.greetings.evening' : 'chat.greetings.eveningAnon';
    return name ? 'chat.greetings.windingDown' : 'chat.greetings.eveningCheckIn';
}

export function getTimeSubtitle(): string {
    const hour = new Date().getHours();
    if (hour < 6) return 'chat.subtitles.night';
    if (hour < 12) return 'chat.subtitles.morning';
    if (hour < 17) return 'chat.subtitles.afternoon';
    if (hour < 21) return 'chat.subtitles.evening';
    return 'chat.subtitles.late';
}

export function getDailyPrompt() {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length];
}

// ── Discovery Questions ────────────────────────────────
export const DISCOVERY_QUESTIONS: AIQuestion[] = [
    {
        id: 'q1',
        question: 'chat.discovery.q1',
        description: 'chat.discovery.q1Desc',
        category: 'preferences',
        options: [
            { id: 'q1-a', text: 'chat.discovery.q1a' },
            { id: 'q1-b', text: 'chat.discovery.q1b' },
            { id: 'q1-c', text: 'chat.discovery.q1c' },
            { id: 'q1-d', text: 'chat.discovery.q1d' },
        ],
    },
    {
        id: 'q2',
        question: 'chat.discovery.q2',
        description: 'chat.discovery.q2Desc',
        category: 'lifestyle',
        options: [
            { id: 'q2-a', text: 'chat.discovery.q2a' },
            { id: 'q2-b', text: 'chat.discovery.q2b' },
            { id: 'q2-c', text: 'chat.discovery.q2c' },
            { id: 'q2-d', text: 'chat.discovery.q2d' },
        ],
    },
    {
        id: 'q3',
        question: 'chat.discovery.q3',
        description: 'chat.discovery.q3Desc',
        category: 'personality',
        options: [
            { id: 'q3-a', text: 'chat.discovery.q3a' },
            { id: 'q3-b', text: 'chat.discovery.q3b' },
            { id: 'q3-c', text: 'chat.discovery.q3c' },
            { id: 'q3-d', text: 'chat.discovery.q3d' },
            { id: 'q3-e', text: 'chat.discovery.q3e' },
        ],
    },
    {
        id: 'q4',
        question: 'chat.discovery.q4',
        description: 'chat.discovery.q4Desc',
        category: 'personality',
        options: [
            { id: 'q4-a', text: 'chat.discovery.q4a' },
            { id: 'q4-b', text: 'chat.discovery.q4b' },
            { id: 'q4-c', text: 'chat.discovery.q4c' },
            { id: 'q4-d', text: 'chat.discovery.q4d' },
        ],
    },
];

// ── Chat Storage ───────────────────────────────────────
export const CHAT_STORAGE_PREFIX = 'mazo_chat_messages_';
