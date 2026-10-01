import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Animated,
    Modal,
    Dimensions,
} from 'react-native';
import { Moon, X, Wind, Pause, Play } from 'lucide-react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ZenModeProps {
    visible: boolean;
    onClose: () => void;
    taskTitle?: string;
}

const BREATHING_PHASES = [
    { label: 'Breathe in', duration: 4000 },
    { label: 'Hold', duration: 4000 },
    { label: 'Breathe out', duration: 4000 },
    { label: 'Hold', duration: 2000 },
];

export const ZenMode: React.FC<ZenModeProps> = ({ visible, onClose, taskTitle }) => {
    const [isPaused, setIsPaused] = useState(false);
    const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
    const [cycleCount, setCycleCount] = useState(0);
    const breathAnim = useRef(new Animated.Value(0.4)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start();
            startBreathing();
        } else {
            setCurrentPhaseIndex(0);
            setCycleCount(0);
            breathAnim.setValue(0.4);
        }
    }, [visible]);

    const startBreathing = () => {
        if (isPaused) return;

        const phase = BREATHING_PHASES[currentPhaseIndex];
        const isExpand = currentPhaseIndex === 0;
        const isContract = currentPhaseIndex === 2;
        const isHold = currentPhaseIndex === 1 || currentPhaseIndex === 3;

        // For hold phases, keep the current value by animating to same value
        const targetValue = isExpand ? 1 : (isContract ? 0.4 : (isHold ? (currentPhaseIndex === 1 ? 1 : 0.4) : 0.7));

        Animated.timing(breathAnim, {
            toValue: targetValue,
            duration: phase.duration,
            useNativeDriver: true,
        }).start(() => {
            if (!isPaused) {
                const nextIndex = (currentPhaseIndex + 1) % BREATHING_PHASES.length;
                setCurrentPhaseIndex(nextIndex);
                if (nextIndex === 0) {
                    setCycleCount(c => c + 1);
                }
            }
        });
    };

    useEffect(() => {
        if (!isPaused && visible) {
            startBreathing();
        }
    }, [currentPhaseIndex, isPaused, visible]);

    const togglePause = () => {
        // Light impact feedback removed
        setIsPaused(!isPaused);
    };

    const handleClose = () => {
        onClose();
    };

    const currentPhase = BREATHING_PHASES[currentPhaseIndex];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                <Pressable style={styles.closeButton} onPress={handleClose}>
                    <X size={24} color="rgba(255,255,255,0.7)" />
                </Pressable>

                <View style={styles.content}>
                    <View style={styles.header}>
                        <Moon size={24} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.title}>Zen Mode</Text>
                    </View>

                    {taskTitle && (
                        <Text style={styles.taskReminder}>
                            Your task: {taskTitle}
                        </Text>
                    )}

                    <View style={styles.breathContainer}>
                        <Animated.View
                            style={[
                                styles.breathCircle,
                                {
                                    transform: [{ scale: breathAnim }],
                                },
                            ]}
                        />
                        <View style={styles.breathInner}>
                            <Wind size={32} color="rgba(255,255,255,0.9)" />
                        </View>
                    </View>

                    <Text style={styles.phaseLabel}>{currentPhase.label}</Text>

                    <View style={styles.stats}>
                        <Text style={styles.statsText}>
                            {cycleCount} {cycleCount === 1 ? 'breath' : 'breaths'} complete
                        </Text>
                    </View>

                    <Pressable style={styles.pauseButton} onPress={togglePause}>
                        {isPaused ? (
                            <Play size={20} color="rgba(255,255,255,0.9)" />
                        ) : (
                            <Pause size={20} color="rgba(255,255,255,0.9)" />
                        )}
                        <Text style={styles.pauseText}>{isPaused ? 'Resume' : 'Pause'}</Text>
                    </Pressable>

                    <Text style={styles.hint}>
                        Take a moment to center yourself before taking action
                    </Text>
                </View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(15, 15, 35, 0.98)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: 24,
        padding: 8,
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: '300' as const,
        color: 'rgba(255,255,255,0.95)',
        letterSpacing: 2,
    },
    taskReminder: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 40,
        textAlign: 'center',
    },
    breathContainer: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    breathCircle: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        borderWidth: 2,
        borderColor: 'rgba(139, 92, 246, 0.6)',
    },
    breathInner: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(139, 92, 246, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    phaseLabel: {
        fontSize: 22,
        fontWeight: '400' as const,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 24,
        letterSpacing: 1,
    },
    stats: {
        marginBottom: 32,
    },
    statsText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
    },
    pauseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 24,
        marginBottom: 40,
    },
    pauseText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '500' as const,
    },
    hint: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        maxWidth: 280,
        lineHeight: 20,
    },
});
