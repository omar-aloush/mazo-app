import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Crown, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';

interface UpgradePromptProps {
  message?: string;
  compact?: boolean;
}

export function UpgradePrompt({ message, compact = false }: UpgradePromptProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const displayMessage = message || t('paywall.unlockUnlimited');

  if (compact) {
    return (
      <Pressable
        onPress={() => router.push('/paywall')}
        style={[styles.compactContainer, { backgroundColor: colors.accentLight, borderColor: colors.accent }]}
      >
        <Crown size={14} color={colors.accent} />
        <Text style={[styles.compactText, { color: colors.accent }]}>{displayMessage}</Text>
        <ArrowRight size={14} color={colors.accent} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => router.push('/paywall')}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.accent }]}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.accentLight }]}>
        <Crown size={20} color={colors.accent} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{t('paywall.goPro')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{displayMessage}</Text>
      </View>
      <View style={[styles.arrowContainer, { backgroundColor: colors.accent }]}>
        <ArrowRight size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    alignSelf: 'center',
    marginVertical: 6,
  },
  compactText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
});
