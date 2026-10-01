import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  Linking,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { X, Check, Crown, Shield, Zap, Brain, Target, Users, Sparkles, Star, ArrowRight, Ticket } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { useApp } from '@/providers/AppProvider';
import { AIFace } from '@/components/AIFace';
import { useTheme } from '@/providers/ThemeProvider';
import { track } from '@/services/analytics';
import { useTranslation } from '@/hooks/useTranslation';

type PlanType = 'annual' | 'monthly';

const VALUE_PROPS = [
  { icon: Target, titleKey: 'paywall.feature1', descKey: 'paywall.feature1Desc' },
  { icon: Users, titleKey: 'paywall.feature2', descKey: 'paywall.feature2Desc' },
  { icon: Brain, titleKey: 'paywall.feature3', descKey: 'paywall.feature3Desc' },
  { icon: Zap, titleKey: 'paywall.feature4', descKey: 'paywall.feature4Desc' },
];

const COMPARISON_FEATURES = [
  { labelKey: 'paywall.dailySessions', freeKey: 'paywall.perDay', freeArgs: { count: 3 }, proKey: 'paywall.unlimited' },
  { labelKey: 'paywall.coachPersonalities', freeKey: 'paywall.coaches8', proKey: 'paywall.coachesAll' },
  { labelKey: 'paywall.customCoaches', freeKey: 'paywall.maxCustom', freeArgs: { count: 2 }, proKey: 'paywall.unlimited' },
  { labelKey: 'paywall.sessionMemory', freeKey: 'paywall.currentSession', proKey: 'paywall.crossSession' },
  { labelKey: 'paywall.coachingModes', freeKey: 'paywall.allModes', proKey: 'paywall.allModes' },
  { labelKey: 'paywall.communityCoaches', free: true as const, pro: true as const },
];

const SOCIAL_PROOF_KEYS = [
  { textKey: 'paywall.socialProof1', authorKey: 'paywall.socialProof1Author' },
  { textKey: 'paywall.socialProof2', authorKey: 'paywall.socialProof2Author' },
  { textKey: 'paywall.socialProof3', authorKey: 'paywall.socialProof3Author' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { isPro, isPurchasing, isRestoring, purchase, restore, getMonthlyProduct, getAnnualProduct, isLoading, activateVoucherPro, voucherExpiresAt, isConfigured, products } = useSubscription();
  const { redeemVoucher, trialDaysRemaining, isTrialActive } = useApp();
  const params = useLocalSearchParams<{ trigger?: string }>();
  const trigger = params.trigger as string | undefined;
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');
  const [showVoucher, setShowVoucher] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherStatus, setVoucherStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [voucherMessage, setVoucherMessage] = useState('');
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const celebrateAnim = useRef(new Animated.Value(0)).current;
  const celebrateScale = useRef(new Animated.Value(0.8)).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(badgePulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, scaleAnim, badgePulse]);

  const annualProduct = getAnnualProduct();
  const monthlyProduct = getMonthlyProduct();

  const annualPrice = annualProduct?.price ?? 59.99;
  const annualPriceString = annualProduct?.displayPrice || '$59.99';
  const monthlyPrice = monthlyProduct?.price ?? 9.99;
  const monthlyPriceString = monthlyProduct?.displayPrice || '$9.99';

  const monthlyEquivalent = useMemo(() => {
    const perMonth = annualPrice / 12;
    return perMonth.toFixed(2);
  }, [annualPrice]);

  const savingsPercent = useMemo(() => {
    const yearlyIfMonthly = monthlyPrice * 12;
    const savings = ((yearlyIfMonthly - annualPrice) / yearlyIfMonthly) * 100;
    return Math.round(savings);
  }, [annualPrice, monthlyPrice]);

  const selectedPriceString = selectedPlan === 'annual' ? `${annualPriceString}/year` : `${monthlyPriceString}/month`;

  // Free trial detection (now controlled via remote config, not intro price)
  const hasFreeTrial = false; // Trials are handled server-side via register-device
  const trialDays = 0;

  const handlePurchase = useCallback(async () => {
    const productId = selectedPlan === 'annual'
      ? (annualProduct?.productId || 'mazo_pro_yearly')
      : (monthlyProduct?.productId || 'mazo_pro_monthly');

    if (!isConfigured) {
      Alert.alert(t('errors.generic'), t('paywall.purchaseError'));
      return;
    }

    try {
      track('purchase_started', { plan: selectedPlan });
      await purchase(productId);
      track('purchase_completed', { plan: selectedPlan });
      setPurchaseSuccess(true);
      Animated.parallel([
        Animated.timing(celebrateAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(celebrateScale, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error: any) {
      if (!error.userCancelled) {
        console.warn('[Paywall] Purchase error:', error);
        Alert.alert(t('paywall.purchaseFailed'), t('paywall.purchaseFail'));
      }
    }
  }, [selectedPlan, annualProduct, monthlyProduct, purchase, celebrateAnim, celebrateScale, isConfigured]);

  const handleRedeemVoucher = useCallback(async () => {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    setVoucherStatus('idle');
    setVoucherMessage('');
    try {
      const result = await redeemVoucher(voucherCode.trim().toUpperCase());
      if (result.success) {
        if (result.expiresAt) {
          await activateVoucherPro(result.expiresAt, voucherCode.trim().toUpperCase());
        }
        setVoucherStatus('success');
        setVoucherMessage(result.message);
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        setVoucherStatus('error');
        setVoucherMessage(result.message);
      }
    } catch (error) {
      setVoucherStatus('error');
      setVoucherMessage(t('paywall.voucherError'));
    } finally {
      setVoucherLoading(false);
    }
  }, [voucherCode, redeemVoucher, activateVoucherPro, router]);

  const handleRestore = useCallback(async () => {
    try {
      await restore();
      // After restore (re-sync from Supabase), check if pro is now active
      // The SubscriptionProvider will update isPro automatically
      setTimeout(() => {
        // Give a moment for state to update
        Alert.alert(t('paywall.restored'), t('paywall.restored'));
      }, 500);
    } catch (error) {
      console.warn('[Paywall] Restore error:', error);
      Alert.alert(t('paywall.restoreFail'), t('paywall.restoreFail'));
    }
  }, [restore]);

  if ((isPro && !isTrialActive) || purchaseSuccess) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => router.back()} style={[styles.closeButton, { backgroundColor: colors.surface }]}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          <Animated.View style={[styles.successContainer, purchaseSuccess && {
            opacity: celebrateAnim,
            transform: [{ scale: celebrateScale }],
          }]}>
            <View style={[styles.successIcon, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)' }]}>
              <Crown size={44} color="#F59E0B" />
            </View>
            <Text style={[styles.successTitle, { color: colors.text, fontSize: 24, fontWeight: '700' }]}>
              {purchaseSuccess ? t('paywall.welcomePro') : t('paywall.youArePro')}
            </Text>
            <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
              {purchaseSuccess ? t('paywall.welcomeProDesc') : t('paywall.fullAccessDesc')}
            </Text>

            {purchaseSuccess && (
              <View style={{ marginTop: 20, alignSelf: 'stretch', paddingHorizontal: 8, gap: 12 }}>
                {[t('paywall.welcomeFeature1'), t('paywall.welcomeFeature2'), t('paywall.welcomeFeature3')].map((f, i) => (
                  <View key={i} style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 14 }}>
                    <Text style={{ fontSize: 15, color: colors.text, flex: 1, textAlign: I18nManager.isRTL ? 'right' : 'left' }}>{f}</Text>
                  </View>
                ))}
              </View>
            )}

            {voucherExpiresAt && (
              <Text style={[styles.voucherExpiryText, { color: colors.textTertiary }]}>
                {t('paywall.voucherUntil', { date: new Date(voucherExpiresAt).toLocaleDateString() })}
              </Text>
            )}

            <Pressable
              style={[styles.primaryButton, { backgroundColor: '#F59E0B', marginTop: 24, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }]}
              onPress={() => router.back()}
            >
              <Text style={[styles.primaryButtonText, { fontWeight: '700', fontSize: 17 }]}>
                {purchaseSuccess ? t('paywall.startCoaching') : t('common.continue')}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.back()} style={[styles.closeButton, { backgroundColor: colors.surface }]}>
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.heroSection,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              }
            ]}
          >
            <View style={styles.faceWrapper}>
              <View style={[styles.glowRing, { backgroundColor: `${colors.accent}15`, borderColor: `${colors.accent}30` }]} />
              <View style={[styles.faceInner, { backgroundColor: colors.surface }]}>
                <AIFace expression="happy" size={80} />
              </View>
              <View style={[styles.crownBadge, { backgroundColor: colors.accent }]}>
                <Crown size={16} color="#FFF" fill="#FFF" />
              </View>
            </View>

            {trigger ? (
              <>
                <Text style={[styles.title, { color: colors.text }]}>
                  {trigger === 'breakthrough' ? t('paywall.breakthroughTrigger') :
                    trigger === 'session_3' ? t('paywall.session3Trigger') :
                      trigger === 'task_complete' ? t('paywall.taskCompleteTrigger') :
                        trigger === 'streak_milestone' ? t('paywall.streakTrigger') :
                          trigger === 'memory_fill' ? t('paywall.memoryFillTrigger') :
                            trigger === 'habit' ? t('paywall.habitTrigger') :
                              t('paywall.yourCoaching')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {trigger === 'breakthrough' ? t('paywall.breakthroughDesc') :
                    trigger === 'session_3' ? t('paywall.session3Desc') :
                      trigger === 'task_complete' ? t('paywall.taskCompleteDesc') :
                        trigger === 'streak_milestone' ? t('paywall.streakDesc') :
                          trigger === 'memory_fill' ? t('paywall.memoryFillDesc') :
                            trigger === 'habit' ? t('paywall.habitDesc') :
                              t('paywall.unlimitedDesc')}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.title, { color: colors.text }]}>{t('paywall.yourCoaching')}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {t('paywall.unlimitedDesc')}
                </Text>
              </>
            )}

            {isTrialActive && trialDaysRemaining > 0 && (
              <View style={[styles.trialBanner, { backgroundColor: `${colors.accent}15`, borderColor: `${colors.accent}40` }]}>
                <Text style={[styles.trialBannerText, { color: colors.accent }]}>
                  {trialDaysRemaining === 1 ? t('paywall.trialRemaining', { count: trialDaysRemaining }) : t('paywall.trialRemainingPlural', { count: trialDaysRemaining })}
                </Text>
              </View>
            )}
          </Animated.View>

          <View style={[styles.valueSection, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            {VALUE_PROPS.map((prop, index) => (
              <View key={`val-${index}`} style={[styles.valueRow, index < VALUE_PROPS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={[styles.valueIcon, { backgroundColor: colors.accentLight }]}>
                  <prop.icon size={18} color={colors.accent} />
                </View>
                <View style={styles.valueContent}>
                  <Text style={[styles.valueTitle, { color: colors.text }]}>{t(prop.titleKey)}</Text>
                  <Text style={[styles.valueDesc, { color: colors.textSecondary }]}>{t(prop.descKey)}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.socialSection]}>
            {SOCIAL_PROOF_KEYS.map((item, index) => (
              <View key={`social-${index}`} style={[styles.socialCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                <View style={styles.socialStars}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={12} color={colors.accent} fill={colors.accent} />
                  ))}
                </View>
                <Text style={[styles.socialText, { color: colors.text }]}>"{t(item.textKey)}"</Text>
                <Text style={[styles.socialAuthor, { color: colors.textTertiary }]}>— {t(item.authorKey)}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.comparisonSection, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{t('paywall.freeVsPro')}</Text>
            <View style={[styles.comparisonHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.comparisonHeaderLabel, { color: colors.textTertiary }]}>{t('paywall.feature')}</Text>
              <Text style={[styles.comparisonHeaderFree, { color: colors.textTertiary }]}>{t('common.free')}</Text>
              <Text style={[styles.comparisonHeaderPro, { color: colors.accent }]}>{t('common.pro')}</Text>
            </View>
            {COMPARISON_FEATURES.map((feature, index) => (
              <View key={`compare-${index}`} style={styles.comparisonRow}>
                <Text style={[styles.comparisonLabel, { color: colors.text }]}>{t(feature.labelKey)}</Text>
                <View style={styles.comparisonFreeCol}>
                  {'free' in feature && typeof feature.free === 'boolean' ? (
                    feature.free ? (
                      <Check size={16} color={colors.accent} />
                    ) : (
                      <X size={16} color={colors.error} />
                    )
                  ) : 'freeKey' in feature ? (
                    <Text style={[styles.comparisonFreeText, { color: colors.textTertiary }]}>{t(feature.freeKey, feature.freeArgs)}</Text>
                  ) : null}
                </View>
                <View style={styles.comparisonProCol}>
                  {'pro' in feature && typeof feature.pro === 'boolean' ? (
                    feature.pro ? (
                      <Check size={16} color={colors.accent} />
                    ) : (
                      <X size={16} color={colors.error} />
                    )
                  ) : 'proKey' in feature ? (
                    <Text style={[styles.comparisonProText, { color: colors.accent }]}>{t(feature.proKey)}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.plansSection}>
            <Pressable
              style={[
                styles.planCard,
                { backgroundColor: colors.surface, borderColor: colors.borderLight },
                selectedPlan === 'annual' && { borderColor: colors.accent, backgroundColor: isDark ? `${colors.accent}10` : '#FAFFFE' },
              ]}
              onPress={() => setSelectedPlan('annual')}
            >
              <Animated.View style={[styles.bestValueBadge, { backgroundColor: colors.accent, transform: [{ scale: badgePulse }] }]}>
                <Text style={styles.bestValueText}>{t('paywall.bestValue')}</Text>
              </Animated.View>

              <View style={styles.planHeader}>
                <View style={[
                  styles.radioCircle,
                  { borderColor: colors.border },
                  selectedPlan === 'annual' && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}>
                  {selectedPlan === 'annual' && (
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  )}
                </View>
                <View style={styles.planInfo}>
                  <Text style={[styles.planName, { color: colors.text }]}>{t('paywall.annual')}</Text>
                  <Text style={[styles.planSubtext, { color: colors.textSecondary }]}>{t('paywall.billedYearly', { price: monthlyEquivalent })}</Text>
                </View>
                <View style={styles.planPricing}>
                  <Text style={[styles.planPrice, { color: colors.text }]}>{annualPriceString}</Text>
                  <View style={[styles.savingsBadge, { backgroundColor: colors.accentLight }]}>
                    <Text style={[styles.savingsText, { color: colors.accent }]}>{t('paywall.save', { percent: savingsPercent })}</Text>
                  </View>
                </View>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.planCard,
                styles.planCardMonthly,
                { backgroundColor: colors.surface, borderColor: colors.borderLight },
                selectedPlan === 'monthly' && { borderColor: colors.accent, backgroundColor: isDark ? `${colors.accent}10` : '#FAFFFE' },
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <View style={styles.planHeader}>
                <View style={[
                  styles.radioCircle,
                  { borderColor: colors.border },
                  selectedPlan === 'monthly' && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}>
                  {selectedPlan === 'monthly' && (
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  )}
                </View>
                <View style={styles.planInfo}>
                  <Text style={[styles.planName, { color: colors.text }]}>{t('paywall.monthly')}</Text>
                  <Text style={[styles.planSubtext, { color: colors.textSecondary }]}>{t('paywall.flexibleMonthly')}</Text>
                </View>
                <View style={styles.planPricing}>
                  <Text style={[styles.planPrice, { color: colors.text }]}>{monthlyPriceString}</Text>
                  <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>{t('paywall.perMonth')}</Text>
                </View>
              </View>
            </Pressable>
          </View>

          <View style={styles.guaranteeSection}>
            <Shield size={20} color={colors.accent} />
            <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
              {t('paywall.guarantee')}
            </Text>
          </View>

          <View style={[styles.voucherSection, { borderColor: colors.borderLight }]}>
            <Pressable
              style={styles.voucherToggle}
              onPress={() => setShowVoucher(!showVoucher)}
            >
              <Ticket size={18} color={colors.textTertiary} />
              <Text style={[styles.voucherToggleText, { color: colors.textTertiary }]}>
                {t('paywall.haveVoucher')}
              </Text>
            </Pressable>

            {showVoucher && (
              <View style={styles.voucherInputSection}>
                <TextInput
                  style={[
                    styles.voucherInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: voucherStatus === 'error' ? colors.error : voucherStatus === 'success' ? '#22C55E' : colors.borderLight,
                    },
                  ]}
                  placeholder={t('paywall.enterVoucher')}
                  placeholderTextColor={colors.textTertiary}
                  value={voucherCode}
                  onChangeText={(text) => {
                    setVoucherCode(text.toUpperCase());
                    setVoucherStatus('idle');
                    setVoucherMessage('');
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!voucherLoading}
                />
                <Pressable
                  style={[
                    styles.voucherRedeemBtn,
                    { backgroundColor: colors.accent },
                    (voucherLoading || !voucherCode.trim()) && { opacity: 0.5 },
                  ]}
                  onPress={handleRedeemVoucher}
                  disabled={voucherLoading || !voucherCode.trim()}
                >
                  {voucherLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.voucherRedeemBtnText}>{t('paywall.redeem')}</Text>
                  )}
                </Pressable>
                {voucherMessage !== '' && (
                  <Text
                    style={[
                      styles.voucherFeedback,
                      { color: voucherStatus === 'success' ? '#22C55E' : colors.error },
                    ]}
                  >
                    {voucherMessage}
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: colors.background, borderTopColor: colors.borderLight }]}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: colors.accent },
              (isPurchasing || isLoading) && styles.buttonDisabled
            ]}
            onPress={handlePurchase}
            disabled={isPurchasing || isLoading}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.primaryButtonText}>
                  {hasFreeTrial ? `Start ${trialDays}-Day Free Trial` : t('paywall.startPro')}
                </Text>
                <Text style={styles.buttonSubtext}>
                  {hasFreeTrial ? `then ${selectedPriceString}` : selectedPriceString}
                </Text>
              </View>
            )}
          </Pressable>

          <View style={styles.footerLinks}>
            <Pressable
              style={styles.textButton}
              onPress={handleRestore}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <ActivityIndicator color={colors.textTertiary} size="small" />
              ) : (
                <Text style={[styles.textButtonText, { color: colors.textTertiary }]}>{t('paywall.restorePurchase')}</Text>
              )}
            </Pressable>

            <Text style={[styles.linkDivider, { color: colors.textTertiary }]}>|</Text>

            <Pressable onPress={() => Linking.openURL('https://pyloush.com/terms')}>
              <Text style={[styles.textButtonText, { color: colors.textTertiary }]}>{t('paywall.terms')}</Text>
            </Pressable>

            <Text style={[styles.linkDivider, { color: colors.textTertiary }]}>|</Text>

            <Pressable onPress={() => Linking.openURL('https://pyloush.com/privacy')}>
              <Text style={[styles.textButtonText, { color: colors.textTertiary }]}>{t('paywall.privacy')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  faceWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  glowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  faceInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  crownBadge: {
    position: 'absolute',
    top: 0,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 30,
    fontWeight: '700' as const,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 20,
  },
  valueSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  valueIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueContent: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  valueDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  socialSection: {
    gap: 10,
    marginBottom: 20,
  },
  socialCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  socialStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  socialText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 6,
  },
  socialAuthor: {
    fontSize: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 12,
  },
  comparisonSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
  },
  comparisonHeaderLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
  },
  comparisonHeaderFree: {
    width: 70,
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  comparisonHeaderPro: {
    width: 70,
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  comparisonLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  comparisonFreeCol: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonFreeText: {
    fontSize: 12,
    textAlign: 'center',
  },
  comparisonProCol: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonProText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  plansSection: {
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    position: 'relative',
    overflow: 'visible',
  },
  planCardMonthly: {
    marginTop: 4,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -12,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bestValueText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 17,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  planSubtext: {
    fontSize: 13,
  },
  planPricing: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  planPeriod: {
    fontSize: 13,
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  guaranteeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  guaranteeText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonContent: {
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600' as const,
  },
  buttonSubtext: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    gap: 10,
  },
  textButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  textButtonText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  linkDivider: {
    fontSize: 13,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  voucherExpiryText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  voucherSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    marginBottom: 8,
  },
  voucherToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  voucherToggleText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  voucherInputSection: {
    marginTop: 12,
    gap: 10,
  },
  voucherInput: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
  },
  voucherRedeemBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  voucherRedeemBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  voucherFeedback: {
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  trialBanner: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center' as const,
  },
  trialBannerText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
