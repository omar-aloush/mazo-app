import React, { useEffect, useRef, memo } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonLoader = memo(function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonLoaderProps) {
  const { colors, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const skeletonColor = isDark ? '#2A2A2A' : '#F0F0EE';

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: skeletonColor,
          opacity,
        },
        style,
      ]}
    />
  );
});

/** Card-shaped skeleton with 3 lines */
export const SkeletonCard = memo(function SkeletonCard({ style }: { style?: ViewStyle }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: isDark ? colors.border : '#E8E8E6' }, style]}>
      <SkeletonLoader height={16} width="80%" style={styles.line} />
      <SkeletonLoader height={12} width="60%" style={styles.line} />
      <SkeletonLoader height={12} width="70%" />
    </View>
  );
});

/** Section card skeleton matching the Journey screen style */
export const SkeletonSectionCard = memo(function SkeletonSectionCard({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionCard, { borderColor: colors.borderLight }, style]}>
      <View style={styles.sectionHeader}>
        <SkeletonLoader width={20} height={20} borderRadius={10} />
        <SkeletonLoader width={120} height={16} />
      </View>
      <SkeletonLoader height={14} width="90%" style={styles.line} />
      <SkeletonLoader height={14} width="75%" style={styles.line} />
      <SkeletonLoader height={14} width="60%" />
    </View>
  );
});

/** Referral card skeleton */
export const SkeletonReferralCard = memo(function SkeletonReferralCard({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.referralSkeleton, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <View style={styles.referralHeader}>
        <SkeletonLoader width={44} height={44} borderRadius={12} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonLoader width={160} height={18} />
          <SkeletonLoader width={220} height={12} />
        </View>
      </View>
      <SkeletonLoader height={12} width={100} style={{ marginTop: 16 }} />
      <SkeletonLoader height={48} width="100%" borderRadius={12} style={{ marginTop: 8 }} />
      <SkeletonLoader height={44} width="100%" borderRadius={22} style={{ marginTop: 12 }} />
    </View>
  );
});

/** Chat message skeleton */
export const SkeletonChatMessage = memo(function SkeletonChatMessage({ isUser = false, style }: { isUser?: boolean; style?: ViewStyle }) {
  return (
    <View style={[styles.chatMessage, isUser && styles.chatMessageUser, style]}>
      <SkeletonLoader height={14} width={isUser ? '60%' : '85%'} style={styles.line} />
      <SkeletonLoader height={14} width={isUser ? '40%' : '70%'} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  line: {
    marginBottom: 10,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  referralSkeleton: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatMessage: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  chatMessageUser: {
    alignSelf: 'flex-end',
  },
});
