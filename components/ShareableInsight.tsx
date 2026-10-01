/**
 * ShareableInsight — capture coaching insights as beautiful branded images for social sharing.
 * Uses react-native-view-shot to capture + expo-sharing / Share API to distribute.
 */

import React, { useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Share,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Share2, Sparkles } from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/providers/ThemeProvider';

interface ShareableInsightProps {
    text: string;
    type?: 'breakthrough' | 'insight' | 'quote';
    onShare?: () => void;
}

// Gradient palettes for different insight types
const GRADIENTS: Record<string, [string, string, string]> = {
    breakthrough: ['#6C5CE7', '#A29BFE', '#DDD6FE'],
    insight: ['#0EA5E9', '#38BDF8', '#BAE6FD'],
    quote: ['#F59E0B', '#FBBF24', '#FDE68A'],
};

export const ShareableInsight: React.FC<ShareableInsightProps> = ({
    text,
    type = 'insight',
    onShare,
}) => {
    const viewShotRef = useRef<ViewShot>(null);
    const { colors, isDark } = useTheme();
    const gradient = GRADIENTS[type] || GRADIENTS.insight;

    const handleShare = useCallback(async () => {
        try {
            if (viewShotRef.current?.capture) {
                const uri = await viewShotRef.current.capture();

                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: 'Share your insight',
                    });
                } else {
                    // Fallback to text share
                    await Share.share({
                        message: `"${text}"\n\n— My AI coaching insight from Mazō\nhttps://mazo.app`,
                    });
                }
            } else {
                // Fallback if ViewShot not available
                await Share.share({
                    message: `"${text}"\n\n— My AI coaching insight from Mazō\nhttps://mazo.app`,
                });
            }
            onShare?.();
        } catch (err: any) {
            console.warn('[ShareableInsight] Share failed:', err?.message || err);
            // Final fallback
            try {
                await Share.share({
                    message: `"${text}"\n\n— From Mazō\nhttps://mazo.app`,
                });
            } catch { }
        }
    }, [text, onShare]);

    return (
        <View style={styles.wrapper}>
            {/* Capturable card */}
            <ViewShot
                ref={viewShotRef}
                options={{ format: 'png', quality: 1 }}
                style={styles.shotContainer}
            >
                <LinearGradient
                    colors={gradient}
                    style={styles.card}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Decorative elements */}
                    <View style={styles.decoration}>
                        <Text style={styles.decorQuote}>"</Text>
                    </View>

                    {/* Insight text */}
                    <Text style={styles.insightText}>{text}</Text>

                    {/* Branding */}
                    <View style={styles.branding}>
                        <View style={styles.brandDot} />
                        <Text style={styles.brandText}>Mazō — AI Life Coach</Text>
                    </View>
                </LinearGradient>
            </ViewShot>

            {/* Share button */}
            <Pressable
                onPress={handleShare}
                style={[styles.shareButton, { backgroundColor: colors.accent + '15' }]}
            >
                <Share2 size={16} color={colors.accent} />
                <Text style={[styles.shareButtonText, { color: colors.accent }]}>Share</Text>
            </Pressable>
        </View>
    );
};

/** Standalone share button for use in other components */
export const ShareInsightButton: React.FC<{
    text: string;
    type?: 'breakthrough' | 'insight' | 'quote';
    size?: 'small' | 'medium';
}> = ({ text, type = 'insight', size = 'small' }) => {
    const { colors } = useTheme();

    const handleQuickShare = useCallback(async () => {
        try {
            await Share.share({
                message: `"${text}"\n\n— My AI coaching insight from Mazō ✨\nhttps://mazo.app`,
            });
        } catch (err: any) {
            console.warn('[ShareInsight] Quick share failed:', err?.message || err);
        }
    }, [text]);

    return (
        <Pressable
            onPress={handleQuickShare}
            style={[
                styles.quickShareBtn,
                {
                    backgroundColor: colors.accent + '12',
                    paddingVertical: size === 'small' ? 6 : 10,
                    paddingHorizontal: size === 'small' ? 10 : 14,
                },
            ]}
            hitSlop={8}
        >
            <Share2 size={size === 'small' ? 13 : 16} color={colors.accent} />
            <Text style={[styles.quickShareText, { color: colors.accent, fontSize: size === 'small' ? 11 : 13 }]}>
                Share
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginVertical: 8,
    },
    shotContainer: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    card: {
        padding: 28,
        paddingTop: 36,
        paddingBottom: 20,
        minHeight: 180,
        justifyContent: 'space-between',
    },
    decoration: {
        position: 'absolute',
        top: 8,
        left: 20,
    },
    decorQuote: {
        fontSize: 60,
        color: 'rgba(255,255,255,0.3)',
        fontWeight: '800',
        lineHeight: 60,
    },
    insightText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF',
        lineHeight: 26,
        marginTop: 12,
        textShadowColor: 'rgba(0,0,0,0.15)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    branding: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 16,
        opacity: 0.8,
    },
    brandDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FFF',
    },
    brandText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFF',
        letterSpacing: 0.5,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 8,
    },
    shareButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    quickShareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 8,
    },
    quickShareText: {
        fontWeight: '600',
    },
});
