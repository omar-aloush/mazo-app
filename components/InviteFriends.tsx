/**
 * InviteFriends — beautiful referral screen with progress tracking and share buttons.
 * Shows referral code, invite progress, reward tiers, and quick-share options.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Share,
    Animated,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Gift,
    Copy,
    Share2,
    Users,
    Crown,
    Sparkles,
    Check,
    ChevronRight,
    Star,
    X,
} from 'lucide-react-native';
import { getOrCreateReferralCode, getReferralStats } from '@/services/referral';

interface InviteFriendsProps {
    onClose?: () => void;
    compact?: boolean; // For onboarding embed
}

// ── Reward Tiers ───────────────────────────────────────
const REWARD_TIERS = [
    { friends: 1, reward: '3 days Pro', emoji: '🎁', color: '#10B981' },
    { friends: 3, reward: '1 month Pro', emoji: '🏆', color: '#F59E0B' },
    { friends: 5, reward: '3 months Pro', emoji: '💎', color: '#8B5CF6' },
    { friends: 10, reward: 'Lifetime Pro', emoji: '👑', color: '#EF4444' },
];

export const InviteFriends: React.FC<InviteFriendsProps> = ({ onClose, compact = false }) => {
    const { colors, isDark } = useTheme();
    const { getUserId } = useApp();
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [inviteCount, setInviteCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    useEffect(() => {
        loadReferralData();
    }, []);

    useEffect(() => {
        // Subtle pulse on the share button
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    const loadReferralData = async () => {
        try {
            const userId = getUserId();
            const result = await getOrCreateReferralCode(userId);
            if (result.status === 'success' && result.code) {
                setReferralCode(result.code);
                const stats = await getReferralStats(userId);
                setInviteCount(stats.totalReferred ?? 0);
            }
        } catch (err: any) {
            console.warn('[InviteFriends] Failed to load referral data:', err?.message || err);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = useCallback(async () => {
        if (!referralCode) return;
        try {
            const Clipboard = await import('expo-clipboard');
            await Clipboard.setStringAsync(referralCode);
        } catch {
            try {
                await navigator.clipboard.writeText(referralCode);
            } catch (err: any) {
                console.warn('[InviteFriends] Copy failed:', err?.message || err);
            }
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [referralCode]);

    const handleShare = useCallback(async () => {
        if (!referralCode) return;
        try {
            const deepLink = `https://mazo.app/invite?code=${referralCode}`;
            await Share.share({
                message: `I've been using Mazō — an AI life coach that actually makes you take action. It's been a game-changer for my clarity and focus.\n\nTry it free with my code: ${referralCode}\n\n${deepLink}`,
                title: 'Join me on Mazō',
            });
        } catch (err: any) {
            console.warn('[InviteFriends] Share failed:', err?.message || err);
        }
    }, [referralCode]);

    const currentTierIndex = REWARD_TIERS.findIndex(t => inviteCount < t.friends);
    const nextTier = REWARD_TIERS[currentTierIndex] || REWARD_TIERS[REWARD_TIERS.length - 1];
    const progress = currentTierIndex === -1 ? 1 : inviteCount / nextTier.friends;

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    const content = (
        <>
            {/* Header */}
            {!compact && onClose && (
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Invite Friends</Text>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Close invite screen"
                        onPress={onClose}
                        hitSlop={12}
                    >
                        <X size={24} color={colors.textSecondary} />
                    </Pressable>
                </View>
            )}

            {/* Hero */}
            <LinearGradient
                colors={isDark ? ['#2A1B3D', '#1A1A2E'] : ['#F0E6FF', '#E8F4FD']}
                style={styles.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Text style={styles.heroEmoji}>🎁</Text>
                <Text style={[styles.heroTitle, { color: colors.text }]}>
                    Give Clarity, Get Rewarded
                </Text>
                <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                    Share Mazō with friends and earn free Pro access
                </Text>
            </LinearGradient>

            {/* Referral Code */}
            {referralCode && (
                <View style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>Your Invite Code</Text>
                    <View style={styles.codeRow}>
                        <Text style={[styles.codeText, { color: colors.accent }]}>{referralCode}</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={copied ? 'Invite code copied' : 'Copy invite code'}
                            onPress={handleCopy}
                            style={[styles.copyBtn, { backgroundColor: colors.accent + '15' }]}
                        >
                            {copied ? (
                                <Check size={18} color={colors.accent} />
                            ) : (
                                <Copy size={18} color={colors.accent} />
                            )}
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Progress */}
            <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.progressHeader}>
                    <Users size={18} color={colors.accent} />
                    <Text style={[styles.progressTitle, { color: colors.text }]}>
                        {inviteCount} friend{inviteCount !== 1 ? 's' : ''} joined
                    </Text>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <LinearGradient
                        colors={['#6C5CE7', '#A29BFE']}
                        style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    />
                </View>
                <Text style={[styles.progressHint, { color: colors.textSecondary }]}>
                    {currentTierIndex === -1
                        ? '🎉 You\'ve unlocked all rewards!'
                        : `${nextTier.friends - inviteCount} more to unlock ${nextTier.reward}`
                    }
                </Text>
            </View>

            {/* Reward Tiers */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Reward Tiers</Text>
            {REWARD_TIERS.map((tier, i) => {
                const unlocked = inviteCount >= tier.friends;
                return (
                    <View
                        key={tier.friends}
                        style={[
                            styles.tierRow,
                            {
                                backgroundColor: unlocked ? tier.color + '15' : colors.surface,
                                borderColor: unlocked ? tier.color + '40' : colors.border,
                            },
                        ]}
                    >
                        <Text style={styles.tierEmoji}>{tier.emoji}</Text>
                        <View style={styles.tierInfo}>
                            <Text style={[styles.tierFriends, { color: colors.text }]}>
                                {tier.friends} friend{tier.friends > 1 ? 's' : ''}
                            </Text>
                            <Text style={[styles.tierReward, { color: unlocked ? tier.color : colors.textSecondary }]}>
                                {tier.reward}
                            </Text>
                        </View>
                        {unlocked ? (
                            <View style={[styles.tierBadge, { backgroundColor: tier.color }]}>
                                <Check size={14} color="#FFF" />
                            </View>
                        ) : (
                            <ChevronRight size={18} color={colors.textTertiary} />
                        )}
                    </View>
                );
            })}

            {/* Share Button */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 20 }}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Share Mazō with friends"
                    onPress={handleShare}
                    style={styles.shareBtn}
                >
                    <LinearGradient
                        colors={['#6C5CE7', '#A29BFE']}
                        style={styles.shareBtnGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Share2 size={20} color="#FFF" />
                        <Text style={styles.shareBtnText}>Share Mazō with Friends</Text>
                    </LinearGradient>
                </Pressable>
            </Animated.View>

            <View style={{ height: 40 }} />
        </>
    );

    if (compact) {
        return (
            <View style={[styles.content, { backgroundColor: colors.background }]}>
                {content}
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {content}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
    },
    hero: {
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
    },
    heroEmoji: {
        fontSize: 40,
        marginBottom: 12,
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 6,
        textAlign: 'center',
    },
    heroSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    codeCard: {
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    codeLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    codeText: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: 2,
    },
    copyBtn: {
        padding: 10,
        borderRadius: 10,
    },
    progressCard: {
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        marginBottom: 20,
    },
    progressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    progressTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressHint: {
        fontSize: 13,
        fontWeight: '500',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    tierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        gap: 12,
    },
    tierEmoji: {
        fontSize: 24,
    },
    tierInfo: {
        flex: 1,
    },
    tierFriends: {
        fontSize: 14,
        fontWeight: '700',
    },
    tierReward: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    tierBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareBtn: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    shareBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    shareBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
    },
});
