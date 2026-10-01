import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, AppState } from 'react-native';
import { ShieldCheck, TrendingUp, Check } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { Fonts } from '@/constants/fonts';
import { analyzeBehavior, formatHour, type BehaviorInsight } from '@/services/behaviorModel';
import { guardPackagesNow } from '@/services/deviceApps';

/**
 * "Mazō learned" — surfaces the danger zone the behavior model found from real
 * per-hour usage, with a 24-bar histogram and a one-tap guard. The DS/AI proof
 * point: a pattern the user never told Mazō. Renders nothing without data.
 */
export function BehaviorInsightCard() {
  const { colors, isDark } = useTheme();
  const [insight, setInsight] = useState<BehaviorInsight | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setInsight(analyzeBehavior(14));
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!insight) return null;

  const sage = colors.accent;
  const clay = colors.accent2;
  const muted = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
  const max = Math.max(...insight.hourly, 1);

  const onGuard = () => {
    const r = guardPackagesNow(insight.topPackages, 120, 'Danger-zone guard');
    setResult(r.message);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(210,160,122,0.14)' : 'rgba(201,139,107,0.10)' }]}>
          <TrendingUp size={16} color={clay} />
        </View>
        <Text style={[styles.kicker, { color: clay }]}>MAZŌ LEARNED</Text>
      </View>

      <Text style={[styles.headline, { color: colors.text, fontFamily: Fonts.serifMedium }]}>
        Your danger zone: {formatHour(insight.dangerStart)}–{formatHour(insight.dangerEnd)}
      </Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        You reach for {insight.topApp} most then · about {insight.dailyAvgMinutes}m/day on your top apps.
      </Text>

      {/* 24-hour opens histogram, danger window highlighted */}
      <View style={styles.chart}>
        {insight.hourly.map((v, h) => {
          const inZone = h >= insight.dangerStart && h < insight.dangerEnd;
          const heightPct = Math.max(0.06, v / max);
          return (
            <View
              key={h}
              style={[styles.bar, { height: `${heightPct * 100}%`, backgroundColor: inZone ? sage : muted }]}
            />
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisLabel, { color: colors.textTertiary }]}>12a</Text>
        <Text style={[styles.axisLabel, { color: colors.textTertiary }]}>6a</Text>
        <Text style={[styles.axisLabel, { color: colors.textTertiary }]}>12p</Text>
        <Text style={[styles.axisLabel, { color: colors.textTertiary }]}>6p</Text>
        <Text style={[styles.axisLabel, { color: colors.textTertiary }]}>11p</Text>
      </View>

      {result ? (
        <View style={[styles.resultRow, { backgroundColor: isDark ? 'rgba(143,184,150,0.14)' : 'rgba(124,154,130,0.10)' }]}>
          <Check size={15} color={sage} strokeWidth={3} />
          <Text style={[styles.resultText, { color: sage }]}>{result}</Text>
        </View>
      ) : (
        <Pressable onPress={onGuard} style={[styles.guardBtn, { backgroundColor: sage }]}>
          <ShieldCheck size={15} color="#FFFFFF" />
          <Text style={styles.guardText}>Guard my danger zone</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  headline: { fontSize: 19, marginBottom: 4 },
  sub: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 56, gap: 2 },
  bar: { flex: 1, borderRadius: 2, minHeight: 3 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 14 },
  axisLabel: { fontSize: 9.5, fontWeight: '600' },
  guardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 22,
  },
  guardText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
  },
  resultText: { fontSize: 13.5, fontWeight: '600', flex: 1 },
});
