/**
 * ScheduleProvider — owns schedule generation, parsing, items, and day index.
 * Extracted from AppProvider lines 505-717.
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SchedulingData, GeneratedSchedule, ScheduleItem } from '@/types';
import { generateSchedule, parseScheduleFromResponse } from '@/services/intent';
import { useStorage, defaultSchedulingData } from './StorageProvider';

// ── Context Shape ───────────────────────────────────────────

interface ScheduleContextValue {
    schedulingData: SchedulingData;
    pendingSchedule: GeneratedSchedule | null;
    scheduleItems: ScheduleItem[];
    schedules: GeneratedSchedule[];
    currentDayIndex: number;
    generateSchedule: (arg?: any) => void;
    isGeneratingSchedule: boolean;
    parseScheduleFromResponse: (response: string) => void;
    isParsingSchedule: boolean;
    approveSchedule: () => void;
    rejectSchedule: () => void;
    setPendingSchedule: (schedule: GeneratedSchedule | null) => void;
    resetSchedulingData: () => void;
    addScheduleItem: (item: Omit<ScheduleItem, 'id' | 'createdAt'>) => ScheduleItem;
    toggleScheduleItemCompletion: (itemId: string) => void;
    deleteScheduleItem: (itemId: string) => void;
    setCurrentDayIndex: (dayIndex: number) => void;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function useSchedule(): ScheduleContextValue {
    const ctx = useContext(ScheduleContext);
    if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
    return ctx;
}

// ── Provider ────────────────────────────────────────────────

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
    const { state, setState, persistState } = useStorage();

    const generateScheduleMutation = useMutation({
        mutationFn: async (_arg?: any) => {
            return generateSchedule(state.schedulingData, state.memory, {
                name: state.userContext.name,
                values: state.userContext.values,
                currentFocus: state.userContext.currentFocus,
                constraints: state.userContext.constraints,
            });
        },
        onSuccess: (schedule) => {
            if (schedule) {
                setState((prev) => {
                    const newState = {
                        ...prev,
                        memory: {
                            ...prev.memory,
                            schedules: [...prev.memory.schedules, schedule],
                        },
                        schedulingData: {
                            ...prev.schedulingData,
                            generatedSchedule: schedule,
                        },
                    };
                    persistState(newState);
                    return newState;
                });
            }
        },
    });

    const parseScheduleMutation = useMutation({
        mutationFn: async (response: string) => {
            return parseScheduleFromResponse(response);
        },
        onSuccess: (schedule) => {
            if (schedule) {
                setState((prev) => ({ ...prev, pendingSchedule: schedule }));
            }
        },
    });

    const setPendingSchedule = useCallback((schedule: GeneratedSchedule | null) => {
        setState((prev) => ({ ...prev, pendingSchedule: schedule }));
    }, [setState]);

    const approveSchedule = useCallback(() => {
        setState((prev) => {
            if (!prev.pendingSchedule) return prev;
            const newState = {
                ...prev,
                memory: {
                    ...prev.memory,
                    schedules: [...prev.memory.schedules, prev.pendingSchedule],
                },
                schedulingData: {
                    ...prev.schedulingData,
                    generatedSchedule: prev.pendingSchedule,
                },
                pendingSchedule: null,
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const rejectSchedule = useCallback(() => {
        setState((prev) => ({ ...prev, pendingSchedule: null }));
    }, [setState]);

    const resetSchedulingData = useCallback(() => {
        setState((prev) => {
            const newState = { ...prev, schedulingData: defaultSchedulingData };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const addScheduleItem = useCallback((item: Omit<ScheduleItem, 'id' | 'createdAt'>): ScheduleItem => {
        const newItem: ScheduleItem = {
            ...item,
            id: `schedule-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: Date.now(),
        };
        setState((prev) => {
            const newState = {
                ...prev,
                memory: { ...prev.memory, scheduleItems: [...prev.memory.scheduleItems, newItem] },
            };
            persistState(newState);
            return newState;
        });
        return newItem;
    }, [setState, persistState]);

    const toggleScheduleItemCompletion = useCallback((itemId: string) => {
        setState((prev) => {
            const item = prev.memory.scheduleItems.find(i => i.id === itemId);
            const wasCompleted = item?.isCompleted;
            const newItems = prev.memory.scheduleItems.map((i) =>
                i.id === itemId
                    ? { ...i, isCompleted: !i.isCompleted, completedAt: !i.isCompleted ? Date.now() : undefined }
                    : i
            );
            const newState = {
                ...prev,
                memory: { ...prev.memory, scheduleItems: newItems },
                showCelebration: !wasCompleted ? true : prev.showCelebration,
                celebrationTaskTitle: !wasCompleted ? (item?.title || null) : prev.celebrationTaskTitle,
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const deleteScheduleItem = useCallback((itemId: string) => {
        setState((prev) => {
            const newItems = prev.memory.scheduleItems.filter((item) => item.id !== itemId);
            const newState = { ...prev, memory: { ...prev.memory, scheduleItems: newItems } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const setCurrentDayIndex = useCallback((dayIndex: number) => {
        setState((prev) => {
            const newState = { ...prev, memory: { ...prev.memory, currentDayIndex: dayIndex } };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    // ── Memoized Value ────────────────────────────────────

    const value = useMemo<ScheduleContextValue>(() => ({
        schedulingData: state.schedulingData,
        pendingSchedule: state.pendingSchedule,
        scheduleItems: state.memory.scheduleItems,
        schedules: state.memory.schedules,
        currentDayIndex: state.memory.currentDayIndex,
        generateSchedule: generateScheduleMutation.mutate,
        isGeneratingSchedule: generateScheduleMutation.isPending,
        parseScheduleFromResponse: parseScheduleMutation.mutate,
        isParsingSchedule: parseScheduleMutation.isPending,
        approveSchedule,
        rejectSchedule,
        setPendingSchedule,
        resetSchedulingData,
        addScheduleItem,
        toggleScheduleItemCompletion,
        deleteScheduleItem,
        setCurrentDayIndex,
    }), [
        state.schedulingData,
        state.pendingSchedule,
        state.memory.scheduleItems,
        state.memory.schedules,
        state.memory.currentDayIndex,
        generateScheduleMutation.mutate,
        generateScheduleMutation.isPending,
        parseScheduleMutation.mutate,
        parseScheduleMutation.isPending,
        approveSchedule,
        rejectSchedule,
        setPendingSchedule,
        resetSchedulingData,
        addScheduleItem,
        toggleScheduleItemCompletion,
        deleteScheduleItem,
        setCurrentDayIndex,
    ]);

    return (
        <ScheduleContext.Provider value={value}>
            {children}
        </ScheduleContext.Provider>
    );
}
