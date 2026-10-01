/**
 * MemoryInsightsCard — "Here's what I've learned about you" in-chat card.
 * This is the moat against "ChatGPT wrapper" perception.
 * Surfaces memory, goals, preferences, and progress inside the chat.
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Animated,
    Easing,
    Platform,
} from 'react-native';
import {
    Brain,
    Target,
    CheckCircle2,
    Lightbulb,
    Flame,
    ChevronRight,
    Sparkles,
    X,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { track } from '@/services/analytics';

interface MemoryInsightsCardProps {
    goalsCount: number;
    tasksCompleted: number;
    insightsCount: number;
    topPreferences: string[];
    streakDays: number;
    totalSessions: number;
    onContinue: () => void;
    onDismiss: () => void;
}

export function MemoryInsightsCard({
    goalsCount,
    tasksCompleted,
    insightsCount,
    topPreferences,
    streakDays,
    totalSessions,
    onContinue,
    onDismiss,
}: MemoryInsightsCardProps) {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const slideAnim = useRef(new Animated.Value(50)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.92)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        track('memory_insights_shown', { totalSessions, goalsCount, insightsCount });

        // Entry animation sequence
        Animated.stagger(80, [
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    friction: 8,
                    tension: 65,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 6,
                    tension: 80,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();

        // Subtle pulse on the brain icon
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.08,
                    duration: 1800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Shimmer effect
        Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 3000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const stats = [
        { icon: Target, value: goalsCount, label: t('memoryInsights.goals'), color: '#F59E0B' },
        { icon: CheckCircle2, value: tasksCompleted, label: t('memoryInsights.done'), color: '#10B981' },
        { icon: Lightbulb, value: insightsCount, label: t('memoryInsights.insights'), color: '#8B5CF6' },
        { icon: Flame, value: streakDays, label: t('memoryInsights.streak'), color: '#EF4444' },
    ];

    const gradientColors = isDark
        ? ['#1a1040', '#1E1B4B', '#2d1f6b'] as const
        : ['#EEF2FF', '#E0E7FF', '#C7D2FE'] as const;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { translateY: slideAnim },
                        { scale: scaleAnim },
                    ],
                    opacity: fadeAnim,
                },
            ]}
        >
            <LinearGradient
                colors={[...gradientColors]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {/* Dismiss button */}
                <Pressable
                    style={styles.dismissButton}
                    onPress={onDismiss}
                    hitSlop={12}
                    accessibilityLabel="Dismiss memory insights"
                >
                    <X size={14} color={isDark ? '#818CF8' : '#6366F1'} />
                </Pressable>

                {/* Header */}
                <View style={styles.headerRow}>
                    <Animated.View
                        style={[
                            styles.iconCircle,
                            {
                                backgroundColor: isDark ? '#4338CA30' : '#4338CA15',
                                transform: [{ scale: pulseAnim }],
                            },
                        ]}
                    >
                        <Brain size={24} color={isDark ? '#A5B4FC' : '#4338CA'} />
                    </Animated.View>
                    <View style={{ flex: 1 }}>
                        <View style={styles.titleRow}>
                            <Text style={[styles.title, { color: isDark ? '#E0E7FF' : '#1E1B4B' }]}>
                                {t('memoryInsights.title')}
                            </Text>
                            <Sparkles size={14} color={isDark ? '#A5B4FC' : '#6366F1'} />
                        </View>
                        <Text style={[styles.subtitle, { color: isDark ? '#A5B4FC' : '#6366F1' }]}>
                            {t('memoryInsights.sessions', { count: totalSessions })}
                        </Text>
                    </View>
                </View>

                {/* Stats Grid */}
                <View style={[styles.statsContainer, { backgroundColor: isDark ? '#ffffff08' : '#ffffff60' }]}>
                    <View style={styles.statsRow}>
                        {stats.map((stat, i) => (
                            <View key={i} style={styles.statItem}>
                                <View style={[styles.statIconBg, { backgroundColor: stat.color + '18' }]}>
                                    <stat.icon size={14} color={stat.color} />
                                </View>
                                <Text style={[styles.statValue, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                                    {stat.value}
                                </Text>
                                <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                                    {stat.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Top Preferences */}
                {topPreferences.length > 0 && (
                    <View style={[styles.preferencesBox, { backgroundColor: isDark ? '#ffffff06' : '#ffffff50' }]}>
                        <Text style={[styles.preferencesLabel, { color: isDark ? '#A5B4FC' : '#4338CA' }]}>
                            {t('memoryInsights.learned')}
                        </Text>
                        {topPreferences.slice(0, 3).map((pref, i) => (
                            <View key={i} style={styles.preferenceRow}>
                                <View style={[styles.prefDot, { backgroundColor: isDark ? '#818CF8' : '#6366F1' }]} />
                                <Text
                                    style={[styles.preferenceItem, { color: isDark ? '#CBD5E1' : '#334155' }]}
                                    numberOfLines={1}
                                >
                                    {pref}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* CTA Button */}
                <Pressable
                    style={({ pressed }) => [
                        styles.ctaButton,
                        {
                            backgroundColor: isDark ? '#4338CA' : '#4F46E5',
                            ...Platform.select({
                                ios: {
                                    shadowColor: '#4F46E5',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                },
                                android: { elevation: 6 },
                            }),
                        },
                        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => {
                        track('memory_insights_cta', { action: 'continue' });
                        onContinue();
                    }}
                    accessibilityLabel="Continue session with learned insights"
                    accessibilityRole="button"
                >
                    <Sparkles size={16} color="#fff" />
                    <Text style={styles.ctaText}>{t('memoryInsights.cta')}</Text>
                    <ChevronRight size={16} color="#fff" />
                </Pressable>
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 14,
        borderRadius: 22,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#4338CA',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 16,
            },
            android: { elevation: 8 },
        }),
    },
    gradient: {
        padding: 20,
        paddingTop: 16,
    },
    dismissButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(99,102,241,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        paddingRight: 24,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 3,
        letterSpacing: 0.2,
    },
    statsContainer: {
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    statIconBg: {
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    statLabel: {
        fontSize: 9,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    preferencesBox: {
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
    },
    preferencesLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    preferenceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 3,
    },
    prefDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    preferenceItem: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '500',
        flex: 1,
    },
    ctaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 6,
    },
    ctaText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});
