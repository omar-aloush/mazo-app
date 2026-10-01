import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Pressable, Share } from 'react-native';
import { Sparkles, Share2 } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { maybeRequestReview } from '@/services/storeReview';
import { hapticCelebration } from '@/utils/haptics';
import { track } from '@/services/analytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  angle: number;
  distance: number;
  char: string;
}

interface BreakthroughMomentProps {
  visible: boolean;
  insightText?: string;
  onComplete?: () => void;
}

const PARTICLE_CHARS = ['✦', '◆', '●', '✧', '○'];

export const BreakthroughMoment: React.FC<BreakthroughMomentProps> = ({
  visible,
  insightText,
  onComplete,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  // Reduced from 12 to 6 particles for subtlety
  const particles = useRef<Particle[]>(
    Array.from({ length: 6 }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      angle: (i / 6) * Math.PI * 2,
      distance: 35 + Math.random() * 40,
      char: PARTICLE_CHARS[i % PARTICLE_CHARS.length],
    }))
  ).current;

  const animate = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    particles.forEach((p, i) => {
      const targetX = Math.cos(p.angle) * p.distance;
      const targetY = Math.sin(p.angle) * p.distance;

      Animated.sequence([
        Animated.delay(i * 80),
        Animated.parallel([
          Animated.spring(p.x, { toValue: targetX, friction: 10, tension: 35, useNativeDriver: true }),
          Animated.spring(p.y, { toValue: targetY, friction: 10, tension: 35, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0.7, duration: 400, useNativeDriver: true }),
          Animated.spring(p.scale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
        ]),
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
      ]).start();
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ]),
      { iterations: 2 }
    ).start();

    Animated.sequence([
      Animated.delay(500),
      Animated.timing(textFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

  }, [onComplete]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      hapticCelebration();
      track('breakthrough_moment');
      animate();
      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.timing(textFade, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start(() => {
          scaleAnim.setValue(0.5);
          glowPulse.setValue(0);
          particles.forEach(p => {
            p.x.setValue(0);
            p.y.setValue(0);
            p.opacity.setValue(0);
            p.scale.setValue(0);
          });
          onComplete?.();
          // Trigger App Store review after a breakthrough moment
          maybeRequestReview('breakthrough').catch(() => { });
        });
      }, 3000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, animate]);

  if (!visible) return null;

  const accentColor = isDark ? '#E0B88A' : '#D4A574';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.particleField}>
        {particles.map((p, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.particle,
              {
                color: accentColor,
                opacity: p.opacity,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { scale: p.scale },
                ],
              },
            ]}
          >
            {p.char}
          </Animated.Text>
        ))}

        <Animated.View
          style={[
            styles.centerIcon,
            {
              backgroundColor: isDark ? '#2A2218' : '#FDF6EE',
              borderColor: accentColor,
              opacity: glowPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1],
              }),
              transform: [{
                scale: glowPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.1],
                }),
              }],
            },
          ]}
        >
          <Sparkles size={22} color={accentColor} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.textContainer, { opacity: textFade }]}>
        <Text style={[styles.title, { color: accentColor }]}>{t('chat.insight')}</Text>
        {insightText && (
          <Text style={[styles.insight, { color: colors.textSecondary }]} numberOfLines={2}>
            {insightText}
          </Text>
        )}
        {insightText && (
          <Pressable
            onPress={async () => {
              try {
                await Share.share({
                  message: `"${insightText}"\n\n— My breakthrough moment with Mazō ✨\nhttps://mazo.app`,
                });
              } catch { }
            }}
            style={[styles.shareBtn, { backgroundColor: (isDark ? '#E0B88A' : '#D4A574') + '20' }]}
            hitSlop={8}
          >
            <Share2 size={13} color={accentColor} />
            <Text style={[styles.shareBtnText, { color: accentColor }]}>{t('common.share')}</Text>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
};

// Reduced pattern list — only genuine multi-word insight patterns, not casual phrases
const BREAKTHROUGH_PATTERNS = [
  /i (just |now )?realiz(e|ed) (that |what |how |why )/i,
  /everything (makes sense|clicked|connected|fell into place)/i,
  /i (finally|suddenly) (see|understand|get|know) (what|how|why|that)/i,
  /i know (exactly )?what (i need|to do|i want)/i,
  /it all (makes sense|comes together|connects)/i,
  /i('ve| have) been looking at (this|it) (all )?wrong/i,
  /this changes everything/i,
  /now i (see|understand|get) (what|how|why|that)/i,
  /i('ve| have) never (thought|seen|looked at) (it|this) (that|this) way/i,
  /something just clicked/i,
];

export function detectBreakthrough(text: string): { isBreakthrough: boolean; matchedText?: string } {
  // Require minimum message length to avoid triggering on short casual messages
  if (text.length < 30) return { isBreakthrough: false };

  for (const pattern of BREAKTHROUGH_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const start = Math.max(0, match.index! - 20);
      const end = Math.min(text.length, match.index! + match[0].length + 40);
      let snippet = text.substring(start, end).trim();
      if (start > 0) snippet = '...' + snippet;
      if (end < text.length) snippet = snippet + '...';
      return { isBreakthrough: true, matchedText: snippet };
    }
  }
  return { isBreakthrough: false };
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginVertical: 8,
  },
  particleField: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '600',
  },
  centerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  insight: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
