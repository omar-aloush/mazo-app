/**
 * StorageProvider — shared persistence & hydration layer.
 *
 * Reads the full AppState from AsyncStorage once, provides it to
 * domain providers for slicing, and exposes a debounced persist()
 * so each domain can save its own state changes.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState as RNAppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { AppState, UserContext, Memory, SchedulingData } from '@/types';
import { updateWidgetData } from '@/services/widgetData';
import { getCoachById } from '@/constants/coaches';

const STORAGE_KEY = 'coach_app_state';
const SUPABASE_USER_ID_KEY = 'mazo_supabase_user_id';

function createDeviceUserId(): string {
    return `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

// ── Defaults ────────────────────────────────────────────────

export const defaultUserContext: UserContext = {
    name: '',
    age: '',
    values: '',
    beliefs: '',
    currentProjects: '',
    currentFocus: '',
    constraints: '',
    workStyle: '',
    energyLevel: '',
    lastUpdated: Date.now(),
};

export const defaultMemory: Memory = {
    goals: [],
    tasks: [],
    habits: [],
    ideas: [],
    problems: [],
    constraints: [],
    preferences: [],
    focusSessions: [],
    alarms: [],
    schedules: [],
    scheduleItems: [],
    currentDayIndex: 0,
    lastExtractedAt: 0,
    mindInsights: [],
};

export const defaultSchedulingData: SchedulingData = {
    isComplete: false,
};

export const defaultAppState: AppState = {
    selectedCoachId: null,
    userContext: defaultUserContext,
    sessions: {},
    memory: defaultMemory,
    freeMessagesUsed: 0,
    freeSessionsToday: 0,
    lastSessionDate: new Date().toDateString(),
    onboardingComplete: false,
    preferredTone: 'balanced',
    detectedIntents: [],
    schedulingData: defaultSchedulingData,
    pendingSchedule: null,
    questionsSession: null,
    showQuestionsPrompt: false,
    hasSeenSystemReady: false,
    showSystemReadyScreen: false,
    customCoaches: [],
    showCelebration: false,
    celebrationTaskTitle: null,
    communityCoaches: [],
    coachRatings: {},
    trialStartedAt: null,
    trialEndsAt: null,
    trialExpired: false,
    streak: {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: '',
        totalSessions: 0,
    },
    referralCode: null,
    smartPaywallTriggers: {},
    sessionDates: [],
    pendingShareMoment: null,
    chatHistory: [],
};

// ── Context Shape ───────────────────────────────────────────

interface StorageContextValue {
    /** Full state — used by domain providers to slice from on mount */
    state: AppState;
    /** Whether initial hydration from AsyncStorage is complete */
    isLoaded: boolean;
    /**
     * Update the persisted state. Accepts a partial AppState.
     * Debounced internally to batch rapid writes.
     */
    updateState: (updates: Partial<AppState>) => void;
    /**
     * Update using a setter function (for state transitions that depend on prev).
     * The setter must return the FULL new state.
     */
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    /** Persist a given full state (debounced 100ms) */
    persistState: (newState: AppState) => void;
    /** Persist a given full state IMMEDIATELY — use for critical data like goals, tasks */
    persistStateImmediate: (newState: AppState) => void;
    /** Shared user context methods */
    updateUserContext: (context: Partial<UserContext>) => void;
    /** Onboarding */
    completeOnboarding: (preferredTone: 'direct' | 'supportive' | 'balanced') => void;
    /** Nuclear reset */
    resetApp: () => Promise<boolean>;
    /** Get stable user ID */
    getUserId: () => string;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function useStorage(): StorageContextValue {
    const ctx = useContext(StorageContext);
    if (!ctx) throw new Error('useStorage must be used within StorageProvider');
    return ctx;
}

// ── Provider ────────────────────────────────────────────────

export function StorageProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient();
    const [state, setState] = useState<AppState>(defaultAppState);
    const [isLoaded, setIsLoaded] = useState(false);
    const hydratedRef = useRef(false);

    // ── Hydration ─────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                let hydratedState: AppState = {
                    ...defaultAppState,
                    userContext: { ...defaultUserContext },
                    memory: { ...defaultMemory },
                };

                if (stored) {
                    const parsed = JSON.parse(stored) as AppState;
                    hydratedState = {
                        ...defaultAppState,
                        ...parsed,
                        memory: { ...defaultMemory, ...(parsed.memory || {}) },
                        userContext: { ...defaultUserContext, ...(parsed.userContext || {}) },
                    };
                }

                const deviceUserId = hydratedState.deviceUserId || createDeviceUserId();
                if (!hydratedState.deviceUserId) {
                    hydratedState = { ...hydratedState, deviceUserId };
                    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hydratedState));
                }

                setState(hydratedState);
                await AsyncStorage.setItem(SUPABASE_USER_ID_KEY, deviceUserId);
            } catch (err) {
                console.warn('[StorageProvider] Hydration error:', err);
            }
            hydratedRef.current = true;
            setIsLoaded(true);
        })();
    }, []);

    // ── Persistence Layer (bulletproof) ───────────────────
    const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingStateRef = useRef<AppState | null>(null);

    // Flush pending state to storage immediately (sync call, async write)
    const flushToStorage = useCallback(async () => {
        if (persistTimerRef.current) {
            clearTimeout(persistTimerRef.current);
            persistTimerRef.current = null;
        }
        const stateToSave = pendingStateRef.current;
        if (stateToSave) {
            try {
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
            } catch (err) {
                console.warn('[StorageProvider] Flush error:', err);
            }
            pendingStateRef.current = null;
        }
    }, []);

    // Standard debounced persist (100ms instead of 300ms for faster saves)
    const persistState = useCallback((newState: AppState) => {
        // Guard: never persist before hydration completes
        if (!hydratedRef.current) return;
        pendingStateRef.current = newState;
        if (persistTimerRef.current) {
            clearTimeout(persistTimerRef.current);
        }
        persistTimerRef.current = setTimeout(async () => {
            const stateToSave = pendingStateRef.current;
            if (stateToSave) {
                try {
                    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
                } catch (err) {
                    console.warn('[StorageProvider] Persist error:', err);
                }
                pendingStateRef.current = null;
            }
        }, 100);
    }, []);

    // ── Flush on app background / unmount ─────────────────
    useEffect(() => {
        const handleAppState = (nextState: string) => {
            if (nextState === 'background' || nextState === 'inactive') {
                // Immediately save any pending state before the OS suspends us
                flushToStorage();
            }
        };
        const sub = RNAppState.addEventListener('change', handleAppState);
        return () => {
            sub.remove();
            // Also flush on unmount (hot reload / dev restart)
            if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
            if (pendingStateRef.current) {
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pendingStateRef.current)).catch(() => { });
            }
        };
    }, [flushToStorage]);

    // ── Generate persistent device ID on first launch ─────
    useEffect(() => {
        if (!isLoaded || state.deviceUserId) return;
        // Generate a random UUID-like device ID
        const id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
        setState((prev) => {
            if (prev.deviceUserId) return prev; // race guard
            const newState = { ...prev, deviceUserId: id };
            persistState(newState);
            return newState;
        });
        // Also store for SubscriptionProvider to use for Supabase sync
        AsyncStorage.setItem(SUPABASE_USER_ID_KEY, id).catch(() => {});
    }, [isLoaded, state.deviceUserId, setState, persistState]);

    // ── Ensure Supabase user ID key stays in sync ─────
    useEffect(() => {
        if (!isLoaded || !state.deviceUserId) return;
        AsyncStorage.setItem(SUPABASE_USER_ID_KEY, state.deviceUserId).catch(() => {});
    }, [isLoaded, state.deviceUserId]);

    // ── Native Widget Sync ────────────────────────────────
    useEffect(() => {
        if (!isLoaded) return;
        const coach = state.selectedCoachId ? getCoachById(state.selectedCoachId) : null;
        const pendingTasks = state.memory.tasks?.filter((t: any) => t.status === 'pending') || [];
        const longTermGoals = state.memory.goals?.filter((g: any) => g.type === 'long-term' && g.status === 'active') || [];
        const activeGoals = state.memory.goals?.filter((g: any) => g.status === 'active') || [];
        const energy = Math.min(((activeGoals.length * 5) + (pendingTasks.length > 0 ? 20 : 0) + (state.streak.currentStreak * 3)), 100);

        updateWidgetData({
            energy,
            userName: state.userContext.name,
            streakCount: state.streak.currentStreak || 0,
            coachName: coach?.name || '',
            coachColor: coach?.tone === 'calm' ? '#7C9A82' : coach?.tone === 'direct' ? '#6366F1' : coach?.tone === 'warm' ? '#F59E0B' : '',
            topTask: pendingTasks[0]?.title || '',
            northStarGoal: longTermGoals[0]?.title || '',
        }).catch(() => { });
    }, [isLoaded, state.memory, state.streak.currentStreak, state.userContext.name, state.selectedCoachId]);

    // ── Widget refresh on app foreground ──
    useEffect(() => {
        if (!isLoaded) return;
        const handleAppState = (nextState: string) => {
            if (nextState === 'active') {
                const coach = state.selectedCoachId ? getCoachById(state.selectedCoachId) : null;
                const pendingTasks = state.memory.tasks?.filter((t: any) => t.status === 'pending') || [];
                const longTermGoals = state.memory.goals?.filter((g: any) => g.type === 'long-term' && g.status === 'active') || [];
                const activeGoals = state.memory.goals?.filter((g: any) => g.status === 'active') || [];
                const energy = Math.min(((activeGoals.length * 5) + (pendingTasks.length > 0 ? 20 : 0) + (state.streak.currentStreak * 3)), 100);

                updateWidgetData({
                    energy,
                    userName: state.userContext.name,
                    streakCount: state.streak.currentStreak || 0,
                    coachName: coach?.name || '',
                    coachColor: coach?.tone === 'calm' ? '#7C9A82' : coach?.tone === 'direct' ? '#6366F1' : coach?.tone === 'warm' ? '#F59E0B' : '',
                    topTask: pendingTasks[0]?.title || '',
                    northStarGoal: longTermGoals[0]?.title || '',
                }).catch(() => { });
            }
        };
        const sub = RNAppState.addEventListener('change', handleAppState);
        return () => sub.remove();
    }, [isLoaded, state.memory, state.streak.currentStreak, state.userContext.name, state.selectedCoachId]);

    // ── Shared Updaters ───────────────────────────────────

    const updateState = useCallback((updates: Partial<AppState>) => {
        setState((prev) => {
            const newState = { ...prev, ...updates };
            persistState(newState);
            return newState;
        });
    }, [persistState]);

    const updateUserContext = useCallback((context: Partial<UserContext>) => {
        setState((prev) => {
            const newContext = {
                ...prev.userContext,
                ...context,
                lastUpdated: Date.now(),
            };
            const newState = { ...prev, userContext: newContext };
            persistState(newState);
            return newState;
        });
    }, [persistState]);

    const completeOnboarding = useCallback((preferredTone: 'direct' | 'supportive' | 'balanced') => {
        updateState({ onboardingComplete: true, preferredTone });
    }, [updateState]);

    const resetApp = useCallback(async () => {
        try {
            pendingStateRef.current = null;
            if (persistTimerRef.current) {
                clearTimeout(persistTimerRef.current);
                persistTimerRef.current = null;
            }
            await AsyncStorage.removeItem(STORAGE_KEY);
            const allKeys = await AsyncStorage.getAllKeys();
            const chatKeys = allKeys.filter(k =>
                k.startsWith('mazo_chat_messages_') || k.startsWith('chat_messages_')
            );
            if (chatKeys.length > 0) {
                await AsyncStorage.multiRemove(chatKeys);
            }
            const freshState: AppState = {
                ...defaultAppState,
                lastSessionDate: new Date().toDateString(),
            };
            setState(freshState);
            queryClient.clear();
            return true;
        } catch (error) {
            console.error('Failed to reset app:', error);
            return false;
        }
    }, [queryClient]);

    const getUserId = useCallback((): string => {
        // Use auth ID if linked, otherwise persisted device ID
        const id = state.authUserId || state.deviceUserId || '';
        if (id) {
            AsyncStorage.setItem(SUPABASE_USER_ID_KEY, id).catch(() => { });
        }
        return id;
    }, [state.authUserId, state.deviceUserId]);

    // ── Memoized Value ────────────────────────────────────

    // Immediate persist — bypasses debounce, writes to AsyncStorage right away
    const persistStateImmediate = useCallback((newState: AppState) => {
        if (!hydratedRef.current) return;
        pendingStateRef.current = null;
        if (persistTimerRef.current) {
            clearTimeout(persistTimerRef.current);
            persistTimerRef.current = null;
        }
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState)).catch((err) => {
            console.warn('[StorageProvider] Immediate persist error:', err);
        });
    }, []);

    const value = useMemo<StorageContextValue>(() => ({
        state,
        isLoaded,
        updateState,
        setState,
        persistState,
        persistStateImmediate,
        updateUserContext,
        completeOnboarding,
        resetApp,
        getUserId,
    }), [state, isLoaded, updateState, setState, persistState, persistStateImmediate, updateUserContext, completeOnboarding, resetApp, getUserId]);

    return (
        <StorageContext.Provider value={value}>
            {children}
        </StorageContext.Provider>
    );
}
