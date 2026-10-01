import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, AppState } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck, Eye, Layers, Check } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { Fonts } from '@/constants/fonts';
import { BLOCKABLE_APPS } from '@/constants/blockable-apps';
import { useFocusGuardSettings } from '@/hooks/useFocusGuardSettings';
import { useGuardianSettings } from '@/hooks/useGuardianSettings';
import {
  isFocusGuardSupported,
  getGuardPermissions,
  openUsageAccess,
  openOverlaySettings,
  GuardPermissions,
} from '@/services/focusGuard';

export default function FocusGuardianScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { settings, setEnabled, togglePackage } = useFocusGuardSettings();
  const guardian = useGuardianSettings();
  const [perms, setPerms] = useState<GuardPermissions>({ usageAccess: false, overlay: false });

  const refreshPerms = useCallback(() => setPerms(getGuardPermissions()), []);

  // Permissions are granted on a system settings screen, so re-check whenever
  // the app returns to the foreground.
  useEffect(() => {
    refreshPerms();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshPerms();
    });
    return () => sub.remove();
  }, [refreshPerms]);

  const bothGranted = perms.usageAccess && perms.overlay;
  const tint = colors.accent;
  const cardBg = colors.surface;
  const subtleBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Focus Guardian',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroBadge, { backgroundColor: isDark ? 'rgba(143,184,150,0.14)' : 'rgba(110,142,118,0.10)' }]}>
            <ShieldCheck size={22} color={tint} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text, fontFamily: Fonts.serif }]}>
            Guard your focus
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            During a focus session, the apps you choose are walled off. Try to open
            one and Mazō puts a gentle stop in front of it — until your session ends.
          </Text>
        </View>

        {!isFocusGuardSupported && (
          <View style={[styles.notice, { backgroundColor: subtleBg, borderColor: colors.border }]}>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              App blocking runs on Android only. On this device, focus sessions
              still work — just as a timer, without the wall.
            </Text>
          </View>
        )}

        {isFocusGuardSupported && (
          <>
            {/* Permissions */}
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>PERMISSIONS</Text>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
              <PermRow
                icon={<Eye size={18} color={tint} />}
                title="Usage access"
                desc="Lets Mazō notice which app is open so it can step in."
                granted={perms.usageAccess}
                onPress={openUsageAccess}
                colors={colors}
                tint={tint}
                isDark={isDark}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <PermRow
                icon={<Layers size={18} color={tint} />}
                title="Draw over other apps"
                desc="Lets Mazō show the focus wall on top of a blocked app."
                granted={perms.overlay}
                onPress={openOverlaySettings}
                colors={colors}
                tint={tint}
                isDark={isDark}
              />
            </View>

            {/* Master toggle */}
            <View style={[styles.card, styles.toggleCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>Block apps during focus</Text>
                <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>
                  {bothGranted
                    ? 'Armed automatically when a focus session starts.'
                    : 'Grant both permissions above to turn this on.'}
                </Text>
              </View>
              <Switch
                value={settings.enabled && bothGranted}
                onValueChange={setEnabled}
                disabled={!bothGranted}
                trackColor={{ false: colors.border, true: tint }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* App picker */}
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>APPS TO BLOCK</Text>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
              {BLOCKABLE_APPS.map((app, i) => {
                const selected = settings.blockedPackages.includes(app.packageName);
                return (
                  <Pressable
                    key={app.key}
                    onPress={() => togglePackage(app.packageName)}
                    style={[
                      styles.appRow,
                      i < BLOCKABLE_APPS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    ]}
                  >
                    <Text style={styles.appEmoji}>{app.emoji}</Text>
                    <Text style={[styles.appLabel, { color: colors.text }]}>{app.label}</Text>
                    <View
                      style={[
                        styles.checkbox,
                        selected
                          ? { backgroundColor: tint, borderColor: tint }
                          : { borderColor: colors.border },
                      ]}
                    >
                      {selected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* EXAM GUARDIAN — the angry-face nudge */}
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>EXAM GUARDIAN</Text>
            <View style={[styles.card, styles.toggleCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>Catch me in distracting apps</Text>
                <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>
                  During exams, if you linger in a game or social app, Mazō appears over it and nudges you back.
                </Text>
              </View>
              <Switch
                value={guardian.settings.enabled && bothGranted}
                onValueChange={(v) => guardian.setField('enabled', v)}
                disabled={!bothGranted}
                trackColor={{ false: colors.border, true: tint }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={[styles.card, styles.toggleCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>Exam mode</Text>
                <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>
                  Force the guardian on even if Mazō hasn’t heard about exams yet.
                </Text>
              </View>
              <Switch
                value={guardian.settings.examMode}
                onValueChange={(v) => guardian.setField('examMode', v)}
                trackColor={{ false: colors.border, true: tint }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={[styles.card, styles.toggleCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>Demo: nudge after 1 minute</Text>
                <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>
                  For showing it live — normally it waits {guardian.settings.thresholdMinutes} minutes.
                </Text>
              </View>
              <Switch
                value={guardian.settings.demoFastTrigger}
                onValueChange={(v) => guardian.setField('demoFastTrigger', v)}
                trackColor={{ false: colors.border, true: tint }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Text style={[styles.footnote, { color: colors.textTertiary }]}>
              You can always end a session early from inside Mazō.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PermRow({
  icon,
  title,
  desc,
  granted,
  onPress,
  colors,
  tint,
  isDark,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  granted: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  tint: string;
  isDark: boolean;
}) {
  return (
    <View style={styles.permRow}>
      <View style={styles.permIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.permTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.permDesc, { color: colors.textSecondary }]}>{desc}</Text>
      </View>
      {granted ? (
        <View style={[styles.grantedPill, { backgroundColor: isDark ? 'rgba(143,184,150,0.16)' : 'rgba(110,142,118,0.10)' }]}>
          <Check size={13} color={tint} strokeWidth={3} />
          <Text style={[styles.grantedText, { color: tint }]}>Granted</Text>
        </View>
      ) : (
        <Pressable onPress={onPress} style={[styles.grantBtn, { backgroundColor: tint }]}>
          <Text style={styles.grantBtnText}>Grant</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  hero: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, marginBottom: 12 },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { fontSize: 26, marginBottom: 8, textAlign: 'center' },
  heroSubtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', paddingHorizontal: 8 },
  notice: { borderRadius: 16, borderWidth: 1, padding: 16 },
  noticeText: { fontSize: 14, lineHeight: 21 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 18, marginLeft: 4 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  permRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  permIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  permTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  permDesc: { fontSize: 12.5, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  grantBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  grantBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  grantedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  grantedText: { fontSize: 12, fontWeight: '700' },
  toggleCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginTop: 12, gap: 12 },
  toggleTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  toggleDesc: { fontSize: 12.5, lineHeight: 18 },
  appRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  appEmoji: { fontSize: 20 },
  appLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footnote: { fontSize: 12.5, textAlign: 'center', marginTop: 18, lineHeight: 18 },
});
