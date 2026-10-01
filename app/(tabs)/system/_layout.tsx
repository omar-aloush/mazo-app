import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function SystemLayout() {
  const { colors } = useTheme();

  return (
    <ScreenErrorBoundary screenName="Journey">
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </ScreenErrorBoundary>
  );
}
