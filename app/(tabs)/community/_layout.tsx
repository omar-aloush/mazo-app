import { Stack } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';

export default function CommunityLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
