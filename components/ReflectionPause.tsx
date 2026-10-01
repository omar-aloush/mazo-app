import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';

interface ReflectionPauseProps {
  visible: boolean;
  onComplete: () => void;
  duration?: number;
}

export const ReflectionPause: React.FC<ReflectionPauseProps> = ({
  visible,
  onComplete,
  duration = 10000,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(0.8)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const [breathPhase, setBreathPhase] = useState<'in' | 'hold' | 'out'>('in');
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(duration / 1000));
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const breathTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const breathLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startBreathing = useCallback(() => {
    const phases = ['in', 'hold', 'out'] as const;
    let phaseIdx = 0;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.2, duration: 3000, useNativeDriver: true }),
        Animated.delay(1000),
        Animated.timing(breatheAnim, { toValue: 0.8, duration: 3000, useNativeDriver: true }),
        Animated.delay(500),
      ])
    );
    breathLoopRef.current = loop;
    loop.start();

    breathTimerRef.current = setInterval(() => {
      phaseIdx = (phaseIdx + 1) % phases.length;
      setBreathPhase(phases[phaseIdx]);
    }, 2500);
  }, []);

  useEffect(() => {
    if (visible) {
      setSecondsLeft(Math.ceil(duration / 1000));

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(textFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]).start();

      startBreathing();

      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            clearInterval(breathTimerRef.current);
            onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      fadeAnim.setValue(0);
      textFade.setValue(0);
      breatheAnim.setValue(0.8);
    }

    return () => {
      clearInterval(timerRef.current);
      clearInterval(breathTimerRef.current);
      if (breathLoopRef.current) {
        breathLoopRef.current.stop();
        breathLoopRef.current = null;
      }
    };
  }, [visible]);

  if (!visible) return null;

  const breathLabel = breathPhase === 'in' ? t('chat.breatheIn') : breathPhase === 'hold' ? t('chat.hold') : t('chat.breatheOut');
  const accentColor = isDark ? '#8FB896' : '#7C9A82';

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.card, { backgroundColor: isDark ? '#1A1E1B' : '#F5F8F5' }]}>
        <Animated.View style={[styles.breathCircleOuter, {
          borderColor: accentColor,
          transform: [{ scale: breatheAnim }],
          opacity: breatheAnim.interpolate({
            inputRange: [0.8, 1.2],
            outputRange: [0.3, 0.6],
          }),
        }]}>
          <View style={[styles.breathCircleInner, { backgroundColor: accentColor }]}>
            <Text style={styles.breathIcon}>○</Text>
          </View>
        </Animated.View>

        <Animated.Text style={[styles.breathLabel, { color: accentColor, opacity: textFade }]}>
          {breathLabel}
        </Animated.Text>

        <Animated.Text style={[styles.prompt, { color: colors.textSecondary, opacity: textFade }]}>
          {t('chat.takeAMoment')}
        </Animated.Text>

        <View style={styles.timerRow}>
          <Text style={[styles.timer, { color: colors.textTertiary }]}>
            {secondsLeft}s
          </Text>
          <Pressable
            onPress={() => {
              clearInterval(timerRef.current);
              clearInterval(breathTimerRef.current);
              onComplete();
            }}
            style={[styles.skipButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.skipText, { color: colors.textTertiary }]}>{t('common.continue')}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
};

const PAUSE_TRIGGERS = [
  /that('s| is| was) (really )?(hard|tough|difficult|painful|scary)/i,
  /i('m| am) (not sure|confused|lost|stuck|overwhelmed)/i,
  /i don('t| do not) know (what|how|why|where|if)/i,
  /it('s| is) (a lot|too much|overwhelming)/i,
  /i need (a moment|to think|time|space)/i,
  /this is (heavy|deep|intense|a lot)/i,
  /i('ve| have) never (thought about|considered|realized)/i,
  /that hit (hard|deep|home|different)/i,
  /wow/i,
  /i('m| am) getting emotional/i,
];

export function shouldSuggestPause(
  userMessage: string,
  messageCount: number,
  lastPauseAt: number | null
): boolean {
  if (messageCount < 4) return false;

  if (lastPauseAt && messageCount - lastPauseAt < 6) return false;

  for (const pattern of PAUSE_TRIGGERS) {
    if (pattern.test(userMessage)) return true;
  }

  return false;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  breathCircleOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  breathCircleInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  breathIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  breathLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  prompt: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timer: {
    fontSize: 13,
    fontWeight: '500',
  },
  skipButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
