import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { WifiOff, X } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';

export default function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => {
        setIsOffline(false);
        setDismissed(false);
      };
      const handleOffline = () => setIsOffline(true);

      setIsOffline(!window.navigator.onLine);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.surface }]}
      accessibilityRole="alert"
      accessibilityLabel="You are offline. Some features may be unavailable."
    >
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
          <WifiOff size={14} color="#92400E" />
        </View>
        <Text style={[styles.text, { color: colors.text }]}>
          You're offline — some features may be unavailable
        </Text>
        <Pressable
          onPress={() => setDismissed(true)}
          hitSlop={12}
          accessibilityLabel="Dismiss offline notification"
          accessibilityRole="button"
        >
          <X size={16} color={colors.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
