/**
 * CoachProvider — owns custom coaches, community coaches, ratings,
 * questions session, and import/export.
 * Extracted from AppProvider lines 883-1190.
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { CustomCoach, QuestionsSession, AIQuestion, Preference } from '@/types';
import { CommunityCoach, FEATURED_COACHES, generateShareCode } from '@/constants/community-coaches';
import * as communityService from '@/services/community';
import { useStorage } from './StorageProvider';

// ── Context Shape ───────────────────────────────────────────

interface CoachContextValue {
    customCoaches: CustomCoach[];
    communityCoaches: CommunityCoach[];
    coachRatings: Record<string, number>;
    questionsSession: QuestionsSession | null;
    showQuestionsPrompt: boolean;
    addCustomCoach: (coach: Omit<CustomCoach, 'id' | 'createdAt' | 'updatedAt' | 'isCustom'>) => CustomCoach;
    updateCustomCoach: (coachId: string, updates: Partial<Omit<CustomCoach, 'id' | 'createdAt' | 'isCustom'>>) => void;
    deleteCustomCoach: (coachId: string) => void;
    getCustomCoachById: (coachId: string) => CustomCoach | undefined;
    exportCoach: (coachId: string) => string | null;
    importCoach: (code: string) => CustomCoach | null;
    importCoachByCode: (code: string) => Promise<CustomCoach | null>;
    shareCoachToCommunity: (coachId: string, authorName: string) => Promise<CommunityCoach | null>;
    rateCoach: (coachId: string, rating: number) => Promise<void>;
    getCoachRating: (coachId: string) => number;
    showQuestionsPromptFn: () => void;
    hideQuestionsPrompt: () => void;
    startQuestionsSession: (questions: AIQuestion[]) => void;
    answerQuestion: (questionId: string, optionId: string) => void;
    completeQuestionsSession: () => void;
    cancelQuestionsSession: () => void;
}

const CoachContext = createContext<CoachContextValue | null>(null);

export function useCoach(): CoachContextValue {
    const ctx = useContext(CoachContext);
    if (!ctx) throw new Error('useCoach must be used within CoachProvider');
    return ctx;
}

// ── Provider ────────────────────────────────────────────────

export function CoachProvider({ children }: { children: React.ReactNode }) {
    const { state, setState, persistState, getUserId } = useStorage();

    // ── Custom Coach CRUD ─────────────────────────────────

    const addCustomCoach = useCallback((coach: Omit<CustomCoach, 'id' | 'createdAt' | 'updatedAt' | 'isCustom'>): CustomCoach => {
        const now = Date.now();
        const newCoach: CustomCoach = {
            ...coach,
            id: `custom-coach-${now}-${Math.random().toString(36).substr(2, 9)}`,
            isCustom: true,
            createdAt: now,
            updatedAt: now,
        };
        setState((prev) => {
            const newState = { ...prev, customCoaches: [...prev.customCoaches, newCoach] };
            persistState(newState);
            return newState;
        });
        return newCoach;
    }, [setState, persistState]);

    const updateCustomCoach = useCallback((coachId: string, updates: Partial<Omit<CustomCoach, 'id' | 'createdAt' | 'isCustom'>>) => {
        setState((prev) => {
            const newCoaches = prev.customCoaches.map((c) =>
                c.id === coachId ? { ...c, ...updates, updatedAt: Date.now() } : c
            );
            const newState = { ...prev, customCoaches: newCoaches };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const deleteCustomCoach = useCallback((coachId: string) => {
        setState((prev) => {
            const newCoaches = prev.customCoaches.filter((c) => c.id !== coachId);
            const newSessions = { ...prev.sessions };
            delete newSessions[coachId];
            const newState = {
                ...prev,
                customCoaches: newCoaches,
                sessions: newSessions,
                selectedCoachId: prev.selectedCoachId === coachId ? null : prev.selectedCoachId,
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const getCustomCoachById = useCallback((coachId: string): CustomCoach | undefined => {
        return state.customCoaches.find((c) => c.id === coachId);
    }, [state.customCoaches]);

    // ── Export / Import ───────────────────────────────────

    const exportCoach = useCallback((coachId: string): string | null => {
        const coach = state.customCoaches.find((c) => c.id === coachId);
        if (!coach) return null;
        const exportData: Record<string, any> = {
            name: coach.name,
            role: coach.role,
            description: coach.description,
            tone: coach.tone,
            specialty: coach.specialty,
            systemPrompt: coach.systemPrompt,
            icon: coach.icon,
            color: coach.color,
        };
        if (coach.mazoConfig) exportData.mazoConfig = coach.mazoConfig;
        return btoa(unescape(encodeURIComponent(JSON.stringify(exportData))));
    }, [state.customCoaches]);

    const importCoach = useCallback((code: string): CustomCoach | null => {
        try {
            const data = JSON.parse(decodeURIComponent(escape(atob(code))));
            if (!data.name || !data.systemPrompt) return null;
            const now = Date.now();
            const newCoach: CustomCoach = {
                id: `custom-coach-${now}-${Math.random().toString(36).substr(2, 9)}`,
                name: data.name,
                role: data.role || 'Custom Coach',
                description: data.description || '',
                tone: data.tone || 'balanced',
                specialty: data.specialty || 'General',
                systemPrompt: data.systemPrompt,
                icon: data.icon || '✨',
                color: data.color || '#6366F1',
                isCustom: true,
                createdAt: now,
                updatedAt: now,
                ...(data.mazoConfig ? { mazoConfig: data.mazoConfig } : {}),
            };
            setState((prev) => {
                const newState = { ...prev, customCoaches: [...prev.customCoaches, newCoach] };
                persistState(newState);
                return newState;
            });
            return newCoach;
        } catch (e) {
            console.error('Failed to import coach:', e);
            return null;
        }
    }, [setState, persistState]);

    const importCoachByCode = useCallback(async (code: string): Promise<CustomCoach | null> => {
        const upperCode = code.toUpperCase().trim();
        let found: CommunityCoach | null = FEATURED_COACHES.find(c => c.shareCode === upperCode) || null;
        if (!found) {
            found = await communityService.importCoachByCode(upperCode);
        }
        if (!found) return null;
        if (!FEATURED_COACHES.some(c => c.shareCode === upperCode)) {
            await communityService.incrementDownloads(found.id);
        }
        const now = Date.now();
        const newCoach: CustomCoach = {
            id: `custom-coach-${now}-${Math.random().toString(36).substr(2, 9)}`,
            name: found.name,
            role: found.role,
            description: found.description,
            tone: found.tone as 'calm' | 'direct' | 'warm' | 'wise' | 'reflective',
            specialty: found.specialty,
            systemPrompt: found.systemPrompt,
            icon: found.icon,
            color: found.color,
            isCustom: true,
            createdAt: now,
            updatedAt: now,
        };
        setState((prev) => {
            const newState = { ...prev, customCoaches: [...prev.customCoaches, newCoach] };
            persistState(newState);
            return newState;
        });
        return newCoach;
    }, [setState, persistState]);

    // ── Community ─────────────────────────────────────────

    const shareCoachToCommunity = useCallback(async (coachId: string, authorName: string): Promise<CommunityCoach | null> => {
        const coach = state.customCoaches.find((c) => c.id === coachId);
        if (!coach) return null;
        const shareCode = generateShareCode();
        const userId = getUserId();
        const communityCoach = await communityService.shareCoachToCommunity({
            name: coach.name,
            role: coach.role,
            description: coach.description,
            specialty: coach.specialty,
            tone: coach.tone,
            icon: coach.icon,
            color: coach.color,
            systemPrompt: coach.systemPrompt,
            author: authorName,
            authorId: userId,
            shareCode,
        });
        if (communityCoach) {
            setState((prev) => {
                const newState = { ...prev, communityCoaches: [...prev.communityCoaches, communityCoach] };
                persistState(newState);
                return newState;
            });
        }
        return communityCoach;
    }, [state.customCoaches, setState, persistState, getUserId]);

    const rateCoach = useCallback(async (coachId: string, rating: number) => {
        const userId = getUserId();
        await communityService.rateCoach(coachId, userId, rating);
        setState((prev) => {
            const newState = { ...prev, coachRatings: { ...prev.coachRatings, [coachId]: rating } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState, getUserId]);

    const getCoachRating = useCallback((coachId: string): number => {
        return state.coachRatings[coachId] || 0;
    }, [state.coachRatings]);

    // ── Questions Session ─────────────────────────────────

    const showQuestionsPromptFn = useCallback(() => {
        setState((prev) => ({ ...prev, showQuestionsPrompt: true }));
    }, [setState]);

    const hideQuestionsPrompt = useCallback(() => {
        setState((prev) => ({ ...prev, showQuestionsPrompt: false }));
    }, [setState]);

    const startQuestionsSession = useCallback((questions: AIQuestion[]) => {
        const session: QuestionsSession = {
            questions,
            currentIndex: 0,
            answers: {},
            isActive: true,
        };
        setState((prev) => ({
            ...prev,
            questionsSession: session,
            showQuestionsPrompt: false,
        }));
    }, [setState]);

    const answerQuestion = useCallback((questionId: string, optionId: string) => {
        setState((prev) => {
            if (!prev.questionsSession) return prev;
            const newAnswers = { ...prev.questionsSession.answers, [questionId]: optionId };
            const newIndex = prev.questionsSession.currentIndex + 1;
            const isComplete = newIndex >= prev.questionsSession.questions.length;
            const newSession: QuestionsSession = {
                ...prev.questionsSession,
                answers: newAnswers,
                currentIndex: newIndex,
                isActive: !isComplete,
            };
            return { ...prev, questionsSession: isComplete ? null : newSession };
        });
    }, [setState]);

    const completeQuestionsSession = useCallback(() => {
        setState((prev) => {
            if (!prev.questionsSession) return prev;
            const answers = prev.questionsSession.answers;
            const questions = prev.questionsSession.questions;
            const now = Date.now();

            const newPreferences: Preference[] = Object.entries(answers).map(([qId, optionId], i) => {
                const question = questions.find(q => q.id === qId);
                const option = question?.options.find(o => o.id === optionId);
                return {
                    id: `pref-q-${now}-${i}`,
                    key: question?.question || 'Unknown',
                    value: option?.text || 'Unknown',
                    category: question?.category === 'preferences' ? 'value' : 'other' as Preference['category'],
                    createdAt: now,
                };
            });

            const newState = {
                ...prev,
                questionsSession: null,
                memory: {
                    ...prev.memory,
                    preferences: [...prev.memory.preferences, ...newPreferences],
                },
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const cancelQuestionsSession = useCallback(() => {
        setState((prev) => ({ ...prev, questionsSession: null }));
    }, [setState]);

    // ── Memoized Value ────────────────────────────────────

    const value = useMemo<CoachContextValue>(() => ({
        customCoaches: state.customCoaches,
        communityCoaches: state.communityCoaches,
        coachRatings: state.coachRatings,
        questionsSession: state.questionsSession,
        showQuestionsPrompt: state.showQuestionsPrompt,
        addCustomCoach,
        updateCustomCoach,
        deleteCustomCoach,
        getCustomCoachById,
        exportCoach,
        importCoach,
        importCoachByCode,
        shareCoachToCommunity,
        rateCoach,
        getCoachRating,
        showQuestionsPromptFn,
        hideQuestionsPrompt,
        startQuestionsSession,
        answerQuestion,
        completeQuestionsSession,
        cancelQuestionsSession,
    }), [
        state.customCoaches,
        state.communityCoaches,
        state.coachRatings,
        state.questionsSession,
        state.showQuestionsPrompt,
        addCustomCoach,
        updateCustomCoach,
        deleteCustomCoach,
        getCustomCoachById,
        exportCoach,
        importCoach,
        importCoachByCode,
        shareCoachToCommunity,
        rateCoach,
        getCoachRating,
        showQuestionsPromptFn,
        hideQuestionsPrompt,
        startQuestionsSession,
        answerQuestion,
        completeQuestionsSession,
        cancelQuestionsSession,
    ]);

    return (
        <CoachContext.Provider value={value}>
            {children}
        </CoachContext.Provider>
    );
}
