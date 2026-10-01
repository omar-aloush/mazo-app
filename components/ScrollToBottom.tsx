import React, { useRef, useEffect } from 'react';
import { StyleSheet, Pressable, Animated, StyleProp, ViewStyle } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';

interface ScrollToBottomProps {
  visible: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ScrollToBottom: React.FC<ScrollToBottomProps> = ({
  visible,
  onPress,
  style,
}) => {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        { opacity: fadeAnim },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable
        onPress={onPress}
        style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityLabel="Scroll to latest message"
        accessibilityRole="button"
        hitSlop={12}
      >
        <ChevronDown size={22} color={colors.text} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 10,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
