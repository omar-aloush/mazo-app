import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Brain, RotateCcw, Zap } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { hapticSelection } from '@/utils/haptics';

export type CoachingMode = 'decision' | 'clarity' | 'planning' | 'reflection' | 'freeform';

interface ModeInfo {
  id: CoachingMode;
  name: string;
}

const MODES: ModeInfo[] = [
  { id: 'freeform', name: 'chat.freeTalk' },
  { id: 'decision', name: 'chat.decision' },
  { id: 'clarity', name: 'chat.clarity' },
  { id: 'planning', name: 'chat.planning' },
  { id: 'reflection', name: 'chat.reflection' },
];

interface ModeSelectProps {
  currentMode: CoachingMode;
  onModeChange: (mode: CoachingMode) => void;
  onMemoryPress?: () => void;
  onResetPress?: () => void;
  onCommandPress?: () => void;
}

export const ModeSelect: React.FC<ModeSelectProps> = ({
  currentMode,
  onModeChange,
  onMemoryPress,
  onResetPress,
  onCommandPress,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const modeOffsets = useRef<Partial<Record<CoachingMode, number>>>({});

  // The mode picker is wider than a phone. Keep the chosen mode in view when
  // it is selected from the first-message prompt as well as by tapping a pill.
  useEffect(() => {
    const x = modeOffsets.current[currentMode];
    if (x != null) scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
  }, [currentMode]);

  const handleSelect = (mode: CoachingMode) => {
    hapticSelection();
    onModeChange(mode);
  };

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {MODES.map((mode) => {
          const isActive = mode.id === currentMode;

          return (
            <Pressable
              key={mode.id}
              onLayout={(event) => {
                const x = event.nativeEvent.layout.x;
                modeOffsets.current[mode.id] = x;
                if (mode.id === currentMode) {
                  scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: false });
                }
              }}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? colors.text : 'transparent',
                  borderColor: isActive ? colors.text : colors.border,
                },
              ]}
              onPress={() => handleSelect(mode.id)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${t(mode.name)} coaching mode`}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? colors.textInverse : colors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {t(mode.name)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        {onCommandPress && (
          <Pressable
            onPress={onCommandPress}
            style={styles.actionButton}
            hitSlop={8}
            accessibilityLabel="Tell Mazo to do something"
            accessibilityRole="button"
          >
            <Zap size={18} color={colors.accent} />
          </Pressable>
        )}
        {onMemoryPress && (
          <Pressable onPress={onMemoryPress} style={styles.actionButton} hitSlop={8}>
            <Brain size={18} color={colors.textSecondary} />
          </Pressable>
        )}
        {onResetPress && (
          <Pressable
            onPress={onResetPress}
            style={styles.actionButton}
            hitSlop={12}
            accessibilityLabel="Start new conversation"
            accessibilityRole="button"
          >
            <RotateCcw size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingLeft: 16,
    paddingRight: 8,
    alignItems: 'center',
    height: 44,
    gap: 8,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    gap: 10,
  },
  actionButton: {
    padding: 6,
  },
});
