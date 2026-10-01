import { Stack } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function ChatLayout() {
  const { colors } = useTheme();

  return (
    <ScreenErrorBoundary screenName="Chat">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      />
    </ScreenErrorBoundary>
  );
}
