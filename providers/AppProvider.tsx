/**
 * AppProvider — thin composition wrapper.
 *
 * Nests all domain providers under StorageProvider and re-exports
 * a backward-compatible `useApp()` hook that merges domain hooks.
 *
 * Consumers can migrate to domain hooks (useChat, useMemory, etc.)
 * incrementally — this shim keeps everything working in the meantime.
 */

import React, { useMemo } from 'react';
import { StorageProvider, useStorage } from './StorageProvider';
import { ChatProvider, useChat } from './ChatProvider';
import { MemoryProvider, useMemory } from './MemoryProvider';
import { ScheduleProvider, useSchedule } from './ScheduleProvider';
import { CoachProvider, useCoach } from './CoachProvider';
import { GrowthProvider, useGrowth } from './GrowthProvider';
import { AppState } from 'react-native';
import { armGuardianIfWarranted } from '@/services/guardian';

// ── Composition Provider ────────────────────────────────────

/**
 * Arms the Exam Guardian nudge when warranted (exam context + watched apps), on
 * launch and whenever the app backgrounds (so the watcher is live while the user
 * is in other apps). Renders nothing.
 */
function GuardianArmer() {
  const storage = useStorage();
  React.useEffect(() => {
    const collect = () => {
      const mem = storage.state?.memory;
      const ctx = storage.state?.userContext;
      return [
        ...(mem?.goals ?? []).map((g) => g.title),
        ...(mem?.tasks ?? []).map((t) => t.title),
        ...(ctx?.currentFocus ? [ctx.currentFocus] : []),
      ];
    };
    armGuardianIfWarranted(collect()).catch(() => {});
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') armGuardianIfWarranted(collect()).catch(() => {});
    });
    return () => sub.remove();
  }, [storage.state?.memory, storage.state?.userContext?.currentFocus]);
  return null;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <StorageProvider>
      <ChatProvider>
        <MemoryProvider>
          <ScheduleProvider>
            <CoachProvider>
              <GrowthProvider>
                <GuardianArmer />
                {children}
              </GrowthProvider>
            </CoachProvider>
          </ScheduleProvider>
        </MemoryProvider>
      </ChatProvider>
    </StorageProvider>
  );
}

// ── Backward-Compatible useApp() Shim ───────────────────────

/**
 * @deprecated Prefer domain-specific hooks (`useChat`, `useMemory`, `useSchedule`,
 * `useCoach`, `useGrowth`) to avoid unnecessary re-renders. This shim merges all
 * providers into one object, causing every consumer to re-render on any state change.
 */
export function useApp() {
  const storage = useStorage();
  const chat = useChat();
  const memory = useMemory();
  const schedule = useSchedule();
  const coach = useCoach();
  const growth = useGrowth();

  return useMemo(() => ({
    // Storage (shared)
    state: storage.state,
    isLoaded: storage.isLoaded,
    resetApp: storage.resetApp,
    updateUserContext: storage.updateUserContext,
    completeOnboarding: storage.completeOnboarding,
    getUserId: storage.getUserId,
    updateState: storage.updateState,

    // Chat
    selectCoach: chat.selectCoach,
    addMessage: chat.addMessage,
    getSession: chat.getSession,
    clearSession: chat.clearSession,
    updateSessionPhase: chat.updateSessionPhase,
    markActionIdentified: chat.markActionIdentified,
    lockSession: chat.lockSession,
    unlockSession: chat.unlockSession,
    triggerCelebration: chat.triggerCelebration,
    dismissCelebration: chat.dismissCelebration,
    hasReachedFreeLimit: chat.hasReachedFreeLimit,
    remainingFreeMessages: chat.remainingFreeMessages,
    incrementFreeSession: chat.incrementFreeSession,
    dailySessionsUsed: chat.dailySessionsUsed,
    chatHistory: chat.chatHistory,
    archiveSession: chat.archiveSession,
    deleteArchivedChat: chat.deleteArchivedChat,

    // Memory
    extractMemory: memory.extractMemory,
    updateMemory: memory.updateMemory,
    updateGoal: memory.updateGoal,
    updateTask: memory.updateTask,
    addGoal: memory.addGoal,
    addTask: memory.addTask,
    addHabit: memory.addHabit,
    addIdea: memory.addIdea,
    addProblem: memory.addProblem,
    addPreference: memory.addPreference,
    addFocusSession: memory.addFocusSession,
    addAlarm: memory.addAlarm,
    updateAlarm: memory.updateAlarm,
    deleteAlarm: memory.deleteAlarm,
    updatePreference: memory.updatePreference,
    deletePreference: memory.deletePreference,
    deleteGoal: memory.deleteGoal,
    deleteTask: memory.deleteTask,
    deleteIdea: memory.deleteIdea,
    completeTaskByTitle: memory.completeTaskByTitle,
    clearIntent: memory.clearIntent,
    detectIntent: memory.detectIntent,
    isDetectingIntent: memory.isDetectingIntent,
    generateDailyPlan: memory.generateDailyPlan,
    generateWeeklyDirection: memory.generateWeeklyDirection,
    isGeneratingPlan: memory.isGeneratingPlan,
    isGeneratingWeekly: memory.isGeneratingWeekly,

    // Schedule
    generateSchedule: schedule.generateSchedule,
    isGeneratingSchedule: schedule.isGeneratingSchedule,
    parseScheduleFromResponse: schedule.parseScheduleFromResponse,
    isParsingSchedule: schedule.isParsingSchedule,
    approveSchedule: schedule.approveSchedule,
    rejectSchedule: schedule.rejectSchedule,
    setPendingSchedule: schedule.setPendingSchedule,
    resetSchedulingData: schedule.resetSchedulingData,
    addScheduleItem: schedule.addScheduleItem,
    toggleScheduleItemCompletion: schedule.toggleScheduleItemCompletion,
    deleteScheduleItem: schedule.deleteScheduleItem,
    setCurrentDayIndex: schedule.setCurrentDayIndex,

    // Coach
    addCustomCoach: coach.addCustomCoach,
    updateCustomCoach: coach.updateCustomCoach,
    deleteCustomCoach: coach.deleteCustomCoach,
    getCustomCoachById: coach.getCustomCoachById,
    exportCoach: coach.exportCoach,
    importCoach: coach.importCoach,
    importCoachByCode: coach.importCoachByCode,
    shareCoachToCommunity: coach.shareCoachToCommunity,
    rateCoach: coach.rateCoach,
    getCoachRating: coach.getCoachRating,
    showQuestionsPrompt: coach.showQuestionsPromptFn,
    hideQuestionsPrompt: coach.hideQuestionsPrompt,
    startQuestionsSession: coach.startQuestionsSession,
    answerQuestion: coach.answerQuestion,
    completeQuestionsSession: coach.completeQuestionsSession,
    cancelQuestionsSession: coach.cancelQuestionsSession,

    // Growth
    trialDaysRemaining: growth.trialDaysRemaining,
    isTrialActive: growth.isTrialActive,
    updateStreak: growth.updateStreak,
    markSmartPaywallTrigger: growth.markSmartPaywallTrigger,
    setReferralCode: growth.setReferralCode,
    redeemVoucher: growth.redeemVoucher,
    triggerSystemReadyScreen: growth.triggerSystemReadyScreen,
    dismissSystemReadyScreen: growth.dismissSystemReadyScreen,
  }), [storage, chat, memory, schedule, coach, growth]);
}
