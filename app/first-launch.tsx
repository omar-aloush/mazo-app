import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowRight,
  Target,
  Lightbulb,
  ClipboardList,
  RotateCcw,
  Sparkles,
  MessageSquare,
  ChevronRight,
  Check,
  Globe,
} from 'lucide-react-native';
import { AIFace } from '@/components/AIFace';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { IconRenderer } from '@/components/IconRenderer';

import { InviteFriends } from '@/components/InviteFriends';

import { useTranslation } from '@/hooks/useTranslation';
import { hapticTap, hapticSelection, hapticSuccess } from '@/utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MODES = [
  {
    id: 'decision',
    name: 'onboarding.modes.decision.name',
    description: 'onboarding.modes.decision.desc',
    icon: 'target',
    color: '#EF4444',
  },
  {
    id: 'clarity',
    name: 'onboarding.modes.clarity.name',
    description: 'onboarding.modes.clarity.desc',
    icon: 'lightbulb',
    color: '#F59E0B',
  },
  {
    id: 'planning',
    name: 'onboarding.modes.planning.name',
    description: 'onboarding.modes.planning.desc',
    icon: 'clipboard-list',
    color: '#3B82F6',
  },
  {
    id: 'reflection',
    name: 'onboarding.modes.reflection.name',
    description: 'onboarding.modes.reflection.desc',
    icon: 'rotate-ccw',
    color: '#8B5CF6',
  },
];

const VALUE_CHIPS = [
  'onboarding.chips.growth',
  'onboarding.chips.confidence',
  'onboarding.chips.discipline',
  'onboarding.chips.career',
  'onboarding.chips.relationships',
  'onboarding.chips.health',
  'onboarding.chips.finances',
  'onboarding.chips.purpose',
];

const FOCUS_CHIPS = [
  'onboarding.chips.overcomingProcrastination',
  'onboarding.chips.makingDecision',
  'onboarding.chips.managingStress',
  'onboarding.chips.buildingHabits',
  'onboarding.chips.careerTransition',
  'onboarding.chips.gettingUnstuck',
];

const MODE_COACH_MAP: Record<string, string> = {
  decision: 'clarifier',
  clarity: 'clarifier',
  planning: 'strategist',
  reflection: 'reflector',
};

const TOTAL_STEPS = 6;

// Animated progress dots with checkmarks on completed steps
function ProgressDots({ currentStep, totalSteps, colors, accentColor }: {
  currentStep: number;
  totalSteps: number;
  colors: any;
  accentColor: string;
}) {
  const dotAnims = useRef(Array.from({ length: totalSteps }, () => ({
    width: new Animated.Value(8),
    opacity: new Animated.Value(0.3),
    checkScale: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    dotAnims.forEach((dot, i) => {
      Animated.parallel([
        Animated.spring(dot.width, {
          toValue: i === currentStep ? 28 : (i < currentStep ? 18 : 8),
          friction: 8,
          tension: 80,
          useNativeDriver: false,
        }),
        Animated.timing(dot.opacity, {
          toValue: i <= currentStep ? 1 : 0.3,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.spring(dot.checkScale, {
          toValue: i < currentStep ? 1 : 0,
          friction: 6,
          tension: 80,
          useNativeDriver: false,
        }),
      ]).start();
    });
  }, [currentStep]);

  return (
    <View style={styles.dotsContainer}>
      {dotAnims.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              width: dot.width,
              height: i < currentStep ? 18 : 8,
              borderRadius: i < currentStep ? 9 : 4,
              backgroundColor: i <= currentStep ? accentColor : colors.border,
              opacity: dot.opacity,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
            },
          ]}
        >
          {i < currentStep && (
            <Animated.View style={{ transform: [{ scale: dot.checkScale }] }}>
              <Check size={10} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>
          )}
        </Animated.View>
      ))}
    </View>
  );
}

// Staggered slide-in animation for cards
function StaggeredCard({ children, index, currentStep, targetStep }: {
  children: React.ReactNode;
  index: number;
  currentStep: number;
  targetStep: number;
}) {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentStep === targetStep) {
      translateY.setValue(20);
      opacity.setValue(0);
      Animated.sequence([
        Animated.delay(index * 80),
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 60,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [currentStep]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function FirstLaunchScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { updateUserContext, completeOnboarding, selectCoach } = useApp();
  const { t } = useTranslation();

  const { step } = useLocalSearchParams<{ step?: string }>();
  const initialStep = step !== undefined ? parseInt(step, 10) : 0;
  const [currentStep, setCurrentStep] = useState(isNaN(initialStep) ? 0 : initialStep);

  useEffect(() => {
    if (step !== undefined) {
      const parsed = parseInt(step, 10);
      if (!isNaN(parsed)) setCurrentStep(parsed);
    }
  }, [step]);

  const [userName, setUserName] = useState('');
  const [valuesInput, setValuesInput] = useState('');
  const [focusInput, setFocusInput] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const nextBtnScale = useRef(new Animated.Value(0.9)).current;
  const nextBtnOpacity = useRef(new Animated.Value(0)).current;

  const accentColor = isDark ? '#8FB896' : '#7C9A82';

  // Bounce the next button on each step
  useEffect(() => {
    nextBtnScale.setValue(0.9);
    nextBtnOpacity.setValue(0);
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.spring(nextBtnScale, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(nextBtnOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [currentStep]);

  const animateToStep = useCallback((nextStep: number) => {
    const direction = nextStep > currentStep ? 1 : -1;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -direction * 30,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentStep(nextStep);
      slideAnim.setValue(direction * 30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [currentStep, fadeAnim, slideAnim]);

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

  // Determine the best-matching coach based on user's focus input
  const getBestCoachId = useCallback(() => {
    const focusLower = (focusInput || '').trim().toLowerCase();
    if (focusLower.includes('plan') || focusLower.includes('strateg') || focusLower.includes('project') || focusLower.includes('launch')) {
      return 'strategist';
    } else if (focusLower.includes('reflect') || focusLower.includes('understand') || focusLower.includes('self') || focusLower.includes('balance')) {
      return 'reflector';
    } else if (focusLower.includes('motiv') || focusLower.includes('energy') || focusLower.includes('stuck')) {
      return 'energizer';
    }
    return 'clarifier';
  }, [focusInput]);

  const handleFinish = useCallback(() => {
    if (userName.trim()) {
      updateUserContext({
        name: userName.trim(),
        values: valuesInput.trim(),
        currentFocus: focusInput.trim()
      });
    }
    const bestCoach = getBestCoachId();
    selectCoach(bestCoach);
    completeOnboarding('balanced');
    AsyncStorage.setItem('autoStartSession', 'true');
    router.replace('/(tabs)/chat');
  }, [userName, valuesInput, focusInput, updateUserContext, selectCoach, completeOnboarding, router, getBestCoachId]);

  const handleSkip = useCallback(() => {
    selectCoach('clarifier');
    completeOnboarding('balanced');
    router.replace('/(tabs)/chat');
  }, [selectCoach, completeOnboarding, router]);

  const toggleValueChip = useCallback((chip: string) => {
    hapticTap();
    const translatedChip = t(chip as any) || chip;
    setValuesInput(prev => {
      const values = prev.split(',').map(v => v.trim()).filter(Boolean);
      if (values.includes(translatedChip)) {
        return values.filter(v => v !== translatedChip).join(', ');
      }
      return [...values, translatedChip].join(', ');
    });
  }, [t]);

  const toggleFocusChip = useCallback((chip: string) => {
    hapticSelection();
    const translatedChip = t(chip as any) || chip;
    setFocusInput(translatedChip);
  }, [t]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderWelcome();
      case 1:
        return renderHowItWorks();
      case 2:
        return renderNameEntry();
      case 3:
        return renderWhoAmI();
      case 4:
        return renderNotifyInvite();
      case 5:
        return renderLetsGo();
      default:
        return null;
    }
  };

  const renderWelcome = () => (
    <View style={styles.stepContent}>
      <View style={styles.welcomeFace}>
        {/* Floating sparkle dots behind face */}
        <View style={styles.sparkleField}>
          {[{ top: 14, left: 22, size: 6 }, { top: 28, right: 14, size: 4 }, { bottom: 35, left: 12, size: 5 }, { bottom: 21, right: 25, size: 7 }, { top: 63, left: 3, size: 3 }, { top: 49, right: 7, size: 4 }].map((pos, i) => (
            <View
              key={i}
              style={[
                styles.sparkleDot,
                {
                  top: pos.top, left: pos.left, right: pos.right, bottom: pos.bottom,
                  width: pos.size, height: pos.size, borderRadius: pos.size / 2,
                  backgroundColor: accentColor,
                  opacity: 0.2 + (i % 3) * 0.1,
                },
              ]}
            />
          ))}
        </View>
        <AIFace expression="happy" size={140} />
      </View>
      <Text style={[styles.welcomeTitle, { color: colors.text }]}>
        {t('onboarding.welcome')}
      </Text>
      <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
        {t('onboarding.welcomeSubtitle')}
      </Text>
      <View style={[styles.welcomeGradientStripe, { backgroundColor: accentColor + '08' }]}>
        <View style={[styles.welcomeTagline, { backgroundColor: accentColor + '12' }]}>
          <Sparkles size={16} color={accentColor} />
          <Text style={[styles.welcomeTaglineText, { color: accentColor }]}>
            {t('common.mazoTagline')}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderHowItWorks = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('common.howItWorks')}
      </Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        {t('common.howItWorksDesc')}
      </Text>

      <View style={styles.modesGrid}>
        {MODES.map((mode, index) => (
          <StaggeredCard key={mode.id} index={index} currentStep={currentStep} targetStep={1}>
            <View
              style={[styles.modeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.modeIconWrap, { backgroundColor: mode.color + '15' }]}>
                <IconRenderer name={mode.icon} size={22} color={mode.color} />
              </View>
              <View style={styles.modeTextWrap}>
                <Text style={[styles.modeName, { color: colors.text }]}>{t(mode.name)}</Text>
                <Text style={[styles.modeDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                  {t(mode.description)}
                </Text>
              </View>
            </View>
          </StaggeredCard>
        ))}
      </View>

      <View style={styles.flowIndicator}>
        <View style={[styles.flowStep, { backgroundColor: accentColor + '15' }]}>
          <MessageSquare size={14} color={accentColor} />
          <Text style={[styles.flowStepText, { color: accentColor }]}>{t('chat.chatTitle')}</Text>
        </View>
        <ChevronRight size={14} color={colors.textTertiary} />
        <View style={[styles.flowStep, { backgroundColor: accentColor + '15' }]}>
          <Target size={14} color={accentColor} />
          <Text style={[styles.flowStepText, { color: accentColor }]}>{t('chat.actionTitle')}</Text>
        </View>
        <ChevronRight size={14} color={colors.textTertiary} />
        <View style={[styles.flowStep, { backgroundColor: accentColor + '15' }]}>
          <Sparkles size={14} color={accentColor} />
          <Text style={[styles.flowStepText, { color: accentColor }]}>{t('common.done')}</Text>
        </View>
      </View>
    </View>
  );

  const renderNameEntry = () => (
    <KeyboardAvoidingView
      style={styles.stepContent}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.nameSection}>
        <View style={styles.nameFace}>
          <AIFace expression="curious" size={100} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('onboarding.whatsYourName')}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {t('onboarding.whatsYourNameSubtitle')}
        </Text>
        <TextInput
          style={[
            styles.nameInput,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: userName.trim() ? accentColor : colors.border,
            },
          ]}
          placeholder={t('onboarding.namePlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={userName}
          onChangeText={setUserName}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleNext}
        />
        {userName.trim().length > 0 && (
          <Text style={[styles.greetingPreview, { color: accentColor }]}>
            {t('onboarding.niceToMeetYou', { name: userName.trim() })}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );

  const renderWhoAmI = () => {
    const selectedValues = valuesInput.split(',').map(v => v.trim()).filter(Boolean);

    return (
      <KeyboardAvoidingView
        style={styles.stepContent}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollStep}
          contentContainerStyle={styles.scrollStepContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.nameFace}>
            <AIFace expression="listening" size={80} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('common.tellMeAboutYou')}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {t('common.tellMeAboutYouDesc')}
          </Text>

          <Text style={[styles.contextLabel, { color: colors.text }]}>
            {t('onboarding.whatMatters')}
          </Text>

          {/* Quick-tap value chips */}
          <View style={styles.chipsContainer}>
            {VALUE_CHIPS.map(chip => {
              // Get the translated name, OR fallback to the last part of the key
              const translatedChip = t(chip as any) || chip.split('.').pop() || chip;
              const isSelected = selectedValues.includes(translatedChip);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={translatedChip}
                  accessibilityState={{ checked: isSelected }}
                  key={chip}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? accentColor + '20' : colors.surface,
                      borderColor: isSelected ? accentColor : colors.border,
                    },
                  ]}
                  onPress={() => toggleValueChip(translatedChip)}
                >
                  {isSelected && <Check size={12} color={accentColor} />}
                  <Text style={[
                    styles.chipText,
                    { color: isSelected ? accentColor : colors.textSecondary },
                  ]}>
                    {translatedChip}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={[
              styles.contextInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: valuesInput.trim() ? accentColor : colors.border,
              },
            ]}
            placeholder={t('onboarding.placeholders.ownValue')}
            placeholderTextColor={colors.textTertiary}
            value={valuesInput}
            onChangeText={setValuesInput}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />

          <Text style={[styles.contextLabel, { color: colors.text, marginTop: 8 }]}>
            {t('onboarding.currentFocus')}
          </Text>

          {/* Quick-tap focus chips */}
          <View style={styles.chipsContainer}>
            {FOCUS_CHIPS.map(chip => {
              // Get the translated name, OR fallback to the last part of the key
              const translatedChip = t(chip as any) || chip.split('.').pop() || chip;
              const isSelected = focusInput === translatedChip;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={translatedChip}
                  accessibilityState={{ selected: isSelected }}
                  key={chip}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? accentColor + '20' : colors.surface,
                      borderColor: isSelected ? accentColor : colors.border,
                    },
                  ]}
                  onPress={() => toggleFocusChip(translatedChip)}
                >
                  {isSelected && <Check size={12} color={accentColor} />}
                  <Text style={[
                    styles.chipText,
                    { color: isSelected ? accentColor : colors.textSecondary },
                  ]}>
                    {translatedChip}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={[
              styles.contextInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: focusInput.trim() ? accentColor : colors.border,
              },
            ]}
            placeholder={t('onboarding.placeholders.ownValue')}
            placeholderTextColor={colors.textTertiary}
            value={focusInput}
            onChangeText={setFocusInput}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  const handleStartWithMode = useCallback((modeId: string) => {
    hapticSuccess();
    if (userName.trim()) {
      updateUserContext({
        name: userName.trim(),
        values: valuesInput.trim(),
        currentFocus: focusInput.trim()
      });
    }
    AsyncStorage.setItem('initialCoachingMode', modeId);
    AsyncStorage.setItem('autoStartSession', 'true');
    selectCoach(MODE_COACH_MAP[modeId] || 'clarifier');
    completeOnboarding('balanced');
    router.replace('/(tabs)/chat');
  }, [userName, valuesInput, focusInput, updateUserContext, selectCoach, completeOnboarding, router]);

  const renderNotifyInvite = () => {
    const FEATURES = [
      {
        emoji: '🧠',
        title: t('onboarding.features.structured'),
        desc: t('onboarding.features.structuredDesc'),
      },
      {
        emoji: '🔒',
        title: t('onboarding.features.private'),
        desc: t('onboarding.features.privateDesc'),
      },
      {
        emoji: '✨',
        title: t('onboarding.features.grows'),
        desc: t('onboarding.features.growsDesc'),
      },
    ];

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.stepContent, { justifyContent: 'flex-start', paddingTop: 30, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.letsGoTitle, { color: colors.text }]}>
          {t('onboarding.yourSystem')}
        </Text>
        <Text style={[styles.letsGoSubtitle, { color: colors.textSecondary, marginBottom: 24 }]}>
          {t('onboarding.yourSystemDesc')}
        </Text>

        {/* Feature Cards */}
        <View style={{ gap: 12, marginBottom: 28 }}>
          {FEATURES.map((feature, index) => (
            <StaggeredCard key={index} index={index} currentStep={currentStep} targetStep={4}>
              <View style={[
                styles.featureCard,
                { backgroundColor: colors.surface, borderColor: colors.borderLight || colors.border },
              ]}>
                <View style={[styles.featureIconWrap, { backgroundColor: accentColor + '12' }]}>
                  <Text style={{ fontSize: 22 }}>{feature.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>
                    {feature.title}
                  </Text>
                  <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                    {feature.desc}
                  </Text>
                </View>
              </View>
            </StaggeredCard>
          ))}
        </View>

        {/* Invite section */}
        <View style={{ marginTop: 4 }}>
          <Text style={[styles.letsGoTitle, { color: colors.text, fontSize: 18 }]}>
            {t('common.inviteFriends')}
          </Text>
          <Text style={[styles.letsGoSubtitle, { color: colors.textSecondary, marginBottom: 12 }]}>
            {t('common.inviteFriendsDesc')}
          </Text>
          <InviteFriends compact />
        </View>
      </ScrollView>
    );
  };

  const renderLetsGo = () => {
    const recommendedCoachId = getBestCoachId();
    const coachNameKey = `coaches.library.${recommendedCoachId}.name`;
    const coachRoleKey = `coaches.library.${recommendedCoachId}.role`;
    const coachDescKey = `coaches.library.${recommendedCoachId}.desc`;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.stepContent, { justifyContent: 'flex-start', paddingTop: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Coach introduction card */}
        <View style={[
          styles.coachIntroCard,
          { backgroundColor: colors.surface, borderColor: accentColor + '30' },
        ]}>
          <View style={styles.coachIntroHeader}>
            <AIFace expression="encouraging" size={64} />
            <View style={styles.coachIntroInfo}>
              <Text style={[styles.coachIntroLabel, { color: colors.textTertiary }]}>{t('common.yourFirstCoach')}</Text>
              <Text style={[styles.coachIntroName, { color: colors.text }]}>{t(coachNameKey)}</Text>
              <Text style={[styles.coachIntroRole, { color: accentColor }]}>{t(coachRoleKey)}</Text>
            </View>
          </View>
          <Text style={[styles.coachIntroDesc, { color: colors.textSecondary }]}>
            {t(coachDescKey)}
          </Text>
        </View>

        <Text style={[styles.letsGoTitle, { color: colors.text }]}>
          {userName.trim() ? t('onboarding.greetingName', { name: userName.trim() }) : t('onboarding.greeting')}
        </Text>
        <Text style={[styles.letsGoSubtitle, { color: colors.textSecondary }]}>
          {t('common.pickMode')}
        </Text>

        <View style={styles.modeStartGrid}>
          {MODES.map((mode, index) => (
            <StaggeredCard key={mode.id} index={index} currentStep={currentStep} targetStep={5}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(mode.name)}
                style={({ pressed }) => [
                  styles.modeStartCard,
                  { backgroundColor: colors.surface, borderColor: mode.color + '40' },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => handleStartWithMode(mode.id)}
              >
                <View style={[styles.modeStartIcon, { backgroundColor: mode.color + '18' }]}>
                  <IconRenderer name={mode.icon} size={26} color={mode.color} />
                </View>
                <Text style={[styles.modeStartName, { color: colors.text }]}>{t(mode.name)}</Text>
                <Text style={[styles.modeStartDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                  {t(mode.description)}
                </Text>
              </Pressable>
            </StaggeredCard>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.justChat')}
          style={({ pressed }) => [
            styles.justChatButton,
            { backgroundColor: accentColor },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleFinish}
        >
          <Sparkles size={18} color="#FFFFFF" />
          <Text style={styles.justChatText}>{t('common.justChat')}</Text>
        </Pressable>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        {currentStep > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={12}
          >
            <Text style={[styles.backText, { color: colors.textSecondary }]}>{t('common.back')}</Text>
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.skip')}
          onPress={handleSkip}
          style={styles.skipButton}
          hitSlop={12}
        >
          <Text style={[styles.skipText, { color: colors.textTertiary }]}>{t('common.skip')}</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.stepContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {renderStep()}
      </Animated.View>

      <View style={styles.bottomBar}>
        <ProgressDots
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          colors={colors}
          accentColor={accentColor}
        />

        {currentStep < TOTAL_STEPS - 1 && (
          <Animated.View style={{
            opacity: nextBtnOpacity,
            transform: [{ scale: nextBtnScale }],
          }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.next')}
              accessibilityState={{ disabled: currentStep === 2 && !userName.trim() }}
              style={[
                styles.nextButton,
                { backgroundColor: accentColor },
                currentStep === 2 && !userName.trim() && { opacity: 0.5 },
              ]}
              onPress={handleNext}
              disabled={currentStep === 2 && !userName.trim()}
            >
              <Text style={styles.nextButtonText}>{t('common.next')}</Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 50,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  stepContainer: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  scrollStep: {
    flex: 1,
  },
  scrollStepContent: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },

  // Welcome step
  welcomeFace: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  welcomeTagline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  welcomeTaglineText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // How it works step
  sectionTitle: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  modesGrid: {
    gap: 10,
    marginBottom: 24,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  modeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTextWrap: {
    flex: 1,
  },
  modeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  modeDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  flowIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  flowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  flowStepText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Name entry step
  nameSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  nameFace: {
    marginBottom: 28,
  },
  nameInput: {
    width: '100%',
    maxWidth: 320,
    fontSize: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    textAlign: 'center',
    marginTop: 8,
  },
  greetingPreview: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },

  // Values/Focus step
  contextLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    width: '100%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  contextInput: {
    width: '100%',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 16,
    minHeight: 56,
    textAlignVertical: 'top',
  },

  // Let's go step
  letsGoFace: {
    alignItems: 'center',
    marginBottom: 28,
  },
  letsGoTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  letsGoSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modeStartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  modeStartCard: {
    width: (SCREEN_WIDTH - 28 * 2 - 10) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 8,
  },
  modeStartIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeStartName: {
    fontSize: 15,
    fontWeight: '700',
  },
  modeStartDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  justChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    alignSelf: 'center',
  },
  justChatText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 16,
    paddingTop: 12,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    overflow: 'hidden' as const,
  },

  // Sparkle field behind welcome face
  sparkleField: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  sparkleDot: {
    position: 'absolute' as const,
  },

  // Gradient stripe on welcome
  welcomeGradientStripe: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 28,
  },

  // Feature cards on "Your System" step
  featureCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  featureIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Coach intro card on final step
  coachIntroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
    width: '100%' as const,
  },
  coachIntroHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
    marginBottom: 12,
  },
  coachIntroInfo: {
    flex: 1,
  },
  coachIntroLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coachIntroName: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  coachIntroRole: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  coachIntroDesc: {
    fontSize: 14,
    lineHeight: 20,
  },

  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
