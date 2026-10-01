import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Download, X, ClipboardPaste, Star, Copy, Share2, Check, Ticket, RefreshCw, Trash2, AlertTriangle, WifiOff } from 'lucide-react-native';
import { IconRenderer } from '@/components/IconRenderer';
import { AIFace } from '@/components/AIFace';
import { useRouter } from 'expo-router';
import { CommunityCoach } from '@/constants/community-coaches';
import { useApp } from '@/providers/AppProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTranslation } from '@/hooks/useTranslation';
import * as communityService from '@/services/community';
let Clipboard: any = null;
try {
  Clipboard = require('expo-clipboard');
} catch (e) { }

async function copyToClipboard(text: string) {
  try {
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(text);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  } catch (e) { }
}

type FilterTab = 'All' | 'Featured' | 'Newest' | 'Popular';

function StarRating({ rating, size = 14, color }: { rating: number; size?: number; color: string }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(<Text key={i} style={{ fontSize: size, color }}>★</Text>);
    } else if (i - 0.5 <= rating) {
      stars.push(<Text key={i} style={{ fontSize: size, color }}>★</Text>);
    } else {
      stars.push(<Text key={i} style={{ fontSize: size, color, opacity: 0.3 }}>★</Text>);
    }
  }
  return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{stars}</View>;
}

function TappableStarRating({ currentRating, onRate, size = 28, color }: { currentRating: number; onRate: (r: number) => void; size?: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onRate(i)}>
          <Text style={{ fontSize: size, color: i <= currentRating ? color : color + '40' }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, addCustomCoach, selectCoach, shareCoachToCommunity, rateCoach, getCoachRating, importCoachByCode, redeemVoucher, getUserId } = useApp();
  const { colors } = useTheme();
  const { activateVoucherPro } = useSubscription();
  const { isOffline } = useNetworkStatus();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [selectedCoach, setSelectedCoach] = useState<CommunityCoach | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareAuthorName, setShareAuthorName] = useState(state.userContext.name || '');
  const [sharingCoachId, setSharingCoachId] = useState<string | null>(null);
  const [sharedCode, setSharedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedDetailCode, setCopiedDetailCode] = useState(false);
  const [allCoaches, setAllCoaches] = useState<CommunityCoach[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherStatus, setVoucherStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [voucherMessage, setVoucherMessage] = useState('');

  const loadCoaches = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      let coaches: CommunityCoach[] = [];
      if (searchQuery.trim()) {
        coaches = await communityService.searchCoaches(searchQuery.trim());
      } else {
        switch (activeFilter) {
          case 'All':
            coaches = await communityService.fetchCommunityCoaches();
            break;
          case 'Featured':
            coaches = await communityService.fetchFeaturedCoaches();
            break;
          case 'Popular':
            coaches = await communityService.fetchPopularCoaches();
            break;
          case 'Newest':
            coaches = await communityService.fetchNewestCoaches();
            break;
          default:
            coaches = await communityService.fetchCommunityCoaches();
        }
      }
      setAllCoaches(coaches);
    } catch (e) {
      console.error('Failed to load coaches:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    loadCoaches();
  }, [loadCoaches]);

  const filteredCoaches = allCoaches;

  const isCoachAlreadyAdded = (coach: CommunityCoach) => {
    return state.customCoaches.some(
      (c) => c.name === coach.name && c.systemPrompt === coach.systemPrompt
    );
  };

  const currentUserId = getUserId();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleImport = async (coach: CommunityCoach) => {
    if (isCoachAlreadyAdded(coach)) {
      return;
    }
    const newCoach = addCustomCoach({
      name: coach.name,
      role: coach.role,
      description: coach.description,
      tone: coach.tone as 'calm' | 'direct' | 'warm' | 'wise' | 'reflective',
      specialty: coach.specialty,
      systemPrompt: coach.systemPrompt,
      icon: coach.icon,
      color: coach.color,
    });
    await communityService.incrementDownloads(coach.id);
    setSelectedCoach(null);
    selectCoach(newCoach.id);
    router.push('/(tabs)/chat');
  };

  const handleDeleteCoach = async (coach: CommunityCoach) => {
    if (!coach.authorId || coach.authorId !== currentUserId) return;
    setIsDeleting(true);
    const success = await communityService.deleteCommunityCoach(coach.id, coach.authorId);
    if (success) {
      setSelectedCoach(null);
      setDeleteConfirmId(null);
      loadCoaches(true);
    }
    setIsDeleting(false);
  };

  const handleImportByCode = async () => {
    setImportStatus('loading' as any);
    const result = await importCoachByCode(importCode.trim());
    if (result) {
      setImportStatus('success');
      setTimeout(() => {
        setShowImportModal(false);
        setImportCode('');
        setImportStatus('idle');
        selectCoach(result.id);
        router.push('/(tabs)/chat');
      }, 1200);
    } else {
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 2000);
    }
  };

  const handleShare = (coachId: string) => {
    setSharingCoachId(coachId);
    setShareAuthorName(state.userContext.name || '');
    setSharedCode(null);
  };

  const confirmShare = async () => {
    if (!sharingCoachId) return;
    const result = await shareCoachToCommunity(sharingCoachId, shareAuthorName || 'Anonymous');
    if (result) {
      setSharedCode(result.shareCode);
      setSharingCoachId(null);
      setSearchQuery('');
      if (activeFilter === 'Newest') {
        loadCoaches(true);
      } else {
        setActiveFilter('Newest');
      }
    }
  };

  const copyCode = async (code: string, setter: (v: boolean) => void) => {
    try {
      await copyToClipboard(code);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch (err: any) {
      console.warn('[Community] Copy failed:', err?.message || err);
      setter(true);
      setTimeout(() => setter(false), 2000);
    }
  };

  const handleRateCoach = (coachId: string, rating: number) => {
    rateCoach(coachId, rating);
  };

  const handleRedeemVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherStatus('loading');
    const result = await redeemVoucher(voucherCode.trim().toUpperCase());
    if (result.success) {
      if (result.expiresAt) {
        await activateVoucherPro(result.expiresAt, voucherCode.trim().toUpperCase());
      }
      setVoucherStatus('success');
      setVoucherMessage(result.message);
      setTimeout(() => {
        setShowVoucherModal(false);
        setVoucherCode('');
        setVoucherStatus('idle');
        setVoucherMessage('');
      }, 2500);
    } else {
      setVoucherStatus('error');
      setVoucherMessage(result.message);
      setTimeout(() => {
        setVoucherStatus('idle');
        setVoucherMessage('');
      }, 3000);
    }
  };

  const isUserShared = (coach: CommunityCoach) => !coach.isFeatured;

  const filters: FilterTab[] = ['All', 'Featured', 'Newest', 'Popular'];

  const renderCoachCard = ({ item }: { item: CommunityCoach }) => (
    <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setSelectedCoach(item)}>
      <View style={[styles.cardIconContainer, { backgroundColor: item.color + '20' }]}>
        <IconRenderer name={item.icon} size={22} color={item.color} />
      </View>
      {isUserShared(item) && (
        <View style={[styles.userBadge, { backgroundColor: colors.accent }]}>
          <Text style={styles.userBadgeText}>{t('community.shared')}</Text>
        </View>
      )}
      <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
      <Text style={[styles.cardRole, { color: colors.textSecondary }]} numberOfLines={1}>{item.role}</Text>
      <Text style={[styles.cardSpecialty, { color: colors.accent }]} numberOfLines={1}>{item.specialty}</Text>
      <View style={styles.cardRatingRow}>
        <StarRating rating={item.rating} size={12} color={colors.accent} />
        <Text style={[styles.ratingText, { color: colors.textSecondary }]}>{item.rating > 0 ? item.rating.toFixed(1) : t('community.new')}</Text>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.cardFooterLeft}>
          <Download size={11} color={colors.textSecondary} />
          <Text style={[styles.downloadCount, { color: colors.textSecondary }]}>{item.downloads}</Text>
        </View>
        <Text style={[styles.shareCodeSmall, { color: colors.textTertiary }]}>{item.shareCode}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{t('community.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('community.subtitle')}</Text>
          </View>
          <Pressable
            style={[styles.importCodeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowImportModal(true)}
          >
            <ClipboardPaste size={18} color={colors.accent} />
            <Text style={[styles.importCodeText, { color: colors.accent }]}>{t('community.import')}</Text>
          </Pressable>
        </View>
      </View>

      {isOffline && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: '#FEF3C7',
          paddingVertical: 10,
          paddingHorizontal: 16,
          marginHorizontal: 16,
          marginBottom: 8,
          borderRadius: 12,
        }}>
          <WifiOff size={14} color="#92400E" />
          <Text style={{ color: '#92400E', fontSize: 13, fontWeight: '600', flex: 1 }}>
            {t('community.offlineMsg')}
          </Text>
        </View>
      )}

      {state.customCoaches.length > 0 && (
        <Pressable
          style={[styles.shareBanner, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}
          onPress={() => {
            setShowShareModal(true);
            setSharedCode(null);
            setSharingCoachId(null);
          }}
        >
          <Share2 size={18} color={colors.accent} />
          <Text style={[styles.shareBannerText, { color: colors.accent }]}>{t('community.shareBanner')}</Text>
        </Pressable>
      )}

      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('community.searchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterContainer}>
        {filters.map((filter) => (
          <Pressable
            key={filter}
            style={[
              styles.filterPill,
              { backgroundColor: colors.surface, borderColor: colors.border },
              activeFilter === filter && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                { color: colors.textSecondary },
                activeFilter === filter && styles.filterTextActive,
              ]}
            >
              {filter === 'All' ? t('community.all') : filter === 'Featured' ? t('community.featured') : filter === 'Newest' ? t('community.newest') : t('community.popular')}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>{t('community.loadingCoaches')}</Text>
        </View>
      ) : filteredCoaches.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>{t('community.noCoachesFound')}</Text>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            {searchQuery.trim() ? t('community.tryDifferentSearch') : t('community.beFirstToShare')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCoaches}
          renderItem={renderCoachCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => loadCoaches(true)}
          refreshing={isRefreshing}
        />
      )}

      <Modal
        visible={selectedCoach !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedCoach(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: colors.surface }]}>
            <Pressable style={styles.modalClose} onPress={() => { setSelectedCoach(null); setCopiedDetailCode(false); setDeleteConfirmId(null); }}>
              <X size={24} color={colors.text} />
            </Pressable>
            {selectedCoach && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalIconLarge, { backgroundColor: selectedCoach.color + '20' }]}>
                    <IconRenderer name={selectedCoach.icon} size={36} color={selectedCoach.color} />
                  </View>
                  <Text style={[styles.modalName, { color: colors.text }]}>{selectedCoach.name}</Text>
                  <Text style={[styles.modalRole, { color: colors.textSecondary }]}>{selectedCoach.role}</Text>
                  <Text style={[styles.modalAuthor, { color: colors.textTertiary }]}>{t('community.by', { author: selectedCoach.author })}</Text>
                  <View style={styles.modalMeta}>
                    <Text style={[styles.modalSpecialty, { color: colors.accent }]}>{selectedCoach.specialty}</Text>
                  </View>
                </View>

                <View style={[styles.ratingSection, { borderColor: colors.border }]}>
                  <View style={styles.ratingDisplay}>
                    <StarRating rating={selectedCoach.rating} size={18} color={colors.accent} />
                    <Text style={[styles.ratingNumber, { color: colors.text }]}>
                      {selectedCoach.rating > 0 ? selectedCoach.rating.toFixed(1) : t('community.new')}
                    </Text>
                    <Text style={[styles.ratingCountText, { color: colors.textSecondary }]}>
                      ({selectedCoach.ratingCount} {selectedCoach.ratingCount === 1 ? t('community.rating') : t('community.ratings')})
                    </Text>
                  </View>
                  <View style={styles.userRatingSection}>
                    <Text style={[styles.userRatingLabel, { color: colors.textSecondary }]}>{t('community.yourRating')}</Text>
                    <TappableStarRating
                      currentRating={getCoachRating(selectedCoach.id)}
                      onRate={(r) => handleRateCoach(selectedCoach.id, r)}
                      size={24}
                      color={colors.accent}
                    />
                  </View>
                </View>

                <View style={[styles.codeSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.codeLabelText, { color: colors.textSecondary }]}>{t('community.shareCode')}</Text>
                  <View style={styles.codeRow}>
                    <Text style={[styles.codeValue, { color: colors.text }]}>{selectedCoach.shareCode}</Text>
                    <Pressable
                      style={[styles.copyBtn, { backgroundColor: colors.accent + '20' }]}
                      onPress={() => copyCode(selectedCoach.shareCode, setCopiedDetailCode)}
                    >
                      {copiedDetailCode ? (
                        <Check size={16} color={colors.accent} />
                      ) : (
                        <Copy size={16} color={colors.accent} />
                      )}
                    </Pressable>
                  </View>
                </View>

                <Text style={[styles.modalDescription, { color: colors.text }]}>{selectedCoach.description}</Text>

                {isUserShared(selectedCoach) && (
                  <View style={[styles.sharedBadgeLarge, { backgroundColor: colors.accent + '15' }]}>
                    <Text style={[styles.sharedBadgeLargeText, { color: colors.accent }]}>{t('community.communityShared')}</Text>
                  </View>
                )}

                {isCoachAlreadyAdded(selectedCoach) ? (
                  <View style={[styles.importButton, { backgroundColor: colors.textTertiary }]}>
                    <Check size={18} color="#FFFFFF" />
                    <Text style={styles.importButtonText}>{t('community.alreadyAdded')}</Text>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.importButton, { backgroundColor: selectedCoach.color }]}
                    onPress={() => handleImport(selectedCoach)}
                  >
                    <Download size={18} color="#FFFFFF" />
                    <Text style={styles.importButtonText}>{t('community.importCoach')}</Text>
                  </Pressable>
                )}

                {selectedCoach.authorId && selectedCoach.authorId === currentUserId && (
                  <View style={{ marginTop: 12 }}>
                    {deleteConfirmId === selectedCoach.id ? (
                      <View style={styles.deleteConfirmContainer}>
                        <Text style={[styles.deleteConfirmText, { color: colors.text }]}>
                          {t('community.deleteConfirm')}
                        </Text>
                        <View style={styles.deleteConfirmButtons}>
                          <Pressable
                            style={[styles.deleteConfirmBtn, { backgroundColor: '#EF4444' }]}
                            onPress={() => handleDeleteCoach(selectedCoach)}
                            disabled={isDeleting}
                          >
                            <Text style={styles.deleteConfirmBtnText}>
                              {isDeleting ? t('community.deleting') : t('community.yesDelete')}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[styles.deleteConfirmBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
                            onPress={() => setDeleteConfirmId(null)}
                          >
                            <Text style={[styles.deleteConfirmBtnText, { color: colors.text }]}>{t('common.cancel')}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.deleteButton, { borderColor: '#EF4444' }]}
                        onPress={() => setDeleteConfirmId(selectedCoach.id)}
                      >
                        <Trash2 size={16} color="#EF4444" />
                        <Text style={[styles.deleteButtonText, { color: '#EF4444' }]}>{t('community.deleteFromCommunity')}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showImportModal}
        animationType="fade"
        transparent
        onRequestClose={() => { setShowImportModal(false); setImportCode(''); setImportStatus('idle'); }}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalOverlay} onPress={() => { setShowImportModal(false); setImportCode(''); setImportStatus('idle'); }}>
            <Pressable style={[styles.importModalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.importModalTitle, { color: colors.text }]}>{t('community.importByCode')}</Text>
              <Text style={[styles.importModalSubtitle, { color: colors.textSecondary }]}>{t('community.importByCodeSubtitle')}</Text>
              <TextInput
                style={[styles.importInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder={t('settings.enterCodePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={importCode}
                onChangeText={(text) => { setImportCode(text.toUpperCase()); setImportStatus('idle'); }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {importStatus === 'success' && (
                <Text style={[styles.importFeedback, { color: '#22C55E' }]}>{t('community.importSuccess')}</Text>
              )}
              {importStatus === 'error' && (
                <Text style={[styles.importFeedback, { color: '#EF4444' }]}>{t('community.importError')}</Text>
              )}
              <Pressable
                style={[styles.importActionBtn, { backgroundColor: colors.accent, opacity: importCode.trim().length < 9 ? 0.5 : 1 }]}
                onPress={handleImportByCode}
                disabled={importCode.trim().length < 9}
              >
                <Text style={styles.importActionBtnText}>{t('community.import')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowShareModal(false); setSharedCode(null); setSharingCoachId(null); }}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: colors.surface }]}>
            <Pressable style={styles.modalClose} onPress={() => { setShowShareModal(false); setSharedCode(null); setSharingCoachId(null); }}>
              <X size={24} color={colors.text} />
            </Pressable>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.shareModalTitle, { color: colors.text }]}>{t('community.shareYourCoaches')}</Text>
              <Text style={[styles.shareModalSubtitle, { color: colors.textSecondary }]}>{t('community.shareYourCoachesSubtitle')}</Text>

              {sharedCode && (
                <View style={[styles.sharedCodeResult, { backgroundColor: colors.accent + '10', borderColor: colors.accent + '30' }]}>
                  <Text style={[styles.sharedCodeLabel, { color: colors.accent }]}>{t('community.coachSharedCode')}</Text>
                  <View style={styles.sharedCodeRow}>
                    <Text style={[styles.sharedCodeValue, { color: colors.text }]}>{sharedCode}</Text>
                    <Pressable
                      style={[styles.copyBtn, { backgroundColor: colors.accent + '20' }]}
                      onPress={() => copyCode(sharedCode, setCopiedCode)}
                    >
                      {copiedCode ? (
                        <Check size={16} color={colors.accent} />
                      ) : (
                        <Copy size={16} color={colors.accent} />
                      )}
                    </Pressable>
                  </View>
                </View>
              )}

              {sharingCoachId && (
                <View style={[styles.authorNameSection, { borderColor: colors.border }]}>
                  <Text style={[styles.authorNameLabel, { color: colors.textSecondary }]}>{t('community.authorName')}</Text>
                  <TextInput
                    style={[styles.authorNameInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                    value={shareAuthorName}
                    onChangeText={setShareAuthorName}
                    placeholder={t('community.yourName')}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Pressable
                    style={[styles.confirmShareBtn, { backgroundColor: colors.accent }]}
                    onPress={confirmShare}
                  >
                    <Text style={styles.confirmShareBtnText}>{t('community.shareCoach')}</Text>
                  </Pressable>
                </View>
              )}

              {!sharingCoachId && state.customCoaches.map((coach) => (
                <View key={coach.id} style={[styles.shareCoachRow, { borderColor: colors.border }]}>
                  <View style={[styles.shareCoachIcon, { backgroundColor: coach.color + '20' }]}>
                    <IconRenderer name={coach.icon} size={18} color={coach.color} />
                  </View>
                  <View style={styles.shareCoachInfo}>
                    <Text style={[styles.shareCoachName, { color: colors.text }]}>{coach.name}</Text>
                    <Text style={[styles.shareCoachRole, { color: colors.textSecondary }]}>{coach.role}</Text>
                  </View>
                  <Pressable
                    style={[styles.shareBtn, { backgroundColor: colors.accent }]}
                    onPress={() => handleShare(coach.id)}
                  >
                    <Share2 size={14} color="#FFFFFF" />
                    <Text style={styles.shareBtnText}>{t('coaches.shareVia')}</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  importCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  importCodeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  shareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 0,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 20,
    gap: 14,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    position: 'relative',
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  userBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  userBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardRole: {
    fontSize: 12,
    marginBottom: 6,
  },
  cardSpecialty: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  cardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  downloadCount: {
    fontSize: 11,
  },
  shareCodeSmall: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalClose: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconLarge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalRole: {
    fontSize: 14,
    marginBottom: 4,
  },
  modalAuthor: {
    fontSize: 13,
    marginBottom: 10,
  },
  modalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalSpecialty: {
    fontSize: 13,
    fontWeight: '500',
  },
  ratingSection: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  ratingNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  ratingCountText: {
    fontSize: 13,
  },
  userRatingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userRatingLabel: {
    fontSize: 13,
  },
  codeSection: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  codeLabelText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  copyBtn: {
    padding: 8,
    borderRadius: 8,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  sharedBadgeLarge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  sharedBadgeLargeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  importButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  importModalContent: {
    position: 'absolute',
    top: '30%',
    left: 20,
    right: 20,
    borderRadius: 20,
    padding: 24,
  },
  importModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  importModalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  importInput: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  importFeedback: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  importActionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  importActionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  shareModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  shareModalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  sharedCodeResult: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  sharedCodeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  sharedCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sharedCodeValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  authorNameSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  authorNameLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  authorNameInput: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  confirmShareBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmShareBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  shareCoachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  shareCoachIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCoachInfo: {
    flex: 1,
  },
  shareCoachName: {
    fontSize: 15,
    fontWeight: '600',
  },
  shareCoachRole: {
    fontSize: 12,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteConfirmContainer: {
    gap: 12,
  },
  deleteConfirmText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
