import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';

interface SystemPulseProps {
  intensity?: number;
  style?: ViewStyle;
}

function getColor(intensity: number): string {
  if (intensity < 33) return '#A0C4B8';
  if (intensity < 66) return '#7C9A82';
  return '#5A7860';
}

export function SystemPulse({ intensity = 50, style }: SystemPulseProps) {
  const anim1 = useRef(new Animated.Value(1)).current;
  const anim2 = useRef(new Animated.Value(1)).current;
  const anim3 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.3)).current;
  const opacity2 = useRef(new Animated.Value(0.2)).current;
  const opacity3 = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    const createBreathing = (scaleAnim: Animated.Value, opacityAnim: Animated.Value, duration: number, baseOpacity: number) => {
      return Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.2,
              duration: duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 0.8,
              duration: duration / 2,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: baseOpacity + 0.15,
              duration: duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: baseOpacity,
              duration: duration / 2,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    };

    const a1 = createBreathing(anim1, opacity1, 2000, 0.3);
    const a2 = createBreathing(anim2, opacity2, 3000, 0.2);
    const a3 = createBreathing(anim3, opacity3, 4000, 0.15);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [anim1, anim2, anim3, opacity1, opacity2, opacity3]);

  const color = getColor(intensity);

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.circle,
          styles.circle3,
          {
            backgroundColor: color,
            opacity: opacity3,
            transform: [{ scale: anim3 }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.circle,
          styles.circle2,
          {
            backgroundColor: color,
            opacity: opacity2,
            transform: [{ scale: anim2 }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.circle,
          styles.circle1,
          {
            backgroundColor: color,
            opacity: opacity1,
            transform: [{ scale: anim1 }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    borderRadius: 9999,
  },
  circle1: {
    width: 80,
    height: 80,
  },
  circle2: {
    width: 120,
    height: 120,
  },
  circle3: {
    width: 160,
    height: 160,
  },
});
