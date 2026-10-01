import { Stack } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';

export default function MemoryLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
