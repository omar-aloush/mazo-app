import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Modal,
    Dimensions,
    Pressable,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AIFace } from '@/components/AIFace';
import { useTheme } from '@/providers/ThemeProvider';
import {
    MessageCircle,
    TrendingUp,
    User,
    Users,
    Palette,
    Globe,
    ChevronDown,
    X,
    Check,
} from 'lucide-react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Tour Steps ───────────────────────────────────────────────
interface TourStep {
    id: string;
    expression: 'happy' | 'proud' | 'curious' | 'encouraging' | 'idle' | 'listening';
    message: string;
    highlight?: 'chat' | 'journey' | 'settings';
    highlightLabel?: string;
    feature?: {
        icon: 'users' | 'palette' | 'globe';
        title: string;
        bullets: string[];
    };
}

const STEPS: TourStep[] = [
    {
        id: 'welcome',
        expression: 'proud',
        message: "Nice work on your first session! 🎉\nLet me show you around — it'll take 30 seconds.",
    },
    {
        id: 'chat',
        expression: 'happy',
        message: "This is Chat — where we talk.\nPick a coach, set a mode, and I'll guide your thinking.",
        highlight: 'chat',
        highlightLabel: 'Chat',
    },
    {
        id: 'coaches',
        expression: 'curious',
        message: "You have 15+ coaches to choose from.\nEach has a unique style — tough love, calm guidance, strategic thinking. Switch anytime.",
        feature: {
            icon: 'users',
            title: 'Your Coaches',
            bullets: ['Different personalities', 'Unique coaching styles', 'Switch anytime'],
        },
    },
    {
        id: 'custom',
        expression: 'happy',
        message: "Don't like the options? Build your own.\nSet a personality, tone, and focus — then share it with friends using a code.",
        feature: {
            icon: 'palette',
            title: 'Create a Coach',
            bullets: ['Custom personality', 'Your own tone', 'Share with friends'],
        },
    },
    {
        id: 'community',
        expression: 'encouraging',
        message: "Other users share their coaches too.\nBrowse community coaches or import one with a code — it's like an app store for coaching styles.",
        feature: {
            icon: 'globe',
            title: 'Community',
            bullets: ['Browse shared coaches', 'Import with a code', 'Rate & discover'],
        },
    },
    {
        id: 'journey',
        expression: 'curious',
        message: "Journey is your headquarters.\nGoals, tasks, schedule, and everything I remember — all in one place.",
        highlight: 'journey',
        highlightLabel: 'Journey',
    },
    {
        id: 'settings',
        expression: 'listening',
        message: "Settings is where you update your profile.\nThe more I know about you, the better I coach.",
        highlight: 'settings',
        highlightLabel: 'Settings',
    },
    {
        id: 'done',
        expression: 'encouraging',
        message: "That's everything! Simple by design.\nGo explore your coaches and start your next session. 🚀",
    },
];

// ─── Typewriter Hook ──────────────────────────────────────────
function useTypewriter(text: string, speed = 28) {
    const [displayed, setDisplayed] = useState('');
    const [isDone, setIsDone] = useState(false);
    const indexRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setDisplayed('');
        setIsDone(false);
        indexRef.current = 0;

        const tick = () => {
            indexRef.current += 1;
            const nextText = text.slice(0, indexRef.current);
            setDisplayed(nextText);

            if (indexRef.current < text.length) {
                // Speed up on spaces/newlines for more natural feel
                const char = text[indexRef.current];
                const delay = char === ' ' ? speed * 0.4 : char === '\n' ? speed * 3 : speed;
                timerRef.current = setTimeout(tick, delay);
            } else {
                setIsDone(true);
            }
        };

        timerRef.current = setTimeout(tick, 400); // Initial pause before typing starts

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [text, speed]);

    const skipToEnd = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setDisplayed(text);
        setIsDone(true);
    }, [text]);

    return { displayed, isDone, skipToEnd };
}

// ─── Tab Icon Component ───────────────────────────────────────
function TabIcon({ type, active, colors }: { type: 'chat' | 'journey' | 'settings'; active: boolean; colors: any }) {
    const iconColor = active ? '#FFFFFF' : 'rgba(255,255,255,0.4)';
    const size = 22;

    return (
        <View style={[tStyles.tabIcon, active && { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' }]}>
            {type === 'chat' && <MessageCircle size={size} color={iconColor} strokeWidth={active ? 2.4 : 1.6} />}
            {type === 'journey' && <TrendingUp size={size} color={iconColor} strokeWidth={active ? 2.4 : 1.6} />}
            {type === 'settings' && <User size={size} color={iconColor} strokeWidth={active ? 2.4 : 1.6} />}
        </View>
    );
}

const tStyles = StyleSheet.create({
    tabIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
});

// ─── Main Component ───────────────────────────────────────────
interface GuidedTourProps {
    visible: boolean;
    onDismiss: () => void;
    userName?: string;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ visible, onDismiss, userName }) => {
    const { colors } = useTheme();
    const [stepIndex, setStepIndex] = useState(0);
    const step = STEPS[stepIndex];
    const isLast = stepIndex === STEPS.length - 1;

    // Personalize the first message
    const rawMessage = stepIndex === 0 && userName
        ? step.message.replace('Nice work', `Nice work, ${userName}`)
        : step.message;

    const { displayed, isDone, skipToEnd } = useTypewriter(rawMessage);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const faceScale = useRef(new Animated.Value(0.5)).current;
    const bubbleSlide = useRef(new Animated.Value(30)).current;
    const tabHighlight = useRef(new Animated.Value(0)).current;
    const arrowBounce = useRef(new Animated.Value(0)).current;
    const dotsOpacity = useRef(new Animated.Value(0)).current;

    // Entrance animation
    useEffect(() => {
        if (visible) {
            setStepIndex(0);
            fadeAnim.setValue(0);
            faceScale.setValue(0.5);
            bubbleSlide.setValue(30);
            dotsOpacity.setValue(0);

            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.spring(faceScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
                Animated.spring(bubbleSlide, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
                Animated.timing(dotsOpacity, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    // Step transition animation
    useEffect(() => {
        bubbleSlide.setValue(20);
        faceScale.setValue(0.9);
        tabHighlight.setValue(0);

        Animated.parallel([
            Animated.spring(bubbleSlide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
            Animated.spring(faceScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        ]).start();

        // Tab highlight pulse
        if (step.highlight) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(tabHighlight, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(tabHighlight, { toValue: 0.3, duration: 800, useNativeDriver: true }),
                ])
            ).start();

            // Arrow bounce
            Animated.loop(
                Animated.sequence([
                    Animated.timing(arrowBounce, { toValue: -8, duration: 500, useNativeDriver: true }),
                    Animated.timing(arrowBounce, { toValue: 0, duration: 500, useNativeDriver: true }),
                ])
            ).start();
        }
    }, [stepIndex]);

    const goNext = useCallback(() => {
        if (!isDone) {
            skipToEnd();
            return;
        }
        if (isLast) {
            Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onDismiss());
        } else {
            setStepIndex(prev => prev + 1);
        }
    }, [isDone, isLast, skipToEnd, onDismiss, fadeAnim]);

    const handleSkip = useCallback(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onDismiss());
    }, [onDismiss, fadeAnim]);

    if (!visible) return null;

    // Determine face expression — 'talking' while typing, step expression when done
    const faceExpression = isDone ? step.expression : 'idle';

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                <LinearGradient
                    colors={['rgba(15,15,25,0.97)', 'rgba(10,10,20,0.99)']}
                    style={StyleSheet.absoluteFillObject}
                />

                {/* Skip button */}
                {!isLast && (
                    <Pressable style={styles.skipBtn} onPress={handleSkip} hitSlop={16}>
                        <X size={20} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.skipText}>Skip</Text>
                    </Pressable>
                )}

                {/* Step dots */}
                <Animated.View style={[styles.dotsContainer, { opacity: dotsOpacity }]}>
                    {STEPS.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: i === stepIndex ? '#F59E0B' : 'rgba(255,255,255,0.2)',
                                    width: i === stepIndex ? 24 : 8,
                                },
                            ]}
                        />
                    ))}
                </Animated.View>

                {/* Main content area */}
                <Pressable style={styles.contentArea} onPress={goNext}>
                    {/* Mazō Face */}
                    <Animated.View style={[styles.faceContainer, { transform: [{ scale: faceScale }] }]}>
                        <View style={styles.faceGlow}>
                            <View style={styles.faceRing}>
                                <AIFace
                                    expression={faceExpression}
                                    size={step.highlight ? 80 : 110}
                                />
                            </View>
                        </View>
                    </Animated.View>

                    {/* Speech Bubble */}
                    <Animated.View style={[styles.speechBubble, { transform: [{ translateY: bubbleSlide }] }]}>
                        <View style={styles.speechTail} />
                        <Text style={styles.speechText}>
                            {displayed}
                            {!isDone && <Text style={styles.cursor}>|</Text>}
                        </Text>
                    </Animated.View>

                    {/* Tab Highlight Area — only when a tab is highlighted */}
                    {step.highlight && (
                        <View style={styles.tabShowcase}>
                            <Animated.View style={[styles.arrowContainer, { transform: [{ translateY: arrowBounce }] }]}>
                                <ChevronDown size={24} color="#F59E0B" />
                            </Animated.View>

                            <View style={styles.tabRow}>
                                {(['chat', 'journey', 'settings'] as const).map((tab) => {
                                    const isActive = tab === step.highlight;
                                    return (
                                        <View key={tab} style={styles.tabItem}>
                                            <Animated.View
                                                style={[
                                                    styles.tabPulse,
                                                    isActive && { opacity: tabHighlight, borderColor: '#F59E0B' },
                                                ]}
                                            >
                                                <TabIcon type={tab} active={isActive} colors={colors} />
                                            </Animated.View>
                                            <Text style={[
                                                styles.tabLabel,
                                                isActive && styles.tabLabelActive,
                                            ]}>
                                                {tab === 'chat' ? 'Chat' : tab === 'journey' ? 'Journey' : 'Settings'}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Feature Showcase — for coaches, custom, community steps */}
                    {step.feature && (
                        <View style={styles.featureShowcase}>
                            <View style={styles.featureIconCircle}>
                                {step.feature.icon === 'users' && <Users size={32} color="#F59E0B" />}
                                {step.feature.icon === 'palette' && <Palette size={32} color="#A78BFA" />}
                                {step.feature.icon === 'globe' && <Globe size={32} color="#34D399" />}
                            </View>
                            <Text style={styles.featureTitle}>{step.feature.title}</Text>
                            <View style={styles.featureBullets}>
                                {step.feature.bullets.map((bullet, i) => (
                                    <View key={i} style={styles.featureBulletRow}>
                                        <Check size={14} color="#F59E0B" />
                                        <Text style={styles.featureBulletText}>{bullet}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </Pressable>

                {/* Bottom tap hint */}
                <Animated.View style={[styles.tapHint, { opacity: dotsOpacity }]}>
                    <Text style={styles.tapHintText}>
                        {!isDone ? 'Tap to skip typing' : isLast ? "Tap to start →" : 'Tap to continue →'}
                    </Text>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    skipBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 56 : 40,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        zIndex: 10,
    },
    skipText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontWeight: '500',
    },
    dotsContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 62 : 46,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },
    contentArea: {
        alignItems: 'center',
        paddingHorizontal: 28,
        gap: 0,
    },
    faceContainer: {
        marginBottom: 20,
    },
    faceGlow: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    faceRing: {
        borderWidth: 3,
        borderColor: 'rgba(245,158,11,0.25)',
        borderRadius: 100,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    speechBubble: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 24,
        paddingVertical: 20,
        maxWidth: SW * 0.85,
        minWidth: SW * 0.7,
        position: 'relative',
        marginBottom: 32,
    },
    speechTail: {
        position: 'absolute',
        top: -8,
        left: '50%',
        marginLeft: -8,
        width: 16,
        height: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        transform: [{ rotate: '45deg' }],
        borderRadius: 3,
    },
    speechText: {
        color: '#FFFFFF',
        fontSize: 17,
        lineHeight: 26,
        textAlign: 'center',
        fontWeight: '400',
        letterSpacing: 0.2,
    },
    cursor: {
        color: '#F59E0B',
        fontWeight: '300',
    },
    tabShowcase: {
        alignItems: 'center',
        gap: 12,
    },
    arrowContainer: {
        marginBottom: 4,
    },
    tabRow: {
        flexDirection: 'row',
        gap: 32,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 28,
        paddingVertical: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    tabItem: {
        alignItems: 'center',
        gap: 8,
    },
    tabPulse: {
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'transparent',
        padding: 2,
    },
    tabLabel: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    tabLabelActive: {
        color: '#F59E0B',
        fontWeight: '700',
    },
    featureShowcase: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 24,
        paddingVertical: 20,
        gap: 12,
        minWidth: SW * 0.7,
    },
    featureIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    featureTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    featureBullets: {
        gap: 8,
        alignItems: 'flex-start',
        width: '100%',
    },
    featureBulletRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    featureBulletText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontWeight: '500',
    },
    tapHint: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 50 : 34,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    tapHintText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
});
