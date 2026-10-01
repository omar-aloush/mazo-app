import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { SessionPhase } from '@/types';

const PHASES: { key: SessionPhase; labelKey: string }[] = [
  { key: 'opening', labelKey: 'chat.context' },
  { key: 'exploration', labelKey: 'chat.explore' },
  { key: 'action', labelKey: 'chat.action' },
  { key: 'exit', labelKey: 'chat.goDoIt' },
];

interface PhaseIndicatorProps {
  currentPhase: SessionPhase;
}

export const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ currentPhase }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  if (currentPhase === 'freeform') return null;

  const currentIndex = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <View style={[styles.container, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.track}>
        {PHASES.map((phase, index) => {
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          const activeColor = colors.accent;
          const inactiveColor = colors.border;
          const completedColor = activeColor;

          return (
            <React.Fragment key={phase.key}>
              {index > 0 && (
                <View style={styles.connectorContainer}>
                  <View
                    style={[
                      styles.connectorBg,
                      { backgroundColor: inactiveColor },
                    ]}
                  />
                  <View
                    style={[
                      styles.connectorFill,
                      {
                        backgroundColor: completedColor,
                        width: isCompleted || isActive ? '100%' : '0%',
                      },
                    ]}
                  />
                </View>
              )}
              <View style={styles.step}>
                {isActive && (
                  <Animated.View
                    style={[
                      styles.glowRing,
                      {
                        backgroundColor: activeColor,
                        opacity: 0.2,
                        transform: [{ scale: pulseAnim }],
                      },
                    ]}
                  />
                )}
                <View
                  style={[
                    isActive ? styles.dotActive : styles.dot,
                    {
                      backgroundColor: isCompleted || isActive ? activeColor : 'transparent',
                      borderColor: isCompleted || isActive ? activeColor : inactiveColor,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.label,
                    {
                      color: isActive ? activeColor : isCompleted ? colors.text : colors.textTertiary,
                      fontWeight: isActive ? '700' : isCompleted ? '600' : '400',
                      fontSize: isActive ? 12 : 11,
                    },
                  ]}
                >
                  {t(phase.labelKey)}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    alignItems: 'center',
    position: 'relative',
  },
  connectorContainer: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: -1,
    marginBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  connectorBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 1.5,
  },
  connectorFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 1.5,
  },
  glowRing: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    top: -5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  dotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
  },
  label: {
    marginTop: 6,
    letterSpacing: 0.3,
  },
});
