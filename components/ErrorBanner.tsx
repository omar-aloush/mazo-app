import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { AlertCircle, WifiOff, RotateCcw, X } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';

interface ErrorBannerProps {
    message: string;
    type?: 'error' | 'offline' | 'warning';
    onRetry?: () => void;
    onDismiss?: () => void;
    autoDismissMs?: number;
    visible: boolean;
}

export function ErrorBanner({
    message,
    type = 'error',
    onRetry,
    onDismiss,
    autoDismissMs = 6000,
    visible,
}: ErrorBannerProps) {
    const { colors } = useTheme();
    const slideAnim = useRef(new Animated.Value(-60)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            if (autoDismissMs > 0 && onDismiss) {
                const timer = setTimeout(() => onDismiss(), autoDismissMs);
                return () => clearTimeout(timer);
            }
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -60,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, autoDismissMs, onDismiss]);

    if (!visible) return null;

    const isOffline = type === 'offline';
    const isWarning = type === 'warning';
    const bgColor = isOffline
        ? '#FEF3C7'
        : isWarning
            ? `${colors.warning}15`
            : '#FEF2F2';
    const textColor = isOffline ? '#92400E' : isWarning ? colors.warning : '#DC2626';
    const borderColor = isOffline ? '#F59E0B' : isWarning ? colors.warning : '#FECACA';

    const Icon = isOffline ? WifiOff : AlertCircle;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: bgColor,
                    borderColor,
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                },
            ]}
        >
            <Icon size={16} color={textColor} />
            <Text style={[styles.message, { color: textColor }]} numberOfLines={2}>
                {message}
            </Text>
            {onRetry && (
                <Pressable style={styles.retryBtn} onPress={onRetry} hitSlop={8}>
                    <RotateCcw size={14} color={textColor} />
                </Pressable>
            )}
            {onDismiss && (
                <Pressable style={styles.dismissBtn} onPress={onDismiss} hitSlop={8}>
                    <X size={14} color={textColor} />
                </Pressable>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginVertical: 6,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    message: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
    },
    retryBtn: {
        padding: 4,
    },
    dismissBtn: {
        padding: 4,
    },
});
