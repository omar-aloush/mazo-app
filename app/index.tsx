import { useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useEffect } from 'react';

export default function Index() {
  const { state, isLoaded } = useApp();
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    if (!state.onboardingComplete) {
      router.replace('/mazo-intro');
    } else {
      router.replace('/(tabs)/chat');
    }
  }, [isLoaded, state.onboardingComplete, router]);

  return (
    <View style={[styles.loading, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="small" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
