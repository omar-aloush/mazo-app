import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Spectral_400Regular,
  Spectral_500Medium,
  Spectral_600SemiBold,
  Spectral_500Medium_Italic,
} from '@expo-google-fonts/spectral';
import React, { useEffect, useState, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from '@/providers/AppProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { SubscriptionProvider, useSubscription } from '@/providers/SubscriptionProvider';
import { DocumentsProvider } from '@/providers/DocumentsProvider';
import { ThemeProvider, useTheme } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import NetworkStatus from '@/components/NetworkStatus';
import { CelebrationModal } from '@/components/CelebrationModal';
import { EnergyCheck } from '@/components/EnergyCheck';
import { initCrashReporting, wrap as sentryWrap } from '@/services/crashReporting';
import { initAnalytics } from '@/services/analytics';
import { registerPushToken } from '@/services/pushNotifications';
import { ensureAuthSession } from '@/services/auth';
import { AlarmOverlay } from '@/components/AlarmOverlay';
import { SplashOverlay } from '@/components/SplashOverlay';
import { rescheduleAllAlarms, scheduleSnooze } from '@/services/alarms';
import { AlarmSoundId } from '@/types';
import { loadSavedLanguage } from '@/i18n/i18n';
import {
  configureNotifications,
  scheduleDailyCheckin,
  hasNotificationPermission,
  getNotificationPrefs,
} from '@/services/notifications';
import * as Notifications from 'expo-notifications';
import { isSupabaseConfigured, supabase } from '@/services/supabase';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const isToday = (timestamp: number): boolean => {
  const today = new Date();
  const date = new Date(timestamp);
  return today.toDateString() === date.toDateString();
};

function CelebrationWrapper() {
  const { state, dismissCelebration } = useApp();

  return (
    <CelebrationModal
      visible={state.showCelebration}
      onDismiss={dismissCelebration}
      taskTitle={state.celebrationTaskTitle || undefined}
    />
  );
}

function EnergyCheckWrapper() {
  const { state, updateUserContext, isLoaded } = useApp();
  const [showEnergyCheck, setShowEnergyCheck] = useState(false);

  useEffect(() => {
    if (isLoaded && state.onboardingComplete) {
      const lastUpdate = state.userContext.lastUpdated || 0;
      if (!isToday(lastUpdate)) {
        const timer = setTimeout(() => {
          setShowEnergyCheck(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoaded, state.onboardingComplete, state.userContext.lastUpdated]);

  const handleComplete = (level: 'low' | 'medium' | 'high') => {
    updateUserContext({
      energyLevel: level,
      lastUpdated: Date.now()
    });
    setShowEnergyCheck(false);
  };

  const handleSkip = () => {
    updateUserContext({ lastUpdated: Date.now() });
    setShowEnergyCheck(false);
  };

  return (
    <EnergyCheck
      visible={showEnergyCheck}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}

function NotificationInit() {
  const { state, isLoaded } = useApp();
  const router = useRouter() as any;
  const notifResponseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Configure notification handler and load language on mount
    configureNotifications();
    loadSavedLanguage();

    // Handle notification taps — route to the right screen
    notifResponseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const screen = response.notification.request.content.data?.screen;
        if (screen === 'chat') {
          router.push('/(tabs)/chat');
        } else if (screen === 'system') {
          router.push('/(tabs)/system');
        }
      }
    );

    return () => {
      if (notifResponseListener.current) {
        notifResponseListener.current.remove();
      }
    };
  }, []);

  // Once onboarding is complete, set up daily check-in + Supabase push notifications
  useEffect(() => {
    if (isLoaded && state.onboardingComplete) {
      let cancelled = false;

      (async () => {
        const hasPerms = await hasNotificationPermission();
        if (!hasPerms || cancelled) return;

        // Registration never prompts here; notification consent belongs to Settings.
        const session = await ensureAuthSession();
        if (cancelled) return;
        await registerPushToken(session.user.id);

        const prefs = await getNotificationPrefs();
        if (prefs.dailyCheckinEnabled) {
          scheduleDailyCheckin(prefs.dailyCheckinHour);
        }
      })().catch((error) => {
        console.warn('[Notifications] Initialization failed:', error);
      });

      return () => {
        cancelled = true;
      };
    }
  }, [isLoaded, state.onboardingComplete]);

  // Reschedule all alarms on app start (survive reboots)
  useEffect(() => {
    if (isLoaded && state.onboardingComplete) {
      const alarms = state.memory?.alarms || [];
      if (alarms.length > 0) {
        rescheduleAllAlarms(alarms).then((idMap) => {
          if (__DEV__ && idMap.size > 0) console.log('[Layout] Rescheduled', idMap.size, 'alarms');
        });
      }
    }
  }, [isLoaded, state.onboardingComplete]);

  return null;
}

function AlarmNotificationWrapper() {
  const { state, updateAlarm } = useApp();
  const [activeAlarm, setActiveAlarm] = useState<{
    visible: boolean;
    label: string;
    hour: number;
    minute: number;
    soundId: AlarmSoundId;
    alarmId: string;
  }>({ visible: false, label: '', hour: 0, minute: 0, soundId: 'gentle', alarmId: '' });

  useEffect(() => {
    // Listen for alarm notification taps
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'alarm' && data?.alarmId) {
        const alarm = (state.memory?.alarms || []).find(a => a.id === data.alarmId);
        if (alarm) {
          setActiveAlarm({
            visible: true,
            label: alarm.label,
            hour: alarm.hour,
            minute: alarm.minute,
            soundId: alarm.soundId,
            alarmId: alarm.id,
          });
        }
      }
    });

    // Also listen for notifications received while app is in foreground
    const fgSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.type === 'alarm' && data?.alarmId) {
        const alarm = (state.memory?.alarms || []).find(a => a.id === data.alarmId);
        if (alarm) {
          setActiveAlarm({
            visible: true,
            label: alarm.label,
            hour: alarm.hour,
            minute: alarm.minute,
            soundId: alarm.soundId,
            alarmId: alarm.id,
          });
        }
      }
    });

    return () => { sub.remove(); fgSub.remove(); };
  }, [state.memory?.alarms]);

  // Web fallback: listen for custom 'mazo-alarm-fire' events from setTimeout
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = (e: any) => {
      const { alarmId, soundId } = e.detail || {};
      if (alarmId) {
        const alarm = (state.memory?.alarms || []).find(a => a.id === alarmId);
        if (alarm) {
          setActiveAlarm({
            visible: true,
            label: alarm.label,
            hour: alarm.hour,
            minute: alarm.minute,
            soundId: alarm.soundId,
            alarmId: alarm.id,
          });
        }
      }
    };
    window.addEventListener('mazo-alarm-fire', handler);
    return () => window.removeEventListener('mazo-alarm-fire', handler);
  }, [state.memory?.alarms]);

  const handleDismiss = () => {
    setActiveAlarm(prev => ({ ...prev, visible: false }));
  };

  const handleSnooze = async () => {
    const alarm = (state.memory?.alarms || []).find(a => a.id === activeAlarm.alarmId);
    if (alarm) {
      await scheduleSnooze(alarm, 5);
    }
    setActiveAlarm(prev => ({ ...prev, visible: false }));
  };

  return (
    <AlarmOverlay
      visible={activeAlarm.visible}
      label={activeAlarm.label}
      hour={activeAlarm.hour}
      minute={activeAlarm.minute}
      soundId={activeAlarm.soundId}
      alarmId={activeAlarm.alarmId}
      onDismiss={handleDismiss}
      onSnooze={handleSnooze}
    />
  );
}

function TrialStateSync() {
  const { isTrialActive } = useApp();
  const { setTrialActive } = useSubscription();

  useEffect(() => {
    setTrialActive(isTrialActive);
  }, [isTrialActive, setTrialActive]);

  return null;
}

function SubscriptionIdentitySync() {
  const { isLoaded } = useApp();
  const { setUserId } = useSubscription();
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const syncIdentity = (userId?: string) => {
      if (userId && syncedUserIdRef.current === userId) return;
      if (userId) syncedUserIdRef.current = userId;
      setUserId().catch((error) => {
        if (userId) syncedUserIdRef.current = null;
        console.warn('[Subscription] Identity sync failed:', error);
      });
    };

    syncIdentity();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        syncedUserIdRef.current = null;
        return;
      }
      setTimeout(() => syncIdentity(session.user.id), 0);
    });

    return () => subscription.unsubscribe();
  }, [isLoaded, setUserId]);

  return null;
}

function RootLayoutNav() {
  const { colors } = useTheme();

  return (
    <>
      <Stack
        screenOptions={{
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="mazo-intro" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="first-launch" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="paywall"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
        <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
        <Stack.Screen name="documents" options={{ headerShown: true }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <CelebrationWrapper />
      <EnergyCheckWrapper />
      <AlarmNotificationWrapper />
      <NotificationInit />
      <TrialStateSync />
      <SubscriptionIdentitySync />
    </>
  );
}

function RootLayoutInner() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded, fontError] = useFonts({
    Spectral_400Regular,
    Spectral_500Medium,
    Spectral_600SemiBold,
    Spectral_500Medium_Italic,
  });

  useEffect(() => {
    initCrashReporting();
    initAnalytics();
  }, []);

  // Hold the native splash until the Living Garden serif is ready (or fails),
  // so headings never flash in a fallback face.
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!isSupabaseConfigured) {
    return (
      <View
        accessibilityRole="alert"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#11110F' }}
      >
        <Text style={{ color: '#F4F1E8', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
          Mazō needs configuration
        </Text>
        <Text style={{ color: '#B8B4AA', fontSize: 16, lineHeight: 24, textAlign: 'center' }}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then rebuild the app.
        </Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <AppProvider>
                  <SubscriptionProvider>
                    <DocumentsProvider>
                      <NetworkStatus />
                      <RootLayoutNav />
                      {showSplash && <SplashOverlay onFinish={() => setShowSplash(false)} />}
                    </DocumentsProvider>
                  </SubscriptionProvider>
                </AppProvider>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

export default sentryWrap(RootLayoutInner);
