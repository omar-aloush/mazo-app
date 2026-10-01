import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function SettingsLayout() {
  const { colors } = useTheme();

  return (
    <ScreenErrorBoundary screenName="Settings">
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
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
