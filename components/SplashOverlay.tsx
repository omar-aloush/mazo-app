import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Image, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface SplashOverlayProps {
  onFinish: () => void;
}

export function SplashOverlay({ onFinish }: SplashOverlayProps) {
  const iconScale = useRef(new Animated.Value(0.8)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const glowScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Step 1: Icon fades in and scales up
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Step 2: Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.15,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 0.9,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Step 3: App name fades in
    setTimeout(() => {
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 400);

    // Step 4: Tagline fades in
    setTimeout(() => {
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 700);

    // Step 5: Loader dots
    setTimeout(() => {
      Animated.timing(loaderOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 900);

    // Step 6: Fade out everything
    setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 2200);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: overlayOpacity }]} pointerEvents="none">
      {/* Subtle radial glow behind icon */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: iconOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* App icon */}
      <Animated.View
        style={{
          opacity: iconOpacity,
          transform: [{ scale: iconScale }],
        }}
      >
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </Animated.View>

      {/* App name */}
      <Animated.Text style={[styles.appName, { opacity: textOpacity }]}>
        Mazō
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Your AI Life Coach
      </Animated.Text>

      {/* Loading dots */}
      <Animated.View style={[styles.loaderContainer, { opacity: loaderOpacity }]}>
        <View style={styles.loaderTrack}>
          <Animated.View style={[styles.loaderBar]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(108, 92, 231, 0.08)',
    top: height * 0.5 - 140,
  },
  icon: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 20,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
    letterSpacing: 0.5,
    fontWeight: '400',
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  loaderTrack: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  loaderBar: {
    width: 20,
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: 'rgba(108, 92, 231, 0.6)',
  },
});
