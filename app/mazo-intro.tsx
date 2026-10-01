import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AIFace } from '@/components/AIFace';
import { useTheme } from '@/providers/ThemeProvider';

import { useTranslation } from '@/hooks/useTranslation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TYPE_SPEED = 28;

export default function MazoIntroScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const MESSAGES = [
    { text: t('onboarding.intro.title'), delay: 600, bold: true },
    { text: t('onboarding.intro.subtitle'), delay: 2600, bold: false },
  ];

  const [visibleMessages, setVisibleMessages] = useState<string[]>([]);
  const [currentTypingIndex, setCurrentTypingIndex] = useState(-1);
  const [typedText, setTypedText] = useState('');

  // Face animations
  const faceScale = useRef(new Animated.Value(0.2)).current;
  const faceOpacity = useRef(new Animated.Value(0)).current;

  // Ring animations (expanding rings behind face)
  const ring1Scale = useRef(new Animated.Value(0.5)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(0.5)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(1)).current;

  // UI animations
  const skipOpacity = useRef(new Animated.Value(0)).current;
  const continueOpacity = useRef(new Animated.Value(0)).current;
  const continueTranslateY = useRef(new Animated.Value(20)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Face entrance (spring)
    Animated.parallel([
      Animated.spring(faceScale, {
        toValue: 1,
        tension: 35,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(faceOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Rings expand outward (staggered)
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(ring1Scale, { toValue: 1, tension: 20, friction: 6, useNativeDriver: true }),
        Animated.timing(ring1Opacity, { toValue: 0.15, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.spring(ring2Scale, { toValue: 1, tension: 15, friction: 7, useNativeDriver: true }),
        Animated.timing(ring2Opacity, { toValue: 0.08, duration: 800, useNativeDriver: true }),
      ]),
    ]).start();

    // 3. Gentle ring pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // 4. Skip button
    setTimeout(() => {
      Animated.timing(skipOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 1500);

    // 5. Start typing messages
    MESSAGES.forEach((msg, index) => {
      setTimeout(() => {
        setCurrentTypingIndex(index);
      }, msg.delay);
    });

    // 6. Continue button
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(continueOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(continueTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, 4500);

    // 7. Hint text
    setTimeout(() => {
      Animated.timing(hintOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 5500);
  }, []);

  useEffect(() => {
    if (currentTypingIndex < 0) return;

    const message = MESSAGES[currentTypingIndex];
    let charIndex = 0;
    setTypedText('');

    const interval = setInterval(() => {
      charIndex++;
      if (charIndex <= message.text.length) {
        setTypedText(message.text.substring(0, charIndex));
      } else {
        clearInterval(interval);
        setVisibleMessages(prev => [...prev, message.text]);
        setTypedText('');
      }
    }, TYPE_SPEED);

    return () => clearInterval(interval);
  }, [currentTypingIndex]);

  const handleContinue = useCallback(() => {
    router.replace('/first-launch');
  }, [router]);

  const accentColor = isDark ? '#8FB896' : '#7C9A82';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.skipContainer, { opacity: skipOpacity }]}>
        <Pressable onPress={handleContinue} style={styles.skipButton} hitSlop={12}>
          <Text style={[styles.skipText, { color: colors.textTertiary }]}>{t('common.skip')}</Text>
        </Pressable>
      </Animated.View>

      <Pressable style={styles.content} onPress={handleContinue}>
        {/* Animated rings behind face */}
        <View style={styles.faceArea}>
          <Animated.View style={[
            styles.ring,
            styles.ringOuter,
            {
              borderColor: accentColor,
              opacity: ring2Opacity,
              transform: [
                { scale: Animated.multiply(ring2Scale, ringPulse) },
              ],
            },
          ]} />
          <Animated.View style={[
            styles.ring,
            styles.ringInner,
            {
              borderColor: accentColor,
              opacity: ring1Opacity,
              transform: [{ scale: ring1Scale }],
            },
          ]} />
          <Animated.View style={[
            styles.faceContainer,
            {
              opacity: faceOpacity,
              transform: [{ scale: faceScale }],
            },
          ]}>
            <AIFace expression="happy" size={180} />
          </Animated.View>
        </View>

        {/* Typed messages */}
        <View style={styles.messagesContainer}>
          {visibleMessages.map((msg, index) => (
            <Text
              key={index}
              style={[
                styles.message,
                { color: colors.text },
                index === 0 && styles.messageBold,
              ]}
            >
              {msg}
            </Text>
          ))}
          {typedText.length > 0 && (
            <Text
              style={[
                styles.message,
                { color: colors.text },
                currentTypingIndex === 0 && styles.messageBold,
              ]}
            >
              {typedText}
              <Text style={[styles.cursor, { color: accentColor }]}>|</Text>
            </Text>
          )}
        </View>
      </Pressable>

      {/* Bottom area */}
      <View style={styles.bottomArea}>
        <Animated.View style={{ opacity: hintOpacity }}>
          <Text style={[styles.hintText, { color: colors.textTertiary }]}>
            {t('onboarding.intro.tapHint')}
          </Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: continueOpacity,
            transform: [{ translateY: continueTranslateY }],
            width: '100%',
          }}
        >
          <Pressable
            style={({ pressed }) => [
              styles.continueButton,
              { backgroundColor: accentColor },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>{t('onboarding.letsGo')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginTop: -30,
  },
  faceArea: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 44,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 999,
  },
  ringOuter: {
    width: 240,
    height: 240,
  },
  ringInner: {
    width: 210,
    height: 210,
  },
  faceContainer: {},
  messagesContainer: {
    alignItems: 'center',
    minHeight: 100,
  },
  message: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  messageBold: {
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 40,
  },
  cursor: {
    fontWeight: '300',
  },
  bottomArea: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 16,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
