/**
 * MemoryProvider — owns memory (goals, tasks, habits, ideas, prefs),
 * intent detection, and plan generation.
 * Extracted from AppProvider lines 348-856.
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import {
    Memory, Goal, Task, Habit, Idea, Problem, Preference,
    SchedulingData, IntentAction, AIActionResult, Alarm, MindInsight,
} from '@/types';
import { extractMemoryFromConversation, generateDailyPlan, generateWeeklyDirection } from '@/services/memory';
import { detectIntentFromMessage } from '@/services/intent';
import { scheduleHabitReminder, scheduleTaskReminder, cancelTaskReminder, scheduleMorningTaskSummary, scheduleGoalReminder } from '@/services/notifications';
import { scheduleAlarm, cancelAlarm } from '@/services/alarms';
import { useStorage, defaultSchedulingData } from './StorageProvider';

// ── Context Shape ───────────────────────────────────────────

interface MemoryContextValue {
    memory: Memory;
    mindInsights: MindInsight[];
    detectedIntents: IntentAction[];
    extractMemory: (conversationText: string) => void;
    proposeInsight: (d: { text: string; face: MindInsight['face']; confidence: number; sourceSessionId?: string }) => MindInsight;
    confirmInsight: (id: string) => void;
    correctInsight: (id: string, newText: string) => void;
    dismissInsight: (id: string) => void;
    updateMemory: (updates: Partial<Memory>) => void;
    updateGoal: (goalId: string, updates: Partial<Goal>) => void;
    updateTask: (taskId: string, updates: Partial<Task>) => void;
    addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => AIActionResult;
    addTask: (task: Omit<Task, 'id' | 'createdAt'>) => AIActionResult;
    addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => AIActionResult;
    addIdea: (idea: Omit<Idea, 'id' | 'createdAt'>) => AIActionResult;
    addProblem: (problem: Omit<Problem, 'id' | 'createdAt'>) => AIActionResult;
    addPreference: (pref: Omit<Preference, 'id' | 'createdAt'>) => AIActionResult;
    addFocusSession: (session: Omit<import('@/types').FocusSession, 'id' | 'completedAt'>) => void;
    addAlarm: (alarm: Omit<Alarm, 'id' | 'createdAt' | 'notificationId'>) => Promise<AIActionResult>;
    updateAlarm: (alarmId: string, updates: Partial<Alarm>) => Promise<void>;
    deleteAlarm: (alarmId: string) => Promise<void>;
    updatePreference: (prefId: string, updates: Partial<Preference>) => void;
    deletePreference: (prefId: string) => void;
    deleteGoal: (goalId: string) => void;
    deleteTask: (taskId: string) => void;
    deleteIdea: (ideaId: string) => void;
    completeTaskByTitle: (title: string) => AIActionResult;
    clearIntent: (intentId: string) => void;
    detectIntent: (params: { message: string; context: string }) => void;
    isDetectingIntent: boolean;
    generateDailyPlan: (availableTime?: string) => void;
    generateWeeklyDirection: (arg?: any) => void;
    isGeneratingPlan: boolean;
    isGeneratingWeekly: boolean;
}

const MemoryContext = createContext<MemoryContextValue | null>(null);

export function useMemory(): MemoryContextValue {
    const ctx = useContext(MemoryContext);
    if (!ctx) throw new Error('useMemory must be used within MemoryProvider');
    return ctx;
}

// ── Provider ────────────────────────────────────────────────

export function MemoryProvider({ children }: { children: React.ReactNode }) {
    const { state, setState, persistState, persistStateImmediate } = useStorage();

    // ── Extract Memory Mutation ───────────────────────────
    const extractMemoryMutation = useMutation({
        mutationFn: async (conversationText: string) => {
            return extractMemoryFromConversation(conversationText, state.memory);
        },
        onSuccess: (extracted) => {
            setState((prev) => {
                // Deduplication helper: check if a similar item already exists
                const isDuplicateTitle = (existing: { title?: string }[], newTitle?: string) => {
                    if (!newTitle || typeof newTitle !== 'string') return false;
                    const nt = newTitle.trim().toLowerCase();
                    if (!nt) return false;
                    return (existing || []).some(e => {
                        if (!e || !e.title || typeof e.title !== 'string') return false;
                        const et = e.title.trim().toLowerCase();
                        return et === nt || et.includes(nt) || nt.includes(et);
                    });
                };
                const isDuplicateContent = (existing: { content?: string; description?: string; value?: string }[], newText?: string) => {
                    if (!newText || typeof newText !== 'string') return false;
                    const nt = newText.trim().toLowerCase();
                    if (!nt) return false;
                    return (existing || []).some(e => {
                        if (!e) return false;
                        const text = e.content || e.description || e.value;
                        if (!text || typeof text !== 'string') return false;
                        const et = text.trim().toLowerCase();
                        return et === nt || et.includes(nt) || nt.includes(et);
                    });
                };

                const uniqueGoals = (extracted.goals || []).filter(g => !isDuplicateTitle(prev.memory.goals, g.title));
                const uniqueTasks = (extracted.tasks || []).filter(t => !isDuplicateTitle(prev.memory.tasks, t.title));
                const uniqueHabits = (extracted.habits || []).filter(h => !isDuplicateTitle(prev.memory.habits, h.title));
                const uniqueIdeas = (extracted.ideas || []).filter(i => !isDuplicateContent(prev.memory.ideas, i.content));
                const uniqueProblems = (extracted.problems || []).filter(p => !isDuplicateContent(prev.memory.problems, p.description));
                const uniqueConstraints = (extracted.constraints || []).filter(c => !isDuplicateContent(prev.memory.constraints, c.description));

                const newMemory: Memory = {
                    ...prev.memory,
                    goals: [...prev.memory.goals, ...uniqueGoals],
                    tasks: [...prev.memory.tasks, ...uniqueTasks],
                    habits: [...prev.memory.habits, ...uniqueHabits],
                    ideas: [...prev.memory.ideas, ...uniqueIdeas],
                    problems: [...prev.memory.problems, ...uniqueProblems],
                    constraints: [...prev.memory.constraints, ...uniqueConstraints],
                    lastExtractedAt: extracted.lastExtractedAt || Date.now(),
                };
                const newState = { ...prev, memory: newMemory };
                persistStateImmediate(newState); // Critical: save immediately
                return newState;
            });
        },
    });

    // ── The Mind: insight lifecycle ───────────────────────

    const proposeInsight = useCallback((d: { text: string; face: MindInsight['face']; confidence: number; sourceSessionId?: string }): MindInsight => {
        const now = Date.now();
        const insight: MindInsight = {
            id: `mind-${now}-${Math.random().toString(36).substr(2, 9)}`,
            text: d.text, face: d.face, status: 'proposed',
            confidence: d.confidence, sourceSessionId: d.sourceSessionId,
            learnedAt: now, timesUsed: 0,
        };
        setState((prev) => {
            const list = prev.memory.mindInsights ?? [];
            const newState = { ...prev, memory: { ...prev.memory, mindInsights: [...list, insight] } };
            persistStateImmediate(newState);
            return newState;
        });
        return insight;
    }, [setState, persistStateImmediate]);

    const confirmInsight = useCallback((id: string) => {
        setState((prev) => {
            const list = (prev.memory.mindInsights ?? []).map(i => i.id === id ? { ...i, status: 'confirmed' as const, confirmedAt: Date.now() } : i);
            const newState = { ...prev, memory: { ...prev.memory, mindInsights: list } };
            persistStateImmediate(newState);
            return newState;
        });
    }, [setState, persistStateImmediate]);

    const correctInsight = useCallback((id: string, newText: string) => {
        setState((prev) => {
            const list = (prev.memory.mindInsights ?? []).map(i => i.id === id ? { ...i, text: newText, status: 'corrected' as const, confirmedAt: Date.now() } : i);
            const newState = { ...prev, memory: { ...prev.memory, mindInsights: list } };
            persistStateImmediate(newState);
            return newState;
        });
    }, [setState, persistStateImmediate]);

    const dismissInsight = useCallback((id: string) => {
        setState((prev) => {
            const list = (prev.memory.mindInsights ?? []).map(i => i.id === id ? { ...i, status: 'dismissed' as const } : i);
            const newState = { ...prev, memory: { ...prev.memory, mindInsights: list } };
            persistStateImmediate(newState);
            return newState;
        });
    }, [setState, persistStateImmediate]);

    // ── CRUD Operations ───────────────────────────────────

    const updateMemory = useCallback((updates: Partial<Memory>) => {
        setState((prev) => {
            const newMemory = { ...prev.memory, ...updates };
            const newState = { ...prev, memory: newMemory };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const updateGoal = useCallback((goalId: string, updates: Partial<Goal>) => {
        setState((prev) => {
            const newGoals = prev.memory.goals.map((g) =>
                g.id === goalId ? { ...g, ...updates, updatedAt: Date.now() } : g
            );
            const newState = { ...prev, memory: { ...prev.memory, goals: newGoals } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
        setState((prev) => {
            const newTasks = prev.memory.tasks.map((t) =>
                t.id === taskId ? { ...t, ...updates } : t
            );
            const newState = { ...prev, memory: { ...prev.memory, tasks: newTasks } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const addGoal = useCallback((goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): AIActionResult => {
        const now = Date.now();
        const newGoal: Goal = {
            ...goal,
            id: `goal-${now}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: now,
            updatedAt: now,
        };
        setState((prev) => {
            const newState = { ...prev, memory: { ...prev.memory, goals: [...prev.memory.goals, newGoal] } };
            persistStateImmediate(newState); // Critical: save immediately
            // Schedule daily goal reminder for long-term goals
            if (newGoal.type === 'long-term') {
                scheduleGoalReminder(newGoal.title).catch(() => {});
            }
            return newState;
        });
        return { success: true, message: `Goal "${newGoal.title}" added successfully`, data: { id: newGoal.id } };
    }, [setState, persistStateImmediate]);

    const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt'>): AIActionResult => {
        const now = Date.now();
        const newTask: Task = {
            ...task,
            id: `task-${now}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: now,
        };
        setState((prev) => {
            const newState = { ...prev, memory: { ...prev.memory, tasks: [...prev.memory.tasks, newTask] } };
            persistStateImmediate(newState); // Critical: save immediately
            // Schedule task notification (2h nudge)
            scheduleTaskReminder(newTask.id, newTask.title).catch(() => {});
            // Update morning summary with new pending count
            const pendingCount = newState.memory.tasks.filter(t => t.status !== 'completed').length;
            scheduleMorningTaskSummary(pendingCount).catch(() => {});
            return newState;
        });
        return { success: true, message: `Task "${newTask.title}" added successfully`, data: { id: newTask.id } };
    }, [setState, persistStateImmediate]);

    const addHabit = useCallback((habit: Omit<Habit, 'id' | 'createdAt'>): AIActionResult => {
        const now = Date.now();
        const newHabit: Habit = {
            ...habit,
            id: `habit-${now}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: now,
        };
        setState((prev) => {
            const newState = { ...prev, memory: { ...prev.memory, habits: [...prev.memory.habits, newHabit] } };
            persistState(newState);
            return newState;
        });
        scheduleHabitReminder(newHabit.id, newHabit.title, newHabit.frequency).catch(() => { });
        return { success: true, message: `Habit "${newHabit.title}" added successfully`, data: { id: newHabit.id } };
    }, [setState, persistState]);

    const addIdea = useCallback((idea: Omit<Idea, 'id' | 'createdAt'>): AIActionResult => {
        const now = Date.now();
        const newIdea: Idea = {
            ...idea,
            id: `idea-${now}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: now,
        };
        setState((prev) => {
            const newState = { ...prev, memory: { ...prev.memory, ideas: [...prev.memory.ideas, newIdea] } };
            persistState(newState);
            return newState;
        });
        return { success: true, message: `Idea saved successfully`, data: { id: newIdea.id } };
    }, [setState, persistState]);

    const addProblem = useCallback((problem: Omit<Problem, 'id' | 'createdAt'>): AIActionResult => {
        const now = Date.now();
        const newProblem: Problem = {
            ...problem,
            id: `problem-${now}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: now,
        };
        setState((prev) => {
            const newState = { ...prev, memory: { ...prev.memory, problems: [...prev.memory.problems, newProblem] } };
            persistStateImmediate(newState); // Critical: save immediately
            return newState;
        });
        return { success: true, message: `Challenge tracked successfully`, data: { id: newProblem.id } };
    }, [setState, persistStateImmediate]);

    const addPreference = useCallback((pref: Omit<Preference, 'id' | 'createdAt'>): AIActionResult => {
        const now = Date.now();
        const newPreference: Preference = {
            ...pref,
            id: `pref-${now}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: now,
        };
        setState((prev) => {
            const existingKeys = prev.memory.preferences.map(p => p.value.toLowerCase());
            if (existingKeys.includes(newPreference.value.toLowerCase())) return prev;
            const newState = { ...prev, memory: { ...prev.memory, preferences: [...prev.memory.preferences, newPreference] } };
            persistState(newState);
            return newState;
        });
        return { success: true, message: `Preference saved to memory`, data: { id: newPreference.id } };
    }, [setState, persistState]);

    const addFocusSession = useCallback((session: Omit<import('@/types').FocusSession, 'id' | 'completedAt'>) => {
        const now = Date.now();
        const newSession: import('@/types').FocusSession = {
            ...session,
            id: `focus-${now}-${Math.random().toString(36).substr(2, 9)}`,
            completedAt: now,
        };
        setState((prev) => {
            const newState = { ...prev, memory: { ...prev.memory, focusSessions: [...(prev.memory.focusSessions || []), newSession] } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const addAlarm = useCallback(async (alarm: Omit<Alarm, 'id' | 'createdAt' | 'notificationId'>): Promise<AIActionResult> => {
        const now = Date.now();
        const newAlarm: Alarm = {
            ...alarm,
            id: `alarm-${now}-${Math.random().toString(36).substr(2, 9)}`,
            notificationId: null,
            createdAt: now,
        };
        // Schedule the notification
        const notifId = await scheduleAlarm(newAlarm);
        newAlarm.notificationId = notifId;
        if (!notifId && Platform.OS !== 'web') newAlarm.enabled = false;
        setState((prev) => {
            const alarms = [...(prev.memory.alarms || []), newAlarm];
            const newState = { ...prev, memory: { ...prev.memory, alarms } };
            persistState(newState);
            return newState;
        });
        const time = `${alarm.hour}:${String(alarm.minute).padStart(2, '0')}`;
        if (!notifId) {
            return { success: false, message: `Alarm saved for ${time}, but notifications are not enabled. Turn them on to make it ring.` };
        }
        if (Platform.OS === 'web') {
            return { success: true, message: `Alarm saved for ${time}. Keep this browser tab open for the web alert.` };
        }
        return { success: true, message: `Alarm set for ${time} — "${alarm.label}"` };
    }, [setState, persistState]);

    const updateAlarm = useCallback(async (alarmId: string, updates: Partial<Alarm>) => {
        let targetAlarm: Alarm | undefined;
        setState((prev) => {
            const alarms = (prev.memory.alarms || []).map((a) => {
                if (a.id === alarmId) {
                    targetAlarm = { ...a, ...updates };
                    return targetAlarm;
                }
                return a;
            });
            const newState = { ...prev, memory: { ...prev.memory, alarms } };
            persistState(newState);
            return newState;
        });
        // Reschedule or cancel based on enabled state
        if (targetAlarm) {
            if (targetAlarm.notificationId) {
                await cancelAlarm(targetAlarm.notificationId);
            }
            if (targetAlarm.enabled) {
                const newNotifId = await scheduleAlarm(targetAlarm);
                // Update the notificationId in state
                setState((prev) => {
                    const alarms = (prev.memory.alarms || []).map((a) =>
                        a.id === alarmId ? { ...a, notificationId: newNotifId } : a
                    );
                    const newState = { ...prev, memory: { ...prev.memory, alarms } };
                    persistState(newState);
                    return newState;
                });
            }
        }
    }, [setState, persistState]);

    const deleteAlarm = useCallback(async (alarmId: string) => {
        let notifId: string | null = null;
        setState((prev) => {
            const target = (prev.memory.alarms || []).find(a => a.id === alarmId);
            if (target?.notificationId) notifId = target.notificationId;
            const alarms = (prev.memory.alarms || []).filter(a => a.id !== alarmId);
            const newState = { ...prev, memory: { ...prev.memory, alarms } };
            persistState(newState);
            return newState;
        });
        if (notifId) await cancelAlarm(notifId);
    }, [setState, persistState]);

    const updatePreference = useCallback((prefId: string, updates: Partial<Preference>) => {
        setState((prev) => {
            const newPreferences = prev.memory.preferences.map((p) => p.id === prefId ? { ...p, ...updates } : p);
            const newState = { ...prev, memory: { ...prev.memory, preferences: newPreferences } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const deletePreference = useCallback((prefId: string) => {
        setState((prev) => {
            const newPreferences = prev.memory.preferences.filter((p) => p.id !== prefId);
            const newState = { ...prev, memory: { ...prev.memory, preferences: newPreferences } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const deleteGoal = useCallback((goalId: string) => {
        setState((prev) => {
            const newGoals = prev.memory.goals.filter((g) => g.id !== goalId);
            const newState = { ...prev, memory: { ...prev.memory, goals: newGoals } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const deleteTask = useCallback((taskId: string) => {
        setState((prev) => {
            const newTasks = prev.memory.tasks.filter((t) => t.id !== taskId);
            const newState = { ...prev, memory: { ...prev.memory, tasks: newTasks } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const deleteIdea = useCallback((ideaId: string) => {
        setState((prev) => {
            const ideas = prev.memory.ideas.filter((idea) => idea.id !== ideaId);
            if (ideas.length === prev.memory.ideas.length) return prev;
            const newState = { ...prev, memory: { ...prev.memory, ideas } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const completeTaskByTitle = useCallback((title: string): AIActionResult => {
        let found = false;
        let completedTaskId: string | null = null;
        setState((prev) => {
            const newTasks = prev.memory.tasks.map((t) => {
                const targetTitle = (title || '').toLowerCase();
                if ((t.title || '').toLowerCase().includes(targetTitle) && t.status !== 'completed') {
                    found = true;
                    completedTaskId = t.id;
                    return { ...t, status: 'completed' as const };
                }
                return t;
            });
            if (!found) return prev;
            const newState = { ...prev, memory: { ...prev.memory, tasks: newTasks } };
            persistState(newState);
            // Cancel task notification when completed
            if (completedTaskId) {
                cancelTaskReminder(completedTaskId).catch(() => {});
            }
            // Update morning summary
            const pendingCount = newState.memory.tasks.filter(t => t.status !== 'completed').length;
            scheduleMorningTaskSummary(pendingCount).catch(() => {});
            return newState;
        });
        return found
            ? { success: true, message: `Task "${title}" marked as completed` }
            : { success: false, message: `Task "${title}" not found` };
    }, [setState, persistState]);

    // ── Intent Detection ──────────────────────────────────

    const clearIntent = useCallback((intentId: string) => {
        setState((prev) => {
            const newState = { ...prev, detectedIntents: prev.detectedIntents.filter(i => i.id !== intentId) };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const detectIntentMutation = useMutation({
        mutationFn: async ({ message, context }: { message: string; context: string }) => {
            return detectIntentFromMessage(message, context);
        },
        onSuccess: (result) => {
            if (result.extractedPreferences.length > 0) {
                const now = Date.now();
                const newPreferences: Preference[] = result.extractedPreferences.map((p, i) => ({
                    id: `pref-${now}-${i}`,
                    key: p.key,
                    value: p.value,
                    category: p.category as Preference['category'],
                    createdAt: now,
                }));

                setState((prev) => {
                    const existingKeys = prev.memory.preferences.map(p => p.value.toLowerCase());
                    const uniquePrefs = newPreferences.filter(p => !existingKeys.includes(p.value.toLowerCase()));
                    if (uniquePrefs.length === 0) return prev;
                    const newState = { ...prev, memory: { ...prev.memory, preferences: [...prev.memory.preferences, ...uniquePrefs] } };
                    persistState(newState);
                    return newState;
                });
            }

            if (result.action) {
                setState((prev) => {
                    const existingIds = prev.detectedIntents.map(i => i.type);
                    if (existingIds.includes(result.action!.type)) return prev;
                    const newState = { ...prev, detectedIntents: [...prev.detectedIntents.slice(-4), result.action!] };
                    persistState(newState);
                    return newState;
                });
            }

            if (result.schedulingInfo && Object.keys(result.schedulingInfo).length > 0) {
                setState((prev) => {
                    const newSchedulingData: SchedulingData = {
                        ...prev.schedulingData,
                        availableTime: result.schedulingInfo.availableTime || prev.schedulingData.availableTime,
                        activities: result.schedulingInfo.activities || prev.schedulingData.activities,
                        constraints: result.schedulingInfo.constraints || prev.schedulingData.constraints,
                        isComplete: !!(result.schedulingInfo.availableTime && result.schedulingInfo.activities?.length),
                    };
                    const newState = { ...prev, schedulingData: newSchedulingData };
                    persistState(newState);
                    return newState;
                });
            }
        },
    });

    // ── Plan Generation ───────────────────────────────────

    const generatePlanMutation = useMutation({
        mutationFn: async (availableTime?: string) => {
            return generateDailyPlan(state.memory, availableTime, {
                name: state.userContext.name,
                values: state.userContext.values,
                currentFocus: state.userContext.currentFocus,
                constraints: state.userContext.constraints,
            });
        },
        onSuccess: (plan) => {
            if (plan) updateMemory({ dailyPlan: plan });
        },
    });

    const generateWeeklyMutation = useMutation({
        mutationFn: async (_arg?: any) => {
            return generateWeeklyDirection(state.memory, {
                name: state.userContext.name,
                values: state.userContext.values,
                currentFocus: state.userContext.currentFocus,
                constraints: state.userContext.constraints,
            });
        },
        onSuccess: (direction) => {
            if (direction) updateMemory({ weeklyDirection: direction });
        },
    });

    // ── Memoized Value ────────────────────────────────────

    const value = useMemo<MemoryContextValue>(() => ({
        memory: state.memory,
        mindInsights: state.memory.mindInsights ?? [],
        detectedIntents: state.detectedIntents,
        extractMemory: extractMemoryMutation.mutate,
        proposeInsight,
        confirmInsight,
        correctInsight,
        dismissInsight,
        updateMemory,
        updateGoal,
        updateTask,
        addGoal,
        addTask,
        addHabit,
        addIdea,
        addProblem,
        addPreference,
        addFocusSession,
        addAlarm,
        updateAlarm,
        deleteAlarm,
        updatePreference,
        deletePreference,
        deleteGoal,
        deleteTask,
        deleteIdea,
        completeTaskByTitle,
        clearIntent,
        detectIntent: detectIntentMutation.mutate,
        isDetectingIntent: detectIntentMutation.isPending,
        generateDailyPlan: generatePlanMutation.mutate,
        generateWeeklyDirection: generateWeeklyMutation.mutate,
        isGeneratingPlan: generatePlanMutation.isPending,
        isGeneratingWeekly: generateWeeklyMutation.isPending,
    }), [
        state.memory,
        state.detectedIntents,
        extractMemoryMutation.mutate,
        proposeInsight,
        confirmInsight,
        correctInsight,
        dismissInsight,
        updateMemory,
        updateGoal,
        updateTask,
        addGoal,
        addTask,
        addHabit,
        addIdea,
        addProblem,
        addPreference,
        addFocusSession,
        addAlarm,
        updateAlarm,
        deleteAlarm,
        updatePreference,
        deletePreference,
        deleteGoal,
        deleteTask,
        deleteIdea,
        completeTaskByTitle,
        clearIntent,
        detectIntentMutation.mutate,
        detectIntentMutation.isPending,
        generatePlanMutation.mutate,
        generateWeeklyMutation.mutate,
        generatePlanMutation.isPending,
        generateWeeklyMutation.isPending,
    ]);

    return (
        <MemoryContext.Provider value={value}>
            {children}
        </MemoryContext.Provider>
    );
}
