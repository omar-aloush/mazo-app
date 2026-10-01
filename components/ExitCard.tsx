import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Pressable,
    Modal,
    Dimensions,
} from 'react-native';
import { ArrowRight, CheckCircle, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { hapticSuccess, hapticTap } from '@/utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ExitCardProps {
    visible: boolean;
    actionTitle: string;
    onDismiss: () => void;
}

export const ExitCard: React.FC<ExitCardProps> = ({ visible, actionTitle, onDismiss }) => {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const checkScale = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const actionFade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            hapticSuccess();
            // Staggered entrance animation
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 350,
                        useNativeDriver: true,
                    }),
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        friction: 12,
                        tension: 45,
                        useNativeDriver: true,
                    }),
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        friction: 10,
                        tension: 50,
                        useNativeDriver: true,
                    }),
                ]),
                // Checkmark appears after card
                Animated.spring(checkScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 60,
                    useNativeDriver: true,
                }),
            ]).start();

            // Delayed action row fade-in
            Animated.sequence([
                Animated.delay(500),
                Animated.timing(actionFade, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]).start();

            // Subtle glow pulse
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
                    Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
                ])
            ).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(40);
            scaleAnim.setValue(0.95);
            checkScale.setValue(0);
            glowAnim.setValue(0);
            actionFade.setValue(0);
        }
    }, [visible, fadeAnim, slideAnim, scaleAnim, checkScale, glowAnim, actionFade]);

    const accentColor = isDark ? '#E0B88A' : '#D4A574';
    const accentBg = isDark ? 'rgba(224, 184, 138, 0.08)' : 'rgba(212, 165, 116, 0.08)';
    const accentBorder = isDark ? 'rgba(224, 184, 138, 0.15)' : 'rgba(212, 165, 116, 0.15)';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
        >
            <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.5)' }]}>
                <Animated.View
                    style={[
                        styles.container,
                        {
                            backgroundColor: colors.surface,
                            borderColor: accentBorder,
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                        },
                    ]}
                >
                    {/* Checkmark icon with spring animation */}
                    <Animated.View style={[styles.iconContainer, { transform: [{ scale: checkScale }] }]}>
                        <View style={[styles.iconCircle, { backgroundColor: accentBg, borderColor: accentBorder }]}>
                            <CheckCircle size={32} color={accentColor} />
                        </View>
                    </Animated.View>

                    {/* Session status badge */}
                    <View style={[styles.statusBadge, { backgroundColor: accentBg, borderColor: accentBorder }]}>
                        <Sparkles size={12} color={accentColor} />
                        <Text style={[styles.statusText, { color: accentColor }]}>{t('chat.sessionComplete')}</Text>
                    </View>

                    {/* Title & subtitle */}
                    <Text style={[styles.title, { color: colors.text }]}>{t('chat.nextStepAwaits')}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {t('chat.gainedClarity')}
                    </Text>

                    {/* Action step card */}
                    <Animated.View style={[
                        styles.actionRow,
                        {
                            backgroundColor: accentBg,
                            borderColor: accentBorder,
                            opacity: actionFade,
                        }
                    ]}>
                        <View style={[styles.actionDot, { backgroundColor: accentColor }]} />
                        <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={2}>
                            {actionTitle}
                        </Text>
                    </Animated.View>

                    {/* Message */}
                    <Text style={[styles.message, { color: colors.textTertiary }]}>
                        {t('chat.actionSaved')}
                    </Text>

                    {/* Continue button */}
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
                        <Text style={styles.continueButtonText}>{t('common.continue')}</Text>
                        <ArrowRight size={18} color="#FFFFFF" />
                    </Pressable>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
    },
    iconContainer: {
        marginBottom: 16,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600' as const,
        letterSpacing: 0.3,
    },
    title: {
        fontSize: 22,
        fontWeight: '700' as const,
        marginBottom: 6,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 15,
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 21,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
        width: '100%',
    },
    actionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    actionText: {
        fontSize: 15,
        fontWeight: '600' as const,
        flex: 1,
        lineHeight: 20,
    },
    message: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 24,
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 14,
        gap: 8,
        width: '100%',
    },
    continueButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: '#FFFFFF',
    },
});
