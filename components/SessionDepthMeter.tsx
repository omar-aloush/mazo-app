import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';

type DepthLevel = 'surface' | 'exploring' | 'deep' | 'breakthrough';

interface SessionDepthMeterProps {
  messages: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>;
  currentPhase: string;
  visible: boolean;
}

const DEPTH_CONFIG: Record<DepthLevel, { labelKey: string; color: string; darkColor: string; emoji: string }> = {
  surface: { labelKey: 'chat.starting', color: '#C8D6CA', darkColor: '#2A3E2E', emoji: '~' },
  exploring: { labelKey: 'chat.exploring', color: '#7C9A82', darkColor: '#3D5E44', emoji: '↓' },
  deep: { labelKey: 'chat.focused', color: '#5A7860', darkColor: '#6B9E74', emoji: '◆' },
  breakthrough: { labelKey: 'chat.breakthrough', color: '#D4A574', darkColor: '#E0B88A', emoji: '✦' },
};

const DEPTH_PATTERNS = {
  deep_indicators: [
    /i (just |now )?realiz/i,
    /now i (see|understand|get it)/i,
    /it('s| is) (actually|really) about/i,
    /what i('m| am) (really|actually) (feeling|afraid|scared|worried)/i,
    /the (real|actual|deeper|root) (issue|problem|reason|cause)/i,
    /i('ve| have) been (avoiding|hiding|ignoring|pretending)/i,
    /i think (the real|what's really|what i actually)/i,
    /when i('m| am) honest with myself/i,
    /the truth is/i,
    /i('ve| have) never (said|told|admitted)/i,
    /this (reminds|connects|relates) (me of|to)/i,
    /pattern/i,
  ],
  breakthrough_indicators: [
    /everything (makes sense|clicked|connected)/i,
    /i (finally|suddenly) (see|understand|get|know)/i,
    /that('s| is) (exactly |precisely )?it/i,
    /oh (wow|my|god|gosh)/i,
    /aha|a-ha/i,
    /i know (exactly )?what (i need|to do)/i,
    /it all (makes sense|comes together|connects)/i,
    /i('ve| have) been looking at (this|it) (all )?wrong/i,
    /this changes everything/i,
    /i feel (so much )?(clearer|lighter|free|relieved)/i,
  ],
  emotional_depth: [
    /i feel/i,
    /i('m| am) (scared|afraid|anxious|nervous|worried|overwhelmed)/i,
    /it (hurts|scares|terrifies|overwhelms)/i,
    /i (miss|love|hate|resent|regret)/i,
    /vulnerable/i,
    /ashamed|embarrassed|guilty/i,
  ],
};

function calculateDepth(
  messages: SessionDepthMeterProps['messages'],
  currentPhase: string
): { level: DepthLevel; score: number } {
  const userMessages = messages.filter(m => m.role === 'user');
  const msgCount = userMessages.length;

  if (msgCount === 0) return { level: 'surface', score: 0 };

  let score = 0;

  score += Math.min(msgCount * 5, 25);

  const avgLength = userMessages.reduce((sum, m) => {
    const text = m.parts?.filter(p => p.type === 'text').map(p => p.text || '').join('') || m.content || '';
    return sum + text.length;
  }, 0) / Math.max(msgCount, 1);
  if (avgLength > 100) score += 10;
  if (avgLength > 200) score += 10;

  const phaseScores: Record<string, number> = {
    opening: 0,
    exploration: 15,
    action: 30,
    exit: 35,
    freeform: 10,
  };
  score += phaseScores[currentPhase] || 0;

  const recentUserTexts = userMessages.slice(-5).map(m =>
    m.parts?.filter(p => p.type === 'text').map(p => p.text || '').join('') || m.content || ''
  );

  for (const text of recentUserTexts) {
    for (const pattern of DEPTH_PATTERNS.breakthrough_indicators) {
      if (pattern.test(text)) { score += 15; break; }
    }
    for (const pattern of DEPTH_PATTERNS.deep_indicators) {
      if (pattern.test(text)) { score += 8; break; }
    }
    for (const pattern of DEPTH_PATTERNS.emotional_depth) {
      if (pattern.test(text)) { score += 5; break; }
    }
  }

  score = Math.min(score, 100);

  let level: DepthLevel = 'surface';
  if (score >= 75) level = 'breakthrough';
  else if (score >= 50) level = 'deep';
  else if (score >= 25) level = 'exploring';

  return { level, score };
}

export const SessionDepthMeter: React.FC<SessionDepthMeterProps> = ({
  messages,
  currentPhase,
  visible,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const widthAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { level, score } = useMemo(
    () => calculateDepth(messages, currentPhase),
    [messages.length, currentPhase]
  );

  const config = DEPTH_CONFIG[level];
  const barColor = isDark ? config.darkColor : config.color;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: score,
      friction: 12,
      tension: 40,
      useNativeDriver: false,
    }).start();

    if (glowLoopRef.current) {
      glowLoopRef.current.stop();
      glowLoopRef.current = null;
    }

    if (level === 'breakthrough') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
        ])
      );
      glowLoopRef.current = loop;
      loop.start();
    } else {
      glowAnim.setValue(0);
    }

    return () => {
      if (glowLoopRef.current) {
        glowLoopRef.current.stop();
        glowLoopRef.current = null;
      }
    };
  }, [score, level]);

  if (!visible) return null;

  const barWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.textTertiary }]}>{t('chat.sessionProgress')}</Text>
        <View style={styles.levelBadge}>
          <Text style={[styles.emoji]}>{config.emoji}</Text>
          <Text style={[styles.levelText, { color: barColor }]}>{t(config.labelKey)}</Text>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: isDark ? '#1A1A1A' : '#EEEDEB' }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: barWidth,
              backgroundColor: barColor,
              opacity: level === 'breakthrough' ? glowAnim : 1,
            },
          ]}
        />
        {level !== 'surface' && (
          <View style={styles.markerContainer}>
            {['exploring', 'deep', 'breakthrough'].map((l, i) => (
              <View
                key={l}
                style={[
                  styles.marker,
                  {
                    left: `${25 + i * 25}%`,
                    backgroundColor: score >= 25 + (i + 1) * 25
                      ? barColor
                      : isDark ? '#333' : '#DDD',
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

export { calculateDepth, DepthLevel };

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emoji: {
    fontSize: 12,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  markerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  marker: {
    position: 'absolute',
    width: 2,
    height: '100%',
    borderRadius: 1,
  },
});
