import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { TrendingUp, Clock, Zap, MessageCircle, X } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';

type EmotionPoint = {
  label: string;
  value: number;
  color: string;
};

interface SessionInsightsProps {
  visible: boolean;
  messages: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>;
  sessionDurationMs: number;
  onDismiss: () => void;
}

const EMOTION_WORDS: Record<string, { score: number; labelKey: string }> = {
  anxious: { score: -2, labelKey: 'chat.emotions.anxious' },
  worried: { score: -2, labelKey: 'chat.emotions.worried' },
  confused: { score: -1, labelKey: 'chat.emotions.confused' },
  uncertain: { score: -1, labelKey: 'chat.emotions.uncertain' },
  stuck: { score: -1, labelKey: 'chat.emotions.stuck' },
  overwhelmed: { score: -2, labelKey: 'chat.emotions.overwhelmed' },
  frustrated: { score: -2, labelKey: 'chat.emotions.frustrated' },
  curious: { score: 1, labelKey: 'chat.emotions.curious' },
  interested: { score: 1, labelKey: 'chat.emotions.interested' },
  thinking: { score: 0, labelKey: 'chat.emotions.thinking' },
  hopeful: { score: 2, labelKey: 'chat.emotions.hopeful' },
  clear: { score: 3, labelKey: 'chat.emotions.clear' },
  confident: { score: 3, labelKey: 'chat.emotions.confident' },
  motivated: { score: 3, labelKey: 'chat.emotions.motivated' },
  excited: { score: 3, labelKey: 'chat.emotions.excited' },
  relieved: { score: 2, labelKey: 'chat.emotions.relieved' },
  ready: { score: 3, labelKey: 'chat.emotions.ready' },
  determined: { score: 3, labelKey: 'chat.emotions.determined' },
};

function analyzeEmotionalArc(
  messages: SessionInsightsProps['messages']
): EmotionPoint[] {
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) return [];

  const chunks: string[][] = [];
  const chunkSize = Math.max(1, Math.ceil(userMessages.length / 5));

  for (let i = 0; i < userMessages.length; i += chunkSize) {
    const chunk = userMessages.slice(i, i + chunkSize).map(m =>
      m.parts?.filter(p => p.type === 'text').map(p => p.text || '').join(' ') || m.content || ''
    );
    chunks.push(chunk);
  }

  return chunks.map((chunk, idx) => {
    const text = (chunk.join(' ') || '').toLowerCase();
    let totalScore = 0;
    let matchCount = 0;
    let bestLabel = 'chat.emotions.neutral';

    for (const [word, config] of Object.entries(EMOTION_WORDS)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        totalScore += config.score * matches.length;
        matchCount += matches.length;
        if (Math.abs(config.score) > Math.abs(totalScore / Math.max(matchCount, 1))) {
          bestLabel = config.labelKey;
        }
      }
    }

    if (text.match(/\?/g)?.length || 0 > 2) {
      totalScore -= 0.5;
      if (bestLabel === 'chat.emotions.neutral') bestLabel = 'chat.emotions.questioning';
    }

    if (text.match(/!/g)?.length || 0 > 1) {
      totalScore += 0.5;
    }

    const avgLength = chunk.reduce((s, c) => s + c.length, 0) / chunk.length;
    if (avgLength > 200) {
      if (bestLabel === 'chat.emotions.neutral') bestLabel = 'chat.emotions.reflecting';
    }

    const normalizedValue = Math.max(-3, Math.min(3, matchCount > 0 ? totalScore / matchCount : 0));
    const mappedValue = ((normalizedValue + 3) / 6) * 100;

    const progressLabels = [
      'chat.phases.opening',
      'chat.phases.exploring',
      'chat.phases.deepening',
      'chat.phases.clarifying',
      'chat.phases.resolving'
    ];
    if (bestLabel === 'chat.emotions.neutral') {
      bestLabel = progressLabels[Math.min(idx, progressLabels.length - 1)];
    }

    let color: string;
    if (normalizedValue < -1) color = '#C27070';
    else if (normalizedValue < 0) color = '#D4A574';
    else if (normalizedValue < 1) color = '#9B9B9B';
    else if (normalizedValue < 2) color = '#7C9A82';
    else color = '#5A7860';

    return { label: bestLabel, value: mappedValue, color };
  });
}

export const SessionInsights: React.FC<SessionInsightsProps> = ({
  visible,
  messages,
  sessionDurationMs,
  onDismiss,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const arcAnims = useRef<Animated.Value[]>([]).current;

  const emotionalArc = useMemo(() => analyzeEmotionalArc(messages), [messages]);
  const userMsgCount = useMemo(() => messages.filter(m => m.role === 'user').length, [messages]);
  const durationMins = Math.max(1, Math.round(sessionDurationMs / 60000));

  while (arcAnims.length < emotionalArc.length) {
    arcAnims.push(new Animated.Value(0));
  }

  useEffect(() => {
    if (visible) {

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 10, tension: 40, useNativeDriver: true }),
      ]).start();

      emotionalArc.forEach((_, i) => {
        if (arcAnims[i]) {
          Animated.sequence([
            Animated.delay(400 + i * 150),
            Animated.spring(arcAnims[i], { toValue: 1, friction: 8, tension: 50, useNativeDriver: false }),
          ]).start();
        }
      });
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      arcAnims.forEach(a => a.setValue(0));
    }
  }, [visible]);

  if (!visible || emotionalArc.length === 0) return null;

  const startEmotion = emotionalArc[0];
  const endEmotion = emotionalArc[emotionalArc.length - 1];
  const journeyDirection = endEmotion.value > startEmotion.value ? 'upward' :
    endEmotion.value < startEmotion.value ? 'shifting' : 'steady';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TrendingUp size={16} color={colors.accent} />
          <Text style={[styles.title, { color: colors.text }]}>{t('chat.sessionJourney')}</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <X size={18} color={colors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.arcContainer}>
        {emotionalArc.map((point, i) => {
          const heightValue = arcAnims[i]
            ? arcAnims[i].interpolate({
              inputRange: [0, 1],
              outputRange: [0, Math.max(8, point.value * 0.6)],
            })
            : 0;

          return (
            <View key={i} style={styles.arcColumn}>
              <Animated.View
                style={[
                  styles.arcBar,
                  {
                    height: heightValue,
                    backgroundColor: point.color,
                    borderRadius: 3,
                  },
                ]}
              />
              <Text style={[styles.arcLabel, { color: colors.textTertiary }]} numberOfLines={1}>
                {t(point.label as any)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Clock size={14} color={colors.textTertiary} />
          <Text style={[styles.statValue, { color: colors.text }]}>{durationMins}m</Text>
        </View>
        <View style={styles.stat}>
          <MessageCircle size={14} color={colors.textTertiary} />
          <Text style={[styles.statValue, { color: colors.text }]}>{userMsgCount} {t('chat.msgs')}</Text>
        </View>
        <View style={styles.stat}>
          <Zap size={14} color={colors.textTertiary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {journeyDirection === 'upward' ? t('chat.growth') : journeyDirection === 'shifting' ? t('chat.exploring') : t('chat.steady')}
          </Text>
        </View>
      </View>

      <Text style={[styles.journeySummary, { color: colors.textSecondary }]}>
        {t(startEmotion.label as any)} → {emotionalArc.length > 2 ? t(emotionalArc[Math.floor(emotionalArc.length / 2)].label as any) + ' → ' : ''}{t(endEmotion.label as any)}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  arcContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 80,
    paddingHorizontal: 4,
  },
  arcColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  arcBar: {
    width: 20,
    minHeight: 4,
  },
  arcLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  journeySummary: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
    letterSpacing: 0.5,
  },
});

