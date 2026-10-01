/**
 * Domain-specific hooks that selectively pick from AppProvider.
 * 
 * Instead of `const { addMessage, getSession, ... } = useApp()` 
 * which subscribes to ALL state changes, use:
 * 
 *   const { addMessage, getSession, ... } = useChat()
 * 
 * This gives consumers a clean API surface and prepares
 * for a future full provider split without touching consumer code.
 */

import { useMemo } from 'react';
import { useApp } from '@/providers/AppProvider';

// ─── Chat & Sessions ───────────────────────────────────────

export function useChat() {
    const app = useApp();
    return useMemo(() => ({
        state: {
            sessions: app.state.sessions,
            selectedCoachId: app.state.selectedCoachId,
            showCelebration: app.state.showCelebration,
            celebrationTaskTitle: app.state.celebrationTaskTitle,
            freeMessagesUsed: app.state.freeMessagesUsed,
            freeSessionsToday: app.state.freeSessionsToday,
            lastSessionDate: app.state.lastSessionDate,
        },
        addMessage: app.addMessage,
        getSession: app.getSession,
        clearSession: app.clearSession,
        updateSessionPhase: app.updateSessionPhase,
        markActionIdentified: app.markActionIdentified,
        lockSession: app.lockSession,
        unlockSession: app.unlockSession,
        triggerCelebration: app.triggerCelebration,
        dismissCelebration: app.dismissCelebration,
        hasReachedFreeLimit: app.hasReachedFreeLimit,
        remainingFreeMessages: app.remainingFreeMessages,
        incrementFreeSession: app.incrementFreeSession,
        dailySessionsUsed: app.dailySessionsUsed,
    }), [
        app.state.sessions,
        app.state.selectedCoachId,
        app.state.showCelebration,
        app.state.celebrationTaskTitle,
        app.state.freeMessagesUsed,
        app.state.freeSessionsToday,
        app.state.lastSessionDate,
        app.addMessage,
        app.getSession,
        app.clearSession,
        app.updateSessionPhase,
        app.markActionIdentified,
        app.lockSession,
        app.unlockSession,
        app.triggerCelebration,
        app.dismissCelebration,
        app.hasReachedFreeLimit,
        app.remainingFreeMessages,
        app.incrementFreeSession,
        app.dailySessionsUsed,
    ]);
}

// ─── Memory (Goals, Tasks, Habits, Ideas, etc.) ────────────

export function useMemory() {
    const app = useApp();
    return useMemo(() => ({
        memory: app.state.memory,
        detectedIntents: app.state.detectedIntents,
        extractMemory: app.extractMemory,
        updateMemory: app.updateMemory,
        updateGoal: app.updateGoal,
        updateTask: app.updateTask,
        addGoal: app.addGoal,
        addTask: app.addTask,
        addHabit: app.addHabit,
        addIdea: app.addIdea,
        addProblem: app.addProblem,
        addPreference: app.addPreference,
        updatePreference: app.updatePreference,
        deletePreference: app.deletePreference,
        deleteGoal: app.deleteGoal,
        deleteTask: app.deleteTask,
        completeTaskByTitle: app.completeTaskByTitle,
        clearIntent: app.clearIntent,
        detectIntent: app.detectIntent,
        isDetectingIntent: app.isDetectingIntent,
        generateDailyPlan: app.generateDailyPlan,
        generateWeeklyDirection: app.generateWeeklyDirection,
        isGeneratingPlan: app.isGeneratingPlan,
        isGeneratingWeekly: app.isGeneratingWeekly,
    }), [
        app.state.memory,
        app.state.detectedIntents,
        app.extractMemory,
        app.updateMemory,
        app.updateGoal,
        app.updateTask,
        app.addGoal,
        app.addTask,
        app.addHabit,
        app.addIdea,
        app.addProblem,
        app.addPreference,
        app.updatePreference,
        app.deletePreference,
        app.deleteGoal,
        app.deleteTask,
        app.completeTaskByTitle,
        app.clearIntent,
        app.detectIntent,
        app.isDetectingIntent,
        app.generateDailyPlan,
        app.generateWeeklyDirection,
        app.isGeneratingPlan,
        app.isGeneratingWeekly,
    ]);
}

// ─── Schedule ──────────────────────────────────────────────

export function useSchedule() {
    const app = useApp();
    return useMemo(() => ({
        schedulingData: app.state.schedulingData,
        pendingSchedule: app.state.pendingSchedule,
        scheduleItems: app.state.memory.scheduleItems,
        schedules: app.state.memory.schedules,
        currentDayIndex: app.state.memory.currentDayIndex,
        generateSchedule: app.generateSchedule,
        isGeneratingSchedule: app.isGeneratingSchedule,
        parseScheduleFromResponse: app.parseScheduleFromResponse,
        isParsingSchedule: app.isParsingSchedule,
        approveSchedule: app.approveSchedule,
        rejectSchedule: app.rejectSchedule,
        setPendingSchedule: app.setPendingSchedule,
        resetSchedulingData: app.resetSchedulingData,
        addScheduleItem: app.addScheduleItem,
        toggleScheduleItemCompletion: app.toggleScheduleItemCompletion,
        deleteScheduleItem: app.deleteScheduleItem,
        setCurrentDayIndex: app.setCurrentDayIndex,
    }), [
        app.state.schedulingData,
        app.state.pendingSchedule,
        app.state.memory.scheduleItems,
        app.state.memory.schedules,
        app.state.memory.currentDayIndex,
        app.generateSchedule,
        app.isGeneratingSchedule,
        app.parseScheduleFromResponse,
        app.isParsingSchedule,
        app.approveSchedule,
        app.rejectSchedule,
        app.setPendingSchedule,
        app.resetSchedulingData,
        app.addScheduleItem,
        app.toggleScheduleItemCompletion,
        app.deleteScheduleItem,
        app.setCurrentDayIndex,
    ]);
}

// ─── Custom Coaches ────────────────────────────────────────

export function useCoach() {
    const app = useApp();
    return useMemo(() => ({
        customCoaches: app.state.customCoaches,
        communityCoaches: app.state.communityCoaches,
        coachRatings: app.state.coachRatings,
        questionsSession: app.state.questionsSession,
        showQuestionsPrompt: app.state.showQuestionsPrompt,
        addCustomCoach: app.addCustomCoach,
        updateCustomCoach: app.updateCustomCoach,
        deleteCustomCoach: app.deleteCustomCoach,
        getCustomCoachById: app.getCustomCoachById,
        exportCoach: app.exportCoach,
        importCoach: app.importCoach,
        importCoachByCode: app.importCoachByCode,
        shareCoachToCommunity: app.shareCoachToCommunity,
        rateCoach: app.rateCoach,
        getCoachRating: app.getCoachRating,
        showQuestionsPromptFn: app.showQuestionsPrompt,
        hideQuestionsPrompt: app.hideQuestionsPrompt,
        startQuestionsSession: app.startQuestionsSession,
        answerQuestion: app.answerQuestion,
        completeQuestionsSession: app.completeQuestionsSession,
        cancelQuestionsSession: app.cancelQuestionsSession,
    }), [
        app.state.customCoaches,
        app.state.communityCoaches,
        app.state.coachRatings,
        app.state.questionsSession,
        app.state.showQuestionsPrompt,
        app.addCustomCoach,
        app.updateCustomCoach,
        app.deleteCustomCoach,
        app.getCustomCoachById,
        app.exportCoach,
        app.importCoach,
        app.importCoachByCode,
        app.shareCoachToCommunity,
        app.rateCoach,
        app.getCoachRating,
        app.showQuestionsPrompt,
        app.hideQuestionsPrompt,
        app.startQuestionsSession,
        app.answerQuestion,
        app.completeQuestionsSession,
        app.cancelQuestionsSession,
    ]);
}

// ─── Growth (Trial, Streak, Referral, Paywall) ─────────────

export function useGrowth() {
    const app = useApp();
    return useMemo(() => ({
        streak: app.state.streak,
        referralCode: app.state.referralCode,
        smartPaywallTriggers: app.state.smartPaywallTriggers,
        trialStartedAt: app.state.trialStartedAt,
        trialEndsAt: app.state.trialEndsAt,
        trialExpired: app.state.trialExpired,
        hasSeenSystemReady: app.state.hasSeenSystemReady,
        showSystemReadyScreen: app.state.showSystemReadyScreen,
        trialDaysRemaining: app.trialDaysRemaining,
        isTrialActive: app.isTrialActive,
        updateStreak: app.updateStreak,
        markSmartPaywallTrigger: app.markSmartPaywallTrigger,
        setReferralCode: app.setReferralCode,
        redeemVoucher: app.redeemVoucher,
        triggerSystemReadyScreen: app.triggerSystemReadyScreen,
        dismissSystemReadyScreen: app.dismissSystemReadyScreen,
    }), [
        app.state.streak,
        app.state.referralCode,
        app.state.smartPaywallTriggers,
        app.state.trialStartedAt,
        app.state.trialEndsAt,
        app.state.trialExpired,
        app.state.hasSeenSystemReady,
        app.state.showSystemReadyScreen,
        app.trialDaysRemaining,
        app.isTrialActive,
        app.updateStreak,
        app.markSmartPaywallTrigger,
        app.setReferralCode,
        app.redeemVoucher,
        app.triggerSystemReadyScreen,
        app.dismissSystemReadyScreen,
    ]);
}
