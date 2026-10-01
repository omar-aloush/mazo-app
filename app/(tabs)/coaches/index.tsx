import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Plus,
  Sparkles,
  X,
  Check,
  ChevronRight,
  Share2,
  Download,
  Trash2,
  Lock,
  Pencil,
  Globe,
  Copy,
  ExternalLink,
} from 'lucide-react-native';
import { IconRenderer } from '@/components/IconRenderer';
import { CoachCard } from '@/components/CoachCard';
import { AIFace } from '@/components/AIFace';
import { MazoCharacter } from '@/components/MazoCharacter';
import { EYE_STYLE_OPTIONS, MOUTH_STYLE_OPTIONS, ACCESSORY_OPTIONS } from '@/constants/mazo';
import { MazoEyeStyle, MazoMouthStyle, MazoAccessory } from '@/types';
import { useApp } from '@/providers/AppProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { useTheme } from '@/providers/ThemeProvider';
import {
  coaches,
  coachTemplates,
  TONE_OPTIONS,
  COACH_ICONS,
  COACH_COLORS,
  createCoachFromTemplate,
} from '@/constants/coaches';
import { CommunitySection } from '@/components/CommunitySection';
import { validateCoachInstructions } from '@/services/ai';
import { CustomCoach, CoachTemplate } from '@/types';
import Colors from '@/constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '@/hooks/useTranslation';

const PENDING_IMPORT_KEY = 'pendingCoachImport';

type CreatorStep = 'choice' | 'template' | 'custom' | 'details';

export default function CoachesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, selectCoach, addCustomCoach, updateCustomCoach, deleteCustomCoach, exportCoach, importCoach, importCoachByCode, shareCoachToCommunity } = useApp();
  const { isPro } = useSubscription();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [showCreator, setShowCreator] = useState(false);
  const [creatorStep, setCreatorStep] = useState<CreatorStep>('choice');
  const [selectedTemplate, setSelectedTemplate] = useState<CoachTemplate | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [activeTab, setActiveTab] = useState<'mine' | 'community' | 'builtin'>('mine');

  const [editingCoachId, setEditingCoachId] = useState<string | null>(null);
  const [shareMenuCoachId, setShareMenuCoachId] = useState<string | null>(null);

  const [coachName, setCoachName] = useState('');
  const [coachRole, setCoachRole] = useState('');
  const [coachDescription, setCoachDescription] = useState('');
  const [coachSpecialty, setCoachSpecialty] = useState('');
  const [coachTone, setCoachTone] = useState<CustomCoach['tone']>('calm');
  const [coachIcon, setCoachIcon] = useState('sparkles');
  const [coachColor, setCoachColor] = useState('#6366F1');
  const [coachPrompt, setCoachPrompt] = useState('');
  const [mazoEyeStyle, setMazoEyeStyle] = useState<MazoEyeStyle>('neutral');
  const [mazoMouthStyle, setMazoMouthStyle] = useState<MazoMouthStyle>('slight_smile');
  const [mazoAccessoryType, setMazoAccessoryType] = useState<MazoAccessory>('none');
  const [isValidatingCoach, setIsValidatingCoach] = useState(false);

  const ringAnim1 = useRef(new Animated.Value(0.15)).current;
  const ringAnim2 = useRef(new Animated.Value(0.1)).current;
  const ringAnim3 = useRef(new Animated.Value(0.06)).current;

  useEffect(() => {
    const breathe = (anim: Animated.Value, min: number, max: number, dur: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: max, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: min, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
    };
    const a1 = breathe(ringAnim1, 0.12, 0.22, 2000);
    const a2 = breathe(ringAnim2, 0.08, 0.15, 2800);
    const a3 = breathe(ringAnim3, 0.04, 0.1, 3500);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [ringAnim1, ringAnim2, ringAnim3]);

  const resetCreator = useCallback(() => {
    setCreatorStep('choice');
    setSelectedTemplate(null);
    setEditingCoachId(null);
    setCoachName('');
    setCoachRole('');
    setCoachDescription('');
    setCoachSpecialty('');
    setCoachTone('calm');
    setCoachIcon('sparkles');
    setCoachColor('#6366F1');
    setCoachPrompt('');
    setMazoEyeStyle('neutral');
    setMazoMouthStyle('slight_smile');
    setMazoAccessoryType('none');
  }, []);

  const handleEditCoach = useCallback((coach: CustomCoach) => {
    setEditingCoachId(coach.id);
    setCoachName(coach.name);
    setCoachRole(coach.role);
    setCoachDescription(coach.description);
    setCoachSpecialty(coach.specialty || '');
    setCoachTone(coach.tone);
    setCoachIcon(coach.icon);
    setCoachColor(coach.color);
    setCoachPrompt(coach.systemPrompt);
    setMazoEyeStyle(coach.mazoConfig?.eyeStyle || 'neutral');
    setMazoMouthStyle(coach.mazoConfig?.mouthStyle || 'slight_smile');
    setMazoAccessoryType(coach.mazoConfig?.accessory || 'none');
    setCreatorStep('details');
    setShowCreator(true);
  }, [t]);

  const tryImportCode = useCallback(async (code: string): Promise<CustomCoach | null> => {
    if (code.toUpperCase().startsWith('MAZO-')) {
      return await importCoachByCode(code);
    }
    const result = importCoach(code);
    if (result) return result;
    return await importCoachByCode(code);
  }, [importCoach, importCoachByCode]);

  useEffect(() => {
    const checkPendingImport = async () => {
      try {
        const pendingCode = await AsyncStorage.getItem(PENDING_IMPORT_KEY);
        if (pendingCode) {
          await AsyncStorage.removeItem(PENDING_IMPORT_KEY);
          const importedCoach = await tryImportCode(pendingCode);
          if (importedCoach) {
            Alert.alert(t('coaches.coachImported'), t('coaches.coachImportedDesc', { name: importedCoach.name }), [
              { text: t('coaches.startChatting'), onPress: () => handleSelectCustomCoach(importedCoach.id) },
            ]);
          } else {
            Alert.alert(t('coaches.importFailed'), t('coaches.importFailedDesc'));
          }
        }
      } catch (error) {
        console.error('Failed to check pending import:', error);
      }
    };
    checkPendingImport();
  }, [tryImportCode]);

  const handleSelectCoach = useCallback((coachId: string) => {
    selectCoach(coachId);
  }, [selectCoach]);

  const handleSelectCustomCoach = useCallback((coachId: string) => {
    selectCoach(coachId);
  }, [selectCoach]);

  const handleSelectCommunityCoach = useCallback((coach: any) => {
    Alert.alert(
      t('coaches.importCoach'),
      t('coaches.importQuestion', { name: coach.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('coaches.add'),
          onPress: async () => {
            const newCoach = await tryImportCode(coach.shareCode);
            if (newCoach) {
              setActiveTab('mine');
              handleSelectCustomCoach(newCoach.id);
            }
          }
        }
      ]
    );
  }, [tryImportCode, handleSelectCustomCoach]);

  const handleTemplateSelect = useCallback((template: CoachTemplate) => {
    setSelectedTemplate(template);
    const coachData = createCoachFromTemplate(template);
    setCoachName(t(coachData.name as any));
    setCoachRole(t(coachData.role as any));
    setCoachDescription(t(coachData.description as any));
    setCoachSpecialty(coachData.specialty);
    setCoachTone(coachData.tone);
    setCoachIcon(coachData.icon);
    setCoachColor(coachData.color);
    setCoachPrompt(coachData.systemPrompt);
    setCreatorStep('details');
  }, [t]);

  const handleStartCustom = useCallback(() => {
    setCreatorStep('custom');
  }, []);

  const handleCreateCoach = useCallback(async () => {
    const name = coachName.trim();
    const role = coachRole.trim();
    const prompt = coachPrompt.trim();

    if (!name || name.length < 2) {
      Alert.alert(t('coaches.invalidName'), t('coaches.invalidNameDesc'));
      return;
    }

    if (!role || role.length < 3) {
      Alert.alert(t('coaches.invalidRole'), t('coaches.invalidRoleDesc'));
      return;
    }

    if (!prompt || prompt.length < 20) {
      Alert.alert(t('coaches.instructionsTooShort'), t('coaches.instructionsTooShortDesc'));
      return;
    }

    // AI-powered validation: check if instructions are meaningful
    setIsValidatingCoach(true);
    try {
      const validation = await validateCoachInstructions(prompt);
      if (!validation.valid) {
        setIsValidatingCoach(false);
        Alert.alert(
          t('coaches.invalidInstructions'),
          validation.reason || t('coaches.invalidInstructionsDefault')
        );
        return;
      }
    } catch (e) {
      // If validation fails, allow creation
      console.warn('[Coaches] Coach validation error:', e);
    }
    setIsValidatingCoach(false);

    const coachData = {
      name: name,
      role: role || 'Custom Coach',
      description: coachDescription.trim() || `Your personal ${name} coach`,
      tone: coachTone,
      specialty: coachSpecialty.trim() || 'General',
      systemPrompt: prompt,
      icon: coachIcon,
      color: coachColor,
      mazoConfig: {
        eyeStyle: mazoEyeStyle,
        mouthStyle: mazoMouthStyle,
        accessory: mazoAccessoryType,
        accentColor: coachColor,
      },
    };

    if (editingCoachId) {
      updateCustomCoach(editingCoachId, coachData);
      setShowCreator(false);
      resetCreator();
      Alert.alert(t('coaches.updated'), t('coaches.updatedDesc', { name: coachData.name }));
    } else {
      const newCoach = addCustomCoach(coachData);
      setShowCreator(false);
      resetCreator();
      selectCoach(newCoach.id);
      router.push('/(tabs)/chat');
    }
  }, [t, coachName, coachRole, coachDescription, coachTone, coachSpecialty, coachPrompt, coachIcon, coachColor, mazoEyeStyle, mazoMouthStyle, mazoAccessoryType, editingCoachId, addCustomCoach, updateCustomCoach, resetCreator, selectCoach, router]);

  const handleDeleteCoach = useCallback((coachId: string, coachName: string) => {
    Alert.alert(
      t('coaches.deleteCoach'),
      t('coaches.deleteConfirm', { name: coachName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteCustomCoach(coachId),
        },
      ]
    );
  }, [t, deleteCustomCoach]);

  const handleShareToCommunity = useCallback(async (coachId: string) => {
    setShareMenuCoachId(null);
    const coach = state.customCoaches.find(c => c.id === coachId);
    if (!coach) return;
    const authorName = state.userContext.name || 'Anonymous';
    const result = await shareCoachToCommunity(coachId, authorName);
    if (result) {
      Alert.alert(t('coaches.shared'), t('coaches.sharedDesc', { name: coach.name, code: result.shareCode }));
    } else {
      Alert.alert(t('coaches.alreadyShared'), t('coaches.alreadySharedDesc'));
    }
  }, [state.customCoaches, state.userContext.name, shareCoachToCommunity]);

  const handleCopyCode = useCallback(async (coachId: string) => {
    setShareMenuCoachId(null);
    const code = exportCoach(coachId);
    if (code) {
      try {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(code);
        Alert.alert(t('coaches.copied'), t('coaches.copiedDesc'));
      } catch (err: any) {
        console.warn('[Coaches] Clipboard copy failed:', err?.message || err);
        try {
          await navigator.clipboard.writeText(code);
          Alert.alert(t('coaches.copied'), t('coaches.copiedDesc'));
        } catch (err: any) {
          console.warn('[Coaches] Clipboard fallback failed:', err?.message || err);
          Alert.alert(t('errors.generic'), t('coaches.copyError'));
        }
      }
    }
  }, [exportCoach]);

  const handleNativeShare = useCallback(async (coachId: string) => {
    setShareMenuCoachId(null);
    const code = exportCoach(coachId);
    const coach = state.customCoaches.find(c => c.id === coachId);
    if (code && coach) {
      try {
        const { Share } = await import('react-native');
        const deepLinkData = encodeURIComponent(code);
        const deepLink = `mazo://import?c=${deepLinkData}`;
        const shareMessage = `Check out my AI Coach: "${coach.name}"\n\n${coach.description}\n\nTap to add this coach to Mazo:\n${deepLink}\n\nOr manually import with this code:\n${code}`;
        await Share.share({
          message: shareMessage,
          title: `Share ${coach.name}`,
        });
      } catch (err: any) {
        console.warn('[Coaches] Native share failed:', err?.message || err);
        handleCopyCode(coachId);
      }
    }
  }, [exportCoach, state.customCoaches, handleCopyCode]);

  const handleImportCoach = useCallback(async () => {
    if (!importCode.trim()) {
      Alert.alert(t('errors.generic'), t('coaches.enterImportCode'));
      return;
    }

    const imported = await tryImportCode(importCode.trim());
    if (imported) {
      setShowImportModal(false);
      setImportCode('');
      Alert.alert(t('coaches.coachImported'), t('coaches.importedSuccess', { name: imported.name }));
    } else {
      Alert.alert(t('errors.generic'), t('coaches.invalidImportCode'));
    }
  }, [importCode, tryImportCode]);

  const customCoachCount = state.customCoaches.length;
  const canCreateMore = true; // Pro build — unlimited custom coaches



  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <AIFace expression="encouraging" size={56} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, { color: colors.text }]}>{t('coaches.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('coaches.subtitle')}
              </Text>
            </View>
          </View>
        </View>

        {/* Premium Segmented Control */}
        <View style={[styles.tabContainer, { backgroundColor: colors.backgroundSecondary || colors.surface }]}>
          {(['mine', 'community', 'builtin'] as const).map(tab => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                style={[
                  styles.tabButton,
                  isActive && [styles.tabButtonActive, { backgroundColor: colors.accent }],
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[
                  styles.tabText,
                  { color: isActive ? '#FFF' : colors.textSecondary },
                  isActive && styles.tabTextActive,
                ]}>
                  {tab === 'mine' ? t('coaches.tabMine') : tab === 'community' ? t('coaches.tabCommunity') : t('coaches.tabBuiltin')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'mine' && (
          <>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.createButton, { backgroundColor: colors.accent }]}
                onPress={() => {
                  if (!canCreateMore) {
                    router.push('/paywall');
                    return;
                  }
                  setShowCreator(true);
                }}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>{t('coaches.createCoach')}</Text>
              </Pressable>

              <Pressable
                style={[styles.importButton, { backgroundColor: colors.accentLight }]}
                onPress={() => setShowImportModal(true)}
              >
                <Download size={18} color={colors.accent} />
              </Pressable>
            </View>

            {/* Pro build — limit banner removed */}

            {state.customCoaches.length > 0 ? (
              <View style={styles.section}>
                {state.customCoaches.map((coach) => (
                  <Pressable
                    key={coach.id}
                    style={[styles.customCoachCard, { backgroundColor: colors.surface }]}
                    onPress={() => handleSelectCustomCoach(coach.id)}
                  >
                    <View style={[styles.customCoachIcon, { backgroundColor: coach.color + '20' }]}>
                      {coach.mazoConfig ? (
                        <MazoCharacter config={coach.mazoConfig} state="idle" size={36} showAccessory={true} />
                      ) : (
                        <IconRenderer name={coach.icon} size={22} color={coach.color || '#6366F1'} />
                      )}
                    </View>
                    <View style={styles.customCoachInfo}>
                      <Text style={[styles.customCoachName, { color: colors.text }]}>{coach.isCustom ? coach.name : t(coach.name)}</Text>
                      <Text style={[styles.customCoachRole, { color: colors.textSecondary }]}>{coach.isCustom ? coach.role : t(coach.role)}</Text>
                    </View>
                    <View style={styles.customCoachActions}>
                      <Pressable
                        style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
                        onPress={() => handleEditCoach(coach)}
                        hitSlop={8}
                      >
                        <Pencil size={16} color={colors.accent} />
                      </Pressable>
                      <Pressable
                        style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
                        onPress={() => setShareMenuCoachId(coach.id)}
                        hitSlop={8}
                      >
                        <Share2 size={16} color={colors.textTertiary} />
                      </Pressable>
                      <Pressable
                        style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
                        onPress={() => handleDeleteCoach(coach.id, coach.name)}
                        hitSlop={8}
                      >
                        <Trash2 size={16} color={colors.error} />
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: colors.textTertiary }]}>
                  {t('coaches.noCustomCoaches')}
                </Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'community' && (
          <CommunitySection />
        )}

        {activeTab === 'builtin' && (
          <View style={styles.section}>
            {coaches.map((coach) => (
              <CoachCard
                key={coach.id}
                coach={coach}
                isSelected={state.selectedCoachId === coach.id}
                isPro={isPro}
                onSelect={() => handleSelectCoach(coach.id)}
              />
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            {t('coaches.footerText')}
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showCreator}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowCreator(false);
          resetCreator();
        }}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
            <Pressable
              onPress={() => {
                if (creatorStep === 'choice') {
                  setShowCreator(false);
                  resetCreator();
                } else if (creatorStep === 'details' && selectedTemplate) {
                  setCreatorStep('template');
                } else {
                  setCreatorStep('choice');
                }
              }}
              style={[styles.modalCloseButton, { backgroundColor: colors.backgroundSecondary }]}
            >
              <X size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingCoachId ? t('coaches.editCoach') :
                creatorStep === 'choice' ? t('coaches.createCoach') :
                  creatorStep === 'template' ? t('coaches.selectTemplate') :
                    creatorStep === 'custom' ? t('coaches.customCoach') : t('coaches.customize')}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {creatorStep === 'choice' && (
              <>
                <Text style={[styles.choiceSubtitle, { color: colors.textSecondary }]}>
                  {t('coaches.howToCreate')}
                </Text>

                <Pressable
                  style={[styles.choiceCard, { backgroundColor: colors.surface }]}
                  onPress={() => setCreatorStep('template')}
                >
                  <View style={[styles.choiceIcon, { backgroundColor: '#E8E4F4' }]}>
                    <Sparkles size={24} color="#8B5CF6" />
                  </View>
                  <View style={styles.choiceInfo}>
                    <Text style={[styles.choiceTitle, { color: colors.text }]}>{t('coaches.startFromTemplate')}</Text>
                    <Text style={[styles.choiceDescription, { color: colors.textSecondary }]}>
                      {t('coaches.startFromTemplateDesc')}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={colors.textTertiary} />
                </Pressable>

                <Pressable
                  style={[styles.choiceCard, { backgroundColor: colors.surface }]}
                  onPress={handleStartCustom}
                >
                  <View style={[styles.choiceIcon, { backgroundColor: '#E4F0E8' }]}>
                    <Plus size={24} color="#10B981" />
                  </View>
                  <View style={styles.choiceInfo}>
                    <Text style={[styles.choiceTitle, { color: colors.text }]}>{t('coaches.buildFromScratch')}</Text>
                    <Text style={[styles.choiceDescription, { color: colors.textSecondary }]}>
                      {t('coaches.buildFromScratchDesc')}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={colors.textTertiary} />
                </Pressable>
              </>
            )}

            {creatorStep === 'template' && (
              <>
                <Text style={[styles.templateSubtitle, { color: colors.textSecondary }]}>
                  {t('coaches.pickTemplate')}
                </Text>

                {coachTemplates.map((template) => (
                  <Pressable
                    key={template.id}
                    style={[styles.templateCard, { backgroundColor: colors.surface }]}
                    onPress={() => handleTemplateSelect(template)}
                  >
                    <View style={[styles.templateIcon, { backgroundColor: template.color + '20' }]}>
                      <IconRenderer name={template.icon} size={22} color={template.color || '#6366F1'} />
                    </View>
                    <View style={styles.templateInfo}>
                      <View style={styles.templateNameRow}>
                        <Text style={[styles.templateName, { color: colors.text }]}>{t(template.name)}</Text>
                        {template.isProOnly && !isPro && (
                          <View style={[styles.proBadge, { backgroundColor: colors.accent }]}>
                            <Lock size={10} color="#FFFFFF" />
                            <Text style={styles.proBadgeText}>{t('common.pro').toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.templateDescription, { color: colors.textSecondary }]}>{t(template.description)}</Text>
                    </View>
                    <ChevronRight size={20} color={colors.textTertiary} />
                  </Pressable>
                ))}
              </>
            )}

            {(creatorStep === 'custom' || creatorStep === 'details') && (
              <>
                {/* Mazo Preview Section */}
                <View style={[styles.mazoPreviewSection, { borderBottomColor: colors.borderLight }]}>
                  <View style={styles.mazoPreviewCharacter}>
                    <View style={styles.auraContainer}>
                      <Animated.View style={[styles.auraRing, { width: 210, height: 210, borderRadius: 105, backgroundColor: coachColor, opacity: ringAnim3 }]} />
                      <Animated.View style={[styles.auraRing, { width: 170, height: 170, borderRadius: 85, backgroundColor: coachColor, opacity: ringAnim2 }]} />
                      <Animated.View style={[styles.auraRing, { width: 138, height: 138, borderRadius: 69, backgroundColor: coachColor, opacity: ringAnim1 }]} />
                    </View>
                    <MazoCharacter
                      config={{
                        eyeStyle: mazoEyeStyle,
                        mouthStyle: mazoMouthStyle,
                        accessory: mazoAccessoryType,
                        accentColor: coachColor,
                      }}
                      state="idle"
                      size={110}
                    />
                  </View>
                  <Text style={[styles.mazoPreviewLabel, { color: colors.text }]}>
                    {coachName ? t(coachName as any) : t('coaches.yourCoach')}
                  </Text>
                  <Text style={[styles.mazoPreviewHint, { color: colors.textTertiary }]}>
                    {coachRole ? t(coachRole as any) : t('coaches.customCoach')}
                  </Text>

                  <View style={styles.customizeSection}>
                    <Text style={[styles.customizeSectionTitle, { color: colors.textSecondary }]}>
                      {t('coaches.customizeMazo')}
                    </Text>

                    <Text style={[styles.customizeOptionLabel, { color: colors.text }]}>{t('coaches.eyeStyle')}</Text>
                    <View style={styles.customizeOptionRow}>
                      {EYE_STYLE_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.id}
                          style={[
                            styles.customizePill,
                            { backgroundColor: colors.surface, borderColor: colors.borderLight },
                            mazoEyeStyle === opt.id && { backgroundColor: coachColor + '18', borderColor: coachColor },
                          ]}
                          onPress={() => setMazoEyeStyle(opt.id)}
                        >
                          <Text style={[
                            styles.customizePillText,
                            { color: colors.textSecondary },
                            mazoEyeStyle === opt.id && { color: coachColor, fontWeight: '600' as const },
                          ]}>
                            {t(`coaches.eyes.${opt.id}`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={[styles.customizeOptionLabel, { color: colors.text }]}>{t('coaches.mouthStyle')}</Text>
                    <View style={styles.customizeOptionRow}>
                      {MOUTH_STYLE_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.id}
                          style={[
                            styles.customizePill,
                            { backgroundColor: colors.surface, borderColor: colors.borderLight },
                            mazoMouthStyle === opt.id && { backgroundColor: coachColor + '18', borderColor: coachColor },
                          ]}
                          onPress={() => setMazoMouthStyle(opt.id)}
                        >
                          <Text style={[
                            styles.customizePillText,
                            { color: colors.textSecondary },
                            mazoMouthStyle === opt.id && { color: coachColor, fontWeight: '600' as const },
                          ]}>
                            {t(`coaches.mouth.${opt.id}`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={[styles.customizeOptionLabel, { color: colors.text }]}>{t('coaches.accessories')}</Text>
                    <View style={styles.customizeOptionRow}>
                      {ACCESSORY_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.id}
                          style={[
                            styles.customizePill,
                            { backgroundColor: colors.surface, borderColor: colors.borderLight },
                            mazoAccessoryType === opt.id && { backgroundColor: coachColor + '18', borderColor: coachColor },
                          ]}
                          onPress={() => setMazoAccessoryType(opt.id)}
                        >
                          <Text style={[
                            styles.customizePillText,
                            { color: colors.textSecondary },
                            mazoAccessoryType === opt.id && { color: coachColor, fontWeight: '600' as const },
                          ]}>
                            {t(`coaches.accessory.${opt.id}`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('coaches.coachName')}</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
                    value={coachName.startsWith('coaches.') ? t(coachName as any) : coachName}
                    onChangeText={setCoachName}
                    placeholder={t('coaches.namePlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('coaches.coachRole')}</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
                    value={coachRole.startsWith('coaches.') ? t(coachRole as any) : coachRole}
                    onChangeText={setCoachRole}
                    placeholder={t('coaches.rolePlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('coaches.coachDescription')}</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
                    value={coachDescription.startsWith('coaches.') ? t(coachDescription as any) : coachDescription}
                    onChangeText={setCoachDescription}
                    placeholder={t('coaches.descriptionPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('coaches.coachTone')}</Text>
                  <View style={styles.toneGrid}>
                    {TONE_OPTIONS.map((tone) => (
                      <Pressable
                        key={tone.id}
                        style={[
                          styles.toneOption,
                          { backgroundColor: colors.surface, borderColor: colors.borderLight },
                          coachTone === tone.id && [styles.toneOptionSelected, { backgroundColor: colors.accentLight, borderColor: colors.accent }],
                        ]}
                        onPress={() => setCoachTone(tone.id as CustomCoach['tone'])}
                      >
                        <Text style={[
                          styles.toneLabel,
                          { color: colors.textSecondary },
                          coachTone === tone.id && [styles.toneLabelSelected, { color: colors.accent }],
                        ]}>
                          {t(`coaches.tones.${tone.id}.label`)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('coaches.coachIcon')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.iconGrid}
                  >
                    {COACH_ICONS.map((icon) => (
                      <Pressable
                        key={icon}
                        style={[
                          styles.iconOption,
                          { backgroundColor: colors.surface, borderColor: colors.borderLight },
                          coachIcon === icon && [styles.iconOptionSelected, { backgroundColor: colors.accentLight, borderColor: colors.accent }],
                        ]}
                        onPress={() => setCoachIcon(icon)}
                      >
                        <IconRenderer name={icon} size={20} color={coachIcon === icon ? '#6366F1' : '#9CA3AF'} />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('coaches.coachColor')}</Text>
                  <View style={styles.colorGrid}>
                    {COACH_COLORS.map((color) => (
                      <Pressable
                        key={color}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          coachColor === color && styles.colorOptionSelected,
                        ]}
                        onPress={() => setCoachColor(color)}
                      >
                        {coachColor === color && (
                          <Check size={16} color="#FFFFFF" />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('coaches.coachInstructions')}</Text>
                  <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                    {t('coaches.instructionsHint')}
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.promptInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
                    value={coachPrompt}
                    onChangeText={setCoachPrompt}
                    placeholder={t('coaches.instructionsPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </View>

                <Pressable
                  style={[
                    styles.createCoachButton,
                    { backgroundColor: colors.accent },
                    (!coachName.trim() || !coachPrompt.trim() || isValidatingCoach) && [styles.createCoachButtonDisabled, { backgroundColor: colors.textTertiary }],
                  ]}
                  onPress={handleCreateCoach}
                  disabled={!coachName.trim() || !coachPrompt.trim() || isValidatingCoach}
                >
                  <Check size={20} color="#FFFFFF" />
                  <Text style={styles.createCoachButtonText}>{isValidatingCoach ? t('coaches.validating') : editingCoachId ? t('coaches.saveChanges') : t('coaches.createCoach')}</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showImportModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowImportModal(false)}
      >
        <Pressable
          style={styles.importOverlay}
          onPress={() => setShowImportModal(false)}
        >
          <Pressable style={[styles.importCard, { backgroundColor: colors.surface }]} onPress={() => { }}>
            <Text style={[styles.importTitle, { color: colors.text }]}>{t('coaches.importCoach')}</Text>
            <Text style={[styles.importDescription, { color: colors.textSecondary }]}>
              {t('coaches.importCoachDesc')}
            </Text>
            <TextInput
              style={[styles.importInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.borderLight }]}
              value={importCode}
              onChangeText={setImportCode}
              placeholder={t('coaches.pasteCodePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            <View style={styles.importActions}>
              <Pressable
                style={[styles.importCancelButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => {
                  setShowImportModal(false);
                  setImportCode('');
                }}
              >
                <Text style={[styles.importCancelText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.importConfirmButton, { backgroundColor: colors.accent }]}
                onPress={handleImportCoach}
              >
                <Text style={styles.importConfirmText}>{t('community.import')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={shareMenuCoachId !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setShareMenuCoachId(null)}
      >
        <Pressable
          style={styles.importOverlay}
          onPress={() => setShareMenuCoachId(null)}
        >
          <Pressable style={[styles.shareMenuCard, { backgroundColor: colors.surface }]} onPress={() => { }}>
            <Text style={[styles.shareMenuTitle, { color: colors.text }]}>{t('coaches.shareCoach')}</Text>

            <Pressable
              style={[styles.shareMenuOption, { borderBottomColor: colors.borderLight }]}
              onPress={() => shareMenuCoachId && handleShareToCommunity(shareMenuCoachId)}
            >
              <View style={[styles.shareMenuIconWrap, { backgroundColor: colors.accent + '15' }]}>
                <Globe size={20} color={colors.accent} />
              </View>
              <View style={styles.shareMenuOptionText}>
                <Text style={[styles.shareMenuOptionTitle, { color: colors.text }]}>{t('coaches.shareToCommunity')}</Text>
                <Text style={[styles.shareMenuOptionDesc, { color: colors.textSecondary }]}>{t('coaches.shareToCommunityDesc')}</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.shareMenuOption, { borderBottomColor: colors.borderLight }]}
              onPress={() => shareMenuCoachId && handleCopyCode(shareMenuCoachId)}
            >
              <View style={[styles.shareMenuIconWrap, { backgroundColor: colors.accent + '15' }]}>
                <Copy size={20} color={colors.accent} />
              </View>
              <View style={styles.shareMenuOptionText}>
                <Text style={[styles.shareMenuOptionTitle, { color: colors.text }]}>{t('coaches.copyCode')}</Text>
                <Text style={[styles.shareMenuOptionDesc, { color: colors.textSecondary }]}>{t('coaches.copyCodeDesc')}</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.shareMenuOption, { borderBottomWidth: 0 }]}
              onPress={() => shareMenuCoachId && handleNativeShare(shareMenuCoachId)}
            >
              <View style={[styles.shareMenuIconWrap, { backgroundColor: colors.accent + '15' }]}>
                <ExternalLink size={20} color={colors.accent} />
              </View>
              <View style={styles.shareMenuOptionText}>
                <Text style={[styles.shareMenuOptionTitle, { color: colors.text }]}>{t('coaches.shareVia')}</Text>
                <Text style={[styles.shareMenuOptionDesc, { color: colors.textSecondary }]}>{t('coaches.shareViaDesc')}</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.shareMenuCancelButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setShareMenuCoachId(null)}
            >
              <Text style={[styles.shareMenuCancelText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  // Mazo Preview styles
  mazoPreviewSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
  },
  mazoPreviewCharacter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    height: 220,
  },
  auraContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraRing: {
    position: 'absolute' as const,
  },
  mazoPreviewLabel: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  mazoPreviewHint: {
    fontSize: 14,
    marginTop: 4,
  },
  customizeSection: {
    marginTop: 20,
    width: '100%',
  },
  customizeSectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  customizeOptionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  customizeOptionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  customizePill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  customizePillText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  header: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  importButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  limitBanner: {
    backgroundColor: Colors.warning + '20',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  limitText: {
    fontSize: 13,
    color: Colors.text,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  customCoachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  customCoachIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customCoachIconText: {
    fontSize: 24,
  },
  customCoachInfo: {
    flex: 1,
    marginLeft: 14,
  },
  customCoachName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  customCoachRole: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  customCoachActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    marginTop: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic' as const,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: 20,
    paddingBottom: 40,
  },
  choiceSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  choiceIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  choiceDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  templateSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateIconText: {
    fontSize: 22,
  },
  templateInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  templateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  templateDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top' as const,
  },
  promptInput: {
    minHeight: 140,
  },
  toneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toneOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  toneOptionSelected: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  toneLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  toneLabelSelected: {
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  iconGrid: {
    gap: 8,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  iconOptionSelected: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  iconOptionText: {
    fontSize: 22,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createCoachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginTop: 12,
  },
  createCoachButtonDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  createCoachButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  importOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  importCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  importTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  importDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  importInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top' as const,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  importActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  importCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
  },
  importCancelText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  importConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  importConfirmText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  shareMenuCard: {
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  shareMenuTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  shareMenuOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  shareMenuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: 14,
  },
  shareMenuOptionText: {
    flex: 1,
  },
  shareMenuOptionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  shareMenuOptionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  shareMenuCancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  shareMenuCancelText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 6,
    padding: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  tabButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
