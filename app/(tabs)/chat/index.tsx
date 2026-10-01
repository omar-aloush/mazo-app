import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
  Keyboard,
  AppState,
} from 'react-native';
import { FirstSessionArtifact, FirstSessionArtifactRef } from '@/components/FirstSessionArtifact';
import * as Sharing from 'expo-sharing';
import { File as ExpoFile, Paths } from 'expo-file-system';
import ViewShot from 'react-native-view-shot';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, Stack } from 'expo-router';
import { RotateCcw, Calendar, Heart, Target, Brain, Sparkles, Check, X, Plus, ArrowUp, Clock, HelpCircle, CheckCircle2, Lock, ArrowRight, UserCircle, WifiOff, CheckSquare, Square } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useOpenAIAgent as useRorkAgent } from '@/hooks/useOpenAIAgent';
import { MessageBubble } from '@/components/MessageBubble';
import { ChatInput } from '@/components/ChatInput';
import { MazoCharacter } from '@/components/MazoCharacter';
import { LoadingDots } from '@/components/LoadingDots';
import { QuestionsMode } from '@/components/QuestionsMode';
import { ExitCard } from '@/components/ExitCard';
import { CatchCard } from '@/components/CatchCard';
import { useMemory } from '@/providers/MemoryProvider';
import { phraseInsight } from '@/services/mindInsights';
import type { MindInsight } from '@/types';
import { TypingIndicator } from '@/components/TypingIndicator';
import { ScrollToBottom } from '@/components/ScrollToBottom';
import { ModeSelect, CoachingMode } from '@/components/ModeSelect';
import { PhaseIndicator } from '@/components/PhaseIndicator';

import { BreakthroughMoment, detectBreakthrough } from '@/components/BreakthroughMoment';
import { SessionDepthMeter } from '@/components/SessionDepthMeter';
import { SessionInsights } from '@/components/SessionInsights';
import { ReflectionPause, shouldSuggestPause } from '@/components/ReflectionPause';
import { GuidedTour } from '@/components/GuidedTour';
import { FocusModeOverlay } from '@/components/FocusModeOverlay';
import { FocusShieldPreview } from '@/components/FocusShieldPreview';
import { FocusCheckInCard } from '@/components/FocusCheckInCard';
import { startFocusCheckIn, advanceFocusCheckIn, type FocusCheckIn } from '@/services/focusCheckIn';
import { armFocusGuardForSession, stopFocusGuard } from '@/services/focusGuard';
import { consumeNudgeLaunch } from '@/modules/mazo-focus-guard';
import { getUsageSummaryText, getTopUsageApps } from '@/services/deviceApps';
import { find as findDocuments } from '@/services/documents';
import { generateActionPlan, detectActionableIntent } from '@/services/actionPlanner';
import { dispatchPlan } from '@/services/actionDispatch';
import { ApprovalCard } from '@/components/ApprovalCard';
import { CommandBar } from '@/components/CommandBar';
import type { ActionPlan } from '@/types';
import { useApp } from '@/providers/AppProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { isLocalDemoMode } from '@/services/demoMode';
import { getCoachById, coaches } from '@/constants/coaches';
import { Coach, CustomCoach, DetectedIntent, AIQuestion, SessionPhase, MazoState } from '@/types';
import { detectMazoEmotion } from '@/utils/mazo-emotions';
import { getMazoConfigForCoach } from '@/constants/mazo';
import { createCoachTools, COACH_SYSTEM_PROMPT_ADDON } from '@/services/actions';
import {
  PHASE_PROMPTS,
  COACH_OVERLAYS,
  detectPhaseTransition,
  detectFreeformRequest,
  detectActionBlock,
  extractActionFromBlock,
  buildPhaseAwarePrompt,
  type CoachId,
} from '@/constants/session-phases';

import Colors from '@/constants/colors';
import { COACHING_MODES, getActionSystemAddition } from '@/constants/coaching-modes';
import { IconRenderer } from '@/components/IconRenderer';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { MemoryInsightsCard } from '@/components/MemoryInsightsCard';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';



import {
  SUGGESTED_PROMPTS,
  QUICK_CHECKIN_PROMPTS,
  DAILY_PROMPTS,
  MODE_COLORS,
  MODE_COLORS_DARK,
  getTimeGreeting,
  getTimeSubtitle,
  getDailyPrompt,
  DISCOVERY_QUESTIONS,
} from '@/constants/chatConstants';

export default function ChatScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const flashListRef = useRef<any>(null);
  const {
    state,
    clearSession,
    selectCoach,
    hasReachedFreeLimit,
    remainingFreeMessages,
    incrementFreeSession,
    dailySessionsUsed,
    approveSchedule,
    rejectSchedule,
    startQuestionsSession,
    answerQuestion,
    completeQuestionsSession,
    cancelQuestionsSession,
    showQuestionsPrompt,
    hideQuestionsPrompt,
    addScheduleItem,
    addGoal,
    addTask,
    addHabit,
    addIdea,
    addProblem,
    addPreference,
    completeTaskByTitle,
    getCustomCoachById,
    updateSessionPhase,
    markActionIdentified,
    lockSession,
    unlockSession,
    extractMemory,
    addMessage,
    updateStreak,
    markSmartPaywallTrigger,
    addFocusSession,
    addAlarm,
    deleteAlarm,
    archiveSession,
    deleteArchivedChat,
  } = useApp();
  const { isPro } = useSubscription();
  const { colors, isDark } = useTheme();
  const { mindInsights, proposeInsight, confirmInsight, correctInsight, dismissInsight } = useMemory();
  const { isOffline } = useNetworkStatus();
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<DetectedIntent | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showExitCard, setShowExitCard] = useState(false);
  const [exitFromApprovedStep, setExitFromApprovedStep] = useState(false);
  const [currentActionTitle, setCurrentActionTitle] = useState<string>('');
  const [coachingMode, setCoachingMode] = useState<CoachingMode>('freeform');
  const [modeChosen, setModeChosen] = useState(false);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null);
  const [showModePrompt, setShowModePrompt] = useState(false);
  const [mazoState, setMazoState] = useState<MazoState>('idle');
  const [pendingInsight, setPendingInsight] = useState<MindInsight | null>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showBreakthrough, setShowBreakthrough] = useState(false);
  const [breakthroughText, setBreakthroughText] = useState('');
  const [showReflectionPause, setShowReflectionPause] = useState(false);
  const [lastPauseAtMsg, setLastPauseAtMsg] = useState<number | null>(null);
  const [showSessionInsights, setShowSessionInsights] = useState(false);
  const [hasRestoredMessages, setHasRestoredMessages] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [hasSeenRoadmap, setHasSeenRoadmap] = useState<boolean | null>(null);
  const [showFreeformNudge, setShowFreeformNudge] = useState(false);
  const freeformMsgCountRef = useRef(0);
  const sessionStartTimeRef = useRef(Date.now());
  const [insightsDismissed, setInsightsDismissed] = useState(true);  // Start true until loaded
  const intentFadeAnim = useRef(new Animated.Value(0)).current;
  const lastSavedMsgCountRef = useRef(0);
  const memoryExtractedAtRef = useRef(0);
  const processedActionMsgRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  const modeFromOnboardingRef = useRef(false);
  const [overrideCoachId, setOverrideCoachId] = useState<string | null>(null);

  // Growth #1: First Session Artifact
  const artifactRef = useRef<FirstSessionArtifactRef>(null);
  const [showArtifactModal, setShowArtifactModal] = useState(false);
  const [artifactInsights, setArtifactInsights] = useState<string[]>([]);
  const [artifactTitle, setArtifactTitle] = useState<string>('My First Breakthrough');
  const [isFirstSession, setIsFirstSession] = useState(false);
  const firstSessionArtifactTriggeredRef = useRef(false);

  // Triggered when session ends or breakthrough happens
  const handleShowArtifact = useCallback(() => {
    // If we have real insights, great. If not, generate some from memory/context.
    if (artifactInsights.length === 0) {
      setArtifactInsights([
        state.userContext?.currentFocus ? `${t('journey.todaysFocus')}: ${state.userContext.currentFocus}` : t('journey.insightFindingClarity'),
        state.memory.goals[0] ? `${t('journey.activeGoals')}: ${state.memory.goals[0].title}` : t('journey.insightTakingAction'),
        t('journey.insightActionPlanCreated')
      ]);
    }
    setShowArtifactModal(true);
  }, [artifactInsights, state.userContext, state.memory]);

  const handleShareArtifact = async () => {
    try {
      if (artifactRef.current) {
        const base64 = await artifactRef.current.capture();
        const file = new ExpoFile(Paths.cache, 'mazo-breakthrough.png');
        // Decode base64 to bytes and write
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        file.write(bytes);
        await Sharing.shareAsync(file.uri);
      }
    } catch (e) {
      console.warn("Sharing failed", e);
    }
  };

  // Auto-select default coach if none is selected so the text input works immediately
  React.useEffect(() => {
    if (!state.selectedCoachId) {
      selectCoach('clarifier');
    }
  }, [state.selectedCoachId, selectCoach]);

  React.useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('hasSeenRoadmap'),
      AsyncStorage.getItem('hasCompletedFirstSession'),
      AsyncStorage.getItem('initialCoachingMode'),
      AsyncStorage.getItem('autoStartSession'),
    ]).then(([roadmapVal, completedVal, initialMode, autoStartVal]) => {
      const seen = roadmapVal === 'true';
      setHasSeenRoadmap(seen);
      if (!seen && completedVal === 'true') {
        setShowRoadmap(true);
        setHasSeenRoadmap(true);
        AsyncStorage.setItem('hasSeenRoadmap', 'true');
      }
      // Track first-ever session for Aha Moment
      if (completedVal !== 'true') {
        setIsFirstSession(true);
      }
      if (initialMode && ['decision', 'clarity', 'planning', 'reflection'].includes(initialMode)) {
        setCoachingMode(initialMode as CoachingMode);
        setModeChosen(true);
        modeFromOnboardingRef.current = true;
        AsyncStorage.removeItem('initialCoachingMode');
      }
      if (autoStartVal === 'true') {
        AsyncStorage.removeItem('autoStartSession');
      }
    });
  }, []);

  const sessionPhase: SessionPhase = useMemo(() => {
    const session = state.sessions[state.selectedCoachId || ''];
    return session?.currentPhase || 'opening';
  }, [state.sessions, state.selectedCoachId]);

  const selectedCoach: (Coach | CustomCoach) | null = React.useMemo(() => {
    // If we have a mid-chat override, use that coach instead
    const effectiveCoachId = overrideCoachId || state.selectedCoachId;
    if (!effectiveCoachId) return null;
    const builtIn = getCoachById(effectiveCoachId);
    if (builtIn) return builtIn;
    const custom = getCustomCoachById(effectiveCoachId);
    return custom || null;
  }, [state.selectedCoachId, overrideCoachId, getCustomCoachById]);

  const currentMazoConfig = React.useMemo(() => {
    if (!state.selectedCoachId) return getMazoConfigForCoach('', '');
    const coach = getCoachById(state.selectedCoachId) || getCustomCoachById(state.selectedCoachId);
    if (!coach) return getMazoConfigForCoach('', '');
    if ('isCustom' in coach && (coach as any).mazoConfig) {
      return (coach as any).mazoConfig;
    }
    const tone = 'isCustom' in coach ? coach.tone : (coach as any)?.tone || '';
    return getMazoConfigForCoach(coach.id, tone);
  }, [state.selectedCoachId, getCustomCoachById]);

  // Build the list of coach IDs the user actually has access to
  const availableCoachIds = useMemo(() => {
    const builtInIds = coaches.map(c => c.id);
    const customIds = (state.customCoaches || []).map((c: CustomCoach) => c.id);
    return [...builtInIds, ...customIds];
  }, [state.customCoaches]);

  // Handle coach switch: stays in the same chat, just changes the coaching persona
  const onSwitchCoach = useCallback((coachId: string) => {
    if (__DEV__) console.log('[Chat] Mid-chat coach switch to:', coachId);
    // Use local override instead of global selectCoach — keeps chat intact
    setOverrideCoachId(coachId);
    return true;
  }, []);

  const [isFocusTimerActive, setIsFocusTimerActive] = useState(false);
  const [focusTaskName, setFocusTaskName] = useState('');
  const [focusDurationMinutes, setFocusDurationMinutes] = useState(0);
  const [focusTechnique, setFocusTechnique] = useState<'pomodoro' | 'deep_work' | 'sprint' | 'custom'>('custom');
  const [focusSuggestion, setFocusSuggestion] = useState<{ task: string; nextStep: string; durationMinutes: number; guardAlreadyActive: boolean; started: boolean } | null>(null);
  const [focusShieldPreview, setFocusShieldPreview] = useState<{ apps: string[]; durationMinutes: number; task: string } | null>(null);
  const [focusCheckIn, setFocusCheckIn] = useState<FocusCheckIn | null>(null);
  const [isFocusCheckInLoading, setIsFocusCheckInLoading] = useState(false);
  const focusCheckInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusOwnsGuardRef = useRef(false);

  const cancelFocusCheckInReply = useCallback(() => {
    if (focusCheckInTimerRef.current) clearTimeout(focusCheckInTimerRef.current);
    focusCheckInTimerRef.current = null;
    setIsFocusCheckInLoading(false);
  }, []);

  useEffect(() => () => {
    if (focusCheckInTimerRef.current) clearTimeout(focusCheckInTimerRef.current);
  }, []);

  const beginFocusSession = useCallback((durationMinutes: number, task: string, technique: 'pomodoro' | 'deep_work' | 'sprint' | 'custom', armGuard = true) => {
    cancelFocusCheckInReply();
    setFocusCheckIn(null);
    setFocusSuggestion((previous) => previous ? { ...previous, started: true } : previous);
    setFocusDurationMinutes(durationMinutes);
    setFocusTaskName(task);
    setFocusTechnique(technique);
    setIsFocusTimerActive(true);
    focusOwnsGuardRef.current = armGuard;
    if (armGuard) armFocusGuardForSession(durationMinutes, task).catch(() => {});
  }, [cancelFocusCheckInReply]);

  const finishChatWithNextStep = useCallback(() => {
    if (!focusSuggestion || !state.selectedCoachId) return;
    const taskTitle = focusSuggestion.nextStep;
    const existing = state.memory.tasks.find((task) => task.status === 'pending' && task.title === taskTitle);
    const taskId = existing?.id ?? String(addTask({ title: taskTitle, priority: 'high', status: 'pending' }).data?.id ?? taskTitle);
    markActionIdentified(state.selectedCoachId);
    lockSession(state.selectedCoachId, taskId);
    updateSessionPhase(state.selectedCoachId, 'exit');
    setCurrentActionTitle(taskTitle);
    cancelFocusCheckInReply();
    setFocusCheckIn(null);
    setFocusSuggestion(null);
    setExitFromApprovedStep(true);
    setShowExitCard(true);
  }, [focusSuggestion, state.selectedCoachId, state.memory.tasks, addTask, markActionIdentified, lockSession, updateSessionPhase, cancelFocusCheckInReply]);

  // Chat-decides: Mazō concludes real phone actions from the conversation and
  // surfaces them inline (approval-gated). Two triggers feed the same card: a
  // deterministic context gate that runs after every actionable message (so it
  // never depends on the model calling a tool), and the proposePhoneActions tool
  // for when the model does decide. Nothing runs until the user taps Approve.
  const [agentPlan, setAgentPlan] = useState<ActionPlan | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const planInFlightRef = useRef(false);
  const plannedForMsgRef = useRef<string | null>(null);

  const proposePlanFromText = useCallback((request: string, force = false) => {
    const trimmed = (request ?? '').trim();
    if (!trimmed) return;
    // Don't stack plans or re-plan the same message. The tool path forces a fresh one.
    if (!force && (planInFlightRef.current || agentPlan || plannedForMsgRef.current === trimmed)) return;
    planInFlightRef.current = true;
    plannedForMsgRef.current = trimmed;
    const distractions = getTopUsageApps(7, 3).map((a) => a.label);
    generateActionPlan(trimmed, state.memory, mindInsights ?? [], distractions)
      .then((p) => {
        if (p && p.actions.length) setAgentPlan(p);
      })
      .catch(() => {})
      .finally(() => {
        planInFlightRef.current = false;
      });
  }, [state.memory, mindInsights, agentPlan]);

  const proposePhoneActions = useCallback((request: string): string => {
    setAgentBusy(false);
    setAgentPlan(null);
    proposePlanFromText(request, true);
    return 'I put a plan together — showing it to you to approve.';
  }, [proposePlanFromText]);

  const coachTools = useMemo(() => createCoachTools({
    addScheduleItem,
    addGoal,
    addTask,
    addHabit,
    addIdea,
    addProblem,
    addPreference,
    completeTaskByTitle,
    onSwitchCoach,
    availableCoachIds,
    currentDayIndex: state.memory.currentDayIndex,
    startFocusTimer: (dur: number, task: string, technique: 'pomodoro' | 'deep_work' | 'sprint' | 'custom') => {
      if (__DEV__) console.log('UI: Received trigger for focus timer:', dur, task, technique);
      setFocusSuggestion(null);
      beginFocusSession(dur, task, technique || 'custom');
      return `Started ${dur} minute focus timer for "${task}" using ${technique}. I'll wait quietly while you work.`;
    },
    setAlarm: (alarm: any) => {
      const safeH = typeof alarm.hour === 'number' && !isNaN(alarm.hour) ? alarm.hour : 7;
      const safeM = typeof alarm.minute === 'number' && !isNaN(alarm.minute) ? alarm.minute : 0;
      const safeDays = Array.isArray(alarm.days) ? alarm.days : typeof alarm.days === 'number' ? [0, 1, 2, 3, 4, 5, 6] : [];
      const safeLabel = alarm.label || alarm.title || 'Alarm';
      const safeSound = alarm.soundId || alarm.sound || 'gentle';

      addAlarm({
        hour: safeH,
        minute: safeM,
        days: safeDays,
        label: safeLabel,
        soundId: safeSound,
        enabled: true,
      });
      const h = safeH % 12 || 12;
      const m = String(safeM).padStart(2, '0');
      const period = safeH < 12 ? 'AM' : 'PM';
      const daysStr = safeDays.length === 0 ? 'once' : safeDays.length === 7 ? 'every day' : safeDays.length === 5 ? 'weekdays' : `on ${safeDays.length} days`;
      return `Alarm set for ${h}:${m} ${period} (${daysStr}) — "${safeLabel}"`;
    },
    deleteAlarmByLabel: (label: string) => {
      const alarms = state.memory.alarms || [];
      const target = alarms.find(a => (a.label || '').toLowerCase() === (label || '').toLowerCase());
      if (!target) return { success: false, message: `No alarm found with label "${label}"` };
      deleteAlarm(target.id);
      return { success: true, message: `Alarm "${label}" has been deleted.` };
    },
    getPhoneUsage: (days: number) => getUsageSummaryText(days),
    proposePhoneActions,
    findDocument: async (query: string): Promise<string> => {
      const hits = await findDocuments(query, 3);
      if (hits.length === 0) {
        return `No file matched "${query}". If they haven't yet, suggest they grant a folder in Settings → Find a document so you can search their files.`;
      }
      const lines = hits.map((h) => {
        let folder = '';
        try {
          const dec = decodeURIComponent(h.doc.folderUri || '');
          folder = dec.split(/[:/]/).filter(Boolean).pop() || '';
        } catch { /* ignore */ }
        return `• ${h.doc.name}${folder ? ` — in "${folder}"` : ''}${h.snippet ? `: "${h.snippet}"` : ''}`;
      }).join('\n');
      return `Found ${hits.length} match${hits.length === 1 ? '' : 'es'} for "${query}":\n${lines}\n\nTell the user the file name and where it is in one short, natural sentence. They can open it from Settings → Find a document.`;
    },
  }), [addScheduleItem, addGoal, addTask, addHabit, addIdea, addProblem, addPreference, completeTaskByTitle, onSwitchCoach, availableCoachIds, state.memory.currentDayIndex, state.memory.alarms, beginFocusSession, addAlarm, deleteAlarm, proposePhoneActions]);

  const getCoachSystemPrompt = useCallback((coach: Coach | CustomCoach): string => {
    if ('isCustom' in coach && coach.isCustom) {
      return coach.systemPrompt;
    }
    return (coach as Coach).systemPrompt;
  }, []);

  const getCoachName = useCallback((coach: Coach | CustomCoach): string => {
    if (coach && coach.name && coach.name.startsWith('coaches.library.')) {
      return t(coach.name as any);
    }
    return coach.name;
  }, [t]);

  const getCoachRole = useCallback((coach: Coach | CustomCoach): string => {
    if (coach && coach.role && coach.role.startsWith('coaches.library.')) {
      return t(coach.role as any);
    }
    return coach.role;
  }, [t]);

  const buildSystemContext = useCallback(() => {
    if (!selectedCoach) return '';
    const contextParts: string[] = [];
    const personalInfo: string[] = [];

    if (state.userContext?.name?.trim()) {
      personalInfo.push(`User's name: ${state.userContext.name}`);
    }
    if (state.userContext?.age?.trim()) {
      personalInfo.push(`User's age: ${state.userContext.age}`);
    }

    if (state.userContext?.values?.trim()) {
      contextParts.push(`Values: ${state.userContext.values}`);
    }
    if (state.userContext?.currentFocus?.trim()) {
      contextParts.push(`Current focus: ${state.userContext.currentFocus}`);
    }
    if (state.userContext?.constraints?.trim()) {
      contextParts.push(`Constraints: ${state.userContext.constraints}`);
    }

    const activeGoals = state.memory.goals.filter(g => g.status === 'active');
    if (activeGoals.length > 0) {
      contextParts.push(`Active goals: ${activeGoals.map(g => g.title).join(', ')}`);
    }
    const completedGoals = state.memory.goals.filter(g => g.status === 'completed');
    if (completedGoals.length > 0) {
      contextParts.push(`Completed goals: ${completedGoals.slice(-3).map(g => g.title).join(', ')}`);
    }
    const pendingTasks = state.memory.tasks.filter(t => t.status === 'pending');
    if (pendingTasks.length > 0) {
      contextParts.push(`Pending tasks: ${pendingTasks.slice(0, 5).map(t => t.title).join(', ')}`);
    }
    const completedTasks = state.memory.tasks.filter(t => t.status === 'completed');
    if (completedTasks.length > 0) {
      contextParts.push(`Recently completed tasks: ${completedTasks.slice(-3).map(t => t.title).join(', ')}`);
    }
    if (state.memory.habits.length > 0) {
      contextParts.push(`Habits working on: ${state.memory.habits.slice(-5).map(h => h.title).join(', ')}`);
    }
    if (state.memory.ideas.length > 0) {
      contextParts.push(`Ideas mentioned: ${state.memory.ideas.slice(-3).map(i => i.content).join(', ')}`);
    }
    const openProblems = state.memory.problems.filter(p => p.status === 'open');
    if (openProblems.length > 0) {
      contextParts.push(`Current challenges: ${openProblems.slice(-3).map(p => p.description).join(', ')}`);
    }
    if (state.memory.constraints.length > 0) {
      contextParts.push(`Known constraints: ${state.memory.constraints.slice(-3).map(c => c.description).join(', ')}`);
    }
    const prefs = state.memory.preferences.slice(0, 10);
    if (prefs.length > 0) {
      contextParts.push(`Preferences: ${prefs.map(p => p.value).join(', ')}`);
    }

    const allScheduleItems = state.memory.scheduleItems || [];
    if (allScheduleItems.length > 0) {
      const currentDay = state.memory.currentDayIndex || 0;
      const todayItems = allScheduleItems.filter(i => i.dayIndex === currentDay);
      const relevantItems = todayItems.slice(0, 10);

      if (relevantItems.length > 0) {
        const itemList = relevantItems.map(i => `${i.title}${i.isCompleted ? ' (done)' : ''}`).join(', ');
        contextParts.push(`Today's schedule: ${itemList}`);
      }

      const total = todayItems.length;
      const completed = todayItems.filter(i => i.isCompleted).length;
      if (total > 0) {
        const rate = Math.round((completed / total) * 100);
        contextParts.push(`Today's progress: ${completed}/${total} items done (${rate}%)`);
      }
    }

    const pastSessions = Object.entries(state.sessions)
      .filter(([id]) => id === state.selectedCoachId)
      .map(([, sess]) => sess);
    if (pastSessions.length > 0 && pastSessions[0].messages.length > 0) {
      const recentMsgs = pastSessions[0].messages.slice(-6);
      const topicSummary = recentMsgs
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .filter(c => c.length > 10)
        .slice(-3)
        .join('; ');
      if (topicSummary) {
        contextParts.push(`Recent conversation topics with this coach: ${topicSummary}`);
      }
    }

    const systemPrompt = getCoachSystemPrompt(selectedCoach);

    const personalSection = personalInfo.length > 0
      ? `\n\n[USER — you already know this person]\n${personalInfo.join('\n')}\nUse their name. Never say "I don't have access to your information."`
      : '';

    const contextSection = contextParts.length > 0
      ? `\n\n[CONTEXT — your memory from previous sessions]\n${contextParts.join('\n')}\nReference this naturally. Don't re-ask what you already know.`
      : '';

    // Get current session phase for structured coaching flow
    const currentSession = state.sessions[state.selectedCoachId || ''];
    const currentPhase: SessionPhase = currentSession?.currentPhase || 'opening';
    const userMessageCount = currentSession?.messages?.filter(m => m.role === 'user').length || 0;
    const sessionDuration = currentSession?.sessionStartTime
      ? (Date.now() - currentSession.sessionStartTime) / 60000
      : 0;

    // Force exit after 8 messages or 12 minutes
    let effectivePhase = currentPhase;
    if (userMessageCount >= 8 || sessionDuration >= 12) {
      effectivePhase = 'exit';
    } else if (userMessageCount >= 5 && !currentSession?.actionIdentified) {
      effectivePhase = 'action';
    }

    // Build unified phase prompt (session phase + coach overlay + urgency)
    const coachId = selectedCoach.id as CoachId;
    const phaseAwarePrompt = buildPhaseAwarePrompt(
      '',
      effectivePhase,
      userMessageCount,
      userMessageCount,
      coachId
    );

    // Mode addition (only if a specific mode is selected — replaces generic phase guidance)
    const modeAddition = coachingMode !== 'freeform' && COACHING_MODES[coachingMode as keyof typeof COACHING_MODES]
      ? `\n\n${COACHING_MODES[coachingMode as keyof typeof COACHING_MODES].systemAddition}`
      : '';

    // Language instruction — ensures AI responds in the same language as the user's message
    const LANGUAGE_NAMES: Record<string, string> = {
      ar: 'Arabic', de: 'German', es: 'Spanish', fr: 'French',
      hi: 'Hindi', id: 'Indonesian', it: 'Italian', ja: 'Japanese',
      ko: 'Korean', pt: 'Portuguese', ru: 'Russian', tr: 'Turkish', zh: 'Chinese',
    };
    const languageInstruction = language !== 'en' && LANGUAGE_NAMES[language]
      ? `\n\n[LANGUAGE]\nThe user's app UI is set to ${LANGUAGE_NAMES[language]}, but you MUST respond in the SAME language the user writes in. If the user writes in English, respond in English. If the user writes in ${LANGUAGE_NAMES[language]}, respond in ${LANGUAGE_NAMES[language]}. Always match the language of the user's latest message.`
      : '';

    // Clean prompt chain: identity → context → language → phase → tools → mode → master rules
    return `${systemPrompt}${personalSection}${contextSection}${languageInstruction}\n\n${phaseAwarePrompt}\n\n${COACH_SYSTEM_PROMPT_ADDON}${modeAddition}\n\n${getActionSystemAddition(language)}`;
  }, [selectedCoach, state.selectedCoachId, state.userContext, state.memory?.goals, state.memory?.tasks, state.memory?.preferences, state.memory?.habits, state.memory?.ideas, state.memory?.problems, state.memory?.constraints, state.memory?.scheduleItems, state.sessions, getCoachSystemPrompt, coachingMode, language]);

  const { messages: agentMessages, sendMessage, setMessages, status, error, stop: stopGenerating } = useRorkAgent({
    tools: coachTools,
    maxSteps: 2, // Prevent infinite tool-call loops: allow at most 1 tool round-trip per user message
  } as any);

  const isAgentLoading = status === 'streaming' || status === 'submitted' || isFocusCheckInLoading;
  const [lastError, setLastError] = useState<string | null>(null);

  const answerFocusCheckIn = useCallback((answer: string) => {
    const text = answer.trim();
    if (!focusCheckIn || !text || focusCheckInTimerRef.current || status === 'streaming' || status === 'submitted') return;
    Keyboard.dismiss();
    setLastError(null);
    const userId = `focus-answer-${Date.now()}`;
    setMessages((previous) => [...previous, {
      id: userId, role: 'user', parts: [{ type: 'text', text }], content: text,
    }]);
    if (state.selectedCoachId) {
      addMessage(state.selectedCoachId, { id: userId, role: 'user', content: text, timestamp: Date.now() });
    }
    setIsFocusCheckInLoading(true);
    const reply = advanceFocusCheckIn(focusCheckIn, text);
    focusCheckInTimerRef.current = setTimeout(() => {
      focusCheckInTimerRef.current = null;
      setMessages((previous) => [...previous, {
        id: `focus-reply-${Date.now()}`, role: 'assistant',
        parts: [{ type: 'text', text: reply.message }], content: reply.message,
      }]);
      setFocusCheckIn(reply.checkIn);
      if (reply.nextStep) {
        setFocusSuggestion({ ...reply.nextStep, guardAlreadyActive: false, started: false });
      }
      setIsFocusCheckInLoading(false);
      flashListRef.current?.scrollToEnd({ animated: true });
    }, isLocalDemoMode() ? 3000 : 300);
  }, [focusCheckIn, status, setMessages, state.selectedCoachId, addMessage]);

  const OFFLINE_ERROR = "You're offline. Check your connection and try again.";

  const CHAT_STORAGE_PREFIX = 'chat_messages_';
  const restoreCoachIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!state.selectedCoachId || hasRestoredMessages || isInitializing) return;

    const coachId = state.selectedCoachId;
    restoreCoachIdRef.current = coachId;

    const restoreMessages = async () => {
      try {
        if (restoreCoachIdRef.current !== coachId) return;
        const stored = await AsyncStorage.getItem(`${CHAT_STORAGE_PREFIX}${coachId}`);
        if (restoreCoachIdRef.current !== coachId) return;

        if (stored) {
          let parsed: any;
          try {
            parsed = JSON.parse(stored);
          } catch (err: any) {
            console.warn('[Chat] Failed to parse stored messages:', err?.message || err);
            await AsyncStorage.removeItem(`${CHAT_STORAGE_PREFIX}${coachId}`);
            parsed = null;
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validMessages = parsed.filter(
              (msg: any) => msg && msg.id && msg.role && Array.isArray(msg.parts) && msg.parts.length > 0
            );
            if (validMessages.length > 0) {
              setMessages(validMessages);
              setShowWelcome(false);
              lastSavedMsgCountRef.current = validMessages.length;
            }
          }
        }
      } catch (e) {
        console.warn('[Chat] Failed to restore chat messages:', e);
      }
      if (restoreCoachIdRef.current === coachId) {
        setHasRestoredMessages(true);
      }
    };

    restoreMessages();
  }, [state.selectedCoachId, hasRestoredMessages, isInitializing, setMessages]);

  useEffect(() => {
    const coachId = state.selectedCoachId;
    if (!coachId || !hasRestoredMessages) return;
    if (agentMessages.length === 0 || agentMessages.length === lastSavedMsgCountRef.current) return;
    if (status === 'streaming' || status === 'submitted') return;

    lastSavedMsgCountRef.current = agentMessages.length;

    const messagesToSave = agentMessages.slice(-50).map(msg => ({
      id: msg.id,
      role: msg.role,
      parts: (msg.parts || [])
        .filter(p => p.type === 'text')
        .map(p => ({
          type: 'text' as const,
          text: (p as { text: string }).text || '',
        })),
    })).filter(msg => msg.parts.length > 0);

    AsyncStorage.setItem(
      `${CHAT_STORAGE_PREFIX}${coachId}`,
      JSON.stringify(messagesToSave)
    ).catch(e => console.warn('[Chat] Failed to save chat messages:', e));

    const lastMsg = agentMessages[agentMessages.length - 1];
    if (lastMsg?.role === 'assistant' && coachId) {
      const assistantText = lastMsg.parts
        ?.filter(p => p.type === 'text')
        .map(p => ('text' in p ? (p as { text: string }).text : ''))
        .join('\n') || '';
      // Check if the message contains tool-result parts (e.g. addGoal, addTask executed)
      const hasToolResults = lastMsg.parts?.some(
        (p: any) => p.type === 'tool-invocation' || p.type === 'tool-result'
      );
      if (assistantText.trim()) {
        addMessage(coachId, {
          id: lastMsg.id || `assistant-${Date.now()}`,
          role: 'assistant',
          content: assistantText,
          timestamp: Date.now(),
        });
      } else if (!hasToolResults) {
        // Only show error if there's genuinely no response (not a silent tool call)
        setLastError("I didn't get a response. Tap to retry.");
      }
    }
  }, [agentMessages, state.selectedCoachId, hasRestoredMessages, status, addMessage]);

  // ── Save on app going to background ──
  // Ensures messages are persisted even if the user force-closes the app
  useEffect(() => {
    const handleAppStateChange = (nextState: string) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const coachId = state.selectedCoachId;
        if (!coachId || agentMessages.length === 0) return;

        const messagesToSave = agentMessages.slice(-50).map(msg => ({
          id: msg.id,
          role: msg.role,
          parts: (msg.parts || [])
            .filter(p => p.type === 'text')
            .map(p => ({
              type: 'text' as const,
              text: (p as { text: string }).text || '',
            })),
        })).filter(msg => msg.parts.length > 0);

        if (messagesToSave.length > 0) {
          AsyncStorage.setItem(
            `${CHAT_STORAGE_PREFIX}${coachId}`,
            JSON.stringify(messagesToSave)
          ).catch(e => console.warn('[Chat] Background save failed:', e));
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [state.selectedCoachId, agentMessages]);

  useEffect(() => {
    const coachId = state.selectedCoachId;
    if (!coachId || agentMessages.length < 2) return;
    if (status === 'streaming' || status === 'submitted') return;

    const lastMsg = agentMessages[agentMessages.length - 1];
    if (lastMsg?.role !== 'assistant') return;

    const userMessages = agentMessages.filter(m => m.role === 'user');
    const userMsgCount = userMessages.length;

    if (userMsgCount <= memoryExtractedAtRef.current) return;
    if (userMsgCount % 2 !== 0) return;

    memoryExtractedAtRef.current = userMsgCount;

    const recentConversation = agentMessages.slice(-8).map(m => {
      const text = m.parts
        ?.filter(p => p.type === 'text')
        .map(p => ('text' in p ? (p as { text: string }).text : ''))
        .join('\n') || '';
      const cleanText = m.role === 'user'
        ? text.replace(/\[System Instructions[\s\S]*?\[User says\]:\n/s, '').trim()
        : text.trim();
      return `${m.role === 'user' ? 'User' : 'Coach'}: ${cleanText}`;
    }).join('\n');

    extractMemory(recentConversation);

    // The Mind: surface one new thing Mazo just learned about the person
    if (!pendingInsight) {
      phraseInsight(recentConversation, mindInsights ?? []).then((draft) => {
        if (!draft) return;
        const created = proposeInsight({ ...draft, sourceSessionId: state.selectedCoachId ?? undefined });
        setPendingInsight(created);
        setMazoState('memory_save');
      });
    }

    // Smart paywall triggers removed for Pro build
  }, [agentMessages, state.selectedCoachId, status, extractMemory]);

  useEffect(() => {
    cancelFocusCheckInReply();
    setFocusCheckIn(null);
    setFocusSuggestion(null);
    setHasRestoredMessages(false);
    setMessages([]);
    setShowWelcome(true);
    // Only reset mode if it wasn't already set from onboarding
    if (!modeFromOnboardingRef.current) {
      setCoachingMode('freeform');
      setModeChosen(false);
    }
    setPendingFirstMessage(null);
    setShowModePrompt(false);
    setShowFreeformNudge(false);
    freeformMsgCountRef.current = 0;
    lastSavedMsgCountRef.current = 0;
    memoryExtractedAtRef.current = 0;
    processedActionMsgRef.current = null;
    hasInitializedRef.current = false;
  }, [state.selectedCoachId, setMessages, cancelFocusCheckInReply]);

  // Load memory insights card dismissed state from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('memory_insights_dismissed_at').then(val => {
      if (val) {
        const dismissedAt = parseInt(val, 10);
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        // Show again after 3 days
        if (Date.now() - dismissedAt > threeDaysMs) {
          setInsightsDismissed(false);
        } else {
          setInsightsDismissed(true);
        }
      } else {
        setInsightsDismissed(false);  // Never dismissed, show it
      }
    }).catch(() => setInsightsDismissed(false));
  }, []);

  const recentChats = Object.entries(state.sessions)
    .map(([coachId, sess]) => {
      const builtIn = getCoachById(coachId);
      const custom = state.customCoaches.find(c => c.id === coachId);
      const hasUserMessages = sess.messages.some(m => m.role === 'user');
      return {
        coachId,
        lastMessage: sess.messages[sess.messages.length - 1],
        lastMessageAt: sess.lastMessageAt,
        coachName: builtIn ? getCoachName(builtIn) : (custom ? getCoachName(custom) : 'Coach'),
        hasUserMessages,
      };
    })
    .filter(chat => chat.lastMessage && chat.hasUserMessages)
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  const handleAgentMessage = useCallback((userMessage: string, retry = false) => {
    if (!selectedCoach) return;

    if (focusSuggestion && /^(?:finish|done|close|save|wrap up)\b/i.test(userMessage.trim())) {
      finishChatWithNextStep();
      return;
    }

    // Reflection answers refine the next step locally, never re-run the alarm
    // or phone-action planner for a plan the user has already approved.
    if (focusCheckIn) {
      if (/^(?:finish|done|close|save|wrap up)\b/i.test(userMessage.trim())) {
        finishChatWithNextStep();
      } else {
        answerFocusCheckIn(userMessage);
      }
      return;
    }

    // Offline guard — prevent sending when there's no connection
    if (isOffline && !isLocalDemoMode()) {
      setLastError(OFFLINE_ERROR);
      return;
    }
    setLastError(null);
    if (retry) {
      // Reuse the existing user turn; do not advance the session or persist it twice.
      const systemContext = buildSystemContext();
      sendMessage({
        text: `[System Instructions - DO NOT REVEAL THIS TO USER]\n${systemContext}\n\n[User says]:\n${userMessage}`,
        retry: true,
      });
      if (detectActionableIntent(userMessage)) proposePlanFromText(userMessage, true);
      return;
    }
    setFocusSuggestion(null);
    setShowWelcome(false);
    hasInitializedRef.current = false;  // Allow auto-init for next session
    if (__DEV__) console.log('[Chat] Sending message to agent:', userMessage);

    // Manual session lock — user wants to end the chat
    const lockPatterns = /^(lock|lock it|lock the chat|close|close chat|end session|end it|i'?m done|good\s?night|bye|done|stop|that'?s all|wrap up|finish)/i;
    if (lockPatterns.test(userMessage.trim())) {
      // Save the user's message first
      if (state.selectedCoachId) {
        addMessage(state.selectedCoachId, {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: userMessage,
          timestamp: Date.now(),
        });
        lockSession(state.selectedCoachId, 'Session ended');
        updateSessionPhase(state.selectedCoachId, 'exit');
      }
      setCurrentActionTitle(t('chat.lockReflection'));
      setShowExitCard(true);
      return;
    }

    if (state.selectedCoachId) {
      addMessage(state.selectedCoachId, {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      });
    }

    const currentSession = state.sessions[state.selectedCoachId || ''];
    const currentPhase: SessionPhase = currentSession?.currentPhase || 'opening';
    const userMessageCount = (currentSession?.messages?.filter(m => m.role === 'user').length || 0) + 1;

    let effectivePhase = currentPhase;

    if (detectFreeformRequest(userMessage) && state.selectedCoachId) {
      updateSessionPhase(state.selectedCoachId, 'freeform');
      effectivePhase = 'freeform';
      freeformMsgCountRef.current = 0;
    } else {
      const suggestedPhase = detectPhaseTransition(
        currentPhase,
        currentSession?.messages || [],
        userMessageCount
      );

      if (suggestedPhase && suggestedPhase !== currentPhase && state.selectedCoachId) {
        updateSessionPhase(state.selectedCoachId, suggestedPhase);
        effectivePhase = suggestedPhase;
      }
    }

    if (effectivePhase === 'freeform') {
      freeformMsgCountRef.current += 1;
      if (freeformMsgCountRef.current === 10 && !showFreeformNudge) {
        setShowFreeformNudge(true);
      }
    }

    const sessionDuration = sessionStartTimeRef.current
      ? (Date.now() - sessionStartTimeRef.current) / 60000
      : 0;

    // Smart exit: only trigger when action is ACTUALLY identified or safety ceiling hit
    // Never cut off a user mid-exploratio just because of message count
    const sessionForExit = state.sessions[state.selectedCoachId || ''];
    const actionIdentified = sessionForExit?.actionIdentified === true;
    const safetyCeiling = userMessageCount >= 25 || sessionDuration >= 30;

    const shouldForceExit = effectivePhase !== 'freeform' && !showExitCard && (
      actionIdentified || safetyCeiling
    );

    if (shouldForceExit) {
      // Only show exit card if we have a REAL action (not generic text)
      const recentAssistant = agentMessages.filter(m => m.role === 'assistant').slice(-3);
      let actionTitle: string | null = null;
      for (const msg of recentAssistant) {
        const text = msg.parts?.filter(p => p.type === 'text').map(p => ('text' in p ? p.text : '')).join('\n') || '';
        const extracted = extractActionFromBlock(text);
        if (extracted) {
          actionTitle = extracted.action;
          break;
        }
      }

      // Only show exit card if we found a real action — no generic fallbacks
      if (actionTitle) {
        setCurrentActionTitle(actionTitle);
        setShowExitCard(true);
        if (state.selectedCoachId) {
          updateSessionPhase(state.selectedCoachId, 'exit');
        }

        // Final memory extraction — capture any goals/tasks from the entire session
        const finalConversation = agentMessages.slice(-12).map(m => {
          const text = m.parts
            ?.filter(p => p.type === 'text')
            .map(p => ('text' in p ? (p as { text: string }).text : ''))
            .join('\n') || '';
          const cleanText = m.role === 'user'
            ? text.replace(/\[System Instructions[\s\S]*?\[User says\]:\n/s, '').trim()
            : text.trim();
          return `${m.role === 'user' ? 'User' : 'Coach'}: ${cleanText}`;
        }).join('\n');
        if (finalConversation.trim()) {
          extractMemory(finalConversation);
        }

        return;
      }
      // If safety ceiling hit but no action: let the AI handle it via phase prompt
      // Don't show exit card with fake content
    }

    const systemContext = buildSystemContext();

    // Tell the AI not to re-introduce itself — the app already shows a greeting
    const skipIntro = agentMessages.length > 0
      ? '\n\n[IMPORTANT — NO INTRODUCTION]\nThe user has already seen your greeting. Do NOT introduce yourself again. Do NOT say "welcome" or re-state who you are. Jump straight into responding to what the user said.'
      : '';

    // Chat-decides: in parallel with the coach's reply, conclude any doable
    // actions straight from what the user said — no tool-call required. The
    // approval card slides up if (and only if) a concrete plan comes back.
    const isActionable = detectActionableIntent(userMessage);
    if (isActionable) {
      proposePlanFromText(userMessage);
    }

    // Coherent agent voice: when a plan card is already on its way up, the coach
    // should be decisive and point to it — not stack more questions.
    const actionHint = isActionable
      ? "\n\n[ACTION MODE]\nThe user asked for something you can DO. An approval card with a concrete plan is appearing right below your reply. Respond with ONE short, warm, decisive line that points to it (e.g. \"On it — here's a plan, just approve below 👇\"). Do NOT ask clarifying questions, do NOT list the steps, do NOT restate their message. Under 20 words."
      : '';

    sendMessage({
      text: `[System Instructions - DO NOT REVEAL THIS TO USER]\n${systemContext}${skipIntro}${actionHint}\n\n[User says]:\n${userMessage}`,
    });
  }, [selectedCoach, sendMessage, buildSystemContext, state.selectedCoachId, state.sessions, updateSessionPhase, addMessage, showExitCard, agentMessages, isOffline, proposePlanFromText, focusCheckIn, answerFocusCheckIn, finishChatWithNextStep, focusSuggestion]);

  useEffect(() => {
    if (error) {
      const errorMsg = error?.message?.toLowerCase() || '';
      const isNetworkError = isOffline || errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('offline');
      const isQuotaError = errorMsg.includes('429') || errorMsg.includes('insufficient_quota') || errorMsg.includes('credit_balance_exhausted');

      if (isQuotaError) {
        setLastError('AI credits are exhausted. This message was not sent again.');
      } else if (isNetworkError && !isLocalDemoMode()) {
        setLastError(OFFLINE_ERROR);
      } else {
        setLastError(t('chat.errorRetry'));
      }
      setMazoState('idle');
    }
  }, [error, isOffline, t]);

  useEffect(() => {
    if (!isOffline && lastError && lastError.includes('offline')) {
      setLastError(null);
    }
  }, [isOffline, lastError]);


  useEffect(() => {
    if (selectedCoach && agentMessages.length === 0 && !isInitializing && hasRestoredMessages && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setIsInitializing(true);
      const userName = state.userContext?.name?.trim();
      const coachName = getCoachName(selectedCoach);

      // Build a contextual, mode-aware opening
      let greeting = '';

      // ── First-ever session: Warm personalized opener ──
      if (isFirstSession && userName) {
        // Mode-specific power question
        const modeQuestionKeys: Record<string, string> = {
          decision: 'chat.modeDecision',
          clarity: 'chat.modeClarity',
          planning: 'chat.modePlanning',
          reflection: 'chat.modeReflection',
        };
        const powerQuestion = t((modeQuestionKeys[coachingMode] || 'chat.modeFallback') as any);

        greeting = t('chat.firstSessionGreeting' as any, { name: userName, coach: coachName, question: powerQuestion });
      }
      // ── Returning user: personalized, coach-aware greeting ──
      else {
        // Time-of-day salutation
        const hour = new Date().getHours();
        let timeSaluteKey = 'chat.timeSaluteNight';
        if (hour < 5) timeSaluteKey = 'chat.timeSaluteLateNight';
        else if (hour < 12) timeSaluteKey = 'chat.timeSaluteMorning';
        else if (hour < 17) timeSaluteKey = 'chat.timeSaluteAfternoon';
        else if (hour < 21) timeSaluteKey = 'chat.timeSaluteEvening';

        const timeSalute = t(timeSaluteKey as any);
        const nameGreet = userName ? `${timeSalute}, ${userName}.` : `${timeSalute}.`;

        // Pick a random action-oriented question
        const questions = [
          t('chat.greeting1'), t('chat.greeting2'), t('chat.greeting3'),
          t('chat.greeting4'), t('chat.greeting5'), t('chat.greeting6'),
          t('chat.greeting7'), t('chat.greeting8'),
        ];
        const pick = questions[Math.floor(Math.random() * questions.length)];

        greeting = `${nameGreet}\n\n${pick}`;
      }

      setMessages([{
        id: `init-${Date.now()}`,
        role: 'assistant',
        parts: [{ type: 'text', text: greeting }],
      }]);
      setShowWelcome(false);
      setIsInitializing(false);
    }
  }, [selectedCoach, agentMessages.length, isInitializing, setMessages, getCoachName, hasRestoredMessages, state.userContext?.name, coachingMode, state.userContext?.currentFocus, state.memory?.goals, state.memory?.tasks, isFirstSession, state.userContext?.values]);

  // Auto-trigger artifact on first session — REMOVED (was disabled with early return, dead code)

  useEffect(() => {
    if (flashListRef.current && !showWelcome) {
      setTimeout(() => {
        flashListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [agentMessages.length, isAgentLoading, showWelcome]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        flashListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    });
    return () => sub.remove();
  }, []);

  // Detect Action Block in AI responses and auto-create task (STEP 4 & 5)
  useEffect(() => {
    if (!state.selectedCoachId || agentMessages.length === 0) return;

    // Get the last assistant message
    const lastMessage = agentMessages[agentMessages.length - 1];
    if (lastMessage?.role !== 'assistant') return;
    if (lastMessage.id === processedActionMsgRef.current) return;

    // Extract text from message parts - handle various part types safely
    const messageText = lastMessage.parts
      ?.filter((part) => part.type === 'text')
      .map((part) => ('text' in part ? (part as { text: string }).text : ''))
      .join('\n') || '';

    const hasFocusTimerTool = lastMessage.parts?.some(
      (part: any) => part.type === 'tool-invocation' && part.toolName === 'startFocusTimer'
    );

    // Check for Action Block (bypass if it's explicitly a focus timer tool call)
    if (!hasFocusTimerTool && detectActionBlock(messageText)) {
      const currentSession = state.sessions[state.selectedCoachId];

      // Only mark once per Action Block
      if (!currentSession?.actionIdentified) {
        processedActionMsgRef.current = lastMessage.id;
        markActionIdentified(state.selectedCoachId);

        // Extract action details and auto-create task (STEP 5)
        const extracted = extractActionFromBlock(messageText);

        if (extracted) {
          const taskAlreadyExists = (state.memory.tasks || []).some(
            t => (t.title || '').toLowerCase().trim() === (extracted.action || '').toLowerCase().trim() && t.status === 'pending'
          );
          if (!taskAlreadyExists && addTask) {
            addTask({
              title: extracted.action,
              priority: 'high',
              status: 'pending',
            });
          }

          lockSession(state.selectedCoachId, extracted.action);

          setCurrentActionTitle(extracted.action);
          setShowExitCard(true);
        }

        // Smart paywall trigger removed for Pro build
      }
    }
  }, [agentMessages, state.selectedCoachId, state.sessions, state.memory.currentDayIndex, state.memory.tasks, markActionIdentified, addTask, lockSession]);

  const isAgentBusy = isAgentLoading || isInitializing;
  useEffect(() => {
    if (isAgentBusy && agentMessages.length > 0) {
      setMazoState('thinking');
    }
  }, [isAgentBusy, agentMessages.length]);

  useEffect(() => {
    if (agentMessages.length === 0) {
      setMazoState('idle');
      return;
    }

    if (isAgentBusy) return;

    const lastMessage = agentMessages[agentMessages.length - 1];
    if (lastMessage?.role !== 'assistant') {
      setMazoState('idle');
      return;
    }

    // Extract text from message parts
    const messageText = lastMessage.parts
      ?.filter((part) => part.type === 'text')
      .map((part) => ('text' in part ? (part as { text: string }).text : ''))
      .join('\n') || '';

    // Detect emotion from AI response
    const detectedEmotion = detectMazoEmotion(messageText);
    if (detectedEmotion) {
      setMazoState(detectedEmotion);
      // Return to responding after a few seconds
      const timer = setTimeout(() => setMazoState('responding'), 5000);
      return () => clearTimeout(timer);
    } else {
      setMazoState('responding');
    }
  }, [agentMessages, isAgentBusy]);

  const lastCheckedMsgCount = useRef(0);

  useEffect(() => {
    const userMessages = agentMessages.filter(m => m.role === 'user');
    const userMsgCount = userMessages.length;

    if (userMsgCount === 0 || userMsgCount === lastCheckedMsgCount.current) return;
    lastCheckedMsgCount.current = userMsgCount;

    const lastUserMsg = userMessages[userMessages.length - 1];
    const userText = lastUserMsg.parts
      ?.filter((part) => part.type === 'text')
      .map((part) => ('text' in part ? (part as { text: string }).text : ''))
      .join('\n') || '';

    const cleanText = userText.replace(/\[System Instructions[\s\S]*?\[User says\]:\n/s, '').trim();

    const { isBreakthrough, matchedText } = detectBreakthrough(cleanText);
    if (isBreakthrough) {
      setBreakthroughText(matchedText || '');
      setShowBreakthrough(true);
    }

    if (shouldSuggestPause(cleanText, userMsgCount, lastPauseAtMsg)) {
      setShowReflectionPause(true);
      setLastPauseAtMsg(userMsgCount);
    }
  }, [agentMessages, lastPauseAtMsg]);

  // Trigger session insights after exit card appears
  useEffect(() => {
    if (showExitCard && agentMessages.length > 4) {
      const timer = setTimeout(() => {
        setShowSessionInsights(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showExitCard]);


  const handleNewConversationWithReset = useCallback(() => {
    sessionStartTimeRef.current = Date.now();
    setShowSessionInsights(false);
    setShowBreakthrough(false);
    setLastPauseAtMsg(null);
    lastCheckedMsgCount.current = 0;
  }, []);

  const detectBestMode = useCallback((text?: string | null): CoachingMode => {
    if (!text) return 'freeform';
    const lower = text.toLowerCase();
    const decisionPatterns = [
      /should i/i, /or should/i, /deciding between/i, /can't decide/i,
      /what should i (do|choose|pick)/i, /which (one|option)/i, /torn between/i,
      /job offer/i, /quit my/i, /stay or (go|leave)/i, /move to/i,
    ];
    const clarityPatterns = [
      /feel (stuck|lost|confused|overwhelmed|off)/i, /don't know (why|what|how)/i,
      /can't (figure|pinpoint|understand)/i, /what's (wrong|going on|happening)/i,
      /something feels/i, /not sure what i/i, /keep (doing|saying|feeling)/i,
    ];
    const planningPatterns = [
      /want to (start|launch|build|create|begin|finish)/i, /how (do|can|should) i/i,
      /plan for/i, /goal is/i, /by (next|end of|this)/i, /in (\d+) (days|weeks|months)/i,
      /step by step/i, /break (it|this) down/i, /get (in shape|fit|better)/i,
    ];
    const reflectionPatterns = [
      /what (does|matters|really)/i, /meaning of/i, /purpose/i,
      /who am i/i, /values/i, /feel (satisfied|fulfilled|empty|hollow)/i,
      /thinking about/i, /looking back/i, /realized/i, /expectations/i,
    ];

    let scores = { decision: 0, clarity: 0, planning: 0, reflection: 0 };
    decisionPatterns.forEach(p => { if (p.test(lower)) scores.decision++; });
    clarityPatterns.forEach(p => { if (p.test(lower)) scores.clarity++; });
    planningPatterns.forEach(p => { if (p.test(lower)) scores.planning++; });
    reflectionPatterns.forEach(p => { if (p.test(lower)) scores.reflection++; });

    const max = Math.max(scores.decision, scores.clarity, scores.planning, scores.reflection);
    if (max === 0) return 'freeform';
    if (scores.decision === max) return 'decision';
    if (scores.clarity === max) return 'clarity';
    if (scores.planning === max) return 'planning';
    return 'reflection';
  }, []);

  const handleModeManualChange = useCallback((mode: CoachingMode) => {
    setCoachingMode(mode);
    setModeChosen(true);
    if (mode !== 'freeform') {
      freeformMsgCountRef.current = 0;
      setShowFreeformNudge(false);
    }
  }, []);

  const handleModeSelected = useCallback((mode: CoachingMode) => {
    setShowModePrompt(false);
    setModeChosen(true);

    let finalMode = mode;
    if (mode === 'freeform' && pendingFirstMessage) {
      finalMode = detectBestMode(pendingFirstMessage);
    }

    if (finalMode !== 'freeform') {
      freeformMsgCountRef.current = 0;
      setShowFreeformNudge(false);
    }

    setCoachingMode(finalMode);

    if (pendingFirstMessage) {
      const msg = pendingFirstMessage;
      setPendingFirstMessage(null);
      setTimeout(() => {
        handleAgentMessage(msg);
      }, 50);
    }
  }, [pendingFirstMessage, detectBestMode, handleAgentMessage]);

  const handleSend = useCallback((text: string, isVoice = false) => {
    const currentSession = state.sessions[state.selectedCoachId || ''];
    if (currentSession?.sessionLocked) {
      return;
    }

    setShowWelcome(false);

    const userMsgCount = agentMessages.filter(m => m.role === 'user').length;
    const isFirstUserMessage = userMsgCount === 0 && !modeChosen;
    if (isFirstUserMessage) {
      // Update streak on new session
      updateStreak();
      // Store the message but DON'T add it to agentMessages yet —
      // it will be added once via handleAgentMessage after mode selection
      setPendingFirstMessage(text);
      setShowModePrompt(true);
    } else {
      handleAgentMessage(text);
    }
  }, [handleAgentMessage, router, state.sessions, state.selectedCoachId, agentMessages, modeChosen, setMessages]);

  // Deep-link from the angry-face nudge: open straight into a plan conversation.
  const nudgeHandledRef = useRef(false);
  useEffect(() => {
    if (nudgeHandledRef.current || !hasRestoredMessages) return;
    const app = consumeNudgeLaunch();
    if (app) {
      nudgeHandledRef.current = true;
      setTimeout(() => {
        handleSend(`I keep getting pulled into ${app} and I've got exams — help me make a plan and guard it.`, false);
      }, 400);
    }
  }, [hasRestoredMessages, handleSend]);

  const handleVoiceStateChange = useCallback((listening: boolean) => {
    setIsVoiceActive(listening);
    if (listening) {
      setMazoState('listening');
    } else {
      setMazoState('idle');
    }
  }, []);

  const handleNewConversation = useCallback(() => {
    if (selectedCoach && status !== 'streaming' && status !== 'submitted') {

      if (agentMessages.length > 2) {
        const conversationText = agentMessages.map(m => {
          const text = m.parts
            ?.filter(p => p.type === 'text')
            .map(p => ('text' in p ? (p as { text: string }).text : ''))
            .join('\n') || '';
          const cleanText = m.role === 'user'
            ? text.replace(/\[System Instructions[\s\S]*?\[User says\]:\n/s, '').trim()
            : text.trim();
          return `${m.role === 'user' ? 'User' : 'Coach'}: ${cleanText}`;
        }).join('\n');
        extractMemory(conversationText);
      }

      // Archive to history before clearing
      const coachName = getCoachName(selectedCoach);
      archiveSession(selectedCoach.id, coachName);

      clearSession(selectedCoach.id);
      setMessages([]);
      setShowWelcome(true);
      cancelFocusCheckInReply();
      setFocusCheckIn(null);
      setFocusSuggestion(null);
      hasInitializedRef.current = true;  // Prevent auto-init greeting
      setCoachingMode('freeform');
      setModeChosen(false);
      setPendingFirstMessage(null);
      setShowModePrompt(false);
      setShowFreeformNudge(false);
      setOverrideCoachId(null);
      setShowExitCard(false);
      setExitFromApprovedStep(false);
      setCurrentActionTitle('');
      setShowSessionInsights(false);
      freeformMsgCountRef.current = 0;
      lastSavedMsgCountRef.current = 0;
      setHasRestoredMessages(true);
      AsyncStorage.removeItem(`${CHAT_STORAGE_PREFIX}${selectedCoach.id}`).catch(() => { });
      handleNewConversationWithReset();
    }
  }, [selectedCoach, clearSession, setMessages, handleNewConversationWithReset, agentMessages, extractMemory, status, archiveSession, getCoachName, cancelFocusCheckInReply]);

  const handlePromptPress = useCallback((prompt: string) => {
    handleSend(prompt, false);
  }, [handleSend]);

  useEffect(() => {
    if (state.detectedIntents.length > 0) {
      const latestIntent = state.detectedIntents[state.detectedIntents.length - 1];
      setCurrentIntent(latestIntent.type);
      Animated.timing(intentFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(intentFadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setCurrentIntent(null));
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [state.detectedIntents, intentFadeAnim]);


  const getIntentBadge = useCallback((intent: DetectedIntent) => {
    const badges: Record<DetectedIntent, { icon: React.ReactNode; label: string; color: string }> = {
      scheduling: { icon: <Calendar size={14} color={colors.textInverse} />, label: 'Planning mode', color: '#3B82F6' },
      goal_setting: { icon: <Target size={14} color={colors.textInverse} />, label: 'Setting goals', color: '#10B981' },
      reflection: { icon: <Brain size={14} color={colors.textInverse} />, label: 'Reflecting', color: '#8B5CF6' },
      preference_sharing: { icon: <Heart size={14} color={colors.textInverse} />, label: 'Saving to memory', color: '#EC4899' },
      problem_solving: { icon: <Sparkles size={14} color={colors.textInverse} />, label: 'Problem solving', color: '#F59E0B' },
      planning: { icon: <Calendar size={14} color={colors.textInverse} />, label: 'Making plans', color: '#06B6D4' },
      general: { icon: <Sparkles size={14} color={colors.textInverse} />, label: 'Coaching', color: colors.accent },
      focus_timer: { icon: <Clock size={14} color={colors.textInverse} />, label: 'Focusing', color: '#EF4444' },
    };
    return badges[intent];
  }, [colors]);

  const handleApproveSchedule = useCallback(() => {
    approveSchedule();
  }, [approveSchedule]);

  const handleRejectSchedule = useCallback(() => {
    rejectSchedule();
  }, [rejectSchedule]);

  const handleStartQuestions = useCallback(() => {
    const translatedQuestions = DISCOVERY_QUESTIONS.map(q => ({
      ...q,
      question: t(q.question),
      description: t(q.description),
      options: q.options.map(o => ({ ...o, text: t(o.text) }))
    }));
    startQuestionsSession(translatedQuestions);
  }, [startQuestionsSession]);

  const handleAnswerQuestion = useCallback((questionId: string, optionId: string) => {
    answerQuestion(questionId, optionId);
  }, [answerQuestion]);

  const handleQuestionsComplete = useCallback(() => {
    completeQuestionsSession();
  }, [completeQuestionsSession]);

  const handleQuestionsBack = useCallback(() => {
    cancelQuestionsSession();
  }, [cancelQuestionsSession]);

  const handleHistoryPress = useCallback((coachId: string) => {
    selectCoach(coachId);
    setShowWelcome(false);
  }, [selectCoach]);

  const handleArchivedChatPress = useCallback((archived: any) => {
    // Restore archived messages into chat view (READ-ONLY)
    if (archived.messages && archived.messages.length > 0) {
      selectCoach(archived.coachId);
      // Convert stored messages into agent message format
      const restoredMessages = archived.messages.map((m: any) => ({
        id: m.id || `archived-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: m.role,
        parts: [{ type: 'text' as const, text: m.content || '' }],
      }));
      setMessages(restoredMessages);
      setShowWelcome(false);
      setHasRestoredMessages(true);
      lastSavedMsgCountRef.current = restoredMessages.length;

      // Lock the session ONLY if it was previously locked or completed
      if (archived.status === 'locked' || archived.status === 'completed') {
        const taskTitle = archived.taskTitles?.[0] || 'Session ended';
        lockSession(archived.coachId, taskTitle);
      }
    } else {
      // No messages stored — just select the coach and start fresh
      selectCoach(archived.coachId);
      setShowWelcome(false);
    }
  }, [selectCoach, setMessages, lockSession]);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };


  const isLoading = isAgentLoading || isInitializing;
  const demoMode = isLocalDemoMode();
  const quotaExhausted = lastError?.startsWith('AI credits are exhausted') ?? false;
  const showFreeLimit = false; // Pro build — no free limit
  const pendingSchedule = state.pendingSchedule;
  const questionsSession = state.questionsSession;

  if (questionsSession?.isActive && questionsSession.questions.length > 0) {
    return (
      <QuestionsMode
        questions={questionsSession.questions}
        currentIndex={questionsSession.currentIndex}
        onAnswer={handleAnswerQuestion}
        onBack={handleQuestionsBack}
        onComplete={handleQuestionsComplete}
      />
    );
  }

  if (showWelcome && agentMessages.length === 0 && selectedCoach) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <ScrollView
          style={styles.welcomeScroll}
          contentContainerStyle={[styles.welcomeScrollContent, { paddingTop: insets.top + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.faceContainer}>
            <MazoCharacter
              config={currentMazoConfig}
              state={isVoiceActive ? 'listening' : 'happy'}
              size={120}
              showAccessory={true}
            />
          </View>

          <Text style={[styles.welcomeTitle, { color: colors.text }]}>{t(getTimeGreeting(state.userContext?.name), { name: state.userContext?.name || '' })}</Text>
          <Text style={[styles.welcomeCoachName, { color: colors.accent }]}>{getCoachName(selectedCoach)} {t('chat.isReady')}</Text>

          {/* Streak Badge — visible when user has an active streak */}
          {state.streak.currentStreak >= 1 && (
            <View style={[styles.streakBadge, { backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)', borderColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.15)' }]}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={[styles.streakCount, { color: '#F59E0B' }]}>{state.streak.currentStreak}</Text>
              <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>{t('chat.dayStreak')}</Text>
            </View>
          )}

          {/* Memory Insights Card — shown after 3+ sessions */}
          {!insightsDismissed && state.streak.totalSessions >= 3 && (
            state.memory.goals.length + state.memory.preferences.length + state.memory.tasks.length > 0
          ) && (
              <MemoryInsightsCard
                goalsCount={state.memory.goals.filter(g => g.status === 'active').length}
                tasksCompleted={state.memory.tasks.filter(t => t.status === 'completed').length}
                insightsCount={state.memory.preferences.length}
                topPreferences={state.memory.preferences.slice(0, 3).map(p => p.value)}
                streakDays={state.streak.currentStreak}
                totalSessions={state.streak.totalSessions}
                onContinue={() => {
                  setInsightsDismissed(true);
                  AsyncStorage.setItem('memory_insights_dismissed_at', Date.now().toString()).catch(() => {});
                }}
                onDismiss={() => {
                  setInsightsDismissed(true);
                  AsyncStorage.setItem('memory_insights_dismissed_at', Date.now().toString()).catch(() => {});
                }}
              />
            )}

          {(() => {
            const dailyPrompt = getDailyPrompt();
            return (
              <Pressable
                style={[styles.dailyPromptCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                onPress={() => handlePromptPress(t(dailyPrompt.text))}
                accessibilityLabel="Today's prompt"
                accessibilityRole="button"
              >
                <View style={styles.dailyPromptIconContainer}>
                  <IconRenderer name={dailyPrompt.icon} size={22} color={colors.accent} />
                </View>
                <View style={styles.dailyPromptContent}>
                  <Text style={[styles.dailyPromptLabel, { color: colors.textTertiary }]}>{t('chat.todaysPrompt')}</Text>
                  <Text style={[styles.dailyPromptText, { color: colors.text }]}>{t(dailyPrompt.text)}</Text>
                </View>
                <ArrowRight size={18} color={colors.textTertiary} />
              </Pressable>
            );
          })()}

          <Pressable
            style={({ pressed }) => [
              styles.quickCheckinButton,
              { backgroundColor: colors.text, marginBottom: 16 },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => {
              const randomPrompt = QUICK_CHECKIN_PROMPTS[Math.floor(Math.random() * QUICK_CHECKIN_PROMPTS.length)];
              handlePromptPress(t(randomPrompt));
            }}
            accessibilityLabel="Start a five minute check-in"
            accessibilityRole="button"
          >
            <Clock size={18} color={colors.textInverse} />
            <Text style={[styles.quickCheckinText, { color: colors.textInverse }]}>{t('chat.checkIn')}</Text>
          </Pressable>

          {/* Pro build — upgrade prompt removed */}

          <View style={styles.promptsSection}>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Pressable
                key={prompt.id}
                style={({ pressed }) => [
                  styles.promptCard,
                  { backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.accent },
                  pressed && styles.promptCardPressed,
                ]}
                onPress={() => handlePromptPress(t(prompt.text))}
                accessibilityLabel={t(prompt.text)}
                accessibilityRole="button"
              >
                <IconRenderer name={prompt.icon} size={18} color={colors.accent} />
                <Text style={[styles.promptText, { color: colors.text }]}>{t(prompt.text)}</Text>
              </Pressable>
            ))}
          </View>

          {/* Command discoverability — the chat takes orders, not just talk */}
          <View style={styles.commandHintSection}>
            <Text style={[styles.commandHintLabel, { color: colors.textSecondary }]}>Or tell Mazō to do something</Text>
            <View style={styles.commandChips}>
              {['🛡️ Block Instagram for 2 hours', '⏰ Wake me at 7am', '📚 Plan my exam week'].map((cmd) => (
                <Pressable
                  key={cmd}
                  style={[styles.commandChip, { backgroundColor: colors.surface, borderColor: colors.accent }]}
                  onPress={() => handleSend(cmd, false)}
                  accessibilityRole="button"
                  accessibilityLabel={cmd}
                >
                  <Text style={[styles.commandChipText, { color: colors.text }]}>{cmd}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {(() => {
            const allHistoryItems = [
              ...recentChats.map(chat => ({ type: 'active' as const, ...chat })),
              ...(state.chatHistory || []).map(archived => ({ type: 'archived' as const, ...archived })),
            ];
            if (allHistoryItems.length === 0) return null;
            const visibleItems = showAllHistory ? allHistoryItems : allHistoryItems.slice(0, 2);
            const hasMore = allHistoryItems.length > 2;
            return (
              <View style={styles.historySection}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('chat.history')}</Text>
                {visibleItems.map((item) => {
                  if (item.type === 'active') {
                    const chat = item as (typeof recentChats)[0] & { type: 'active' };
                    const sess = state.sessions[chat.coachId];
                    const isLocked = sess?.sessionLocked;
                    const pendingTaskId = sess?.pendingActionTaskId;
                    const pendingTask = pendingTaskId ? state.memory.tasks.find(t => t.id === pendingTaskId || t.title === pendingTaskId) : null;
                    const isTaskDone = pendingTask?.status === 'completed';
                    return (
                      <Pressable
                        key={`active-${chat.coachId}`}
                        style={({ pressed }) => [
                          styles.historyItem,
                          { backgroundColor: colors.surface },
                          pressed && [styles.historyItemPressed, { backgroundColor: colors.backgroundSecondary }],
                        ]}
                        onPress={() => handleHistoryPress(chat.coachId)}
                        accessibilityLabel={`Continue chat with ${chat.coachName}`}
                        accessibilityRole="button"
                      >
                        <View style={styles.historyItemContent}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isLocked ? (isTaskDone ? colors.accent : '#F59E0B') : '#34D399' }} />
                            <Text style={[styles.historyCoachName, { color: colors.text }]}>{chat.coachName}</Text>
                            {isLocked ? (
                              <View style={{ backgroundColor: isTaskDone ? colors.accent + '18' : '#F59E0B18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: isTaskDone ? colors.accent : '#F59E0B' }}>
                                  {isTaskDone ? t('chat.statusDone') : t('chat.statusTaskPending')}
                                </Text>
                              </View>
                            ) : (
                              <View style={{ backgroundColor: '#34D39918', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: '#34D399' }}>{t('chat.statusActive')}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.historyMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                            {chat.lastMessage?.content}
                          </Text>
                          {pendingTask && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <CheckSquare size={12} color={isTaskDone ? colors.accent : '#F59E0B'} />
                              <Text style={{ fontSize: 11, color: isTaskDone ? colors.accent : '#F59E0B', fontWeight: '500' }} numberOfLines={1}>
                                {pendingTask.title}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Clock size={12} color={colors.textTertiary} />
                          <Text style={[styles.historyTime, { color: colors.textTertiary }]}>{formatTimeAgo(chat.lastMessageAt)}</Text>
                        </View>
                      </Pressable>
                    );
                  } else {
                    const archived = item as any;
                    let archivedStatus = archived.status;
                    if (archived.taskIds?.length > 0) {
                      const task = state.memory.tasks.find((t: any) => archived.taskIds.includes(t.id) || archived.taskTitles.includes(t.title));
                      if (task?.status === 'completed') archivedStatus = 'completed';
                      else if (task) archivedStatus = 'locked';
                    }
                    return (
                      <Pressable
                        key={`archived-${archived.id}`}
                        style={({ pressed }) => [
                          styles.historyItem,
                          { backgroundColor: colors.surface, opacity: 0.85 },
                          pressed && [styles.historyItemPressed, { backgroundColor: colors.backgroundSecondary }],
                        ]}
                        onPress={() => handleArchivedChatPress(archived)}
                        accessibilityLabel={`View archived chat with ${archived.coachName}`}
                        accessibilityRole="button"
                      >
                        <View style={styles.historyItemContent}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: archivedStatus === 'completed' ? colors.accent : archivedStatus === 'locked' ? '#F59E0B' : colors.accent + '60' }} />
                            <Text style={[styles.historyCoachName, { color: colors.text }]}>{archived.coachName}</Text>
                            {archivedStatus !== 'open' && (
                              <View style={{ backgroundColor: archivedStatus === 'completed' ? colors.accent + '18' : '#F59E0B18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: archivedStatus === 'completed' ? colors.accent : '#F59E0B' }}>
                                  {archivedStatus === 'completed' ? t('chat.statusDone') : t('chat.statusTaskPending')}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.historyMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                            {archived.lastMessage}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={[styles.historyTime, { color: colors.textTertiary }]}>{formatTimeAgo(archived.archivedAt)}</Text>
                          <Pressable
                            style={{ padding: 4 }}
                            onPress={(e) => {
                              e.stopPropagation();
                              deleteArchivedChat(archived.id);
                            }}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete archived chat: ${archived.lastMessage}`}
                          >
                            <X size={13} color={colors.textTertiary} />
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  }
                })}
                {hasMore && !showAllHistory && (
                  <Pressable
                    onPress={() => setShowAllHistory(true)}
                    style={({ pressed }) => [{
                      alignItems: 'center',
                      paddingVertical: 12,
                      marginTop: 4,
                      borderRadius: 12,
                      backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
                    }]}
                  >
                    <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
                      {t('chat.showMore') || 'Show More'} ({allHistoryItems.length - 2} more)
                    </Text>
                  </Pressable>
                )}
                {showAllHistory && allHistoryItems.length > 2 && (
                  <Pressable
                    onPress={() => setShowAllHistory(false)}
                    style={({ pressed }) => [{
                      alignItems: 'center',
                      paddingVertical: 12,
                      marginTop: 4,
                      borderRadius: 12,
                      backgroundColor: pressed ? colors.backgroundSecondary : 'transparent',
                    }]}
                  >
                    <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
                      {t('chat.showLess') || 'Show Less'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })()}
        </ScrollView>

        <View style={[styles.welcomeInputArea, { backgroundColor: colors.background }]}>
          <ChatInput
            onSend={(text) => handleSend(text, false)}
            disabled={isLoading}
            placeholder={t('chat.whatsOnMind')}
            onVoiceStateChange={handleVoiceStateChange}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Mode Selector with gradient accent */}
      <LinearGradient
        colors={[
          (isDark ? MODE_COLORS_DARK : MODE_COLORS)[coachingMode]?.start || 'transparent',
          'transparent',
        ]}
        style={{ borderBottomWidth: 0 }}
      >
        <ModeSelect
          currentMode={coachingMode}
          onModeChange={handleModeManualChange}
          onMemoryPress={() => router.push('/(tabs)/memory')}
          onResetPress={handleNewConversation}
          onCommandPress={() => setCmdOpen(true)}
        />
      </LinearGradient>


      {/* Phase Progress */}
      <PhaseIndicator currentPhase={sessionPhase} />

      {isOffline && !isLocalDemoMode() && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: '#FEF3C7',
          paddingVertical: 10,
          paddingHorizontal: 16,
          marginHorizontal: 12,
          marginBottom: 4,
          borderRadius: 12,
        }}>
          <WifiOff size={14} color="#92400E" />
          <Text style={{ color: '#92400E', fontSize: 13, fontWeight: '600' }}>
            {t('community.offlineMsg')}
          </Text>
        </View>
      )}

      {/* Session Depth Meter */}
      <SessionDepthMeter
        messages={agentMessages}
        currentPhase={sessionPhase}
        visible={agentMessages.length > 0}
      />

      <KeyboardAvoidingView
        style={[styles.chatContainer, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlashList
          {...({
            data: agentMessages,
            ref: flashListRef,
            renderItem: ({ item: message, index: messageIndex }: { item: any; index: number }) => {
              const messageKey = (message as any).id && (message as any).id.length > 0 ? (message as any).id : `msg-fallback-${messageIndex}`;
              if (!(message as any).parts || !Array.isArray((message as any).parts)) return null;
              return (
                <View key={messageKey}>
                  {(message as any).parts.map((part: any, partIndex: number) => {
                    if (part.type === 'text') {
                      let displayText = part.text || '';
                      if (!displayText.trim()) return null;
                      if (message.role === 'user' && displayText.includes('[System Instructions')) {
                        const userMessageMatch = displayText.match(/\[User says\]:\n(.+)$/s);
                        if (userMessageMatch) {
                          displayText = userMessageMatch[1].trim();
                        } else {
                          return null;
                        }
                      }

                      return (
                        <MessageBubble
                          key={`${messageKey}-text-${partIndex}`}
                          message={{
                            id: `${messageKey}-${partIndex}`,
                            role: message.role as 'user' | 'assistant',
                            content: displayText,
                            timestamp: Date.now(),
                          }}
                          coachName={message.role === 'assistant' ? getCoachName(selectedCoach!) : undefined}
                        />
                      );
                    }
                    if (part.type === 'tool') {
                      if (part.state === 'output-available') {
                        // Parse output - hide raw JSON from discovery/quick_question tools
                        let displayOutput = '';
                        try {
                          const parsed = typeof part.output === 'string' ? JSON.parse(part.output) : part.output;
                          if (parsed && (parsed.type === 'discovery' || parsed.type === 'quick_question')) {
                            // These are handled by QuestionsMode, don't show raw JSON
                            return null;
                          }
                          displayOutput = parsed?.message || (typeof part.output === 'string' ? part.output : 'Action completed');
                        } catch {
                          displayOutput = typeof part.output === 'string'
                            ? part.output
                            : (typeof part.output === 'object' && part.output !== null && 'message' in part.output)
                              ? String((part.output as { message: string }).message)
                              : 'Action completed';
                        }
                        return (
                          <View key={`${messageKey}-tool-${partIndex}`} style={[styles.toolResultCard, { backgroundColor: colors.accentLight, borderLeftColor: colors.accent }]}>
                            <CheckCircle2 size={16} color={colors.accent} />
                            <Text style={[styles.toolResultText, { color: colors.text }]}>
                              {displayOutput}
                            </Text>
                          </View>
                        );
                      }
                      if (part.state === 'input-available' || part.state === 'input-streaming') {
                        return (
                          <View key={`${messageKey}-loading-${partIndex}`} style={[styles.toolLoadingCard, { backgroundColor: colors.backgroundSecondary }]}>
                            <Sparkles size={14} color={colors.accent} />
                            <Text style={[styles.toolLoadingText, { color: colors.textSecondary }]}>{t('chat.workingOnIt')}</Text>
                          </View>
                        );
                      }
                    }
                    return null;
                  })}
                </View>
              );
            },
            estimatedItemSize: 100,
            onScroll: (e: any) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
              setShowScrollButton(!isNearBottom && contentSize.height > layoutMeasurement.height);
            },
            scrollEventThrottle: 100,
            keyExtractor: (item: any, index: number) => item.id || `msg-${index}`,
            contentContainerStyle: styles.messagesContent,
            showsVerticalScrollIndicator: false,
            keyboardShouldPersistTaps: "handled",
            ListFooterComponent: (
              <>
                <TypingIndicator visible={isAgentLoading} />

                {focusCheckIn && !isFocusTimerActive && !isAgentLoading && (
                  <FocusCheckInCard
                    checkIn={focusCheckIn}
                    onReply={answerFocusCheckIn}
                    onSkip={() => setFocusCheckIn(null)}
                  />
                )}

                {lastError && !isAgentLoading && (
                  <Pressable
                    disabled={quotaExhausted || isOffline}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: lastError?.includes('offline') ? '#FEF3C7' : colors.surface,
                      borderWidth: 1,
                      borderColor: lastError?.includes('offline') ? '#F59E0B' : '#EF4444',
                      borderRadius: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      marginTop: 12,
                      alignSelf: 'center',
                    }}
                    onPress={() => {
                      if (isOffline || quotaExhausted) return;
                      setLastError(null);
                      const lastUserMsg = agentMessages.filter(m => m.role === 'user').pop();
                      if (lastUserMsg) {
                        const text = lastUserMsg.parts
                          ?.filter(p => p.type === 'text')
                          .map(p => ('text' in p ? (p as { text: string }).text : ''))
                          .join('\n') || '';
                        const cleanText = text.replace(/\[System Instructions[\s\S]*?\[User says\]:\n/s, '').trim();
                        if (cleanText) {
                          handleAgentMessage(cleanText, true);
                        }
                      }
                    }}
                    accessibilityLabel={quotaExhausted ? 'AI credits exhausted' : 'Retry sending message'}
                    accessibilityRole="button"
                  >
                    {lastError?.includes('offline') ? <WifiOff size={16} color="#92400E" /> : !quotaExhausted && <RotateCcw size={16} color="#EF4444" />}
                    <Text style={{ color: lastError?.includes('offline') ? '#92400E' : '#EF4444', fontSize: 14, fontWeight: '600' }}>{lastError}</Text>
                  </Pressable>
                )}

                {showModePrompt && (
                  <Animated.View style={[styles.modePromptContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <Text style={[styles.modePromptTitle, { color: colors.text }]}>{t('chat.modePromptTitle')}</Text>
                    <Text style={[styles.modePromptSubtitle, { color: colors.textSecondary }]}>{t('chat.modePromptSubtitle')}</Text>
                    <View style={styles.modePromptButtons}>
                      {[
                        { id: 'decision' as CoachingMode, label: t('chat.decision'), icon: Target },
                        { id: 'clarity' as CoachingMode, label: t('chat.clarity'), icon: HelpCircle },
                        { id: 'planning' as CoachingMode, label: t('chat.planning'), icon: ArrowRight },
                        { id: 'reflection' as CoachingMode, label: t('chat.reflection'), icon: Brain },
                      ].map((mode) => (
                        <Pressable
                          key={mode.id}
                          style={({ pressed }) => [
                            styles.modePromptButton,
                            { backgroundColor: colors.background, borderColor: colors.border },
                            pressed && { opacity: 0.7 },
                          ]}
                          onPress={() => {
                            setCoachingMode(mode.id);
                            setModeChosen(true);
                            setShowModePrompt(false);
                            if (pendingFirstMessage) {
                              handleAgentMessage(pendingFirstMessage);
                              setPendingFirstMessage(null);
                            }
                          }}
                        >
                          <mode.icon size={20} color={colors.accent} style={{ marginBottom: 4 }} />
                          <Text style={[styles.modePromptButtonText, { color: colors.text }]}>{mode.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </Animated.View>
                )}

                {showFreeformNudge && (
                  <View style={[styles.freeformNudgeCard, { backgroundColor: colors.accent + '15', borderColor: colors.accent }]}>
                    <View style={styles.freeformNudgeHeader}>
                      <Sparkles size={16} color={colors.accent} />
                      <Text style={[styles.freeformNudgeTitle, { color: colors.accent }]}>{t('chat.freeformNudgeTitle')}</Text>
                    </View>
                    <Text style={[styles.freeformNudgeText, { color: colors.text }]}>{t('chat.freeformNudgeText')}</Text>
                    <View style={styles.freeformNudgeActions}>
                      <Pressable
                        style={[styles.freeformNudgeBtn, { backgroundColor: colors.accent }]}
                        onPress={() => {
                          setShowModePrompt(true);
                          setShowFreeformNudge(false);
                        }}
                      >
                        <Text style={{ color: colors.textInverse, fontWeight: '600' }}>{t('chat.pickAMode')}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                <BreakthroughMoment
                  visible={showBreakthrough}
                  insightText={breakthroughText}
                  onComplete={() => {
                    setShowBreakthrough(false);
                    // 60% chance to show artifact after a breakthrough to make it feel special
                    // In production, check if first session
                    setTimeout(() => handleShowArtifact(), 500);
                  }}
                />

                {/* Reflection Pause - breathing break when things get deep */}
                <ReflectionPause
                  visible={showReflectionPause}
                  onComplete={() => setShowReflectionPause(false)}
                />

                {/* Session Insights - emotional arc after session ends */}
                <SessionInsights
                  visible={showSessionInsights}
                  messages={agentMessages}
                  sessionDurationMs={Date.now() - sessionStartTimeRef.current}
                  onDismiss={() => setShowSessionInsights(false)}
                />
              </>
            ),
          } as any)}
        />

        <ScrollToBottom
          visible={showScrollButton}
          onPress={() => flashListRef.current?.scrollToEnd({ animated: true })}
          style={{ bottom: 100 }}
        />

        {/* Exit Card Modal - Put the Phone Down */}
        <ExitCard
          visible={showExitCard}
          actionTitle={currentActionTitle}
          onDismiss={() => {
            setShowExitCard(false);
            AsyncStorage.setItem('hasCompletedFirstSession', 'true');
            if (exitFromApprovedStep) {
              setExitFromApprovedStep(false);
              router.push('/(tabs)/system');
              return;
            }
            if (hasSeenRoadmap === false) {
              setShowRoadmap(true);
              setHasSeenRoadmap(true);
              AsyncStorage.setItem('hasSeenRoadmap', 'true');
            } else {
              router.push('/(tabs)/system');
            }
          }}
        />

        {currentIntent && (
          <Animated.View style={[styles.intentBadge, { opacity: intentFadeAnim, backgroundColor: getIntentBadge(currentIntent).color }]}>
            {getIntentBadge(currentIntent).icon}
            <Text style={[styles.intentBadgeText, { color: colors.textInverse }]}>{getIntentBadge(currentIntent).label}</Text>
          </Animated.View>
        )}

        {showFreeLimit && (
          <Pressable onPress={() => router.push('/paywall')} style={[styles.limitBanner, { backgroundColor: colors.warning }]}>
            <Text style={[styles.limitText, { color: colors.text }]}>
              {t('chat.freeSessionsBanner', { count: remainingFreeMessages })}
            </Text>
          </Pressable>
        )}

        {pendingSchedule && (
          <View style={[styles.scheduleApprovalCard, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
            <View style={styles.scheduleApprovalHeader}>
              <Calendar size={20} color={colors.accent} />
              <Text style={[styles.scheduleApprovalTitle, { color: colors.accent }]}>{t('chat.scheduleReady')}</Text>
            </View>
            <Text style={[styles.scheduleApprovalName, { color: colors.text }]}>{pendingSchedule.title}</Text>
            <Text style={[styles.scheduleApprovalInfo, { color: colors.textSecondary }]}>
              {t('chat.timeBlocks', { count: pendingSchedule.timeBlocks.length })}
            </Text>
            <View style={styles.scheduleApprovalActions}>
              <Pressable
                style={[styles.rejectButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={handleRejectSchedule}
              >
                <X size={18} color={colors.textSecondary} />
                <Text style={[styles.rejectButtonText, { color: colors.textSecondary }]}>{t('chat.dismiss')}</Text>
              </Pressable>
              <Pressable
                style={[styles.approveButton, { backgroundColor: colors.accent }]}
                onPress={handleApproveSchedule}
              >
                <Check size={18} color={colors.textInverse} />
                <Text style={[styles.approveButtonText, { color: colors.textInverse }]}>{t('chat.addToSchedules')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {showFreeformNudge && (
          <View style={[styles.freeformNudgeCard, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
            <View style={styles.freeformNudgeHeader}>
              <Sparkles size={18} color={colors.accent} />
              <Text style={[styles.freeformNudgeTitle, { color: colors.accent }]}>{t('chat.getMoreTitle')}</Text>
            </View>
            <Text style={[styles.freeformNudgeText, { color: colors.textSecondary }]}>
              {t('chat.getMoreText')}
            </Text>
            <View style={styles.freeformNudgeActions}>
              <Pressable
                style={[styles.rejectButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowFreeformNudge(false)}
              >
                <Text style={[styles.rejectButtonText, { color: colors.textSecondary }]}>{t('chat.keepChatting')}</Text>
              </Pressable>
              <Pressable
                style={[styles.freeformNudgeBtn, { backgroundColor: colors.accent }]}
                onPress={() => {
                  setShowFreeformNudge(false);
                  setShowModePrompt(true);
                }}
              >
                <Target size={16} color="#fff" />
                <Text style={[styles.approveButtonText, { color: '#fff' }]}>{t('chat.pickAMode')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {focusSuggestion && !isFocusTimerActive && !focusCheckIn && !isAgentLoading && (
          <View style={{ marginHorizontal: 14, marginBottom: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Clock size={17} color={colors.accent} />
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}>Your next step</Text>
              <Pressable onPress={() => setFocusSuggestion(null)} accessibilityRole="button" accessibilityLabel="Dismiss focus suggestion" hitSlop={8}>
                <X size={17} color={colors.textTertiary} />
              </Pressable>
            </View>
            <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
              {focusSuggestion.nextStep}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 7, marginBottom: 12 }}>
              {focusSuggestion.started
                ? 'You started the focus timer. Your next step stays saved when this chat ends.'
                : focusSuggestion.guardAlreadyActive
                  ? 'Guardian is on. Begin the focus timer when ready.'
                  : 'Start this small step now, or save it to Journey for later.'}
            </Text>
            {!focusSuggestion.started && (
              <Pressable
                onPress={() => {
                  setFocusSuggestion({ ...focusSuggestion, started: true });
                  beginFocusSession(focusSuggestion.durationMinutes, focusSuggestion.task, 'pomodoro', !focusSuggestion.guardAlreadyActive);
                }}
                style={{ backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Start ${focusSuggestion.durationMinutes} minute focus session`}
              >
                <Text style={{ color: colors.textInverse, fontSize: 14, fontWeight: '700' }}>Start {focusSuggestion.durationMinutes}-minute focus</Text>
                <ArrowRight size={16} color={colors.textInverse} />
              </Pressable>
            )}
            <Pressable
              onPress={finishChatWithNextStep}
              style={{ borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginTop: focusSuggestion.started ? 0 : 6 }}
              accessibilityRole="button"
              accessibilityLabel="Finish chat and save next step to Journey"
            >
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Finish chat · Save to Journey</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.inputArea, { backgroundColor: colors.background }]}>
          {/* Stop Generating button — like ChatGPT */}
          {isAgentLoading && (
            <Pressable
              onPress={() => {
                if (isFocusCheckInLoading) cancelFocusCheckInReply();
                else stopGenerating();
              }}
              style={({ pressed }) => [{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'center',
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.backgroundSecondary,
                marginBottom: 8,
              }, pressed && { opacity: 0.6 }]}
            >
              <Square size={14} color={colors.textSecondary} fill={colors.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                {t('chat.stopGenerating')}
              </Text>
            </Pressable>
          )}
          {(() => {
            const currentSession = state.sessions[state.selectedCoachId || ''];
            if (currentSession?.sessionLocked) {
              const pendingTaskId = currentSession.pendingActionTaskId;
              // Try exact match first, then partial match (title might differ slightly)
              const pendingTask = state.memory.tasks.find(t => 
                t.id === pendingTaskId || 
                t.title === pendingTaskId ||
                (pendingTaskId && t.title && t.title.toLowerCase().includes(pendingTaskId.toLowerCase())) ||
                (pendingTaskId && t.title && pendingTaskId.toLowerCase().includes(t.title.toLowerCase()))
              );
              // Task is completed if we found the matching task and it's done,
              // OR if there are no pending tasks at all (user completed everything)
              const hasPendingTasks = state.memory.tasks.some(t => t.status === 'pending');
              const isTaskCompleted = pendingTask?.status === 'completed' || (pendingTaskId !== 'Session ended' && !hasPendingTasks);

              return (
                <View style={[styles.lockedSessionContainer, { backgroundColor: colors.accentLight }]}>
                  <View style={styles.lockedIconRow}>
                    {isTaskCompleted ? (
                      <CheckCircle2 size={20} color={colors.accent} />
                    ) : (
                      <Lock size={20} color={colors.accent} />
                    )}
                    <Text style={[styles.lockedTitle, { color: colors.text }]}>
                      {isTaskCompleted ? t('chat.greatWork') : t('chat.sessionComplete')}
                    </Text>
                  </View>
                  <Text style={[styles.lockedDescription, { color: colors.textSecondary }]}>
                    {isTaskCompleted
                      ? t('chat.tasksInsightsSaved')
                      : t('chat.completeActionStep')}
                  </Text>
                  <View style={styles.lockedButtonsRow}>
                    {isTaskCompleted ? (
                      <Pressable
                        style={[styles.newSessionButton, { backgroundColor: colors.accent, borderColor: colors.accent, flex: 1 }]}
                        onPress={() => {
                          if (state.selectedCoachId) {
                            handleNewConversation();
                          }
                        }}
                      >
                        <Text style={[styles.newSessionButtonText, { color: colors.textInverse }]}>{t('chat.startNewSession')}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.goToTaskButton, { backgroundColor: colors.accent, flex: 1 }]}
                        onPress={() => router.push('/(tabs)/system')}
                      >
                        <Text style={[styles.goToTaskButtonText, { color: colors.textInverse }]}>{t('chat.viewYourTask')}</Text>
                        <ArrowRight size={16} color={colors.textInverse} />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            }

            return (
              <ChatInput
                onSend={(text) => handleSend(text, false)}
                disabled={isAgentLoading}
                placeholder={t('chat.placeholder')}
                onVoiceStateChange={handleVoiceStateChange}
              />
            );
          })()}
        </View>
      </KeyboardAvoidingView>

      {/* The Mind: Catch Card — Mazo just learned something about you */}
      {pendingInsight && (
        <CatchCard
          insight={pendingInsight}
          onConfirm={() => { confirmInsight(pendingInsight.id); setMazoState('happy'); setPendingInsight(null); }}
          onCorrect={(text) => { correctInsight(pendingInsight.id, text); setMazoState('happy'); setPendingInsight(null); }}
          onDismiss={() => { dismissInsight(pendingInsight.id); setPendingInsight(null); }}
        />
      )}

      {/* Session Insights — emotional journey after exit */}
      {showSessionInsights && !insightsDismissed && (
        <SessionInsights
          visible={showSessionInsights}
          messages={agentMessages}
          sessionDurationMs={Date.now() - sessionStartTimeRef.current}
          onDismiss={() => {
            setShowSessionInsights(false);
            setInsightsDismissed(true);
          }}
        />
      )}

      {/* Reflection Pause */}
      {showReflectionPause && (
        <ReflectionPause
          visible={showReflectionPause}
          onComplete={() => setShowReflectionPause(false)}
        />
      )}

      <GuidedTour
        visible={showRoadmap}
        onDismiss={() => {
          setShowRoadmap(false);
          router.push('/(tabs)/system');
        }}
        userName={state.userContext?.name}
      />

      {/* Growth #1: Artifact Modal — Animated */}
      {showArtifactModal && (() => {
        const modalScale = new Animated.Value(0.8);
        const modalOpacity = new Animated.Value(0);
        Animated.parallel([
          Animated.spring(modalScale, { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }),
          Animated.timing(modalOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();

        return (
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', zIndex: 9999, opacity: modalOpacity }]}>
            <Animated.View style={{ transform: [{ scale: modalScale }] }}>
              <FirstSessionArtifact
                ref={artifactRef}
                userName={state.userContext?.name || ''}
                insights={artifactInsights}
                date={new Date().toLocaleDateString()}
                title={artifactTitle}
              />
            </Animated.View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <Pressable
                onPress={handleShareArtifact}
                style={{ backgroundColor: colors.accent, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Share ✨</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowArtifactModal(false);
                  router.push('/(tabs)/system');
                }}
                style={{ borderColor: colors.accent, borderWidth: 1.5, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 15 }}>Save to Journey</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setShowArtifactModal(false)}
              style={{ marginTop: 16, padding: 10 }}
            >
              <Text style={{ color: '#fff', opacity: 0.6, fontSize: 14 }}>Continue session →</Text>
            </Pressable>
          </Animated.View>
        );
      })()}

      <FocusModeOverlay
        visible={isFocusTimerActive}
        taskName={focusTaskName}
        technique={focusTechnique}
        durationMinutes={focusDurationMinutes}
        onComplete={(success, rating) => {
          setIsFocusTimerActive(false);
          if (focusOwnsGuardRef.current) stopFocusGuard();
          focusOwnsGuardRef.current = false;
          if (success) {
            if (addFocusSession) {
              addFocusSession({
                taskName: focusTaskName,
                durationMinutes: focusDurationMinutes,
                technique: focusTechnique,
                rating: rating || null,
                completed: true,
              });
            }
          }
          // A timer event is app state, not a user chat turn. Keeping it local
          // avoids re-running the planner and proposing the same action twice.
          const checkIn = startFocusCheckIn(focusTaskName, success, rating);
          setFocusCheckIn(checkIn.checkIn);
          setFocusSuggestion((previous) => ({
            task: previous?.task ?? focusTaskName,
            nextStep: previous?.nextStep ?? focusTaskName,
            durationMinutes: previous?.durationMinutes ?? focusDurationMinutes,
            guardAlreadyActive: false,
            started: false,
          }));
          const sessionStatus = success
            ? `Your completed ${focusDurationMinutes}-minute block is saved to Journey.\n\n${checkIn.message}`
            : checkIn.message;
          setMessages((prev) => [...prev, {
            id: `focus-status-${Date.now()}`,
            role: 'assistant',
            parts: [{ type: 'text', text: sessionStatus }],
            content: sessionStatus,
          }]);
        }}
        onCancel={() => {
          setIsFocusTimerActive(false);
          if (focusOwnsGuardRef.current) stopFocusGuard();
          focusOwnsGuardRef.current = false;
        }}
      />

      <FocusShieldPreview
        visible={!!focusShieldPreview}
        apps={focusShieldPreview?.apps ?? []}
        durationMinutes={focusShieldPreview?.durationMinutes ?? 25}
        onDismiss={() => setFocusShieldPreview(null)}
        onStartFocus={() => {
          const preview = focusShieldPreview;
          if (!preview) return;
          setFocusShieldPreview(null);
          // iOS demo preview does not arm Android Focus Guardian.
          beginFocusSession(preview.durationMinutes, preview.task, 'pomodoro', false);
        }}
      />

      {/* Chat-decides: Mazō proposes real phone actions; you approve, it runs them. */}
      {agentPlan && (
        <ApprovalCard
          proposal={agentPlan}
          busy={agentBusy}
          onApprove={async () => {
            setAgentBusy(true);
            const receipts = await dispatchPlan(agentPlan.actions, {
              addAlarm,
              saveNote: (note, category) => addIdea({ content: note, category }),
            });
            setAgentBusy(false);
            setAgentPlan(null);
            const ok = receipts.filter((r) => r.success).length;
            const studyNote = agentPlan.actions.find((action) =>
              action.kind === 'save_note' && /study|exam|revise|revision|focus|مذاكر|امتحان/i.test(`${action.title} ${action.note ?? ''}`),
            );
            if (studyNote && receipts.some((receipt) => receipt.id === studyNote.id && receipt.success)) {
              const guard = agentPlan.actions.find((action) => action.kind === 'guard');
              setFocusSuggestion({
                task: agentPlan.understood,
                nextStep: studyNote.note ?? agentPlan.understood,
                durationMinutes: Math.min(60, guard?.durationMinutes ?? 25),
                guardAlreadyActive: receipts.some((receipt) => receipt.kind === 'guard' && receipt.success),
                started: false,
              });
            }
            const focusPreview = agentPlan.actions.find((action) => action.kind === 'focus_preview');
            if (focusPreview && receipts.some((receipt) => receipt.id === focusPreview.id && receipt.success)) {
              setFocusShieldPreview({
                apps: focusPreview.apps ?? [],
                durationMinutes: Math.min(60, focusPreview.durationMinutes ?? 25),
                task: studyNote?.note ?? agentPlan.understood,
              });
            }
            // Show an honest receipt, not an internal follow-up prompt as a user bubble.
            const summary = receipts.length === 1
              ? receipts[0].message
              : `${ok} of ${receipts.length} actions completed. ${receipts.map((receipt) => receipt.message).join(' · ')}`.trim();
            const receiptId = `receipt-${Date.now()}`;
            setMessages((prev) => [...prev, {
              id: receiptId,
              role: 'assistant',
              parts: [{ type: 'text', text: summary }],
              content: summary,
            }]);
          }}
          onDecline={() => {
            setAgentPlan(null);
            setAgentBusy(false);
          }}
        />
      )}

      {/* ⚡ The Agent's command surface, reachable from inside the chat (System keeps its own). */}
      <CommandBar showLauncher={false} open={cmdOpen} onOpenChange={setCmdOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  welcomeScroll: {
    flex: 1,
  },
  welcomeScrollContent: {
    paddingBottom: 200,
  },
  commandHintSection: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 4,
  },
  commandHintLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  commandChips: {
    gap: 8,
  },
  commandChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  commandChipText: {
    fontSize: 14.5,
    fontWeight: '500' as const,
  },
  faceContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  welcomeCoachName: {
    fontSize: 16,
    fontWeight: '500' as const,
    textAlign: 'center',
    marginBottom: 8,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  streakEmoji: {
    fontSize: 16,
  },
  streakCount: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  streakLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 4,
    lineHeight: 22,
  },
  dailyPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  dailyPromptIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyPromptContent: {
    flex: 1,
  },
  dailyPromptLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  dailyPromptText: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  quickCheckinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  quickCheckinText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  quickAccessButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  selectCoachButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  selectCoachButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  contextAccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 30,
  },
  contextAccessText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  promptsSection: {
    marginTop: 8,
    paddingHorizontal: 20,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 12,
  },
  promptIcon: {
    width: 24,
    alignItems: 'center',
  },
  promptText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    lineHeight: 22,
    flex: 1,
  },
  promptCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.8,
  },
  historySection: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  historyItemContent: {
    flex: 1,
    marginRight: 12,
  },
  historyCoachName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  historyMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyTime: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  historyItemPressed: {
    backgroundColor: Colors.backgroundSecondary,
    transform: [{ scale: 0.98 }],
  },
  welcomeInputArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
    flexGrow: 1,
  },
  headerButton: {
    padding: 8,
  },
  limitBanner: {
    backgroundColor: Colors.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  limitText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  inputArea: {
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
    backgroundColor: Colors.background,
  },
  intentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 8,
  },
  intentBadgeText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textInverse,
  },
  scheduleApprovalCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  scheduleApprovalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scheduleApprovalTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  scheduleApprovalName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  scheduleApprovalInfo: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  scheduleApprovalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary,
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  approveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    gap: 6,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textInverse,
  },
  freeformNudgeCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  freeformNudgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  freeformNudgeTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  freeformNudgeText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  freeformNudgeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  freeformNudgeBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  toolResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  toolResultText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500' as const,
    flex: 1,
  },
  toolLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
  },
  toolLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  // Locked session UI styles
  lockedSessionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: Colors.accentLight,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
  },
  lockedIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  lockedDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  lockedButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  goToTaskButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  goToTaskButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textInverse,
  },
  newSessionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  newSessionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modePromptContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  modePromptTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
    textAlign: 'center' as const,
  },
  modePromptSubtitle: {
    fontSize: 13,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  modePromptButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'center',
  },
  modePromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  modePromptButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  modePromptAutoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modePromptAutoText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
