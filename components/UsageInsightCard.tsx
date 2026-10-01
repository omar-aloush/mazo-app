import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck, TrendingUp, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { Fonts } from '@/constants/fonts';
import { getTopUsageApps, formatDuration, isDeviceAppsSupported } from '@/services/deviceApps';
import { getGuardPermissions, loadFocusGuardSettings, saveFocusGuardSettings } from '@/services/focusGuard';
import { BLOCKABLE_BY_PACKAGE } from '@/constants/blockable-apps';
import type { UsageStat } from '@/modules/mazo-focus-guard';

/** Only surface the nudge once an app crosses this much foreground time in 24h. */
const MIN_MS = 15 * 60 * 1000;

/**
 * Proactive "Mazō noticed" card: reads the user's real top app over the last 24h
 * and offers to guard it — the edge a generic assistant can't show. Renders
 * nothing on iOS/web, without usage permission, or when there's no notable data.
 */
export function UsageInsightCard() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [top, setTop] = useState<UsageStat | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(() => {
    if (!isDeviceAppsSupported) return;
    if (!getGuardPermissions().usageAccess) {
      setNeedsPermission(true);
      setTop(null);
      return;
    }
    setNeedsPermission(false);
    const apps = getTopUsageApps(1, 1);
    setTop(apps[0] && apps[0].totalMs >= MIN_MS ? apps[0] : null);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!isDeviceAppsSupported || dismissed) return null;

  const clay = colors.accent2;
  const clayBg = isDark ? 'rgba(210,160,122,0.14)' : 'rgba(201,139,107,0.10)';

  // Permission prompt — invites the one-time grant that powers usage coaching.
  if (needsPermission) {
    return (
      <Pressable
        onPress={() => router.push('/focus-guardian')}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={[styles.iconBadge, { backgroundColor: clayBg }]}>
          <TrendingUp size={18} color={clay} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>See where your time goes</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Turn on usage access and Mazō will coach you on your real screen-time.
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textTertiary} />
      </Pressable>
    );
  }

  if (!top) return null;

  const meta = BLOCKABLE_BY_PACKAGE[top.packageName];
  const emoji = meta?.emoji ?? '📱';

  const onGuard = async () => {
    const s = await loadFocusGuardSettings();
    if (!s.blockedPackages.includes(top.packageName)) {
      await saveFocusGuardSettings({ ...s, blockedPackages: [...s.blockedPackages, top.packageName] });
    }
    router.push('/focus-guardian');
  };

  return (
    <View style={[styles.card, styles.insight, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.insightTop}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: clay }]}>MAZŌ NOTICED</Text>
          <Text style={[styles.headline, { color: colors.text, fontFamily: Fonts.serifMedium }]}>
            {formatDuration(top.totalMs)} on {top.label}
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Your most-used app in the last 24 hours.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onGuard} style={[styles.guardBtn, { backgroundColor: colors.accent }]}>
          <ShieldCheck size={15} color="#FFFFFF" />
          <Text style={styles.guardText}>Guard {top.label}</Text>
        </Pressable>
        <Pressable onPress={() => setDismissed(true)} style={styles.dismissBtn}>
          <Text style={[styles.dismissText, { color: colors.textTertiary }]}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  insight: { flexDirection: 'column', alignItems: 'stretch' },
  insightTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 30, marginTop: 2 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 3 },
  headline: { fontSize: 19, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  sub: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  guardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  guardText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dismissBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  dismissText: { fontSize: 14, fontWeight: '600' },
});
