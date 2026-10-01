/**
 * ChatProvider — owns chat sessions, free message limits, celebrations.
 * Extracted from AppProvider lines 177-346 + 1197-1223.
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { Session, Message, ArchivedChat } from '@/types';
import { FREE_DAILY_SESSION_LIMIT } from '@/constants/coaches';
import { useStorage } from './StorageProvider';

// ── Context Shape ───────────────────────────────────────────

interface ChatContextValue {
    sessions: Record<string, Session>;
    selectedCoachId: string | null;
    showCelebration: boolean;
    celebrationTaskTitle: string | null;
    freeSessionsToday: number;
    lastSessionDate: string;
    selectCoach: (coachId: string) => void;
    addMessage: (coachId: string, message: Message) => void;
    getSession: (coachId: string) => Session | null;
    clearSession: (coachId: string) => void;
    updateSessionPhase: (coachId: string, newPhase: Session['currentPhase']) => void;
    markActionIdentified: (coachId: string) => void;
    lockSession: (coachId: string, taskId: string) => void;
    unlockSession: (coachId: string) => void;
    triggerCelebration: (taskTitle?: string) => void;
    dismissCelebration: () => void;
    hasReachedFreeLimit: boolean;
    remainingFreeMessages: number;
    incrementFreeSession: () => void;
    dailySessionsUsed: number;
    chatHistory: ArchivedChat[];
    archiveSession: (coachId: string, coachName: string) => void;
    deleteArchivedChat: (chatId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error('useChat must be used within ChatProvider');
    return ctx;
}

// ── Provider ────────────────────────────────────────────────

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { state, setState, persistState } = useStorage();

    const selectCoach = useCallback((coachId: string) => {
        setState((prev) => {
            const newState = { ...prev, selectedCoachId: coachId };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const addMessage = useCallback((coachId: string, message: Message) => {
        setState((prev) => {
            const now = Date.now();
            const existingSession = prev.sessions[coachId] || {
                coachId,
                messages: [],
                lastMessageAt: now,
                currentPhase: 'opening' as const,
                phaseHistory: ['opening' as const],
                phaseStartedAt: now,
                actionIdentified: false,
                sessionStartTime: now,
                lastActionBlockAt: null,
                sessionLocked: false,
                pendingActionTaskId: null,
            };

            const newSession: Session = {
                ...existingSession,
                messages: [...existingSession.messages, message],
                lastMessageAt: now,
                currentPhase: existingSession.currentPhase || 'opening',
                phaseHistory: existingSession.phaseHistory || ['opening'],
                phaseStartedAt: existingSession.phaseStartedAt || now,
                actionIdentified: existingSession.actionIdentified || false,
                sessionStartTime: existingSession.sessionStartTime || now,
                lastActionBlockAt: existingSession.lastActionBlockAt || null,
                sessionLocked: existingSession.sessionLocked || false,
                pendingActionTaskId: existingSession.pendingActionTaskId || null,
            };

            const newState = {
                ...prev,
                sessions: { ...prev.sessions, [coachId]: newSession },
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const getSession = useCallback((coachId: string): Session | null => {
        return state.sessions[coachId] || null;
    }, [state.sessions]);

    const clearSession = useCallback((coachId: string) => {
        setState((prev) => {
            const newSessions = { ...prev.sessions };
            delete newSessions[coachId];
            const newState = { ...prev, sessions: newSessions };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const updateSessionPhase = useCallback((coachId: string, newPhase: Session['currentPhase']) => {
        setState((prev) => {
            const existingSession = prev.sessions[coachId];
            if (!existingSession) return prev;

            const newSession: Session = {
                ...existingSession,
                currentPhase: newPhase,
                phaseHistory: [...(existingSession.phaseHistory || []), newPhase],
                phaseStartedAt: Date.now(),
            };

            const newState = {
                ...prev,
                sessions: { ...prev.sessions, [coachId]: newSession },
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const markActionIdentified = useCallback((coachId: string) => {
        setState((prev) => {
            const existingSession = prev.sessions[coachId];
            if (!existingSession) return prev;

            const newSession: Session = {
                ...existingSession,
                actionIdentified: true,
                lastActionBlockAt: Date.now(),
            };

            const newState = {
                ...prev,
                sessions: { ...prev.sessions, [coachId]: newSession },
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const lockSession = useCallback((coachId: string, taskId: string) => {
        setState((prev) => {
            const now = Date.now();
            const existingSession = prev.sessions[coachId] || {
                coachId,
                messages: [],
                lastMessageAt: now,
                currentPhase: 'exit' as const,
                phaseHistory: ['exit' as const],
                phaseStartedAt: now,
                actionIdentified: true,
                sessionStartTime: now,
                lastActionBlockAt: now,
                sessionLocked: false,
                pendingActionTaskId: null,
            };

            const newSession: Session = {
                ...existingSession,
                sessionLocked: true,
                pendingActionTaskId: taskId,
                currentPhase: 'exit',
            };

            const newState = {
                ...prev,
                sessions: { ...prev.sessions, [coachId]: newSession },
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const unlockSession = useCallback((coachId: string) => {
        setState((prev) => {
            const existingSession = prev.sessions[coachId];
            if (!existingSession) return prev;

            const now = Date.now();
            const newSession: Session = {
                ...existingSession,
                sessionLocked: false,
                pendingActionTaskId: null,
                currentPhase: 'opening',
                actionIdentified: false,
                sessionStartTime: now,
                phaseStartedAt: now,
            };

            const newState = {
                ...prev,
                sessions: { ...prev.sessions, [coachId]: newSession },
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const triggerCelebration = useCallback((taskTitle?: string) => {
        setState((prev) => ({
            ...prev,
            showCelebration: true,
            celebrationTaskTitle: taskTitle || null,
        }));
    }, [setState]);

    const dismissCelebration = useCallback(() => {
        setState((prev) => ({
            ...prev,
            showCelebration: false,
            celebrationTaskTitle: null,
        }));
    }, [setState]);

    // Free limit tracking
    const todayStr = useMemo(() => new Date().toDateString(), []);

    const dailySessionsUsed = useMemo(() => {
        return state.lastSessionDate === todayStr ? state.freeSessionsToday : 0;
    }, [state.lastSessionDate, state.freeSessionsToday, todayStr]);

    const hasReachedFreeLimit = useMemo(() => {
        return dailySessionsUsed >= FREE_DAILY_SESSION_LIMIT;
    }, [dailySessionsUsed]);

    const remainingFreeMessages = useMemo(() => {
        return Math.max(0, FREE_DAILY_SESSION_LIMIT - dailySessionsUsed);
    }, [dailySessionsUsed]);

    const incrementFreeSession = useCallback(() => {
        setState((prev) => {
            const today = new Date().toDateString();
            const isNewDay = prev.lastSessionDate !== today;
            const newState = {
                ...prev,
                freeSessionsToday: isNewDay ? 1 : prev.freeSessionsToday + 1,
                lastSessionDate: today,
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const archiveSession = useCallback((coachId: string, coachName: string) => {
        setState((prev) => {
            const session = prev.sessions[coachId];
            if (!session || session.messages.length === 0) return prev;

            // Find associated tasks by looking at pendingActionTaskId
            const taskIds: string[] = [];
            const taskTitles: string[] = [];
            if (session.pendingActionTaskId) {
                taskIds.push(session.pendingActionTaskId);
                const task = prev.memory.tasks.find(t => t.id === session.pendingActionTaskId || t.title === session.pendingActionTaskId);
                if (task) taskTitles.push(task.title);
            }

            // Determine status
            let status: ArchivedChat['status'] = 'open';
            if (session.sessionLocked) {
                const task = prev.memory.tasks.find(t => t.id === session.pendingActionTaskId || t.title === session.pendingActionTaskId);
                status = task?.status === 'completed' ? 'completed' : 'locked';
            }

            // Get last user message for preview
            const userMessages = session.messages.filter(m => m.role === 'user');
            const lastUserMsg = userMessages[userMessages.length - 1];
            const lastMessage = lastUserMsg?.content || session.messages[session.messages.length - 1]?.content || '';

            // Save last 30 messages for viewing archived chats
            const savedMessages = session.messages.slice(-30).map(m => ({
                ...m,
                // Strip system instructions from user messages for clean storage
                content: m.role === 'user'
                    ? (m.content.replace(/\[System Instructions[\s\S]*?\[User says\]:\n/s, '').trim() || m.content)
                    : m.content,
            }));

            const archived: ArchivedChat = {
                id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                coachId,
                coachName,
                lastMessage: lastMessage.slice(0, 100),
                messageCount: session.messages.length,
                taskIds,
                taskTitles,
                status,
                archivedAt: Date.now(),
                sessionStartTime: session.sessionStartTime || Date.now(),
                messages: savedMessages,
            };

            const newHistory = [archived, ...(prev.chatHistory || [])].slice(0, 50);
            const newState = { ...prev, chatHistory: newHistory };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const deleteArchivedChat = useCallback((chatId: string) => {
        setState((prev) => {
            const newHistory = (prev.chatHistory || []).filter(c => c.id !== chatId);
            const newState = { ...prev, chatHistory: newHistory };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    // ── Memoized Value ────────────────────────────────────

    const value = useMemo<ChatContextValue>(() => ({
        sessions: state.sessions,
        selectedCoachId: state.selectedCoachId,
        showCelebration: state.showCelebration,
        celebrationTaskTitle: state.celebrationTaskTitle,
        freeSessionsToday: state.freeSessionsToday,
        lastSessionDate: state.lastSessionDate,
        selectCoach,
        addMessage,
        getSession,
        clearSession,
        updateSessionPhase,
        markActionIdentified,
        lockSession,
        unlockSession,
        triggerCelebration,
        dismissCelebration,
        hasReachedFreeLimit,
        remainingFreeMessages,
        incrementFreeSession,
        dailySessionsUsed,
        chatHistory: state.chatHistory || [],
        archiveSession,
        deleteArchivedChat,
    }), [
        state.sessions,
        state.selectedCoachId,
        state.showCelebration,
        state.celebrationTaskTitle,
        state.freeSessionsToday,
        state.lastSessionDate,
        selectCoach,
        addMessage,
        getSession,
        clearSession,
        updateSessionPhase,
        markActionIdentified,
        lockSession,
        unlockSession,
        triggerCelebration,
        dismissCelebration,
        hasReachedFreeLimit,
        remainingFreeMessages,
        incrementFreeSession,
        dailySessionsUsed,
        state.chatHistory,
        archiveSession,
        deleteArchivedChat,
    ]);

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
}
