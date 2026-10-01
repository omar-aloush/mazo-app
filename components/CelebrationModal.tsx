import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Pressable } from 'react-native';
import { CheckCircle, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { hapticCelebration, hapticTap } from '@/utils/haptics';

interface CelebrationModalProps {
    visible: boolean;
    onDismiss: () => void;
    taskTitle?: string;
}

const { width } = Dimensions.get('window');

export function CelebrationModal({ visible, onDismiss, taskTitle }: CelebrationModalProps) {
    const { colors, isDark } = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.92)).current;
    const checkScale = useRef(new Animated.Value(0)).current;
    const ringScale = useRef(new Animated.Value(0.5)).current;
    const ringOpacity = useRef(new Animated.Value(0)).current;
    const contentFade = useRef(new Animated.Value(0)).current;
    const glowPulse = useRef(new Animated.Value(0)).current;

    const accentColor = isDark ? '#8FB896' : '#7C9A82';
    const accentBg = isDark ? 'rgba(143, 184, 150, 0.08)' : 'rgba(124, 154, 130, 0.06)';
    const accentBorder = isDark ? 'rgba(143, 184, 150, 0.15)' : 'rgba(124, 154, 130, 0.12)';

    useEffect(() => {
        if (visible) {
            hapticCelebration();
            // 1. Card fades in
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 10,
                    tension: 50,
                    useNativeDriver: true,
                }),
            ]).start();

            // 2. Ring expands outward from center
            Animated.sequence([
                Animated.delay(200),
                Animated.parallel([
                    Animated.spring(ringScale, {
                        toValue: 1,
                        friction: 6,
                        tension: 40,
                        useNativeDriver: true,
                    }),
                    Animated.timing(ringOpacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start();

            // 3. Checkmark springs in
            Animated.sequence([
                Animated.delay(400),
                Animated.spring(checkScale, {
                    toValue: 1,
                    friction: 4,
                    tension: 70,
                    useNativeDriver: true,
                }),
            ]).start();

            // 4. Text content fades in
            Animated.sequence([
                Animated.delay(600),
                Animated.timing(contentFade, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]).start();

            // 5. Gentle glow pulse
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowPulse, { toValue: 1, duration: 2500, useNativeDriver: true }),
                    Animated.timing(glowPulse, { toValue: 0, duration: 2500, useNativeDriver: true }),
                ])
            ).start();
        } else {
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.92);
            checkScale.setValue(0);
            ringScale.setValue(0.5);
            ringOpacity.setValue(0);
            contentFade.setValue(0);
            glowPulse.setValue(0);
        }
    }, [visible, fadeAnim, scaleAnim, checkScale, ringScale, ringOpacity, contentFade, glowPulse]);

    if (!visible) return null;

    return (
        <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.45)' }]}>
            <Animated.View
                style={[
                    styles.cardContainer,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: accentBorder }]}>
                    {/* Animated checkmark with expanding ring */}
                    <View style={styles.iconArea}>
                        <Animated.View style={[
                            styles.outerRing,
                            {
                                borderColor: accentColor,
                                opacity: Animated.multiply(ringOpacity, glowPulse.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.2, 0.4],
                                })),
                                transform: [{ scale: ringScale }],
                            },
                        ]} />
                        <Animated.View style={[
                            styles.middleRing,
                            {
                                borderColor: accentColor,
                                opacity: ringOpacity.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 0.15],
                                }),
                                transform: [{
                                    scale: ringScale.interpolate({
                                        inputRange: [0.5, 1],
                                        outputRange: [0.6, 0.85],
                                    }),
                                }],
                            },
                        ]} />
                        <Animated.View
                            style={[
                                styles.checkCircle,
                                {
                                    backgroundColor: accentBg,
                                    borderColor: accentBorder,
                                    transform: [{ scale: checkScale }],
                                },
                            ]}
                        >
                            <CheckCircle size={28} color={accentColor} />
                        </Animated.View>
                    </View>

                    {/* Content */}
                    <Animated.View style={[styles.content, { opacity: contentFade }]}>
                        <Text style={[styles.title, { color: colors.text }]}>Session Wrapped Up</Text>

                        {taskTitle ? (
                            <View style={[styles.taskRow, { backgroundColor: accentBg, borderColor: accentBorder }]}>
                                <View style={[styles.taskDot, { backgroundColor: accentColor }]} />
                                <Text style={[styles.taskText, { color: colors.text }]} numberOfLines={2}>
                                    {taskTitle}
                                </Text>
                            </View>
                        ) : (
                            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                Great session — your insights are saved.
                            </Text>
                        )}

                        <Text style={[styles.message, { color: colors.textTertiary }]}>
                            Your tasks and progress are saved. Start a new session anytime.
                        </Text>

                        <Pressable
                            style={({ pressed }) => [
                                styles.continueButton,
                                { backgroundColor: accentColor },
                                pressed && styles.continueButtonPressed,
                            ]}
                            onPress={() => {
                                hapticTap();
                                onDismiss();
                            }}
                        >
                            <Text style={styles.continueText}>Continue</Text>
                            <ArrowRight size={16} color="#FFFFFF" />
                        </Pressable>
                    </Animated.View>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    cardContainer: {
        width: width * 0.88,
        maxWidth: 360,
    },
    card: {
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 8,
    },
    iconArea: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    outerRing: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 1.5,
    },
    middleRing: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 1,
    },
    checkCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        width: '100%',
    },
    title: {
        fontSize: 21,
        fontWeight: '700' as const,
        marginBottom: 12,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 21,
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        width: '100%',
    },
    taskDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    taskText: {
        fontSize: 14,
        fontWeight: '600' as const,
        flex: 1,
        lineHeight: 19,
    },
    message: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 20,
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        paddingHorizontal: 28,
        borderRadius: 13,
        gap: 6,
        width: '100%',
    },
    continueButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    continueText: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: '#FFFFFF',
    },
});
