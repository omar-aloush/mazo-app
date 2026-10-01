import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  TextInput,
  Alert,
  Share,
  Linking,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
  I18nManager,
} from 'react-native';
import { SkeletonReferralCard } from '@/components/SkeletonLoader';
import { getOrCreateReferralCode, redeemReferral, getReferralStats } from '@/services/referral';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Brain,
  Users,
  User,
  ChevronRight,
  Heart,
  Target,
  CheckSquare,
  Lightbulb,
  AlertCircle,
  Clock,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
  Share2,
  Star,
  RotateCcw,
  Gift,
  Copy,
  UserPlus,
  Bell,
  Shield,
  FileText,
  Cloud,
  ShieldCheck,
} from 'lucide-react-native';
import { Crown, FileSearch } from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useApp } from '@/providers/AppProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { coaches } from '@/constants/coaches';
import Colors from '@/constants/colors';
import { AIFace } from '@/components/AIFace';
import { useTheme } from '@/providers/ThemeProvider';
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  scheduleDailyCheckin,
  cancelDailyCheckin,
  cancelAllNotifications,
  hasNotificationPermission,
  requestPermissions,
  NotificationPreferences,
} from '@/services/notifications';
import { useTranslation } from '@/hooks/useTranslation';
import { Globe2 } from 'lucide-react-native';
import { AlarmSettingsSection } from '@/components/AlarmSettingsSection';
import { WidgetSettingsSection } from '@/components/WidgetSettingsSection';

type SettingsSection = 'memory' | 'context' | 'aboutYou';
type MemorySubsection = 'preferences' | 'goals' | 'tasks' | 'ideas' | 'problems' | 'constraints';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    state,
    updateUserContext,
    updatePreference,
    deletePreference,
    deleteGoal,
    deleteTask,
    deleteAlarm,
    updateAlarm,
    addAlarm,
    resetApp,
    getUserId,
    trialDaysRemaining,
    isTrialActive,
    updateState,
  } = useApp();
  const { t, language, setLanguage: changeLanguage, languages } = useTranslation();
  const { user, isAuthenticated, isLoading: authLoading, signIn, signOut } = useAuth();

  // ── Referral System State ──
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralStatus, setReferralStatus] = useState<'idle' | 'disabled' | 'error' | 'success'>('idle');
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [redeemMessage, setRedeemMessage] = useState('');
  const [referralStats, setReferralStats] = useState({ totalReferred: 0, totalDaysEarned: 0 });

  // Load referral code + stats on mount
  useEffect(() => {
    const loadReferral = async () => {
      const userId = getUserId();
      if (!userId) return;
      setReferralLoading(true);
      try {
        const [result, stats] = await Promise.all([
          getOrCreateReferralCode(userId),
          getReferralStats(userId),
        ]);
        if (result.status === 'success') {
          setReferralCode(result.code);
          setReferralStatus('success');
        } else if (result.status === 'disabled') {
          setReferralStatus('disabled');
        } else {
          setReferralStatus('error');
          setReferralError(result.message);
        }
        setReferralStats(stats);
      } catch (e: any) {
        console.warn('[Settings] Referral load error:', e?.message || e);
        setReferralStatus('error');
        setReferralError('Could not load referral info.');
      } finally {
        setReferralLoading(false);
      }
    };
    loadReferral();
  }, []);

  const handleSignIn = async () => {
    const { success, error, user: signedInUser } = await signIn();
    if (!success) {
      Alert.alert('Sign In Failed', error || 'Could not connect account');
    } else {
      Alert.alert('Success', 'Account linked successfully!');
      // Link the current device ID to this auth user
      updateState({
        authUserId: signedInUser?.id,
        authEmail: signedInUser?.email,
        authDisplayName: signedInUser?.name,
        isAccountLinked: true,
      });
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your data will remain on this device but will stop syncing.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            const signedOut = await signOut();
            if (!signedOut) {
              Alert.alert('Sign Out Failed', 'Could not sign out. Check your connection and try again.');
              return;
            }
            updateState({ authUserId: undefined, authEmail: undefined, authDisplayName: undefined, isAccountLinked: false });
          }
        }
      ]
    );
  };

  const handleShareReferral = useCallback(async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message: `Hey! Try Mazō — the AI coaching app that actually changes how you think. Use my code ${referralCode} and we both get 3 days of Pro for FREE! 🔥\n\nhttps://mazo.app`,
      });
    } catch (e) { }
  }, [referralCode]);

  const handleCopyCode = useCallback(async () => {
    if (!referralCode) return;
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(referralCode);
    } catch (err: any) {
      console.warn('[Settings] Clipboard copy failed:', err?.message || err);
      try {
        await navigator.clipboard.writeText(referralCode);
      } catch (err: any) {
        console.warn('[Settings] Clipboard fallback failed:', err?.message || err);
      }
    }
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  }, [referralCode]);

  const handleRedeemFriendCode = useCallback(async () => {
    if (!friendCode.trim()) return;
    setRedeemStatus('loading');
    const userId = getUserId();
    const result = await redeemReferral(friendCode.trim().toUpperCase(), userId);
    if (result.success) {
      setRedeemStatus('success');
      setRedeemMessage(result.message);
      setFriendCode('');
      // Refresh stats
      const stats = await getReferralStats(userId);
      setReferralStats(stats);
      setTimeout(() => { setRedeemStatus('idle'); setRedeemMessage(''); }, 4000);
    } else {
      setRedeemStatus('error');
      setRedeemMessage(result.message);
      setTimeout(() => { setRedeemStatus('idle'); setRedeemMessage(''); }, 3000);
    }
  }, [friendCode, getUserId]);

  const { isDark, toggleTheme, colors } = useTheme();
  const { isPro, restore, isRestoring, subscriptionSource, voucherExpiresAt } = useSubscription();

  const handleRestorePurchases = useCallback(async () => {
    try {
      await restore();
      // The SubscriptionProvider will update isPro automatically after sync
      setTimeout(() => {
        Alert.alert(
          t('settings.restore'),
          t('paywall.restored')
        );
      }, 500);
    } catch (error) {
      console.warn('[Settings] Restore error:', error);
      Alert.alert(
        t('settings.restore'),
        t('paywall.restoreFail')
      );
    }
  }, [restore]);

  const { memory, userContext, selectedCoachId } = state;

  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
  const [expandedMemory, setExpandedMemory] = useState<Record<MemorySubsection, boolean>>({
    preferences: true,
    goals: true,
    tasks: false,
    ideas: false,
    problems: false,
    constraints: false,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const [contextValues, setContextValues] = useState(userContext.values);
  const [contextFocus, setContextFocus] = useState(userContext.currentFocus);
  const [contextConstraints, setContextConstraints] = useState(userContext.constraints);
  const [userName, setUserName] = useState(userContext.name || '');
  const [userAge, setUserAge] = useState(userContext.age || '');

  // ── Notification Preferences State ──
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [notifPermission, setNotifPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const hasPerms = await hasNotificationPermission();
      setNotifPermission(hasPerms);
      const prefs = await getNotificationPrefs();
      setNotifPrefs(prefs);
    })();
  }, []);

  const toggleNotifPref = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    if (!notifPrefs) return;

    // If enabling and no permission, request it first
    if (value && !notifPermission) {
      const granted = await requestPermissions();
      setNotifPermission(granted);
      if (!granted) return;
    }

    const updated = await saveNotificationPrefs({ [key]: value });
    setNotifPrefs(updated);

    // Toggle daily check-in scheduling
    if (key === 'dailyCheckinEnabled') {
      if (value) {
        scheduleDailyCheckin(updated.dailyCheckinHour).catch(() => { });
      } else {
        cancelDailyCheckin().catch(() => { });
      }
    }
  }, [notifPrefs, notifPermission]);

  const toggleMemorySection = useCallback((section: MemorySubsection) => {
    setExpandedMemory((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const handleEditPreference = useCallback((id: string, currentValue: string) => {
    setEditingId(id);
    setEditValue(currentValue);
  }, []);

  const handleSavePreference = useCallback((id: string) => {
    if (editValue.trim()) {
      updatePreference(id, { value: editValue.trim() });
    }
    setEditingId(null);
    setEditValue('');
  }, [editValue, updatePreference]);

  const handleDeletePreference = useCallback((id: string) => {
    Alert.alert(
      t('settings.deleteMemoryTitle'),
      t('settings.deleteMemoryConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deletePreference(id) },
      ]
    );
  }, [deletePreference]);

  const handleDeleteGoal = useCallback((id: string) => {
    Alert.alert(
      t('settings.deleteGoalTitle'),
      t('settings.deleteGoalConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteGoal(id) },
      ]
    );
  }, [deleteGoal]);

  const handleDeleteTask = useCallback((id: string) => {
    Alert.alert(
      t('settings.deleteTaskTitle'),
      t('settings.deleteTaskConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteTask(id) },
      ]
    );
  }, [deleteTask]);

  const handleContextChange = useCallback((field: 'values' | 'currentFocus' | 'constraints', value: string) => {
    if (field === 'values') setContextValues(value);
    if (field === 'currentFocus') setContextFocus(value);
    if (field === 'constraints') setContextConstraints(value);
    updateUserContext({ [field]: value });
  }, [updateUserContext]);

  const handleAboutYouChange = useCallback((field: 'name' | 'age', value: string) => {
    if (field === 'name') setUserName(value);
    if (field === 'age') setUserAge(value);
    updateUserContext({ [field]: value });
  }, [updateUserContext]);

  const handleRestoreApp = useCallback(() => {
    Alert.alert(
      t('settings.restoreAppTitle'),
      t('settings.restoreAppConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.restore'),
          style: 'destructive',
          onPress: async () => {
            const reset = await resetApp();
            if (!reset) {
              Alert.alert('Reset Failed', 'Could not clear local app data. Please try again.');
              return;
            }
            router.replace('/mazo-intro');
          },
        },
      ]
    );
  }, [resetApp, router]);

  const handleDeleteMyData = useCallback(() => {
    Alert.alert(
      t('settings.deleteMyData'),
      t('settings.deleteMyDataConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const reset = await resetApp();
            if (!reset) {
              Alert.alert('Deletion Failed', 'Could not clear local app data. Please try again.');
              return;
            }
            router.replace('/mazo-intro');
          },
        },
      ]
    );
  }, [resetApp, router]);

  const getCategoryLabel = (category?: string) => {
    const labels: Record<string, string> = {
      like: t('memory.categories.like'),
      dislike: t('memory.categories.dislike'),
      value: t('memory.categories.value'),
      habit: t('memory.categories.habit'),
      interest: t('memory.categories.interest'),
      other: t('memory.categories.other'),
    };
    return labels[category || 'other'] || t('memory.categories.other');
  };

  const groupedPreferences = useMemo(() => memory.preferences.reduce((acc, pref) => {
    const category = pref.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(pref);
    return acc;
  }, {} as Record<string, typeof memory.preferences>), [memory.preferences]);

  const memoryCount = useMemo(() => memory.preferences.length + memory.goals.length + memory.tasks.length +
    memory.ideas.length + memory.problems.length + memory.constraints.length, [memory]);

  const selectedCoach = useMemo(() => coaches.find(c => c.id === selectedCoachId), [selectedCoachId]);

  const renderMemoryContent = () => (
    <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
      {memoryCount === 0 ? (
        <View style={styles.emptyState}>
          <Brain size={40} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.text }]}>{t('memory.noMemories')}</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>{t('memory.noMemoriesDesc')}</Text>
        </View>
      ) : (
        <>
          {memory.preferences.length > 0 && (
            <View style={[styles.memorySection, { backgroundColor: colors.backgroundSecondary }]}>
              <Pressable
                style={styles.memorySectionHeader}
                onPress={() => toggleMemorySection('preferences')}
              >
                <Heart size={18} color={colors.accent} />
                <Text style={[styles.memorySectionTitle, { color: colors.text }]}>{t('memory.preferencesValues')}</Text>
                <Text style={[styles.memorySectionCount, { backgroundColor: colors.background, color: colors.textTertiary }]}>{memory.preferences.length}</Text>
                {expandedMemory.preferences ? (
                  <ChevronUp size={18} color={colors.textTertiary} />
                ) : (
                  <ChevronDown size={18} color={colors.textTertiary} />
                )}
              </Pressable>

              {expandedMemory.preferences && (
                <View style={styles.memorySectionContent}>
                  {Object.entries(groupedPreferences).map(([category, prefs]) => (
                    <View key={category} style={styles.categoryGroup}>
                      <Text style={[styles.categoryLabel, { color: colors.accent }]}>{getCategoryLabel(category)}</Text>
                      {prefs.map((pref) => (
                        <View key={pref.id} style={[styles.memoryItem, { backgroundColor: colors.background }]}>
                          {editingId === pref.id ? (
                            <View style={styles.editContainer}>
                              <TextInput
                                style={[styles.editInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                                value={editValue}
                                onChangeText={setEditValue}
                                autoFocus
                                multiline
                              />
                              <Pressable
                                style={styles.editButton}
                                onPress={() => handleSavePreference(pref.id)}
                              >
                                <Check size={18} color={colors.success} />
                              </Pressable>
                              <Pressable
                                style={styles.editButton}
                                onPress={() => setEditingId(null)}
                              >
                                <X size={18} color={colors.textTertiary} />
                              </Pressable>
                            </View>
                          ) : (
                            <>
                              <Text style={[styles.memoryText, { color: colors.text }]}>{pref.value}</Text>
                              <View style={styles.memoryActions}>
                                <Pressable
                                  style={styles.actionButton}
                                  onPress={() => handleEditPreference(pref.id, pref.value)}
                                  hitSlop={8}
                                >
                                  <Edit3 size={16} color={colors.textTertiary} />
                                </Pressable>
                                <Pressable
                                  style={styles.actionButton}
                                  onPress={() => handleDeletePreference(pref.id)}
                                  hitSlop={8}
                                >
                                  <Trash2 size={16} color={colors.error} />
                                </Pressable>
                              </View>
                            </>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {memory.goals.length > 0 && (
            <View style={[styles.memorySection, { backgroundColor: colors.backgroundSecondary }]}>
              <Pressable
                style={styles.memorySectionHeader}
                onPress={() => toggleMemorySection('goals')}
              >
                <Target size={18} color={colors.accent} />
                <Text style={[styles.memorySectionTitle, { color: colors.text }]}>{t('journey.activeGoals')}</Text>
                <Text style={[styles.memorySectionCount, { backgroundColor: colors.background, color: colors.textTertiary }]}>{memory.goals.length}</Text>
                {expandedMemory.goals ? (
                  <ChevronUp size={18} color={colors.textTertiary} />
                ) : (
                  <ChevronDown size={18} color={colors.textTertiary} />
                )}
              </Pressable>

              {expandedMemory.goals && (
                <View style={styles.memorySectionContent}>
                  {memory.goals.map((goal) => (
                    <View key={goal.id} style={[styles.goalItem, { backgroundColor: colors.background }]}>
                      <View style={styles.goalContent}>
                        <Text style={[styles.goalTitle, { color: colors.text }]}>{goal.title}</Text>
                        <Text style={[styles.goalDescription, { color: colors.textSecondary }]}>{goal.description}</Text>
                        <View style={styles.goalMeta}>
                          <View style={[
                            styles.badge,
                            { backgroundColor: isDark ? colors.backgroundSecondary : colors.border },
                            goal.priority === 'high' && { backgroundColor: isDark ? 'rgba(224, 128, 128, 0.15)' : '#FDECEA' },
                            goal.priority === 'medium' && { backgroundColor: isDark ? 'rgba(224, 184, 138, 0.15)' : '#FEF3E2' },
                          ]}>
                            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{goal.priority}</Text>
                          </View>
                          <View style={[
                            styles.badge,
                            { backgroundColor: isDark ? colors.backgroundSecondary : colors.border },
                            goal.status === 'active' && { backgroundColor: colors.accentLight },
                          ]}>
                            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{goal.status}</Text>
                          </View>
                        </View>
                      </View>
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => handleDeleteGoal(goal.id)}
                        hitSlop={8}
                      >
                        <Trash2 size={16} color={colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {memory.tasks.length > 0 && (
            <View style={[styles.memorySection, { backgroundColor: colors.backgroundSecondary }]}>
              <Pressable
                style={styles.memorySectionHeader}
                onPress={() => toggleMemorySection('tasks')}
              >
                <CheckSquare size={18} color={colors.accent} />
                <Text style={[styles.memorySectionTitle, { color: colors.text }]}>{t('journey.pendingTasks')}</Text>
                <Text style={[styles.memorySectionCount, { backgroundColor: colors.background, color: colors.textTertiary }]}>{memory.tasks.length}</Text>
                {expandedMemory.tasks ? (
                  <ChevronUp size={18} color={colors.textTertiary} />
                ) : (
                  <ChevronDown size={18} color={colors.textTertiary} />
                )}
              </Pressable>

              {expandedMemory.tasks && (
                <View style={styles.memorySectionContent}>
                  {memory.tasks.map((task) => (
                    <View key={task.id} style={[styles.taskItem, { backgroundColor: colors.background }]}>
                      <View style={styles.taskContent}>
                        <Text style={[
                          styles.taskTitle,
                          { color: colors.text },
                          task.status === 'completed' && [styles.taskCompleted, { color: colors.textTertiary }],
                        ]}>
                          {task.title}
                        </Text>
                        {task.estimatedMinutes && (
                          <View style={styles.taskMeta}>
                            <Clock size={12} color={colors.textTertiary} />
                            <Text style={[styles.taskMetaText, { color: colors.textSecondary }]}>
                              {task.estimatedMinutes} min
                            </Text>
                          </View>
                        )}
                      </View>
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => handleDeleteTask(task.id)}
                        hitSlop={8}
                      >
                        <Trash2 size={16} color={colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {memory.ideas.length > 0 && (
            <View style={[styles.memorySection, { backgroundColor: colors.backgroundSecondary }]}>
              <Pressable
                style={styles.memorySectionHeader}
                onPress={() => toggleMemorySection('ideas')}
              >
                <Lightbulb size={18} color={colors.accent} />
                <Text style={[styles.memorySectionTitle, { color: colors.text }]}>{t('common.ideas')}</Text>
                <Text style={[styles.memorySectionCount, { backgroundColor: colors.background, color: colors.textTertiary }]}>{memory.ideas.length}</Text>
                {expandedMemory.ideas ? (
                  <ChevronUp size={18} color={colors.textTertiary} />
                ) : (
                  <ChevronDown size={18} color={colors.textTertiary} />
                )}
              </Pressable>

              {expandedMemory.ideas && (
                <View style={styles.memorySectionContent}>
                  {memory.ideas.map((idea) => (
                    <View key={idea.id} style={[styles.ideaItem, { backgroundColor: colors.background }]}>
                      <Text style={[styles.ideaText, { color: colors.text }]}>{idea.content}</Text>
                      {idea.category && (
                        <Text style={[styles.ideaCategory, { color: colors.textSecondary }]}>{idea.category}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {memory.problems.length > 0 && (
            <View style={[styles.memorySection, { backgroundColor: colors.backgroundSecondary }]}>
              <Pressable
                style={styles.memorySectionHeader}
                onPress={() => toggleMemorySection('problems')}
              >
                <AlertCircle size={18} color={colors.warning} />
                <Text style={[styles.memorySectionTitle, { color: colors.text }]}>{t('common.openChallenges')}</Text>
                <Text style={[styles.memorySectionCount, { backgroundColor: colors.background, color: colors.textTertiary }]}>{memory.problems.length}</Text>
                {expandedMemory.problems ? (
                  <ChevronUp size={18} color={colors.textTertiary} />
                ) : (
                  <ChevronDown size={18} color={colors.textTertiary} />
                )}
              </Pressable>

              {expandedMemory.problems && (
                <View style={styles.memorySectionContent}>
                  {memory.problems.map((problem) => (
                    <View key={problem.id} style={[styles.problemItem, { backgroundColor: colors.background }]}>
                      <Text style={[styles.problemText, { color: colors.text }]}>{problem.description}</Text>
                      <View style={[
                        styles.badge,
                        { backgroundColor: isDark ? colors.backgroundSecondary : colors.border },
                        problem.urgency === 'high' && { backgroundColor: isDark ? 'rgba(224, 128, 128, 0.15)' : '#FDECEA' },
                      ]}>
                        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{problem.urgency}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {memory.constraints.length > 0 && (
            <View style={[styles.memorySection, { backgroundColor: colors.backgroundSecondary }]}>
              <Pressable
                style={styles.memorySectionHeader}
                onPress={() => toggleMemorySection('constraints')}
              >
                <Clock size={18} color={colors.textSecondary} />
                <Text style={[styles.memorySectionTitle, { color: colors.text }]}>{t('journey.constraints')}</Text>
                <Text style={[styles.memorySectionCount, { backgroundColor: colors.background, color: colors.textTertiary }]}>{memory.constraints.length}</Text>
                {expandedMemory.constraints ? (
                  <ChevronUp size={18} color={colors.textTertiary} />
                ) : (
                  <ChevronDown size={18} color={colors.textTertiary} />
                )}
              </Pressable>

              {expandedMemory.constraints && (
                <View style={styles.memorySectionContent}>
                  {memory.constraints.map((constraint) => (
                    <View key={constraint.id} style={[styles.constraintItem, { backgroundColor: colors.background }]}>
                      <Text style={[styles.constraintText, { color: colors.text }]}>{constraint.description}</Text>
                      <View style={[styles.badge, { backgroundColor: isDark ? colors.backgroundSecondary : colors.border }]}>
                        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{constraint.type}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderContextContent = () => (
    <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
      <Text style={[styles.contextIntro, { color: colors.textSecondary }]}>
        {t('settings.contextIntro')}
      </Text>

      <View style={styles.contextField}>
        <Text style={[styles.contextLabel, { color: colors.text }]}>{t('onboarding.whatMatters')}</Text>
        <Text style={[styles.contextHint, { color: colors.textTertiary }]}>{t('settings.contextValuesHint')}</Text>
        <TextInput
          style={[styles.contextInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
          value={contextValues}
          onChangeText={(text) => handleContextChange('values', text)}
          placeholder={t('settings.contextValuesPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.contextField}>
        <Text style={[styles.contextLabel, { color: colors.text }]}>{t('onboarding.currentFocus')}</Text>
        <Text style={[styles.contextHint, { color: colors.textTertiary }]}>{t('settings.contextFocusHint')}</Text>
        <TextInput
          style={[styles.contextInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
          value={contextFocus}
          onChangeText={(text) => handleContextChange('currentFocus', text)}
          placeholder={t('settings.contextFocusPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.contextField}>
        <Text style={[styles.contextLabel, { color: colors.text }]}>{t('journey.constraints')}</Text>
        <Text style={[styles.contextHint, { color: colors.textTertiary }]}>{t('settings.contextConstraintsHint')}</Text>
        <TextInput
          style={[styles.contextInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
          value={contextConstraints}
          onChangeText={(text) => handleContextChange('constraints', text)}
          placeholder={t('settings.contextConstraintsPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
        />
      </View>

      <Text style={[styles.contextFooter, { color: colors.textTertiary }]}>
        {t('settings.contextFooter')}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMid, colors.background]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <AIFace expression="happy" size={56} />
            <Text style={[styles.pageTitle, { color: colors.text }]}>{t('settings.title')}</Text>
          </View>
        </View>

        {isPro && isTrialActive && subscriptionSource === 'trial' ? (
          <View style={[styles.proButton, { backgroundColor: isDark ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(245,158,11,0.20)' : 'rgba(245,158,11,0.12)', flexDirection: 'column', alignItems: 'stretch', paddingVertical: 14, paddingHorizontal: 16 }]}>
            {/* Header row */}
            <View style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' }}>
                  <Crown size={16} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{t('settings.proActive')}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>{t('settings.sourceTrial')}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: trialDaysRemaining <= 2 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                <Text style={{ color: trialDaysRemaining <= 2 ? '#EF4444' : '#F59E0B', fontSize: 11, fontWeight: '700' }}>
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={{ height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: 14 }}>
              <View style={{ height: '100%', borderRadius: 2, width: `${Math.max(5, (trialDaysRemaining / 7) * 100)}%`, backgroundColor: trialDaysRemaining <= 2 ? '#EF4444' : '#F59E0B' }} />
            </View>

            {/* Upgrade button */}
            <Pressable
              onPress={() => router.push('/paywall')}
              style={({ pressed }) => [{
                backgroundColor: '#F59E0B',
                borderRadius: 10,
                paddingVertical: 11,
                alignItems: 'center',
                flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
                justifyContent: 'center',
                gap: 6,
              }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            >
              <Crown size={14} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>Upgrade to Pro</Text>
            </Pressable>
          </View>
        ) : isPro && subscriptionSource === 'voucher' && voucherExpiresAt ? (
          <View style={[styles.proButton, { backgroundColor: isDark ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.06)', borderWidth: 1, borderColor: isDark ? 'rgba(245,158,11,0.20)' : 'rgba(245,158,11,0.12)', flexDirection: 'column', alignItems: 'stretch', paddingVertical: 14, paddingHorizontal: 16 }]}>
            <View style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' }}>
                  <Crown size={16} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{t('settings.proActive')}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>{t('settings.sourceVoucher')}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: Math.ceil((new Date(voucherExpiresAt).getTime() - Date.now()) / 86400000) <= 3 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                <Text style={{ color: Math.ceil((new Date(voucherExpiresAt).getTime() - Date.now()) / 86400000) <= 3 ? '#EF4444' : '#F59E0B', fontSize: 11, fontWeight: '700' }}>
                  {Math.max(0, Math.ceil((new Date(voucherExpiresAt).getTime() - Date.now()) / 86400000))} days left
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: I18nManager.isRTL ? 'right' : 'left' }}>
              Expires on {new Date(voucherExpiresAt).toLocaleDateString()}
            </Text>
          </View>
        ) : isPro ? (
          <View style={[styles.proButton, { backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.15)', flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }]}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={18} color="#F59E0B" />
            </View>
            <View style={[styles.proButtonContent, { flex: 1 }]}>
              <Text style={[styles.proButtonTitle, { color: '#F59E0B' }]}>{t('settings.proActive')}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                {t('settings.proActiveDesc')}
                {subscriptionSource ? ` · ${t('settings.subscriptionVia', { source: subscriptionSource === 'iap' ? t('settings.sourceIAP') : subscriptionSource === 'voucher' ? t('settings.sourceVoucher') : subscriptionSource === 'trial' ? t('settings.sourceTrial') : t('settings.sourceAdmin') })}` : ''}
              </Text>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/paywall')}
            style={[styles.proButton, { backgroundColor: colors.accent, flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }]}
          >
            <Crown size={18} color="#FFFFFF" />
            <View style={styles.proButtonContent}>
              <Text style={styles.proButtonTitle}>{t('paywall.title')}</Text>
              <Text style={styles.proButtonSubtitle}>{t('settings.proSubtitle')}</Text>
            </View>
            <ChevronRight size={18} color="rgba(255,255,255,0.7)" style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
          </Pressable>
        )}

        {/* Subscription management — Manage or Restore */}
        <View style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
          {isPro && (
            <Pressable
              onPress={() => {
                const url = Platform.OS === 'ios'
                  ? 'https://apps.apple.com/account/subscriptions'
                  : 'https://play.google.com/store/account/subscriptions';
                Linking.openURL(url);
              }}
              style={({ pressed }) => [{ paddingVertical: 10, paddingHorizontal: 20 }, pressed && { opacity: 0.6 }]}
            >
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' as const }}>
                {t('settings.manageSubscription')}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleRestorePurchases}
            disabled={isRestoring}
            style={({ pressed }) => [{ paddingVertical: 10, paddingHorizontal: 20 }, pressed && { opacity: 0.6 }]}
          >
            <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: '500' as const }}>
              {isRestoring ? 'Restoring...' : t('paywall.restorePurchase')}
            </Text>
          </Pressable>
        </View>

        {/* Account Linking Section */}
        <View style={styles.appearanceSection}>
          <Text style={[styles.appearanceSectionTitle, { color: colors.textSecondary }]}>Account</Text>
          <View style={[styles.appearanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {authLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : isAuthenticated ? (
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <ShieldCheck size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Account Linked ✓</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{user?.email}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={handleSignOut}
                  style={({ pressed }) => [
                    { paddingVertical: 10, alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
                    pressed && { opacity: 0.7 }
                  ]}
                >
                  <Text style={{ color: colors.error, fontWeight: '600', fontSize: 14 }}>Sign Out</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Cloud size={20} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Link Your Account</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Secure your sign-in and make subscription recovery easier.</Text>
                  </View>
                </View>
                
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  onPress={handleSignIn}
                  style={({ pressed }) => [
                    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: colors.text, borderRadius: 10, gap: 8 },
                    pressed && { opacity: 0.8 }
                  ]}
                >
                  <Text style={{ color: colors.background, fontWeight: '600', fontSize: 15 }}>Continue with Google</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.appearanceSection}>
          <Text style={[styles.appearanceSectionTitle, { color: colors.textSecondary }]}>{t('settings.appearance')}</Text>
          <View style={[styles.appearanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.appearanceRow}>
              <View style={styles.appearanceRowLeft}>
                {isDark ? (
                  <Moon size={20} color={colors.accent} />
                ) : (
                  <Sun size={20} color={colors.accent} />
                )}
                <Text style={[styles.appearanceLabel, { color: colors.text }]}>{t('settings.darkMode')}</Text>
              </View>
              <Pressable onPress={toggleTheme} style={styles.togglePill}>
                <View style={[styles.toggleTrack, isDark && styles.toggleTrackActive, { backgroundColor: isDark ? colors.accent : colors.border }]}>
                  <View style={[styles.toggleThumb, isDark && styles.toggleThumbActive, { backgroundColor: isDark ? colors.background : colors.surface }]} />
                </View>
                <Text style={[styles.toggleText, { color: colors.textSecondary }]}>{isDark ? t('common.on') : t('common.off')}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Notification Preferences */}
        {notifPrefs && (
          <View style={styles.appearanceSection}>
            <Text style={[styles.appearanceSectionTitle, { color: colors.textSecondary }]}>{t('settings.notifications')}</Text>
            <View style={[styles.appearanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.appearanceRow}>
                <View style={styles.appearanceRowLeft}>
                  <Bell size={20} color={colors.accent} />
                  <View>
                    <Text style={[styles.appearanceLabel, { color: colors.text }]}>{t('settings.dailyCheckin')}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>{t('settings.dailyCheckinDesc')}</Text>
                  </View>
                </View>
                <Switch
                  value={notifPrefs.dailyCheckinEnabled}
                  onValueChange={(v) => toggleNotifPref('dailyCheckinEnabled', v)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#FFF"
                />
              </View>
              <View style={[{ height: 1, backgroundColor: colors.border, marginVertical: 8 }]} />
              <View style={styles.appearanceRow}>
                <View style={styles.appearanceRowLeft}>
                  <Clock size={20} color={colors.accent} />
                  <View>
                    <Text style={[styles.appearanceLabel, { color: colors.text }]}>{t('settings.habitReminders')}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>{t('settings.habitRemindersDesc')}</Text>
                  </View>
                </View>
                <Switch
                  value={notifPrefs.habitRemindersEnabled}
                  onValueChange={(v) => toggleNotifPref('habitRemindersEnabled', v)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#FFF"
                />
              </View>
              <View style={[{ height: 1, backgroundColor: colors.border, marginVertical: 8 }]} />
              <View style={styles.appearanceRow}>
                <View style={styles.appearanceRowLeft}>
                  <Star size={20} color={colors.accent} />
                  <View>
                    <Text style={[styles.appearanceLabel, { color: colors.text }]}>{t('settings.streakAlerts')}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>{t('settings.streakAlertsDesc')}</Text>
                  </View>
                </View>
                <Switch
                  value={notifPrefs.streakAlertsEnabled}
                  onValueChange={(v) => toggleNotifPref('streakAlertsEnabled', v)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#FFF"
                />
              </View>
            </View>
          </View>
        )}

        {/* Alarms Management — Always visible with Add Alarm */}
        <AlarmSettingsSection
          alarms={state.memory?.alarms || []}
          colors={colors}
          isDark={isDark}
          onDelete={deleteAlarm}
          onUpdate={updateAlarm}
          addAlarm={addAlarm}
        />

        {/* Widget Settings */}
        <WidgetSettingsSection colors={colors} isDark={isDark} />

        {/* Language Picker */}
        <View style={styles.appearanceSection}>
          <Text style={[styles.appearanceSectionTitle, { color: colors.textSecondary }]}>{t('settings.language')}</Text>
          <View style={[styles.appearanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {languages.map((lang, index) => (
              <React.Fragment key={lang.code}>
                {index > 0 && <View style={[{ height: 1, backgroundColor: colors.border, marginVertical: 8 }]} />}
                <Pressable
                  style={styles.appearanceRow}
                  onPress={() => {
                    if (lang.code !== language) {
                      changeLanguage(lang.code);
                      if (lang.code === 'ar' || language === 'ar') {
                        Alert.alert(
                          t('settings.languageChanged'),
                          t('settings.restartForRTL'),
                          [{ text: t('common.ok') }]
                        );
                      }
                    }
                  }}
                >
                  <View style={styles.appearanceRowLeft}>
                    <Globe2 size={20} color={colors.accent} />
                    <Text style={[styles.appearanceLabel, { color: colors.text }]}>{lang.nativeName}</Text>
                  </View>
                  <View style={[{
                    width: 22, height: 22, borderRadius: 11,
                    borderWidth: 2, borderColor: language === lang.code ? colors.accent : colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }]}>
                    {language === lang.code && (
                      <View style={[{
                        width: 12, height: 12, borderRadius: 6,
                        backgroundColor: colors.accent,
                      }]} />
                    )}
                  </View>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.sectionsContainer}>
          <Pressable
            style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/memory')}
          >
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionCardIcon, { backgroundColor: colors.accentLight }]}>
                <Brain size={22} color={colors.accent} />
              </View>
              <View style={styles.sectionCardInfo}>
                <Text style={[styles.sectionCardTitle, { color: colors.text }]}>{t('memory.title')}</Text>
                <Text style={[styles.sectionCardSubtitle, { color: colors.textSecondary }]}>
                  {t('memory.itemsStored', { count: memoryCount })}
                </Text>
              </View>
              <ChevronRight
                size={20}
                color={colors.textTertiary}
              />
            </View>
          </Pressable>

          <Pressable
            style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/coaches')}
          >
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionCardIcon, { backgroundColor: colors.accentLight }]}>
                <Users size={22} color={colors.accent} />
              </View>
              <View style={styles.sectionCardInfo}>
                <Text style={[styles.sectionCardTitle, { color: colors.text }]}>{t('coaches.title')}</Text>
                <Text style={[styles.sectionCardSubtitle, { color: colors.textSecondary }]}>
                  {selectedCoach ? t('coaches.current', { name: t(selectedCoach.name) }) : t('coaches.browseCreate')}
                </Text>
              </View>
              <ChevronRight
                size={20}
                color={colors.textTertiary}
              />
            </View>
          </Pressable>

          <Pressable
            style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/documents' as any)}
          >
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionCardIcon, { backgroundColor: colors.accentLight }]}>
                <FileSearch size={22} color={colors.accent} />
              </View>
              <View style={styles.sectionCardInfo}>
                <Text style={[styles.sectionCardTitle, { color: colors.text }]}>Find a document</Text>
                <Text style={[styles.sectionCardSubtitle, { color: colors.textSecondary }]}>
                  Ask Mazō where your files are
                </Text>
              </View>
              <ChevronRight
                size={20}
                color={colors.textTertiary}
              />
            </View>
          </Pressable>

          <Pressable
            style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/community')}
          >
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionCardIcon, { backgroundColor: colors.accentLight }]}>
                <Users size={22} color={colors.accent} />
              </View>
              <View style={styles.sectionCardInfo}>
                <Text style={[styles.sectionCardTitle, { color: colors.text }]}>{t('community.title')}</Text>
                <Text style={[styles.sectionCardSubtitle, { color: colors.textSecondary }]}>
                  {t('coaches.discoverCommunity')}
                </Text>
              </View>
              <ChevronRight
                size={20}
                color={colors.textTertiary}
              />
            </View>
          </Pressable>

          <Pressable
            style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/focus-guardian')}
          >
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionCardIcon, { backgroundColor: colors.accentLight }]}>
                <ShieldCheck size={22} color={colors.accent} />
              </View>
              <View style={styles.sectionCardInfo}>
                <Text style={[styles.sectionCardTitle, { color: colors.text }]}>Focus Guardian</Text>
                <Text style={[styles.sectionCardSubtitle, { color: colors.textSecondary }]}>
                  Block distracting apps during focus sessions
                </Text>
              </View>
              <ChevronRight
                size={20}
                color={colors.textTertiary}
              />
            </View>
          </Pressable>

          <Pressable
            style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }, activeSection === 'aboutYou' && { borderWidth: 1, borderColor: colors.accentLight }]}
            onPress={() => setActiveSection(activeSection === 'aboutYou' ? null : 'aboutYou')}
          >
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionCardIcon, { backgroundColor: colors.accentLight }]}>
                <User size={22} color={colors.accent} />
              </View>
              <View style={styles.sectionCardInfo}>
                <Text style={[styles.sectionCardTitle, { color: colors.text }]}>{t('settings.aboutYou')}</Text>
                <Text style={[styles.sectionCardSubtitle, { color: colors.textSecondary }]}>
                  {userName ? userName : t('settings.aboutYouSubtitle')}
                </Text>
              </View>
              <ChevronRight
                size={20}
                color={colors.textTertiary}
                style={activeSection === 'aboutYou' ? { transform: [{ rotate: '90deg' }] } : undefined}
              />
            </View>
          </Pressable>
          {activeSection === 'aboutYou' && (
            <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.contextIntro, { color: colors.textSecondary }]}>
                {t('settings.aboutYouIntro')}
              </Text>

              <View style={styles.contextField}>
                <Text style={[styles.contextLabel, { color: colors.text }]}>{t('settings.yourName')}</Text>
                <Text style={[styles.contextHint, { color: colors.textTertiary }]}>{t('settings.yourNameHint')}</Text>
                <TextInput
                  style={[styles.aboutYouInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  value={userName}
                  onChangeText={(text) => handleAboutYouChange('name', text)}
                  placeholder={t('settings.enterYourName')}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.contextField}>
                <Text style={[styles.contextLabel, { color: colors.text }]}>{t('settings.yourAge')}</Text>
                <Text style={[styles.contextHint, { color: colors.textTertiary }]}>{t('settings.yourAgeHint')}</Text>
                <TextInput
                  style={[styles.aboutYouInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  value={userAge}
                  onChangeText={(text) => handleAboutYouChange('age', text)}
                  placeholder={t('settings.agePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                />
              </View>

              <Text style={[styles.contextFooter, { color: colors.textTertiary }]}>
                {t('settings.aboutYouFooter')}
              </Text>
            </View>
          )}

          <Pressable
            style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }, activeSection === 'context' && { borderWidth: 1, borderColor: colors.accentLight }]}
            onPress={() => setActiveSection(activeSection === 'context' ? null : 'context')}
          >
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionCardIcon, { backgroundColor: colors.accentLight }]}>
                <Heart size={22} color={colors.accent} />
              </View>
              <View style={styles.sectionCardInfo}>
                <Text style={[styles.sectionCardTitle, { color: colors.text }]}>{t('settings.context')}</Text>
                <Text style={[styles.sectionCardSubtitle, { color: colors.textSecondary }]}>{t('settings.contextSubtitle')}</Text>
              </View>
              <ChevronRight
                size={20}
                color={colors.textTertiary}
                style={activeSection === 'context' ? { transform: [{ rotate: '90deg' }] } : undefined}
              />
            </View>
          </Pressable>
          {activeSection === 'context' && renderContextContent()}
        </View>

        <View style={styles.aboutSection}>
          <Text style={[styles.aboutSectionTitle, { color: colors.textSecondary }]}>{t('settings.about')}</Text>
          <Pressable
            style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => Linking.openURL('https://apps.apple.com')}
          >
            <View style={styles.aboutRow}>
              <Star size={20} color={colors.accent} />
              <Text style={[styles.aboutLabel, { color: colors.text }]}>{t('settings.rateApp')}</Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </Pressable>
          <Pressable
            style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => Share.share({ message: t('settings.shareMessage') })}
          >
            <View style={styles.aboutRow}>
              <Share2 size={20} color={colors.accent} />
              <Text style={[styles.aboutLabel, { color: colors.text }]}>{t('settings.shareApp')}</Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </Pressable>
          <Pressable
            style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/privacy-policy')}
          >
            <View style={styles.aboutRow}>
              <Shield size={20} color={colors.accent} />
              <Text style={[styles.aboutLabel, { color: colors.text }]}>{t('settings.privacyPolicy')}</Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </Pressable>
          <Pressable
            style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/terms-of-service')}
          >
            <View style={styles.aboutRow}>
              <FileText size={20} color={colors.accent} />
              <Text style={[styles.aboutLabel, { color: colors.text }]}>{t('settings.termsOfService')}</Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </Pressable>
        </View>

        {/* ── 🎁 REFERRAL SYSTEM — The Growth Engine ── */}
        <View style={styles.referralSection}>
          <View style={[styles.referralCard, { backgroundColor: colors.surface, borderColor: colors.accent + '40' }]}>
            <View style={styles.referralHeader}>
              <View style={[styles.referralIconWrap, { backgroundColor: colors.accent + '20' }]}>
                <Gift size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.referralTitle, { color: colors.text }]}>{t('settings.inviteFriends')}</Text>
                <Text style={[styles.referralSubtitle, { color: colors.textSecondary }]}>
                  {t('settings.inviteFriendsDesc')}
                </Text>
              </View>
            </View>

            {/* Your Referral Code */}
            {referralLoading ? (
              <SkeletonReferralCard style={{ borderWidth: 0, padding: 0, backgroundColor: 'transparent' }} />
            ) : referralStatus === 'disabled' ? (
              <View style={[styles.referralComingSoon, { backgroundColor: colors.accent + '08' }]}>
                <Text style={[styles.referralComingSoonEmoji]}>🚀</Text>
                <Text style={[styles.referralComingSoonTitle, { color: colors.text }]}>{t('common.comingSoon')}</Text>
                <Text style={[styles.referralComingSoonText, { color: colors.textSecondary }]}>
                  {t('settings.referralComingSoon')}
                </Text>
              </View>
            ) : referralStatus === 'error' ? (
              <View style={[styles.referralErrorWrap, { backgroundColor: '#FEF2F2' }]}>
                <Text style={[styles.referralErrorText, { color: '#DC2626' }]}>
                  {referralError || t('settings.referralError')}
                </Text>
              </View>
            ) : referralCode ? (
              <View style={styles.referralCodeSection}>
                <Text style={[styles.referralCodeLabel, { color: colors.textSecondary }]}>{t('settings.referralCode')}</Text>
                <View style={[styles.referralCodeBox, { backgroundColor: colors.background, borderColor: colors.accent + '30' }]}>
                  <Text style={[styles.referralCodeText, { color: colors.accent }]}>{referralCode}</Text>
                  <Pressable
                    style={[styles.referralCopyBtn, { backgroundColor: colors.accent + '20' }]}
                    onPress={handleCopyCode}
                  >
                    {referralCopied ? <Check size={16} color={colors.accent} /> : <Copy size={16} color={colors.accent} />}
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.referralShareBtn, { backgroundColor: colors.accent }]}
                  onPress={handleShareReferral}
                >
                  <UserPlus size={18} color="#FFF" />
                  <Text style={styles.referralShareBtnText}>{t('settings.shareWithFriends')}</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Enter friend's code */}
            <View style={[styles.referralDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.referralFriendLabel, { color: colors.textSecondary }]}>{t('settings.haveFriendCode')}</Text>
            <View style={styles.referralRedeemRow}>
              <TextInput
                style={[styles.referralFriendInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder={t('settings.enterCodePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={friendCode}
                onChangeText={(text) => { setFriendCode(text.toUpperCase()); setRedeemStatus('idle'); }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable
                style={[styles.referralRedeemBtn, { backgroundColor: colors.accent, opacity: friendCode.trim().length < 5 || redeemStatus === 'loading' ? 0.5 : 1 }]}
                onPress={handleRedeemFriendCode}
                disabled={friendCode.trim().length < 5 || redeemStatus === 'loading'}
              >
                {redeemStatus === 'loading' ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.referralRedeemBtnText}>{t('settings.redeemCode')}</Text>
                )}
              </Pressable>
            </View>
            {redeemStatus === 'success' && (
              <Text style={[styles.referralFeedback, { color: '#22C55E' }]}>🎉 {redeemMessage}</Text>
            )}
            {redeemStatus === 'error' && (
              <Text style={[styles.referralFeedback, { color: '#EF4444' }]}>{redeemMessage}</Text>
            )}

            {/* Stats */}
            {referralStats.totalReferred > 0 && (
              <View style={[styles.referralStatsRow, { borderTopColor: colors.border }]}>
                <View style={styles.referralStat}>
                  <Text style={[styles.referralStatValue, { color: colors.accent }]}>{referralStats.totalReferred}</Text>
                  <Text style={[styles.referralStatLabel, { color: colors.textSecondary }]}>{t('settings.friendsInvited')}</Text>
                </View>
                <View style={[styles.referralStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.referralStat}>
                  <Text style={[styles.referralStatValue, { color: colors.accent }]}>{referralStats.totalDaysEarned}</Text>
                  <Text style={[styles.referralStatLabel, { color: colors.textSecondary }]}>{t('settings.daysEarned')}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.aboutSection}>
          <Pressable
            style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleDeleteMyData}
          >
            <View style={styles.aboutRow}>
              <Trash2 size={20} color={colors.error} />
              <Text style={[styles.aboutLabel, { color: colors.error }]}>{t('settings.deleteMyData')}</Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </Pressable>
          <Pressable
            style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleRestoreApp}
          >
            <View style={styles.aboutRow}>
              <RotateCcw size={20} color={colors.error} />
              <Text style={[styles.aboutLabel, { color: colors.error }]}>{t('settings.resetApp')}</Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </Pressable>
        </View>

        <Text style={[styles.versionText, { color: colors.textTertiary }]}>Mazō v1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  proButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  proButtonContent: {
    flex: 1,
  },
  proButtonTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  proButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  sectionsContainer: {
    gap: 12,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sectionCardActive: {
    borderWidth: 1,
    borderColor: Colors.accentLight,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  sectionCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCardInfo: {
    flex: 1,
  },
  sectionCardTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  sectionCardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  memorySection: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  memorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  memorySectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  memorySectionCount: {
    fontSize: 13,
    color: Colors.textTertiary,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  memorySectionContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  categoryGroup: {
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.accent,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  memoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  memoryText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  memoryActions: {
    flexDirection: 'row',
    gap: 10,
    marginLeft: 10,
  },
  actionButton: {
    padding: 4,
  },
  editContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    padding: 8,
    minHeight: 32,
  },
  editButton: {
    padding: 4,
  },
  goalItem: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  goalDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  goalMeta: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  badgeHigh: {
    backgroundColor: '#FDECEA',
  },
  badgeMedium: {
    backgroundColor: '#FEF3E2',
  },
  badgeActive: {
    backgroundColor: Colors.accentLight,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textTransform: 'capitalize' as const,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    color: Colors.text,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  taskMetaText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  ideaItem: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  ideaText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  ideaCategory: {
    fontSize: 11,
    color: Colors.accent,
    marginTop: 4,
    fontWeight: '500' as const,
  },
  problemItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  problemText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  constraintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  constraintText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  contextIntro: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  contextField: {
    marginBottom: 20,
  },
  contextLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  contextHint: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginBottom: 10,
    lineHeight: 18,
  },
  contextInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    minHeight: 80,
    lineHeight: 20,
  },
  contextFooter: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 8,
  },
  aboutYouInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    height: 48,
  },
  appearanceSection: {
    marginBottom: 24,
  },
  appearanceSectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B6B6B',
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  appearanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E6',
  },
  appearanceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  appearanceRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  appearanceLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#1A1A1A',
  },
  togglePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8E8E6',
    justifyContent: 'center' as const,
    paddingHorizontal: 2,
  },
  toggleTrackActive: {
    backgroundColor: '#7C9A82',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end' as const,
  },
  toggleText: {
    fontSize: 13,
    color: '#6B6B6B',
    fontWeight: '500' as const,
  },
  aboutSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  aboutSectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B6B6B',
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E6',
    marginBottom: 8,
  },
  aboutRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  aboutLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#1A1A1A',
  },
  // ── Referral System Styles ──
  referralSection: {
    marginBottom: 24,
  },
  referralCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
  },
  referralHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    marginBottom: 16,
  },
  referralIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  referralTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  referralSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  referralCodeLoading: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    paddingVertical: 16,
  },
  referralLoadingText: {
    fontSize: 14,
  },
  referralCodeSection: {
    gap: 10,
  },
  referralCodeLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  referralCodeBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  referralCodeText: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: 1.5,
  },
  referralCopyBtn: {
    padding: 8,
    borderRadius: 8,
  },
  referralShareBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  referralShareBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  referralDisabledText: {
    fontSize: 14,
    textAlign: 'center' as const,
    paddingVertical: 16,
  },
  referralDivider: {
    height: 1,
    marginVertical: 16,
  },
  referralFriendLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  referralRedeemRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  referralFriendInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  referralRedeemBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  referralRedeemBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  referralFeedback: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 8,
    textAlign: 'center' as const,
  },
  referralStatsRow: {
    flexDirection: 'row' as const,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  referralStat: {
    flex: 1,
    alignItems: 'center' as const,
  },
  referralStatValue: {
    fontSize: 24,
    fontWeight: '800' as const,
  },
  referralStatLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  referralStatDivider: {
    width: 1,
    height: '100%' as any,
  },
  referralComingSoon: {
    alignItems: 'center' as const,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  referralComingSoonEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  referralComingSoonTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  referralComingSoonText: {
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  referralErrorWrap: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 12,
  },
  referralErrorText: {
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  versionText: {
    fontSize: 12,
    textAlign: 'center' as const,
    marginTop: 16,
    marginBottom: 32,
  },
});
