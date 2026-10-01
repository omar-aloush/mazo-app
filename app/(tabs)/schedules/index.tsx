import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Check,
  Sun,
  Moon,
  Sunrise,
  Target,
  Sparkles,
  Plus,
  Calendar,
  X,
  Trash2,
  MessageCircle,
  Clock,
  Dumbbell,
  Book,
  Coffee,
  Heart,
  Zap,
  Star,
} from 'lucide-react-native';
import { useApp } from '@/providers/AppProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { ScheduleItem } from '@/types';
import { AIFace } from '@/components/AIFace';
import { useTranslation } from '@/hooks/useTranslation';

const CATEGORIES = {
  morning: { labelKey: 'schedule.morning', icon: 'sunrise', color: '#F59E0B' },
  afternoon: { labelKey: 'schedule.afternoon', icon: 'sun', color: '#3B82F6' },
  evening: { labelKey: 'schedule.evening', icon: 'moon', color: '#8B5CF6' },
  anytime: { labelKey: 'schedule.anytime', icon: 'sparkles', color: '#10B981' },
};

const ICONS = [
  { name: 'sunrise', icon: Sunrise, labelKey: 'schedule.iconMorning' },
  { name: 'sun', icon: Sun, labelKey: 'schedule.iconDay' },
  { name: 'moon', icon: Moon, labelKey: 'schedule.iconNight' },
  { name: 'target', icon: Target, labelKey: 'schedule.iconGoal' },
  { name: 'sparkles', icon: Sparkles, labelKey: 'schedule.iconMagic' },
  { name: 'calendar', icon: Calendar, labelKey: 'schedule.iconSchedule' },
  { name: 'clock', icon: Clock, labelKey: 'schedule.iconTime' },
  { name: 'dumbbell', icon: Dumbbell, labelKey: 'schedule.iconExercise' },
  { name: 'book', icon: Book, labelKey: 'schedule.iconLearn' },
  { name: 'coffee', icon: Coffee, labelKey: 'schedule.iconBreak' },
  { name: 'heart', icon: Heart, labelKey: 'schedule.iconHealth' },
  { name: 'zap', icon: Zap, labelKey: 'schedule.iconEnergy' },
  { name: 'star', icon: Star, labelKey: 'schedule.iconImportant' },
];

export default function SchedulesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    state,
    generateDailyPlan,
    generateWeeklyDirection,
    isGeneratingPlan,
    isGeneratingWeekly,
    addScheduleItem,
    toggleScheduleItemCompletion,
    setCurrentDayIndex,
    deleteScheduleItem,
  } = useApp();
  const { t } = useTranslation();

  const { memory } = state;
  const [selectedDay, setSelectedDay] = useState(memory.currentDayIndex || 0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('morning');
  const [selectedIcon, setSelectedIcon] = useState<string>('sparkles');
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const checkAnimations = useRef<Record<string, Animated.Value>>({}).current;

  const handleRefresh = useCallback(() => {
    generateDailyPlan(undefined);
    generateWeeklyDirection(undefined);
  }, [generateDailyPlan, generateWeeklyDirection]);

  const handleDaySelect = useCallback((dayIndex: number) => {
    setSelectedDay(dayIndex);
    setCurrentDayIndex(dayIndex);
  }, [setCurrentDayIndex]);

  const filteredItems = useMemo(() => {
    return memory.scheduleItems.filter(item => item.dayIndex === selectedDay);
  }, [memory.scheduleItems, selectedDay]);

  const handleToggleItem = useCallback((itemId: string) => {
    if (!checkAnimations[itemId]) {
      checkAnimations[itemId] = new Animated.Value(0);
    }

    const item = memory.scheduleItems.find(i => i.id === itemId);
    if (item && !item.isCompleted) {
      Animated.sequence([
        Animated.timing(checkAnimations[itemId], {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(checkAnimations[itemId], {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }

    toggleScheduleItemCompletion(itemId);
  }, [toggleScheduleItemCompletion, memory.scheduleItems, checkAnimations]);

  const handleAddTask = useCallback(() => {
    if (!newTaskTitle.trim()) return;

    const order = filteredItems.length;
    addScheduleItem({
      title: newTaskTitle.trim(),
      category: selectedCategory as ScheduleItem['category'],
      icon: selectedIcon,
      isCompleted: false,
      dayIndex: selectedDay,
      order,
    });

    setNewTaskTitle('');
    setSelectedCategory('morning');
    setSelectedIcon('sparkles');
    setShowAddModal(false);
  }, [newTaskTitle, selectedCategory, selectedIcon, selectedDay, filteredItems.length, addScheduleItem]);

  const handleDeleteItem = useCallback((itemId: string) => {
    deleteScheduleItem(itemId);
  }, [deleteScheduleItem]);

  const handleAskCoach = useCallback(() => {
    router.push('/(tabs)/chat');
  }, [router]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, ScheduleItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.order - b.order);
    });
    return groups;
  }, [filteredItems]);

  const completionStats = useMemo(() => {
    const total = filteredItems.length;
    const completed = filteredItems.filter(i => i.isCompleted).length;
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [filteredItems]);

  const getItemIcon = (iconName?: string) => {
    const found = ICONS.find(i => i.name === iconName);
    return found?.icon || Calendar;
  };

  const renderTaskCard = (item: ScheduleItem, index: number) => {
    const IconComponent = getItemIcon(item.icon);
    const scaleAnim = checkAnimations[item.id] || new Animated.Value(0);
    const categoryInfo = CATEGORIES[item.category as keyof typeof CATEGORIES];

    return (
      <Pressable
        key={item.id}
        style={[styles.taskCard, { backgroundColor: colors.surface }, item.isCompleted && styles.taskCardCompleted]}
        onPress={() => handleToggleItem(item.id)}
        onLongPress={() => setEditingItem(item)}
        testID={`schedule-item-${item.id}`}
      >
        <Animated.View
          style={[
            styles.checkbox,
            { borderColor: colors.border },
            item.isCompleted && [styles.checkboxChecked, { backgroundColor: colors.accent, borderColor: colors.accent }],
            {
              transform: [
                {
                  scale: scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.2],
                  }),
                },
              ],
            },
          ]}
        >
          {item.isCompleted && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
        </Animated.View>
        <View style={styles.taskContent}>
          <Text
            style={[styles.taskTitle, { color: colors.text }, item.isCompleted && { color: colors.textTertiary, textDecorationLine: 'line-through' }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
        </View>
        <View style={[styles.taskIconContainer, { backgroundColor: `${categoryInfo?.color || colors.cardHighlight}15` }]}>
          <IconComponent
            size={20}
            color={item.isCompleted ? colors.textTertiary : (categoryInfo?.color || colors.cardHighlight)}
          />
        </View>
      </Pressable>
    );
  };

  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowAddModal(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddModal(false)} />
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('schedule.addNewTask')}</Text>
            <Pressable onPress={() => setShowAddModal(false)} style={styles.modalClose}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.borderLight }]}
              placeholder={t('schedule.whatToDo')}
              placeholderTextColor={colors.textTertiary}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('schedule.timeOfDay')}</Text>
          <View style={styles.categoryGrid}>
            {Object.entries(CATEGORIES).map(([key, cat]) => {
              const IconComp = getItemIcon(cat.icon);
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.categoryOption,
                    { backgroundColor: colors.background, borderColor: colors.borderLight },
                    selectedCategory === key && { backgroundColor: `${cat.color}20`, borderColor: cat.color },
                  ]}
                  onPress={() => setSelectedCategory(key)}
                >
                  <IconComp size={18} color={selectedCategory === key ? cat.color : colors.textSecondary} />
                  <Text style={[
                    styles.categoryOptionText,
                    { color: colors.textSecondary },
                    selectedCategory === key && { color: cat.color },
                  ]}>{t(cat.labelKey)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('schedule.icon')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconScroll}>
            <View style={styles.iconGrid}>
              {ICONS.map((iconItem) => {
                const IconComp = iconItem.icon;
                return (
                  <Pressable
                    key={iconItem.name}
                    style={[
                      styles.iconOption,
                      { backgroundColor: colors.background, borderColor: colors.borderLight },
                      selectedIcon === iconItem.name && [styles.iconOptionSelected, { backgroundColor: `${colors.cardHighlight}25`, borderColor: colors.cardHighlight }],
                    ]}
                    onPress={() => setSelectedIcon(iconItem.name)}
                  >
                    <IconComp
                      size={22}
                      color={selectedIcon === iconItem.name ? colors.cardHighlight : colors.textSecondary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Pressable
            style={[styles.addButton, { backgroundColor: colors.accent }, !newTaskTitle.trim() && styles.addButtonDisabled]}
            onPress={handleAddTask}
            disabled={!newTaskTitle.trim()}
          >
            <Text style={styles.addButtonText}>{t('schedule.addTask')}</Text>
          </Pressable>

          <Pressable style={styles.coachSuggestButton} onPress={handleAskCoach}>
            <MessageCircle size={18} color={colors.cardHighlight} />
            <Text style={[styles.coachSuggestText, { color: colors.cardHighlight }]}>{t('schedule.askAICoach')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal
      visible={!!editingItem}
      animationType="fade"
      transparent
      onRequestClose={() => setEditingItem(null)}
    >
      <Pressable style={styles.editModalOverlay} onPress={() => setEditingItem(null)}>
        <View style={[styles.editModalContent, { backgroundColor: colors.surface }]}>
          <Text style={[styles.editModalTitle, { color: colors.text }]}>{editingItem?.title}</Text>
          <Pressable
            style={styles.deleteButton}
            onPress={() => {
              if (editingItem) {
                handleDeleteItem(editingItem.id);
                setEditingItem(null);
              }
            }}
          >
            <Trash2 size={18} color="#EF4444" />
            <Text style={styles.deleteButtonText}>{t('schedule.deleteTask')}</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => setEditingItem(null)}>
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        refreshControl={
          <RefreshControl
            refreshing={isGeneratingPlan || isGeneratingWeekly}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <AIFace expression="happy" size={56} />
            <Text style={[styles.pageTitle, { color: colors.text }]}>{t('schedule.schedules')}</Text>
          </View>

          {completionStats.total > 0 && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: `${colors.accent}25` }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${completionStats.percentage}%`, backgroundColor: colors.accent }
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {completionStats.completed}/{completionStats.total} {t('schedule.completed')}
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.daySelector}
          contentContainerStyle={styles.daySelectorContent}
        >
          {Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const localeTag = t('common.locale');
            const safeLocale = (localeTag && !localeTag.includes('.')) ? localeTag : 'en-US';
            const dayName = i === 0 ? t('schedule.today') : i === 1 ? t('schedule.tmrw') : date.toLocaleDateString(safeLocale, { weekday: 'short' });
            const dayNum = date.getDate();
            return (
              <Pressable
                key={i}
                style={[styles.dayPill, { backgroundColor: colors.surface }, selectedDay === i && [styles.dayPillActive, { backgroundColor: colors.accent }]]}
                onPress={() => handleDaySelect(i)}
              >
                <Text style={[styles.dayLabel, { color: colors.textTertiary }, selectedDay === i && styles.dayLabelActive]}>
                  {dayName}
                </Text>
                <Text style={[styles.dayNumber, { color: colors.text }, selectedDay === i && styles.dayNumberActive]}>
                  {dayNum}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {Object.entries(groupedItems).length > 0 ? (
          Object.entries(groupedItems).map(([category, items]) => {
            const categoryInfo = CATEGORIES[category as keyof typeof CATEGORIES];
            return (
              <View key={category} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionLine, { backgroundColor: `${categoryInfo?.color || colors.cardHighlight}30` }]} />
                  <Text style={[styles.sectionTitle, { color: categoryInfo?.color || colors.textTertiary }]}>
                    {t(categoryInfo?.labelKey || '') || category}
                  </Text>
                  <View style={[styles.sectionLine, { backgroundColor: `${categoryInfo?.color || colors.cardHighlight}30` }]} />
                </View>
                <View style={styles.taskList}>
                  {items.map((item, index) => renderTaskCard(item, index))}
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, { backgroundColor: `${colors.cardHighlight}18` }]}>
              <Calendar size={40} color={colors.cardHighlight} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('schedule.emptyTitle')}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {t('schedule.emptySubtitle')}
            </Text>
            <View style={styles.emptyActions}>
              <Pressable style={[styles.emptyActionButton, { backgroundColor: colors.accent }]} onPress={() => setShowAddModal(true)}>
                <Plus size={18} color="#FFFFFF" />
                <Text style={styles.emptyActionText}>{t('schedule.addTask')}</Text>
              </Pressable>
              <Pressable style={[styles.emptyCoachButton, { backgroundColor: `${colors.cardHighlight}18` }]} onPress={handleAskCoach}>
                <MessageCircle size={18} color={colors.cardHighlight} />
                <Text style={[styles.emptyCoachText, { color: colors.cardHighlight }]}>{t('schedule.askCoach')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {filteredItems.length > 0 && (
          <Pressable style={styles.coachCard} onPress={handleAskCoach}>
            <LinearGradient
              colors={[colors.cardHighlight, colors.accentDark]}
              style={styles.coachGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.coachContent}>
                <MessageCircle size={22} color="#FFFFFF" />
                <View style={styles.coachTextContainer}>
                  <Text style={styles.coachTitle}>{t('schedule.needHelp')}</Text>
                  <Text style={styles.coachSubtitle}>{t('schedule.personalizedAdvice')}</Text>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        <View style={styles.tipCard}>
          <Text style={[styles.tipText, { color: colors.textTertiary }]}>{t('schedule.tipLongPress')}</Text>
        </View>
      </ScrollView>

      <Pressable style={[styles.fab, { shadowColor: colors.cardHighlight }]} onPress={() => setShowAddModal(true)}>
        <LinearGradient
          colors={[colors.cardHighlight, colors.accent]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Plus size={28} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      {renderAddModal()}
      {renderEditModal()}
    </View>
  );
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
    height: 200,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  progressContainer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(139, 126, 200, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B7EC8',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  daySelector: {
    marginBottom: 24,
    marginHorizontal: -20,
  },
  daySelectorContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  dayPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dayPillActive: {
    backgroundColor: '#8B7EC8',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
  },
  dayLabelActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  dayNumberActive: {
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  taskList: {
    gap: 12,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  taskCardCompleted: {
    opacity: 0.7,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checkboxChecked: {
    backgroundColor: '#8B7EC8',
    borderColor: '#8B7EC8',
  },
  taskTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  taskIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 126, 200, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  taskContent: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 126, 200, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B7EC8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyActionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  emptyCoachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 126, 200, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyCoachText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#8B7EC8',
  },
  coachCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  coachGradient: {
    padding: 16,
  },
  coachContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  coachTextContainer: {
    flex: 1,
  },
  coachTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  coachSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tipCard: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 20,
  },
  tipText: {
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    borderRadius: 28,
    shadowColor: '#8B7EC8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  modalClose: {
    padding: 4,
  },
  inputContainer: {
    marginBottom: 20,
  },
  textInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  iconScroll: {
    marginBottom: 24,
  },
  iconGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  iconOptionSelected: {
    backgroundColor: 'rgba(139, 126, 200, 0.15)',
    borderColor: '#8B7EC8',
  },
  addButton: {
    backgroundColor: '#8B7EC8',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  coachSuggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
  },
  coachSuggestText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#8B7EC8',
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  editModalContent: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 14,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
});
