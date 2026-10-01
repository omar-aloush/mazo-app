import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import {
  Users,
  Palette,
  Globe,
  TrendingUp,
  UserCircle,
  Brain,
  ArrowRight,
  ChevronLeft,
  Sparkles,
  Rocket,
  Star,
  Zap,
  Target,
  Lightbulb,
  Heart,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { AIFace } from '@/components/AIFace';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AppRoadmapProps {
  visible: boolean;
  onDismiss: () => void;
  userName?: string;
}

const TOUR_STEPS = [
  {
    id: 'congrats',
    gradient: ['#1a1a2e', '#16213e', '#0f3460'] as [string, string, string],
    accentColor: '#F59E0B',
    expression: 'proud' as const,
    faceSize: 130,
    showFace: true,
    miniIcons: [
      { icon: 'star', x: '15%', y: '18%', size: 18, color: '#F59E0B', delay: 200 },
      { icon: 'sparkle', x: '80%', y: '15%', size: 22, color: '#A78BFA', delay: 400 },
      { icon: 'zap', x: '10%', y: '75%', size: 16, color: '#34D399', delay: 600 },
      { icon: 'heart', x: '85%', y: '72%', size: 20, color: '#FB7185', delay: 300 },
      { icon: 'star', x: '70%', y: '82%', size: 14, color: '#FBBF24', delay: 500 },
      { icon: 'target', x: '25%', y: '85%', size: 16, color: '#60A5FA', delay: 700 },
    ],
  },
  {
    id: 'coaches',
    gradient: ['#0c1445', '#1e3a5f', '#2563eb'] as [string, string, string],
    accentColor: '#60A5FA',
    expression: 'happy' as const,
    faceSize: 70,
    showFace: false,
    mainIcon: 'users',
  },
  {
    id: 'create',
    gradient: ['#1a0a2e', '#2d1b69', '#7c3aed'] as [string, string, string],
    accentColor: '#A78BFA',
    expression: 'curious' as const,
    faceSize: 70,
    showFace: false,
    mainIcon: 'palette',
  },
  {
    id: 'context',
    gradient: ['#2d1a00', '#7c4a03', '#d97706'] as [string, string, string],
    accentColor: '#FCD34D',
    expression: 'listening' as const,
    faceSize: 70,
    showFace: false,
    mainIcon: 'user',
  },
  {
    id: 'memory',
    gradient: ['#1a0533', '#3730a3', '#6366f1'] as [string, string, string],
    accentColor: '#C4B5FD',
    expression: 'idle' as const,
    faceSize: 70,
    showFace: false,
    mainIcon: 'brain',
  },
  {
    id: 'journey',
    gradient: ['#042f2e', '#134e4a', '#0d9488'] as [string, string, string],
    accentColor: '#34D399',
    expression: 'encouraging' as const,
    faceSize: 70,
    showFace: false,
    mainIcon: 'trending',
  },
  {
    id: 'ready',
    gradient: ['#0a2618', '#15503b', '#059669'] as [string, string, string],
    accentColor: '#6EE7B7',
    expression: 'happy' as const,
    faceSize: 120,
    showFace: true,
  },
];

// We will move TOUR_CONTENT inside the component to use the translation hook
const TOTAL_STEPS = 7; // Fixed length based on TOUR_STEPS


const renderIcon = (name: string, size: number, color: string) => {
  switch (name) {
    case 'users': return <Users size={size} color={color} />;
    case 'palette': return <Palette size={size} color={color} />;
    case 'globe': return <Globe size={size} color={color} />;
    case 'trending': return <TrendingUp size={size} color={color} />;
    case 'user': return <UserCircle size={size} color={color} />;
    case 'brain': return <Brain size={size} color={color} />;
    case 'star': return <Star size={size} color={color} />;
    case 'sparkle': return <Sparkles size={size} color={color} />;
    case 'sparkles': return <Sparkles size={size} color={color} />;
    case 'zap': return <Zap size={size} color={color} />;
    case 'heart': return <Heart size={size} color={color} />;
    case 'target': return <Target size={size} color={color} />;
    case 'rocket': return <Rocket size={size} color={color} />;
    case 'arrow': return <ArrowRight size={size} color={color} />;
    case 'lightbulb': return <Lightbulb size={size} color={color} />;
    default: return <Sparkles size={size} color={color} />;
  }
};

const FloatingIcon: React.FC<{ icon: string; x: string; y: string; size: number; color: string; delay: number }> = ({ icon, x, y, size, color, delay }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = Animated.timing(opacityAnim, {
      toValue: 0.6,
      duration: 600,
      delay,
      useNativeDriver: true,
    });
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 2000 + delay, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 8, duration: 2000 + delay, useNativeDriver: true }),
      ])
    );
    fadeIn.start(() => float.start());
  }, []);

  return (
    <Animated.View
      style={[
        styles.floatingIcon,
        { left: x as any, top: y as any, opacity: opacityAnim, transform: [{ translateY: floatAnim }] },
      ]}
    >
      {renderIcon(icon, size, color)}
    </Animated.View>
  );
};

import { useTranslation } from '@/hooks/useTranslation';

export const AppRoadmap: React.FC<AppRoadmapProps> = ({ visible, onDismiss, userName }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  // Recreate TOUR_CONTENT inside the component so it has access to `t`
  const TOUR_CONTENT = [
    {
      title: t('roadmap.step1Title'),
      subtitle: t('roadmap.step1Desc'),
      btnText: t('roadmap.showMe'),
      btnIcon: 'rocket',
    },
    {
      title: t('roadmap.step2Title'),
      subtitle: t('roadmap.step2Desc'),
      btnText: t('common.next'),
      btnIcon: 'arrow',
      features: [t('roadmap.step2F1'), t('roadmap.step2F2'), t('roadmap.step2F3')],
    },
    {
      title: t('roadmap.step3Title'),
      subtitle: t('roadmap.step3Desc'),
      btnText: t('common.next'),
      btnIcon: 'arrow',
      features: [t('roadmap.step3F1'), t('roadmap.step3F2'), t('roadmap.step3F3')],
    },
    {
      title: t('roadmap.step4Title'),
      subtitle: t('roadmap.step4Desc'),
      btnText: t('common.next'),
      btnIcon: 'arrow',
      features: [t('roadmap.step4F1'), t('roadmap.step4F2'), t('roadmap.step4F3')],
    },
    {
      title: t('roadmap.step5Title'),
      subtitle: t('roadmap.step5Desc'),
      btnText: t('common.next'),
      btnIcon: 'arrow',
      features: [t('roadmap.step5F1'), t('roadmap.step5F2'), t('roadmap.step5F3')],
    },
    {
      title: t('roadmap.step6Title'),
      subtitle: t('roadmap.step6Desc'),
      btnText: t('common.next'),
      btnIcon: 'arrow',
      features: [t('roadmap.step6F1'), t('roadmap.step6F2'), t('roadmap.step6F3')],
    },
    {
      title: t('roadmap.step7Title'),
      subtitle: t('roadmap.step7Desc'),
      btnText: t('roadmap.letsGo'),
      btnIcon: 'sparkles',
    },
  ];

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      scaleAnim.setValue(1);
      animateStepIn();
    }
  }, [visible]);

  const animateStepIn = useCallback(() => {
    iconScale.setValue(0);
    contentSlide.setValue(30);
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(contentSlide, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [iconScale, contentSlide]);

  const animateToStep = useCallback((nextStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentStep(nextStep);
      scaleAnim.setValue(1.02);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
      animateStepIn();
    });
  }, [fadeAnim, scaleAnim, animateStepIn]);

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      animateToStep(currentStep + 1);
    }
  }, [currentStep, animateToStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      animateToStep(currentStep - 1);
    }
  }, [currentStep, animateToStep]);

  const handleDone = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  }, [onDismiss, fadeAnim, scaleAnim]);

  const step = TOUR_STEPS[currentStep];
  const content = TOUR_CONTENT[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOTAL_STEPS - 1;
  const progress = (currentStep + 1) / TOTAL_STEPS;

  const displayTitle = isFirst && userName ? `Nice one, ${userName}!` : content.title;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      <Animated.View style={[styles.fullScreen, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient colors={step.gradient} style={styles.gradientBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>

          {isFirst && step.miniIcons?.map((mi, i) => (
            <FloatingIcon key={i} icon={mi.icon} x={mi.x} y={mi.y} size={mi.size} color={mi.color} delay={mi.delay} />
          ))}

          <View style={styles.topBar}>
            {currentStep > 0 ? (
              <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={16}>
                <ChevronLeft size={22} color="rgba(255,255,255,0.7)" />
              </Pressable>
            ) : (
              <View style={styles.backBtn} />
            )}
            {!isLast && (
              <Pressable onPress={handleDone} style={styles.skipBtn} hitSlop={12}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: step.accentColor }]} />
            </View>
          </View>

          <View style={styles.mainContent}>
            <Animated.View style={[styles.visualArea, { transform: [{ scale: iconScale }] }]}>
              {step.showFace ? (
                <View style={styles.faceGlow}>
                  <View style={[styles.faceRing, { borderColor: step.accentColor + '40' }]}>
                    <AIFace expression={step.expression} size={step.faceSize} />
                  </View>
                </View>
              ) : (
                <View style={styles.iconArea}>
                  <View style={[styles.bigIconOuter, { backgroundColor: step.accentColor + '20' }]}>
                    <View style={[styles.bigIconInner, { backgroundColor: step.accentColor + '30' }]}>
                      {step.mainIcon && renderIcon(step.mainIcon, 48, step.accentColor)}
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>

            <Animated.View style={[styles.textArea, { transform: [{ translateY: contentSlide }] }]}>
              <Text style={styles.mainTitle}>{displayTitle}</Text>
              <Text style={styles.mainSubtitle}>{content.subtitle}</Text>

              {content.features && (
                <View style={styles.featureList}>
                  {content.features.map((f, i) => (
                    <View key={i} style={[styles.featureItem, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                      <View style={[styles.featureDot, { backgroundColor: step.accentColor }]} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          </View>

          <View style={styles.bottomArea}>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: step.accentColor },
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
              onPress={isLast ? handleDone : handleNext}
            >
              <Text style={styles.actionButtonText}>{content.btnText}</Text>
              {renderIcon(content.btnIcon || 'arrow', 20, '#000')}
            </Pressable>

            <View style={styles.dotsRow}>
              {TOUR_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === currentStep ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
                      width: i === currentStep ? 24 : 8,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  gradientBg: {
    flex: 1,
  },
  floatingIcon: {
    position: 'absolute',
    zIndex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 4,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '500',
  },
  progressBarContainer: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  visualArea: {
    marginBottom: 32,
  },
  faceGlow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceRing: {
    borderWidth: 3,
    borderRadius: 100,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconArea: {
    alignItems: 'center',
  },
  bigIconOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigIconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    alignItems: 'center',
    width: '100%',
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  mainSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 320,
  },
  featureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  featureText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  bottomArea: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 18,
    width: '100%',
    maxWidth: 340,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
