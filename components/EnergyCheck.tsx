import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Animated,
    Modal,
} from 'react-native';
import { Battery, BatteryLow, BatteryMedium, BatteryFull, Zap } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';

interface EnergyCheckProps {
    visible: boolean;
    onComplete: (level: 'low' | 'medium' | 'high') => void;
    onSkip: () => void;
}

const ENERGY_LEVELS = [
    {
        id: 'low' as const,
        label: 'Low',
        description: 'Need rest',
        icon: BatteryLow,
        color: '#EF4444'
    },
    {
        id: 'medium' as const,
        label: 'Medium',
        description: 'Feeling okay',
        icon: BatteryMedium,
        color: '#F59E0B'
    },
    {
        id: 'high' as const,
        label: 'High',
        description: 'Ready to go',
        icon: BatteryFull,
        color: '#22C55E'
    },
];

export const EnergyCheck: React.FC<EnergyCheckProps> = ({ visible, onComplete, onSkip }) => {
    const { colors } = useTheme();
    const [selectedLevel, setSelectedLevel] = useState<'low' | 'medium' | 'high' | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, fadeAnim, slideAnim]);

    const handleSelect = (level: 'low' | 'medium' | 'high') => {
        setSelectedLevel(level);
    };

    const handleConfirm = () => {
        if (selectedLevel) {
            onComplete(selectedLevel);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
        >
            <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
                <Animated.View
                    style={[
                        styles.container,
                        { backgroundColor: colors.surface },
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        }
                    ]}
                >
                    <View style={styles.iconHeader}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                            <Zap size={28} color={colors.accent} />
                        </View>
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>How's your energy today?</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        This helps me suggest the right focus for you
                    </Text>

                    <View style={styles.levelsContainer}>
                        {ENERGY_LEVELS.map((level) => {
                            const Icon = level.icon;
                            const isSelected = selectedLevel === level.id;

                            return (
                                <Pressable
                                    key={level.id}
                                    style={[
                                        styles.levelOption,
                                        { backgroundColor: colors.background },
                                        isSelected && { borderColor: level.color, backgroundColor: `${level.color}10` }
                                    ]}
                                    onPress={() => handleSelect(level.id)}
                                >
                                    <View style={[styles.levelIcon, { backgroundColor: `${level.color}20` }]}>
                                        <Icon size={24} color={level.color} />
                                    </View>
                                    <Text style={[styles.levelLabel, { color: colors.text }, isSelected && { color: level.color }]}>
                                        {level.label}
                                    </Text>
                                    <Text style={[styles.levelDescription, { color: colors.textSecondary }]}>{level.description}</Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <View style={styles.footer}>
                        <Pressable style={[styles.skipButton, { backgroundColor: colors.background }]} onPress={onSkip}>
                            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.confirmButton,
                                { backgroundColor: colors.accent },
                                !selectedLevel && styles.confirmButtonDisabled
                            ]}
                            onPress={handleConfirm}
                            disabled={!selectedLevel}
                        >
                            <Text style={[styles.confirmText, { color: colors.textInverse }]}>Continue</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: Colors.surface,
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
    },
    iconHeader: {
        marginBottom: 16,
    },
    iconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.accentLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700' as const,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    levelsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    levelOption: {
        flex: 1,
        backgroundColor: Colors.background,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    levelIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    levelEmoji: {
        fontSize: 24,
        marginBottom: 4,
    },
    levelLabel: {
        fontSize: 14,
        fontWeight: '600' as const,
        color: Colors.text,
        marginBottom: 2,
    },
    levelDescription: {
        fontSize: 11,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    skipButton: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: Colors.background,
    },
    skipText: {
        fontSize: 15,
        fontWeight: '500' as const,
        color: Colors.textSecondary,
    },
    confirmButton: {
        flex: 2,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: Colors.accent,
    },
    confirmButtonDisabled: {
        opacity: 0.5,
    },
    confirmText: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: Colors.textInverse,
    },
});
