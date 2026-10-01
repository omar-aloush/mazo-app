/**
 * StreakBadge — compact streak display with flame animation.
 * Shows "🔥 5" with animated flame and milestone celebrations.
 * Theme-aware: adapts colors and glow to light/dark mode.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';

interface StreakBadgeProps {
    streak: number;
    compact?: boolean;
}

export function StreakBadge({ streak, compact = true }: StreakBadgeProps) {
    const { colors, isDark } = useTheme();
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulse animation on streak > 0
        if (streak > 0) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [streak]);

    useEffect(() => {
        // Glow for milestones
        if ([3, 7, 14, 30, 60, 100].includes(streak)) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [streak]);

    if (streak <= 0) return null;

    const getBadgeColor = () => {
        if (streak >= 30) return isDark ? '#FFE082' : '#FFD700'; // gold
        if (streak >= 14) return isDark ? '#E0E0E0' : '#C0C0C0'; // silver
        if (streak >= 7) return isDark ? '#FFAB91' : '#CD7F32'; // bronze
        return isDark ? '#FF8A65' : '#FF6B35'; // default flame
    };

    const getBadgeBg = () => {
        const base = getBadgeColor();
        return isDark ? `${base}20` : `${base}18`;
    };

    const color = getBadgeColor();

    if (compact) {
        return (
            <Animated.View
                style={[
                    styles.compactBadge,
                    { backgroundColor: getBadgeBg(), transform: [{ scale: pulseAnim }] },
                ]}
            >
                <Text style={styles.flameEmoji}>🔥</Text>
                <Text style={[styles.compactNumber, { color }]}>{streak}</Text>
            </Animated.View>
        );
    }

    return (
        <Animated.View
            style={[
                styles.fullBadge,
                { borderColor: color, backgroundColor: getBadgeBg(), transform: [{ scale: pulseAnim }] },
            ]}
        >
            <Text style={styles.flameEmoji}>🔥</Text>
            <View>
                <Text style={[styles.streakNumber, { color }]}>{streak}</Text>
                <Text style={[styles.streakLabel, { color: colors.textTertiary }]}>day streak</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    compactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 2,
    },
    flameEmoji: {
        fontSize: 14,
    },
    compactNumber: {
        fontSize: 13,
        fontWeight: '700',
    },
    fullBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1.5,
        gap: 8,
    },
    streakNumber: {
        fontSize: 20,
        fontWeight: '800',
    },
    streakLabel: {
        fontSize: 11,
        fontWeight: '500',
    },
});
