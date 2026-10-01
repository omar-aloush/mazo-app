import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Target,
  CheckSquare,
  Lightbulb,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Calendar,
  Heart,
  Brain,
  Zap,
  X,
  CalendarClock,
  MessageCircle,
  Flame,
  CheckCircle2,
  TrendingUp,
  Users,
  ChevronDown,
  ChevronUp,
  Check,
  Timer,
  Bell,
} from 'lucide-react-native';
import { useApp } from '@/providers/AppProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useGrowth } from '@/providers/GrowthProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { DetectedIntent, Goal } from '@/types';
import Colors from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { CommandBar } from '@/components/CommandBar';
import { UsageInsightCard } from '@/components/UsageInsightCard';
import { BehaviorInsightCard } from '@/components/BehaviorInsightCard';
import { PersonalizedReadyScreen } from '@/components/PersonalizedReadyScreen';
import { AIFace } from '@/components/AIFace';
import { GrowthTimeline, TimelineItem } from '@/components/GrowthTimeline';
import { ShareMomentCard } from '@/components/ShareMomentCard';
import { AlarmCard } from '@/components/AlarmCard';
import { NorthStarCard } from '@/components/NorthStarCard';
import { updateWidgetData } from '@/services/widgetData';
import { computeDailyFocus, buildWeeklyHeatmap, getHeatmapDayLabels } from '@/services/dailyRitual';
import { shareStreakMilestone, shareBreakthrough, shareGoalComplete } from '@/services/shareService';
import { useTranslation } from '@/hooks/useTranslation';

function getGreeting(userName: string | undefined, t: (key: string, params?: Record<string, string | number>) => string): { greeting: string; subtitle: string } {
  const hour = new Date().getHours();
  const name = userName?.trim();
  if (hour < 6) return { greeting: name ? t('greeting.nightOwlName', { name }) : t('greeting.nightOwl'), subtitle: t('greeting.nightSubtitle') };
  if (hour < 12) return { greeting: name ? t('greeting.morningName', { name }) : t('greeting.morning'), subtitle: t('greeting.morningSubtitle') };
  if (hour < 17) return { greeting: name ? t('greeting.afternoonName', { name }) : t('greeting.afternoon'), subtitle: t('greeting.afternoonSubtitle') };
  if (hour < 21) return { greeting: name ? t('greeting.eveningName', { name }) : t('greeting.evening'), subtitle: t('greeting.eveningSubtitle') };
  return { greeting: name ? t('greeting.eveningReviewName', { name }) : t('greeting.eveningReview'), subtitle: t('greeting.reviewSubtitle') };
}

function getEnergyLevel(memory: any, sessions: any): number {
  let energy = 0;

  const totalGoals = memory.goals?.length || 0;
  const activeGoals = memory.goals?.filter((g: any) => g.status === 'active')?.length || 0;
  if (activeGoals > 0) energy += Math.min(activeGoals * 5, 15);

  const totalTasks = memory.tasks?.length || 0;
  const completedTasks = memory.tasks?.filter((t: any) => t.status === 'completed')?.length || 0;
  const pendingTasks = memory.tasks?.filter((t: any) => t.status === 'pending')?.length || 0;
  if (totalTasks > 0) energy += Math.round((completedTasks / totalTasks) * 25);
  if (pendingTasks > 0) energy += 5;

  const sessionKeys = sessions ? Object.keys(sessions) : [];
  const totalSessionMessages = sessionKeys.reduce((sum: number, key: string) => {
    const session = sessions[key];
    return sum + (session?.messages?.length || 0);
  }, 0);
  if (totalSessionMessages > 0) energy += Math.min(Math.round(totalSessionMessages / 2), 20);

  if (memory.ideas?.length > 0) energy += Math.min(memory.ideas.length * 3, 10);
  if (memory.preferences?.length > 0) energy += 5;
  if (memory.habits?.length > 0) energy += 5;
  if (memory.dailyPlan) energy += 10;
  if (memory.weeklyDirection) energy += 5;

  return Math.min(energy, 100);
}

function getFaceExpression(energy: number): 'happy' | 'curious' | 'thinking' | 'proud' {
  if (energy >= 80) return 'proud';
  if (energy >= 60) return 'happy';
  if (energy >= 40) return 'curious';
  return 'thinking';
}

function EnergyRing({ energy, size, colors }: { energy: number; size: number; colors: any }) {
  const ringAnim1 = useRef(new Animated.Value(0.15)).current;
  const ringAnim2 = useRef(new Animated.Value(0.1)).current;
  const ringAnim3 = useRef(new Animated.Value(0.06)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const breathe = (anim: Animated.Value, base: number, peak: number, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: peak, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: base, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );

    const s = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.02, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    const a1 = breathe(ringAnim1, 0.12, 0.22, 2000);
    const a2 = breathe(ringAnim2, 0.08, 0.15, 2800);
    const a3 = breathe(ringAnim3, 0.04, 0.1, 3500);

    a1.start(); a2.start(); a3.start(); s.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); s.stop(); };
  }, []);

  const ringColor = colors.accent;

  return (
    <Animated.View style={[styles.energyRingContainer, { width: size + 28, height: size + 28, transform: [{ scale: scaleAnim }] }]}>
      <Animated.View style={[styles.ring, { width: size + 24, height: size + 24, borderRadius: (size + 24) / 2, backgroundColor: ringColor, opacity: ringAnim3 }]} />
      <Animated.View style={[styles.ring, { width: size + 14, height: size + 14, borderRadius: (size + 14) / 2, backgroundColor: ringColor, opacity: ringAnim2 }]} />
      <Animated.View style={[styles.ring, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, backgroundColor: ringColor, opacity: ringAnim1 }]} />
      <AIFace expression={getFaceExpression(energy)} size={size} />
    </Animated.View>
  );
}

export default function SystemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    state,
    generateDailyPlan,
    generateWeeklyDirection,
    isGeneratingPlan,
    isGeneratingWeekly,
    updateTask,
    clearIntent,
    generateSchedule,
    isGeneratingSchedule,
    triggerSystemReadyScreen,
    dismissSystemReadyScreen,
    triggerCelebration,
    unlockSession,
    updateAlarm,
    deleteAlarm,
  } = useApp();
  const { isPro } = useSubscription();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { streak, sessionDates, pendingShareMoment, referralCode, dismissShareMoment } = useGrowth();

  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const { memory, detectedIntents, schedulingData, showSystemReadyScreen, hasSeenSystemReady, sessions, selectedCoachId } = state;

  const activeGoals = useMemo(() => memory.goals.filter((g) => g.status === 'active'), [memory.goals]);
  const pendingTasks = useMemo(() => memory.tasks.filter((t) => t.status === 'pending'), [memory.tasks]);
  const completedTasks = useMemo(() => memory.tasks.filter((t) => t.status === 'completed'), [memory.tasks]);
  const openProblems = useMemo(() => memory.problems.filter((p) => p.status === 'open'), [memory.problems]);

  const totalTasks = memory.tasks.length;
  const taskCompletionPct = totalTasks > 0 ? completedTasks.length / totalTasks : 0;

  const totalInsights = memory.preferences.length + memory.goals.length + memory.tasks.length;
  const personalizedTopic = memory.goals.length > 0
    ? t('journey.yourGoals')
    : memory.preferences.length > 0
      ? t('journey.yourJourney')
      : t('journey.yourExperience');

  const isEmpty =
    activeGoals.length === 0 &&
    pendingTasks.length === 0 &&
    memory.ideas.length === 0 &&
    openProblems.length === 0 &&
    completedTasks.length === 0 &&
    memory.habits.length === 0 &&
    memory.preferences.length === 0;

  const energy = useMemo(() => getEnergyLevel(memory, sessions), [memory, sessions]);
  const { greeting, subtitle } = useMemo(() => getGreeting(state.userContext?.name, t), [state.userContext?.name, t]);

  const dailyFocus = useMemo(() => computeDailyFocus(memory, streak.currentStreak, t), [memory, streak.currentStreak, t]);
  const weeklyHeatmap = useMemo(() => buildWeeklyHeatmap(sessionDates), [sessionDates]);
  const dayLabels = useMemo(() => getHeatmapDayLabels(t), [t]);

  // ── Focus Stats ──
  const focusStats = useMemo(() => {
    const sessions = memory.focusSessions || [];
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;
    const completedCount = sessions.filter(s => s.completed).length;
    return { totalMinutes, totalHours, remainingMins, completedCount, totalSessions: sessions.length };
  }, [memory.focusSessions]);

  // ── Next Alarm ──
  const nextAlarm = useMemo(() => {
    const alarms = (memory.alarms || []).filter(a => a.enabled);
    if (alarms.length === 0) return null;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let closest: { label: string; time: string } | null = null;
    let closestDiff = Infinity;
    for (const alarm of alarms) {
      const alarmMinutes = alarm.hour * 60 + alarm.minute;
      let diff = alarmMinutes - currentMinutes;
      if (diff <= 0) diff += 24 * 60;
      if (diff < closestDiff) {
        closestDiff = diff;
        const h = alarm.hour % 12 || 12;
        const ampm = alarm.hour < 12 ? 'AM' : 'PM';
        closest = {
          label: alarm.label,
          time: `${h}:${String(alarm.minute).padStart(2, '0')} ${ampm}`,
        };
      }
    }
    return closest;
  }, [memory.alarms]);

  const handleShareMoment = useCallback(() => {
    if (!pendingShareMoment) return;
    const { type, data } = pendingShareMoment;
    if (type === 'streak') {
      shareStreakMilestone(data?.streak || streak.currentStreak, referralCode, t);
    } else if (type === 'breakthrough') {
      shareBreakthrough(data?.insight || '', referralCode, t);
    } else if (type === 'goal') {
      shareGoalComplete(data?.goal || '', referralCode, t);
    }
    dismissShareMoment();
  }, [pendingShareMoment, streak.currentStreak, referralCode, t, dismissShareMoment]);

  const timelineItems: TimelineItem[] = useMemo(() => [
    ...memory.goals.slice(0, 3).map(g => ({
      id: g.id || `goal-${g.title}`,
      icon: 'target' as const,
      title: g.title,
      date: t('journey.goal'),
      type: 'goal' as const,
    })),
    ...completedTasks.slice(0, 3).map(ct => ({
      id: ct.id || `done-${ct.title}`,
      icon: 'check' as const,
      title: ct.title,
      date: t('common.completed'),
      type: 'milestone' as const,
    })),
    ...memory.habits.slice(0, 2).map(h => ({
      id: h.id || `habit-${h.title}`,
      icon: 'zap' as const,
      title: h.title,
      date: String(h.frequency || t('journey.habit')),
      type: 'habit' as const,
    })),
    ...memory.preferences.slice(0, 2).map((p, i) => ({
      id: `insight-${i}`,
      icon: 'lightbulb' as const,
      title: p.value,
      date: t('journey.insight'),
      type: 'insight' as const,
    })),
  ], [memory.goals, completedTasks, memory.habits, memory.preferences]);

  // Sync widget data whenever energy or user info changes
  useEffect(() => {
    updateWidgetData({
      energy,
      userName: state.userContext?.name,
      streakCount: state.streak?.currentStreak || 0,
    });
  }, [energy, state.userContext?.name, state.streak?.currentStreak]);

  useEffect(() => {
    if (!hasSeenSystemReady && totalInsights >= 3) {
      triggerSystemReadyScreen();
    }
  }, [hasSeenSystemReady, totalInsights, triggerSystemReadyScreen]);

  const getIntentIcon = (type: DetectedIntent) => {
    const icons: Record<DetectedIntent, React.ReactNode> = {
      scheduling: <Calendar size={18} color={colors.textInverse} />,
      goal_setting: <Target size={18} color={colors.textInverse} />,
      reflection: <Brain size={18} color={colors.textInverse} />,
      preference_sharing: <Heart size={18} color={colors.textInverse} />,
      problem_solving: <AlertCircle size={18} color={colors.textInverse} />,
      planning: <Lightbulb size={18} color={colors.textInverse} />,
      general: <Sparkles size={18} color={colors.textInverse} />,
      focus_timer: <Clock size={18} color={colors.textInverse} />,
    };
    return icons[type];
  };

  const handleIntentAction = useCallback((intentId: string, type: DetectedIntent) => {
    if (type === 'scheduling') {
      if (schedulingData.isComplete) {
        generateSchedule(undefined);
      } else {
        router.push('/(tabs)/chat');
      }
    } else if (type === 'preference_sharing') {
      router.push('/(tabs)/memory');
    } else {
      router.push('/(tabs)/chat');
    }
    clearIntent(intentId);
  }, [schedulingData.isComplete, generateSchedule, clearIntent, router]);

  const handleRefresh = useCallback(() => {
    generateDailyPlan(undefined);
    generateWeeklyDirection(undefined);
  }, [generateDailyPlan, generateWeeklyDirection]);

  const handleGeneratePlan = useCallback(() => {
    generateDailyPlan(undefined);
  }, [generateDailyPlan]);

  const handleToggleTask = useCallback(
    (taskId: string, currentStatus: string) => {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      const task = memory.tasks.find(t => t.id === taskId);
      updateTask(taskId, { status: newStatus as 'pending' | 'completed' });

      if (newStatus === 'completed' && selectedCoachId) {
        const currentSession = sessions[selectedCoachId];
        if (currentSession?.sessionLocked) {
          if (task?.title) {
            triggerCelebration(task.title);
            // Session stays locked — the locked UI shows "Great work!" with task status
          }
        }
      }
    },
    [updateTask, selectedCoachId, sessions, memory.tasks, triggerCelebration]
  );

  if (showSystemReadyScreen) {
    return (
      <PersonalizedReadyScreen
        preferencesCount={totalInsights}
        personalizedTopic={personalizedTopic}
        onContinue={dismissSystemReadyScreen}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isGeneratingPlan || isGeneratingWeekly}
          onRefresh={handleRefresh}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerLabel, { color: colors.textTertiary }]}>{t('journey.yourJourney')}</Text>
          <Text style={[styles.headerGreeting, { color: colors.text }]}>{greeting}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, { backgroundColor: energy >= 60 ? `${colors.accent}18` : `${colors.warning}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: energy >= 60 ? colors.accent : colors.warning }]} />
            <Text style={[styles.statusText, { color: energy >= 60 ? colors.accent : colors.warning }]}>
              {energy >= 80 ? t('journey.thriving') : energy >= 60 ? t('journey.active') : energy >= 40 ? t('journey.building') : t('journey.starting')}
            </Text>
          </View>
          <EnergyRing energy={energy} size={56} colors={colors} />
        </View>
      </View>

      {/* The Agent — say it, Mazo does it on your phone */}
      <CommandBar />

      {/* Proactive nudge — Mazo noticed your real usage */}
      <UsageInsightCard />

      {/* Behavior model — Mazo learned your danger zone */}
      <BehaviorInsightCard />

      {/* Streak + Focus Stats + Next Alarm — compact info strip */}
      <View style={styles.infoStripRow}>
        {/* Streak */}
        <View style={[styles.infoChip, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Flame size={14} color={streak.currentStreak > 0 ? colors.accent2 : colors.textTertiary} />
          <Text style={[styles.infoChipValue, { color: streak.currentStreak > 0 ? colors.accent2 : colors.textTertiary }]}>
            {streak.currentStreak}
          </Text>
          <Text style={[styles.infoChipLabel, { color: colors.textTertiary }]}>day{streak.currentStreak !== 1 ? 's' : ''}</Text>
        </View>

        {/* Focus Time */}
        {focusStats.totalMinutes > 0 && (
          <View style={[styles.infoChip, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Timer size={14} color={colors.accent} />
            <Text style={[styles.infoChipValue, { color: colors.accent }]}>
              {focusStats.totalHours > 0 ? `${focusStats.totalHours}h${focusStats.remainingMins > 0 ? ` ${focusStats.remainingMins}m` : ''}` : `${focusStats.totalMinutes}m`}
            </Text>
            <Text style={[styles.infoChipLabel, { color: colors.textTertiary }]}>focused</Text>
          </View>
        )}

        {/* Next Alarm */}
        {nextAlarm && (
          <View style={[styles.infoChip, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Bell size={13} color={colors.textSecondary} />
            <Text style={[styles.infoChipValue, { color: colors.text }]}>{nextAlarm.time}</Text>
          </View>
        )}
      </View>

      {/* Share Moment Card — appears on milestones */}
      {pendingShareMoment && (
        <ShareMomentCard
          type={pendingShareMoment.type}
          title={pendingShareMoment.title}
          subtitle={pendingShareMoment.subtitle}
          onShare={handleShareMoment}
          onDismiss={dismissShareMoment}
        />
      )}

      {/* North Star — Long-term Goal Prominence */}
      <NorthStarCard
        goals={memory.goals}
        colors={colors}
        isDark={isDark}
        onGoalPress={(goal: Goal) => {
          router.push({ pathname: '/(tabs)/chat', params: { prompt: `Let's talk about my goal: "${goal.title}". How can I make progress today?` } });
        }}
      />

      {/* Daily Focus Card */}
      <Pressable
        style={[styles.dailyFocusCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
        onPress={() => {
          if (dailyFocus.chatPrompt) {
            router.push({ pathname: '/(tabs)/chat', params: { prompt: dailyFocus.chatPrompt } });
          } else {
            router.push('/(tabs)/chat');
          }
        }}
      >
        <View style={styles.dailyFocusTop}>
          <View style={styles.dailyFocusIcon}>
            <Flame size={20} color={colors.accent2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dailyFocusLabel, { color: colors.textTertiary }]}>{t('dailyRitual.title')}</Text>
            <Text style={[styles.dailyFocusHeadline, { color: colors.text }]}>{dailyFocus.headline}</Text>
            <Text style={[styles.dailyFocusSubtitle, { color: colors.textSecondary }]}>{dailyFocus.subtitle}</Text>
          </View>
          <ChevronRight size={18} color={colors.textTertiary} />
        </View>
        <View style={[styles.heatmapRow, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.heatmapLabel, { color: colors.textTertiary }]}>{t('dailyRitual.thisWeek')}</Text>
          <View style={styles.heatmapDots}>
            {weeklyHeatmap.map((active, i) => (
              <View key={i} style={styles.heatmapDayCol}>
                <View
                  style={[
                    styles.heatmapDot,
                    active
                      ? { backgroundColor: colors.accent }
                      : { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.borderLight },
                  ]}
                />
                <Text style={[styles.heatmapDayText, { color: colors.textTertiary }]}>{dayLabels[i]}</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>

      {/* Progress Summary — glass card */}
      <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
        <View style={styles.progressStats}>
          <View style={styles.progressStatItem}>
            <Target size={13} color={colors.accent} />
            <Text style={[styles.progressStatValue, { color: colors.text }]}>{activeGoals.length}</Text>
            <Text style={[styles.progressStatLabel, { color: colors.textTertiary }]}>Goals</Text>
          </View>
          <View style={[styles.progressStatDivider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.progressStatItem}>
            <CheckCircle2 size={13} color={colors.accent} />
            <Text style={[styles.progressStatValue, { color: colors.text }]}>{completedTasks.length}</Text>
            <Text style={[styles.progressStatLabel, { color: colors.textTertiary }]}>Done</Text>
          </View>
          <View style={[styles.progressStatDivider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.progressStatItem}>
            <Lightbulb size={13} color={colors.accent} />
            <Text style={[styles.progressStatValue, { color: colors.text }]}>{memory.ideas.length}</Text>
            <Text style={[styles.progressStatLabel, { color: colors.textTertiary }]}>Ideas</Text>
          </View>
          {focusStats.completedCount > 0 && (
            <>
              <View style={[styles.progressStatDivider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.progressStatItem}>
                <Timer size={13} color={colors.accent} />
                <Text style={[styles.progressStatValue, { color: colors.text }]}>{focusStats.completedCount}</Text>
                <Text style={[styles.progressStatLabel, { color: colors.textTertiary }]}>Sessions</Text>
              </View>
            </>
          )}
        </View>
        {totalTasks > 0 && (
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBarTrack, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={[styles.progressBarFill, { backgroundColor: colors.accent, width: `${Math.round(taskCompletionPct * 100)}%` }]} />
            </View>
            <Text style={[styles.progressBarLabel, { color: colors.textTertiary }]}>
              {t('journey.tasksComplete', { completed: completedTasks.length, total: totalTasks })}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.quickAccessRow}>
        <Pressable
          style={[styles.quickAccessCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          onPress={() => router.push('/(tabs)/schedules')}
        >
          <View style={[styles.quickAccessIconWrap, { backgroundColor: `${colors.accent}12` }]}>
            <CalendarClock size={18} color={colors.accent} />
          </View>
          <Text style={[styles.quickAccessTitle, { color: colors.text }]}>{t('journey.schedule')}</Text>
        </Pressable>

        <Pressable
          style={[styles.quickAccessCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          onPress={() => router.push('/(tabs)/memory')}
        >
          <View style={[styles.quickAccessIconWrap, { backgroundColor: `${colors.cardHighlight}15` }]}>
            <Brain size={18} color={colors.cardHighlight} />
          </View>
          <Text style={[styles.quickAccessTitle, { color: colors.text }]}>{t('journey.memory')}</Text>
        </Pressable>
      </View>

      {detectedIntents.length > 0 && (
        <View style={[styles.sectionCard, { borderColor: colors.borderLight }]}>
          <View style={styles.sectionCardHeader}>
            <Zap size={18} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('journey.detectedIntents')}</Text>
            <View style={[styles.countBadge, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.countText, { color: colors.textTertiary }]}>{detectedIntents.length}</Text>
            </View>
          </View>
          {detectedIntents.map((intent) => (
            <View key={intent.id} style={[styles.actionCard, { backgroundColor: colors.backgroundSecondary }]}>
              <Pressable
                style={styles.actionButton}
                onPress={() => handleIntentAction(intent.id, intent.type)}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: colors.accent }]}>
                  {getIntentIcon(intent.type)}
                </View>
                <View style={styles.actionContent}>
                  <Text style={[styles.actionLabel, { color: colors.text }]}>{intent.label}</Text>
                  <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>{intent.description}</Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </Pressable>
              <Pressable style={styles.dismissBtn} onPress={() => clearIntent(intent.id)} hitSlop={8}>
                <X size={14} color={colors.textTertiary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {isEmpty && detectedIntents.length === 0 ? (
        <LinearGradient
          colors={[colors.accent + '18', colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.emptyCard]}
        >
          <View style={styles.emptyIconRow}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.accent + '20' }]}>
              <Target size={20} color={colors.accent} />
            </View>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.accent + '20' }]}>
              <Sparkles size={20} color={colors.accent} />
            </View>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.accent + '20' }]}>
              <TrendingUp size={20} color={colors.accent} />
            </View>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('journey.emptyState')}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {t('journey.emptyStateSubtitle')}
          </Text>
          <Pressable
            style={[styles.startBtn, { backgroundColor: colors.text }]}
            onPress={() => router.push('/(tabs)/chat')}
          >
            <MessageCircle size={18} color={colors.background} />
            <Text style={[styles.startBtnText, { color: colors.background }]}>{t('journey.startChat')}</Text>
          </Pressable>
        </LinearGradient>
      ) : !isEmpty ? (
        <>
          {memory.dailyPlan && (
            <View style={[styles.sectionCard, { borderColor: colors.borderLight }]}>
              <View style={styles.sectionCardHeader}>
                <Flame size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('journey.todaysPlan')}</Text>
              </View>
              <Text style={[styles.focusText, { color: colors.text }]}>{memory.dailyPlan.focus}</Text>
              {memory.dailyPlan.insights.length > 0 && (
                <View style={styles.insightsWrap}>
                  {memory.dailyPlan.insights.map((insight: string, index: number) => (
                    <View key={index} style={styles.insightRow}>
                      <Lightbulb size={13} color={colors.accent} />
                      <Text style={[styles.insightText, { color: colors.textSecondary }]}>{insight}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {memory.weeklyDirection && (
            <View style={[styles.sectionCard, { borderColor: colors.borderLight }]}>
              <View style={styles.sectionCardHeader}>
                <TrendingUp size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('journey.weeklyDirection')}</Text>
              </View>
              {memory.weeklyDirection.mainGoals.map((goal: string, index: number) => (
                <View key={index} style={styles.weeklyGoal}>
                  <View style={[styles.weeklyDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.weeklyGoalText, { color: colors.text }]}>{goal}</Text>
                </View>
              ))}
            </View>
          )}

          {!memory.dailyPlan && (
            <Pressable
              style={[styles.generateBtn, { backgroundColor: colors.accent }]}
              onPress={handleGeneratePlan}
              disabled={isGeneratingPlan}
            >
              <Sparkles size={18} color={colors.textInverse} />
              <Text style={[styles.generateBtnText, { color: colors.textInverse }]}>
                {isGeneratingPlan ? t('schedule.generating') : t('journey.generatePlan')}
              </Text>
            </Pressable>
          )}

          {/* Alarms Card */}
          {(memory.alarms || []).length > 0 && (
            <AlarmCard
              alarms={memory.alarms || []}
              colors={colors}
              onToggle={(id, enabled) => updateAlarm(id, { enabled })}
              onDelete={(id) => deleteAlarm(id)}
            />
          )}

          {activeGoals.length > 0 && (
            <View style={[styles.sectionCard, { borderColor: colors.borderLight }]}>
              <View style={styles.sectionCardHeader}>
                <Target size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('journey.activeGoals')}</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.countText, { color: colors.textTertiary }]}>{activeGoals.length}</Text>
                </View>
              </View>
              {activeGoals.slice(0, 5).map((goal) => (
                <View
                  key={goal.id}
                  style={[
                    styles.goalItem,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                >
                  <View style={styles.goalContent}>
                    <Text style={[styles.goalTitle, { color: colors.text }]}>{goal.title}</Text>
                    <Text style={[styles.goalDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                      {goal.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: colors.backgroundSecondary },
                      goal.priority === 'high' && { backgroundColor: `${colors.error}18` },
                      goal.priority === 'medium' && { backgroundColor: `${colors.warning}18` },
                    ]}
                  >
                    <Text style={[styles.priorityText, { color: colors.textSecondary }]}>{goal.priority}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {(pendingTasks.length > 0 || completedTasks.length > 0) && (
            <View style={[styles.sectionCard, { borderColor: colors.borderLight }]}>
              <View style={styles.sectionCardHeader}>
                <CheckSquare size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('journey.tasks')}</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.countText, { color: colors.textTertiary }]}>{pendingTasks.length}</Text>
                </View>
                {totalTasks > 0 && (
                  <View style={[styles.taskPctCircle, { borderColor: colors.borderLight }]}>
                    <View style={[styles.taskPctFill, { backgroundColor: colors.accent, height: `${Math.round(taskCompletionPct * 100)}%` }]} />
                    <Text style={[styles.taskPctText, { color: colors.textTertiary }]}>{Math.round(taskCompletionPct * 100)}%</Text>
                  </View>
                )}
              </View>
              {pendingTasks.slice(0, 6).map((task) => (
                <Pressable
                  key={task.id}
                  style={[styles.taskItem, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => handleToggleTask(task.id, task.status)}
                >
                  <View
                    style={[
                      styles.taskCheckbox,
                      { borderColor: colors.border },
                    ]}
                  />
                  <View style={styles.taskContent}>
                    <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title || task.description || 'Task'}</Text>
                    {task.estimatedMinutes && (
                      <View style={styles.taskMeta}>
                        <Clock size={11} color={colors.textTertiary} />
                        <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>
                          {task.estimatedMinutes} min
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
              {completedTasks.length > 0 && (
                <Pressable
                  style={[styles.showCompletedToggle, { borderTopColor: colors.borderLight }]}
                  onPress={() => setShowCompletedTasks(!showCompletedTasks)}
                >
                  <Text style={[styles.showCompletedText, { color: colors.accent }]}>
                    {showCompletedTasks ? t('common.hide') : t('common.show')} {t('common.completed')} ({completedTasks.length})
                  </Text>
                  {showCompletedTasks ? (
                    <ChevronUp size={14} color={colors.accent} />
                  ) : (
                    <ChevronDown size={14} color={colors.accent} />
                  )}
                </Pressable>
              )}
              {showCompletedTasks && completedTasks.map((task) => (
                <Pressable
                  key={task.id}
                  style={[styles.taskItem, styles.taskItemCompleted, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => handleToggleTask(task.id, task.status)}
                >
                  <View style={[styles.taskCheckbox, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                    <Check size={12} color={colors.textInverse} />
                  </View>
                  <View style={styles.taskContent}>
                    <Text style={[styles.taskTitle, { color: colors.textTertiary, textDecorationLine: 'line-through' }]}>{task.title || task.description || 'Task'}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {memory.ideas.length > 0 && (
            <View style={[styles.sectionCard, { borderColor: colors.borderLight }]}>
              <View style={styles.sectionCardHeader}>
                <Lightbulb size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('common.ideas')}</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.countText, { color: colors.textTertiary }]}>{memory.ideas.length}</Text>
                </View>
              </View>
              {memory.ideas.slice(0, 4).map((idea) => (
                <View key={idea.id} style={[styles.ideaItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.ideaText, { color: colors.text }]}>{idea.content}</Text>
                  {idea.category && (
                    <View style={[styles.ideaCategoryPill, { backgroundColor: `${colors.accent}18` }]}>
                      <Text style={[styles.ideaCategoryText, { color: colors.accent }]}>{idea.category}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {openProblems.length > 0 && (
            <View style={[styles.sectionCard, { borderColor: colors.borderLight }]}>
              <View style={styles.sectionCardHeader}>
                <AlertCircle size={18} color={colors.warning} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('common.openChallenges')}</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.countText, { color: colors.textTertiary }]}>{openProblems.length}</Text>
                </View>
              </View>
              {openProblems.slice(0, 4).map((problem) => (
                <View key={problem.id} style={[styles.problemItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.problemText, { color: colors.text }]}>{problem.description}</Text>
                  <View
                    style={[
                      styles.urgencyBadge,
                      { backgroundColor: colors.backgroundSecondary },
                      problem.urgency === 'high' && { backgroundColor: `${colors.error}18` },
                    ]}
                  >
                    <Text style={[styles.urgencyText, { color: colors.textSecondary }]}>{problem.urgency}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {timelineItems.length > 0 && (
            <View style={[styles.sectionCard, { borderColor: colors.borderLight }]}>
              <View style={styles.sectionCardHeader}>
                <TrendingUp size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('journey.yourJourney')}</Text>
              </View>
              <GrowthTimeline items={timelineItems} />
            </View>
          )}

          <Pressable
            style={[styles.chatPrompt, { borderColor: colors.borderLight }]}
            onPress={() => router.push('/(tabs)/chat')}
          >
            <Text style={[styles.chatPromptText, { color: colors.accent }]}>
              {t('journey.chatPrompt')}
            </Text>
            <ChevronRight size={18} color={colors.accent} />
          </Pressable>
        </>
      ) : null}

      {isGeneratingSchedule && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.surface }]}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('journey.generatingSchedule')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerRight: {
    alignItems: 'center',
    gap: 8,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  headerGreeting: {
    fontFamily: Fonts.serifMedium,
    fontSize: 27,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  energyRingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  // ── Info Strip (Streak / Focus / Alarm) ──
  infoStripRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  infoChipValue: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as any,
  },
  infoChipLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  // ── Progress Card ──
  progressCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  progressStatItem: {
    alignItems: 'center',
    gap: 3,
  },
  progressStatValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as any,
  },
  progressStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  progressStatDivider: {
    width: 1,
    height: 28,
  },
  progressBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.1)',
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  quickAccessRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickAccessCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  quickAccessIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionCard: {
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  actionIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
  },
  dismissBtn: {
    padding: 12,
  },
  emptyCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  emptyIconRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: Fonts.serifMedium,
    fontSize: 22,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    gap: 10,
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  focusText: {
    fontFamily: Fonts.serifMedium,
    fontSize: 17,
    lineHeight: 25,
  },
  insightsWrap: {
    marginTop: 12,
    gap: 8,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  insightText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  weeklyGoal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  weeklyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  weeklyGoalText: {
    fontSize: 14,
    flex: 1,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    marginBottom: 16,
  },
  generateBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  goalItem: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  goalDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  taskItem: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taskItemCompleted: {
    opacity: 0.7,
  },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  taskMetaText: {
    fontSize: 11,
  },
  taskPctCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  taskPctFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 16,
  },
  taskPctText: {
    fontSize: 8,
    fontWeight: '700',
  },
  showCompletedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    gap: 4,
  },
  showCompletedText: {
    fontSize: 13,
    fontWeight: '500',
  },
  ideaItem: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  ideaText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ideaCategoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  ideaCategoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  problemItem: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  problemText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chatPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
    marginTop: 4,
    borderTopWidth: 1,
  },
  chatPromptText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingOverlay: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    fontSize: 14,
  },
  // ── Daily Focus Card ─────────────
  dailyFocusCard: {
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dailyFocusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  dailyFocusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(201,139,107,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyFocusLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  dailyFocusHeadline: {
    fontFamily: Fonts.serif,
    fontSize: 17,
  },
  dailyFocusSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  // ── Weekly Heatmap ──────────────
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  heatmapLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  heatmapDots: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  heatmapDayCol: {
    alignItems: 'center',
    gap: 3,
  },
  heatmapDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  heatmapDayText: {
    fontSize: 9,
    fontWeight: '500',
  },
});
