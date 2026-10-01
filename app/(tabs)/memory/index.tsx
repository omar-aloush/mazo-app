import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  TextInput,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
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
  Brain,
  Compass,
  ArrowLeft,
  Database,
  Sparkles,
} from 'lucide-react-native';
import { useApp } from '@/providers/AppProvider';
import { AIFace } from '@/components/AIFace';
import { MindPortrait } from '@/components/MindPortrait';
import Colors from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';

import { useTranslation } from '@/hooks/useTranslation';

type MemorySection = 'preferences' | 'goals' | 'tasks' | 'ideas' | 'problems' | 'constraints';

const SECTION_CONFIG: { key: MemorySection; label: string; icon: any; iconColor: (colors: any) => string }[] = [
  { key: 'preferences', label: 'memory.sections.preferences', icon: Heart, iconColor: (c) => c.accent },
  { key: 'goals', label: 'memory.sections.goals', icon: Target, iconColor: (c) => c.accent },
  { key: 'tasks', label: 'memory.sections.tasks', icon: CheckSquare, iconColor: (c) => c.accent },
  { key: 'ideas', label: 'memory.sections.ideas', icon: Lightbulb, iconColor: (c) => c.accent },
  { key: 'problems', label: 'memory.sections.challenges', icon: AlertCircle, iconColor: (c) => c.warning },
  { key: 'constraints', label: 'memory.sections.constraints', icon: Clock, iconColor: (c) => c.textSecondary },
];

export default function MemoryScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    state,
    updatePreference,
    deletePreference,
    deleteGoal,
    deleteTask,
    deleteIdea,
    updateUserContext,
  } = useApp();
  const { memory, userContext } = state;

  const [expandedSections, setExpandedSections] = useState<Record<MemorySection, boolean>>({
    preferences: true,
    goals: true,
    tasks: false,
    ideas: false,
    problems: false,
    constraints: false,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isEditingValues, setIsEditingValues] = useState(false);
  const [valuesInput, setValuesInput] = useState(userContext.values || '');

  const toggleSection = useCallback((section: MemorySection) => {
    setExpandedSections((prev) => ({
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

  const handleSaveValues = useCallback(() => {
    updateUserContext({ values: valuesInput.trim() });
    setIsEditingValues(false);
  }, [valuesInput, updateUserContext]);

  const handleDeletePreference = useCallback((id: string) => {
    Alert.alert(
      t('memory.delete.title'),
      t('memory.delete.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deletePreference(id) },
      ]
    );
  }, [deletePreference]);

  const handleDeleteGoal = useCallback((id: string) => {
    Alert.alert(
      t('memory.deleteGoal.title'),
      t('memory.deleteGoal.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteGoal(id) },
      ]
    );
  }, [deleteGoal]);

  const handleDeleteTask = useCallback((id: string) => {
    Alert.alert(
      t('memory.deleteTask.title'),
      t('memory.deleteTask.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteTask(id) },
      ]
    );
  }, [deleteTask]);

  const handleDeleteIdea = useCallback((id: string) => {
    const remove = () => deleteIdea(id);
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this idea from your Mind?')) remove();
      return;
    }
    Alert.alert('Delete idea?', 'This will remove the idea from your Mind.', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: remove },
    ]);
  }, [deleteIdea, t]);

  const getCategoryLabel = (category?: string) => {
    const labels: Record<string, string> = {
      like: 'memory.categories.like',
      dislike: 'memory.categories.dislike',
      value: 'memory.categories.value',
      habit: 'memory.categories.habit',
      interest: 'memory.categories.interest',
      other: 'memory.categories.other',
    };
    return labels[category || 'other'] || 'memory.categories.other';
  };

  const groupedPreferences = useMemo(() => memory.preferences.reduce((acc, pref) => {
    const category = pref.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(pref);
    return acc;
  }, {} as Record<string, typeof memory.preferences>), [memory.preferences]);

  const stats = useMemo(() => ({
    preferences: memory.preferences.length,
    goals: memory.goals.length,
    tasks: memory.tasks.length,
    ideas: memory.ideas.length,
    problems: memory.problems.length,
    constraints: memory.constraints.length,
    total: memory.preferences.length + memory.goals.length + memory.tasks.length +
      memory.ideas.length + memory.problems.length + memory.constraints.length,
  }), [memory]);

  const isEmpty = stats.total === 0 && !userContext.values;

  const activeSections = SECTION_CONFIG.filter(s => (stats as any)[s.key] > 0);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMid, colors.background]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            style={[styles.backButton, { backgroundColor: colors.surface }]}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <View style={styles.headerTitleRow}>
            <AIFace expression="thinking" size={48} />
            <Text style={[styles.pageTitle, { color: colors.text }]}>{t('memory.title')}</Text>
          </View>
        </View>

        <MindPortrait />

        {stats.total > 0 && (
          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statIconWrap, { backgroundColor: colors.accentLight }]}>
                  <Database size={16} color={colors.accent} />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('memory.stats.total')}</Text>
              </View>
              {stats.goals > 0 && (
                <View style={styles.statItem}>
                  <View style={[styles.statIconWrap, { backgroundColor: isDark ? 'rgba(124,154,130,0.15)' : '#E8F5E9' }]}>
                    <Target size={16} color={colors.accent} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{stats.goals}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('memory.stats.goals')}</Text>
                </View>
              )}
              {stats.tasks > 0 && (
                <View style={styles.statItem}>
                  <View style={[styles.statIconWrap, { backgroundColor: isDark ? 'rgba(100,149,237,0.15)' : '#E3F2FD' }]}>
                    <CheckSquare size={16} color={isDark ? '#7EB8FF' : '#4285F4'} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{stats.tasks}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('memory.stats.tasks')}</Text>
                </View>
              )}
              {stats.ideas > 0 && (
                <View style={styles.statItem}>
                  <View style={[styles.statIconWrap, { backgroundColor: isDark ? 'rgba(255,193,7,0.15)' : '#FFF8E1' }]}>
                    <Lightbulb size={16} color={isDark ? '#FFD54F' : '#F9A825'} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{stats.ideas}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('memory.stats.ideas')}</Text>
                </View>
              )}
              {stats.preferences > 0 && (
                <View style={styles.statItem}>
                  <View style={[styles.statIconWrap, { backgroundColor: isDark ? 'rgba(224,128,128,0.15)' : '#FCE4EC' }]}>
                    <Heart size={16} color={isDark ? '#E08080' : '#E57373'} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{stats.preferences}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('memory.stats.prefs')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={[styles.valuesCard, { backgroundColor: colors.surface, borderColor: colors.accentLight }]}>
          <View style={styles.valuesHeader}>
            <View style={[styles.valuesIconWrap, { backgroundColor: colors.accentLight }]}>
              <Compass size={20} color={colors.accent} />
            </View>
            <View style={styles.valuesHeaderText}>
              <Text style={[styles.valuesTitle, { color: colors.text }]}>{t('memory.coreValues.title')}</Text>
              <Text style={[styles.valuesSubtitle, { color: colors.textTertiary }]}>{t('memory.coreValues.subtitle')}</Text>
            </View>
            {!isEditingValues && (
              <Pressable
                style={[styles.valuesEditBtn, { backgroundColor: colors.accentLight }]}
                onPress={() => {
                  setValuesInput(userContext.values || '');
                  setIsEditingValues(true);
                }}
              >
                <Edit3 size={14} color={colors.accent} />
              </Pressable>
            )}
          </View>

          {isEditingValues ? (
            <View style={styles.valuesEditContainer}>
              <TextInput
                style={[styles.valuesInput, { color: colors.text, backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                value={valuesInput}
                onChangeText={setValuesInput}
                placeholder={t('memory.coreValues.placeholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
                autoFocus
              />
              <View style={styles.valuesActions}>
                <Pressable style={[styles.valuesCancelBtn, { backgroundColor: colors.backgroundSecondary }]} onPress={() => setIsEditingValues(false)}>
                  <X size={16} color={colors.textSecondary} />
                  <Text style={[styles.valuesCancelText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable style={[styles.valuesSaveBtn, { backgroundColor: colors.accent }]} onPress={handleSaveValues}>
                  <Check size={16} color={colors.textInverse} />
                  <Text style={[styles.valuesSaveText, { color: colors.textInverse }]}>{t('common.save')}</Text>
                </Pressable>
              </View>
            </View>
          ) : userContext.values ? (
            <View style={[styles.valuesContent, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.valuesText, { color: colors.text }]}>{userContext.values}</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.valuesEmptyState, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              onPress={() => setIsEditingValues(true)}
            >
              <Sparkles size={20} color={colors.textTertiary} />
              <Text style={[styles.valuesEmptyText, { color: colors.textTertiary }]}>
                {t('memory.coreValues.empty')}
              </Text>
            </Pressable>
          )}
        </View>

        {isEmpty ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Brain size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('memory.empty.title')}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {t('memory.empty.subtitle')}
            </Text>
          </View>
        ) : (
          <>
            {activeSections.map(({ key, label, icon: Icon, iconColor }) => {
              const items = (memory as any)[key];
              if (!items || items.length === 0) return null;
              const isExpanded = expandedSections[key];

              return (
                <View key={key} style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                  <Pressable
                    style={styles.sectionHeader}
                    onPress={() => toggleSection(key)}
                  >
                    <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? `${iconColor(colors)}15` : `${iconColor(colors)}18` }]}>
                      <Icon size={18} color={iconColor(colors)} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t(label)}</Text>
                    <View style={[styles.sectionBadge, { backgroundColor: colors.backgroundSecondary }]}>
                      <Text style={[styles.sectionBadgeText, { color: colors.textTertiary }]}>{items.length}</Text>
                    </View>
                    <View style={[styles.sectionChevron, { backgroundColor: colors.backgroundSecondary }]}>
                      {isExpanded ? (
                        <ChevronUp size={16} color={colors.textTertiary} />
                      ) : (
                        <ChevronDown size={16} color={colors.textTertiary} />
                      )}
                    </View>
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.sectionContent}>
                      {key === 'preferences' && renderPreferences()}
                      {key === 'goals' && renderGoals()}
                      {key === 'tasks' && renderTasks()}
                      {key === 'ideas' && renderIdeas()}
                      {key === 'problems' && renderProblems()}
                      {key === 'constraints' && renderConstraints()}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  function renderPreferences() {
    return (
      <>
        {Object.entries(groupedPreferences).map(([category, prefs]) => (
          <View key={category} style={styles.categoryGroup}>
            <Text style={[styles.categoryLabel, { color: colors.accent }]}>{t(getCategoryLabel(category))}</Text>
            {prefs.map((pref) => (
              <View key={pref.id} style={[styles.memoryItem, { backgroundColor: colors.backgroundSecondary }]}>
                {editingId === pref.id ? (
                  <View style={styles.editContainer}>
                    <TextInput
                      style={[styles.editInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                      value={editValue}
                      onChangeText={setEditValue}
                      autoFocus
                      multiline
                    />
                    <Pressable style={[styles.editActionBtn, { backgroundColor: isDark ? 'rgba(124,154,130,0.2)' : '#E8F5E9' }]} onPress={() => handleSavePreference(pref.id)}>
                      <Check size={16} color={colors.success} />
                    </Pressable>
                    <Pressable style={[styles.editActionBtn, { backgroundColor: colors.backgroundSecondary }]} onPress={() => setEditingId(null)}>
                      <X size={16} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.memoryText, { color: colors.text }]}>{pref.value}</Text>
                    <View style={styles.memoryActions}>
                      <Pressable style={styles.actionButton} onPress={() => handleEditPreference(pref.id, pref.value)} hitSlop={8}>
                        <Edit3 size={14} color={colors.textTertiary} />
                      </Pressable>
                      <Pressable style={styles.actionButton} onPress={() => handleDeletePreference(pref.id)} hitSlop={8}>
                        <Trash2 size={14} color={colors.error} />
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ))}
          </View>
        ))}
      </>
    );
  }

  function renderGoals() {
    return memory.goals.map((goal) => (
      <View key={goal.id} style={[styles.goalItem, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={styles.goalContent}>
          <Text style={[styles.goalTitle, { color: colors.text }]}>{goal.title}</Text>
          <Text style={[styles.goalDescription, { color: colors.textSecondary }]}>{goal.description}</Text>
          <View style={styles.goalMeta}>
            <View style={[
              styles.badge,
              { backgroundColor: colors.border },
              goal.priority === 'high' && { backgroundColor: isDark ? 'rgba(224,128,128,0.15)' : '#FDECEA' },
              goal.priority === 'medium' && { backgroundColor: isDark ? 'rgba(224,184,138,0.15)' : '#FEF3E2' },
            ]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{goal.priority}</Text>
            </View>
            <View style={[
              styles.badge,
              { backgroundColor: colors.border },
              goal.status === 'active' && { backgroundColor: colors.accentLight },
            ]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{goal.status}</Text>
            </View>
          </View>
        </View>
        <Pressable style={styles.deleteButton} onPress={() => handleDeleteGoal(goal.id)} hitSlop={8}>
          <Trash2 size={14} color={colors.error} />
        </Pressable>
      </View>
    ));
  }

  function renderTasks() {
    return memory.tasks.map((task) => (
      <View key={task.id} style={[styles.taskItem, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={styles.taskContent}>
          <Text style={[
            styles.taskTitle,
            { color: colors.text },
            task.status === 'completed' && { textDecorationLine: 'line-through' as const, color: colors.textTertiary },
          ]}>
            {task.title}
          </Text>
          {task.estimatedMinutes && (
            <View style={styles.taskMeta}>
              <Clock size={11} color={colors.textTertiary} />
              <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>{task.estimatedMinutes} min</Text>
            </View>
          )}
        </View>
        <Pressable style={styles.deleteButton} onPress={() => handleDeleteTask(task.id)} hitSlop={8}>
          <Trash2 size={14} color={colors.error} />
        </Pressable>
      </View>
    ));
  }

  function renderIdeas() {
    return memory.ideas.map((idea) => (
      <View key={idea.id} style={[styles.ideaItem, { backgroundColor: colors.backgroundSecondary, flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ideaText, { color: colors.text }]}>{idea.content}</Text>
          {idea.category && (
            <Text style={[styles.ideaCategory, { color: colors.accent }]}>{idea.category}</Text>
          )}
        </View>
        <Pressable
          style={styles.deleteButton}
          onPress={() => handleDeleteIdea(idea.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Delete idea: ${idea.content}`}
        >
          <Trash2 size={14} color={colors.error} />
        </Pressable>
      </View>
    ));
  }

  function renderProblems() {
    return memory.problems.map((problem) => (
      <View key={problem.id} style={[styles.problemItem, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.problemText, { color: colors.text }]}>{problem.description}</Text>
        <View style={[
          styles.badge,
          { backgroundColor: colors.border },
          problem.urgency === 'high' && { backgroundColor: isDark ? 'rgba(224,128,128,0.15)' : '#FDECEA' },
        ]}>
          <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{problem.urgency}</Text>
        </View>
      </View>
    ));
  }

  function renderConstraints() {
    return memory.constraints.map((constraint) => (
      <View key={constraint.id} style={[styles.constraintItem, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.constraintText, { color: colors.text }]}>{constraint.description}</Text>
        <View style={[styles.badge, { backgroundColor: colors.border }]}>
          <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{constraint.type}</Text>
        </View>
      </View>
    ));
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  statsCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: 6,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  valuesCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  valuesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  valuesIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuesHeaderText: {
    flex: 1,
  },
  valuesTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  valuesSubtitle: {
    fontSize: 13,
  },
  valuesEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuesContent: {
    borderRadius: 12,
    padding: 14,
  },
  valuesText: {
    fontSize: 15,
    lineHeight: 24,
  },
  valuesEmptyState: {
    borderRadius: 12,
    padding: 20,
    borderStyle: 'dashed' as const,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  valuesEmptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  valuesEditContainer: {
    gap: 12,
  },
  valuesInput: {
    fontSize: 15,
    borderRadius: 12,
    padding: 14,
    minHeight: 80,
    textAlignVertical: 'top' as const,
    borderWidth: 1,
  },
  valuesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  valuesCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  valuesCancelText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  valuesSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  valuesSaveText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  section: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 28,
    alignItems: 'center',
  },
  sectionBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  sectionChevron: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  categoryGroup: {
    marginBottom: 14,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  memoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  memoryText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  memoryActions: {
    flexDirection: 'row',
    gap: 10,
    marginLeft: 12,
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
    borderRadius: 8,
    padding: 10,
    minHeight: 36,
    borderWidth: 1,
  },
  editActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalItem: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 3,
  },
  goalDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  goalMeta: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'capitalize' as const,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  taskMetaText: {
    fontSize: 11,
  },
  ideaItem: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  ideaText: {
    fontSize: 14,
    lineHeight: 21,
  },
  ideaCategory: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500' as const,
  },
  problemItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  problemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  constraintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  constraintText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
});
