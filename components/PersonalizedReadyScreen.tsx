import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface PersonalizedReadyScreenProps {
  preferencesCount: number;
  personalizedTopic: string;
  onContinue: () => void;
}

const DOT_ROWS = 4;
const DOT_COLS = 6;

export function PersonalizedReadyScreen({
  preferencesCount,
  personalizedTopic,
  onContinue,
}: PersonalizedReadyScreenProps) {
  const insets = useSafeAreaInsets();

  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const dotAnims = useRef(
    Array.from({ length: DOT_ROWS * DOT_COLS }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    Animated.parallel([
      Animated.timing(fadeInAnim, {
        toValue: 1,
        duration: 800,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 800,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    const dotAnimations = dotAnims.map((anim, index) => {
      const row = Math.floor(index / DOT_COLS);
      const col = index % DOT_COLS;
      const delay = (row + col) * 100;

      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 1500,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
    });

    Animated.stagger(50, dotAnimations).start();
  }, [glowAnim, pulseAnim, fadeInAnim, slideUpAnim, dotAnims]);

  const glowColor1 = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(0, 210, 180, 0.6)', 'rgba(0, 180, 220, 0.8)', 'rgba(0, 210, 180, 0.6)'],
  });

  const glowColor2 = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(0, 150, 136, 0.4)', 'rgba(0, 200, 180, 0.6)', 'rgba(0, 150, 136, 0.4)'],
  });

  const renderDots = () => {
    const dots = [];
    for (let row = 0; row < DOT_ROWS; row++) {
      for (let col = 0; col < DOT_COLS; col++) {
        const index = row * DOT_COLS + col;
        const isLargeDot = (row + col) % 2 === 0;

        dots.push(
          <Animated.View
            key={`dot-${row}-${col}`}
            style={[
              styles.dot,
              isLargeDot ? styles.dotLarge : styles.dotSmall,
              {
                opacity: dotAnims[index],
                transform: [
                  {
                    scale: dotAnims[index].interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      }
    }
    return dots;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a1628', '#0d1f35', '#0a1628']}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.glowOrb,
          {
            backgroundColor: glowColor1,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.glowOrbSecondary,
          {
            backgroundColor: glowColor2,
            transform: [
              { scale: pulseAnim },
              { translateX: -20 },
              { translateY: 20 },
            ],
          },
        ]}
      />

      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <Animated.Text
          style={[
            styles.headerText,
            {
              opacity: fadeInAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          Your personal coaching system is ready!
        </Animated.Text>

        <Animated.View
          style={[
            styles.dotsContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={styles.dotsGrid}>{renderDots()}</View>
        </Animated.View>

        <Animated.View
          style={[
            styles.messageContainer,
            {
              opacity: fadeInAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          <Text style={styles.largeNumber}>{preferencesCount}</Text>
          <Text style={styles.messageText}>
            insights learned about{' '}
            <Text style={styles.highlightText}>you</Text>
            {'\n'}to personalize{' '}
            <Text style={styles.highlightTextSecondary}>{personalizedTopic}</Text>
          </Text>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={onContinue}
        >
          <Text style={styles.buttonText}>View My System</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  glowOrb: {
    position: 'absolute',
    top: height * 0.2,
    left: width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    opacity: 0.5,
  },
  glowOrbSecondary: {
    position: 'absolute',
    top: height * 0.25,
    left: width * 0.15,
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    opacity: 0.4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 60,
  },
  dotsContainer: {
    marginBottom: 60,
  },
  dotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: DOT_COLS * 28,
    justifyContent: 'center',
  },
  dot: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    margin: 6,
    shadowColor: '#00d4b4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  dotLarge: {
    width: 14,
    height: 14,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  dotSmall: {
    width: 10,
    height: 10,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  messageContainer: {
    alignItems: 'center',
  },
  largeNumber: {
    fontSize: 80,
    fontWeight: '300' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 22,
    fontWeight: '400' as const,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 32,
  },
  highlightText: {
    color: '#6366f1',
    fontWeight: '600' as const,
  },
  highlightTextSecondary: {
    color: '#6366f1',
    fontWeight: '600' as const,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#0a1628',
  },
});
