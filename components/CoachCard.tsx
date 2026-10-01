import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Lock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Coach } from '@/types';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { CustomCoach } from '@/types';

interface CoachCardProps {
  coach: Coach;
  isSelected: boolean;
  isPro: boolean;
  onSelect: () => void;
}

export const CoachCard: React.FC<CoachCardProps> = ({
  coach,
  isSelected,
  isPro,
  onSelect,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isLocked = coach.isProOnly && !isPro;

  const getTranslated = (val: string) => {
    if (val && val.startsWith('coaches.library.')) {
      return t(val as any);
    }
    return val;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isSelected && { borderColor: colors.accent, backgroundColor: colors.accentLight },
        pressed && styles.pressed,
      ]}
      onPress={onSelect}
      testID={`coach-card-${coach.id}`}
    >
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }, isSelected && { color: colors.accentDark }]}>
            {getTranslated(coach.name)}
          </Text>
          {isLocked && (
            <View style={[styles.lockBadge, { backgroundColor: colors.backgroundSecondary }]}>
              <Lock size={12} color={colors.textTertiary} />
              <Text style={[styles.proBadgeText, { color: colors.textTertiary }]}>Pro</Text>
            </View>
          )}
        </View>
        <Text style={[styles.role, { color: colors.textSecondary }, isSelected && { color: colors.accentDark }]}>
          {getTranslated(coach.role)}
        </Text>
      </View>
      <Text style={[styles.description, { color: colors.textSecondary }, isSelected && { color: colors.text }]}>
        {getTranslated(coach.description)}
      </Text>
      <View style={styles.toneContainer}>
        <Text style={[styles.tone, { color: colors.textTertiary }, isSelected && { color: colors.accentDark }]}>
          {coach.tone}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  selected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  header: {
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  selectedText: {
    color: Colors.accentDark,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  role: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  selectedRole: {
    color: Colors.accentDark,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  selectedDescription: {
    color: Colors.text,
  },
  toneContainer: {
    marginTop: 12,
  },
  tone: {
    fontSize: 12,
    color: Colors.textTertiary,
    textTransform: 'capitalize',
    fontStyle: 'italic',
  },
  selectedTone: {
    color: Colors.accentDark,
  },
});
