/**
 * ShareMomentCard — celebratory card that appears at streak milestones,
 * breakthroughs, and goal completions with an organic share CTA.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Share2, X, Flame, Sparkles, Target } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import type { ShareMomentType } from '@/providers/GrowthProvider';

interface ShareMomentCardProps {
    type: ShareMomentType;
    title: string;
    subtitle: string;
    onShare: () => void;
    onDismiss: () => void;
}

const ICON_MAP: Record<ShareMomentType, typeof Flame> = {
    streak: Flame,
    breakthrough: Sparkles,
    goal: Target,
};

const GRADIENT_MAP: Record<ShareMomentType, [string, string]> = {
    streak: ['#FF6B35', '#FF2D2D'],
    breakthrough: ['#7C3AED', '#2563EB'],
    goal: ['#059669', '#10B981'],
};

export function ShareMomentCard({ type, title, subtitle, onShare, onDismiss }: ShareMomentCardProps) {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const slideAnim = useRef(new Animated.Value(80)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                easing: Easing.out(Easing.back(1.2)),
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const Icon = ICON_MAP[type];
    const gradient = GRADIENT_MAP[type];

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                },
            ]}
        >
            <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={12}>
                    <X size={16} color="rgba(255,255,255,0.7)" />
                </Pressable>

                <View style={styles.iconRow}>
                    <View style={styles.iconCircle}>
                        <Icon size={24} color="#fff" />
                    </View>
                </View>

                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>

                <Pressable style={styles.shareButton} onPress={onShare}>
                    <Share2 size={16} color={gradient[0]} />
                    <Text style={[styles.shareText, { color: gradient[0] }]}>
                        {t('shareMoment.shareWithFriend')}
                    </Text>
                </Pressable>
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 20,
        overflow: 'hidden',
    },
    gradient: {
        padding: 24,
        alignItems: 'center',
    },
    dismissButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconRow: {
        marginBottom: 12,
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        marginBottom: 20,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        gap: 8,
    },
    shareText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
