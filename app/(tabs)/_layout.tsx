import { Tabs } from 'expo-router';
import { MessageCircle, User, TrendingUp } from 'lucide-react-native';
import { Platform, Animated, View, StyleSheet } from 'react-native';
import { useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';

function AnimatedTabIcon({ children, focused, accentColor }: { children: React.ReactNode; focused: boolean; accentColor: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.5)).current;
  const dotScale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.12 : 1,
        friction: 6,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0.5,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(dotScale, {
        toValue: focused ? 1 : 0,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <View style={tabIconStyles.wrapper}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        {children}
      </Animated.View>
      <Animated.View
        style={[
          tabIconStyles.dot,
          { backgroundColor: accentColor, transform: [{ scale: dotScale }] },
        ]}
      />
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
});

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 0);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.borderLight,
          borderTopWidth: 0.5,
          paddingBottom: bottomPadding,
          height: 60 + bottomPadding,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.4,
          marginTop: -2,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
        headerShown: false,
        freezeOnBlur: true,
        animation: 'none',
        lazy: true,
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarAccessibilityLabel: 'Coach - Start a coaching session',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon focused={focused} accentColor={colors.accent}>
              <MessageCircle size={size - 1} color={color} strokeWidth={focused ? 2.4 : 1.8} />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="system"
        options={{
          title: t('tabs.journey'),
          tabBarAccessibilityLabel: 'Journey - View your progress',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon focused={focused} accentColor={colors.accent}>
              <TrendingUp size={size - 1} color={color} strokeWidth={focused ? 2.4 : 1.8} />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarAccessibilityLabel: 'You - Your profile and preferences',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon focused={focused} accentColor={colors.accent}>
              <User size={size - 1} color={color} strokeWidth={focused ? 2.4 : 1.8} />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="coaches"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="schedules"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="context"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="memory"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
