/**
 * WidgetSettingsSection — Premium widget customization in Settings.
 * Fully translated, with "Add Widget" button and polished UI.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Platform, Alert, Linking } from 'react-native';
import { Smartphone, Flame, CheckSquare, Target, Palette, Plus, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getWidgetPreferences, saveWidgetPreferences, WidgetPreferences } from '@/services/widgetData';
import { useTranslation } from '@/hooks/useTranslation';

interface Props {
  colors: any;
  isDark?: boolean;
}

export function WidgetSettingsSection({ colors, isDark }: Props) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<WidgetPreferences>({
    showStreak: true,
    showTask: true,
    showGoal: true,
    theme: 'auto',
  });

  useEffect(() => {
    getWidgetPreferences().then(setPrefs);
  }, []);

  const toggle = (key: 'showStreak' | 'showTask' | 'showGoal') => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    saveWidgetPreferences(updated);
  };

  const setTheme = (theme: WidgetPreferences['theme']) => {
    const updated = { ...prefs, theme };
    setPrefs(updated);
    saveWidgetPreferences(updated);
  };

  const handleAddWidget = () => {
    if (Platform.OS === 'android') {
      // Android 8+ supports requestPinAppWidget but requires native module
      // Fallback: guide user manually
      Alert.alert(
        t('widget.addWidget'),
        t('widget.addWidgetHint'),
        [{ text: t('common.ok') }]
      );
    } else {
      Alert.alert(
        t('widget.addWidget'),
        t('widget.addWidgetHint'),
        [{ text: t('common.ok') }]
      );
    }
  };

  const THEME_OPTIONS: { value: WidgetPreferences['theme']; label: string }[] = [
    { value: 'auto', label: t('widget.auto') },
    { value: 'dark', label: t('widget.dark') },
    { value: 'light', label: t('widget.light') },
  ];

  const TOGGLES: { key: 'showStreak' | 'showTask' | 'showGoal'; label: string; icon: typeof Flame; iconColor: string }[] = [
    { key: 'showStreak', label: t('widget.showStreak'), icon: Flame, iconColor: '#FF6B35' },
    { key: 'showTask', label: t('widget.showTask'), icon: CheckSquare, iconColor: colors.accent },
    { key: 'showGoal', label: t('widget.showGoal'), icon: Target, iconColor: '#A78BFA' },
  ];

  return (
    <View style={st.wrapper}>
      {/* Header card */}
      <LinearGradient
        colors={isDark
          ? ['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.04)']
          : ['rgba(99,102,241,0.08)', 'rgba(99,102,241,0.02)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[st.headerCard, { borderColor: colors.borderLight }]}
      >
        <View style={[st.headerIcon, { backgroundColor: `${colors.accent}18` }]}>
          <Smartphone size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[st.headerTitle, { color: colors.text }]}>{t('widget.title')}</Text>
          <Text style={[st.headerSub, { color: colors.textTertiary }]}>{t('widget.subtitle')}</Text>
        </View>
      </LinearGradient>

      {/* Toggles */}
      <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
        {TOGGLES.map((item, i) => {
          const Icon = item.icon;
          return (
            <View key={item.key}>
              {i > 0 && <View style={[st.divider, { backgroundColor: colors.borderLight }]} />}
              <View style={st.row}>
                <View style={[st.rowIcon, { backgroundColor: `${item.iconColor}12` }]}>
                  <Icon size={15} color={item.iconColor} />
                </View>
                <Text style={[st.rowLabel, { color: colors.text }]}>{item.label}</Text>
                <Switch
                  value={prefs[item.key] as boolean}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: colors.backgroundSecondary, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          );
        })}

        <View style={[st.divider, { backgroundColor: colors.borderLight }]} />

        {/* Theme picker */}
        <View style={st.row}>
          <View style={[st.rowIcon, { backgroundColor: `${colors.textSecondary}12` }]}>
            <Palette size={15} color={colors.textSecondary} />
          </View>
          <Text style={[st.rowLabel, { color: colors.text }]}>{t('widget.widgetTheme')}</Text>
          <View style={st.themePicker}>
            {THEME_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setTheme(opt.value)}
                style={[
                  st.themeChip,
                  {
                    backgroundColor: prefs.theme === opt.value ? colors.accent : colors.backgroundSecondary,
                    borderColor: prefs.theme === opt.value ? colors.accent : colors.borderLight,
                  },
                ]}
              >
                <Text
                  style={[
                    st.themeChipText,
                    { color: prefs.theme === opt.value ? '#fff' : colors.textSecondary },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Add Widget Button */}
      <Pressable
        onPress={handleAddWidget}
        style={({ pressed }) => [
          st.addBtn,
          { backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={[st.addBtnIcon, { backgroundColor: `${colors.accent}15` }]}>
          <Plus size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[st.addBtnTitle, { color: colors.text }]}>{t('widget.addWidget')}</Text>
          <Text style={[st.addBtnHint, { color: colors.textTertiary }]}>{t('widget.addWidgetHint')}</Text>
        </View>
        <ChevronRight size={16} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    gap: 10,
  },
  // Header
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  // Toggles card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  themePicker: {
    flexDirection: 'row',
    gap: 6,
  },
  themeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  themeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Add Widget button
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  addBtnIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  addBtnHint: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});
