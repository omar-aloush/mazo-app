import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Text,
} from 'react-native';
import { Mic, MicOff, Loader, Lock } from 'lucide-react-native';
import { speechService } from '@/services/speech';
import Colors from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';

interface VoiceButtonProps {
  onTranscription: (text: string) => void;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
  disabled?: boolean;
  size?: 'small' | 'large';
  isPro?: boolean;
  onUpgradePress?: () => void;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onTranscription,
  onRecordingStart,
  onRecordingEnd,
  disabled = false,
  size = 'large',
  isPro = true,
  onUpgradePress,
}) => {
  const { colors } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const handlePress = async () => {
    if (disabled || isProcessing) return;

    if (!isPro) {
      onUpgradePress?.();
      return;
    }

    if (isRecording) {
      stopPulse();
      setIsRecording(false);
      setIsProcessing(true);
      onRecordingEnd?.();

      try {
        const result = await speechService.stopRecording();
        if (result.text) {
          onTranscription(result.text);
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      try {
        await speechService.startRecording();
        setIsRecording(true);
        startPulse();
        onRecordingStart?.();
      } catch (error) {
        console.error('Error starting recording:', error);
      }
    }
  };

  const buttonSize = size === 'large' ? 64 : 44;
  const iconSize = size === 'large' ? 28 : 20;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || isProcessing}
      style={({ pressed }) => [
        styles.container,
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          backgroundColor: isRecording ? colors.error + '20' : colors.surface,
          borderColor: isRecording ? colors.error : colors.borderLight,
        },
        pressed && { opacity: 0.7 },
        disabled && styles.disabled,
      ]}
    >
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        {isProcessing ? (
          <Loader size={iconSize} color={colors.accent} style={styles.spinner} />
        ) : isRecording ? (
          <MicOff size={iconSize} color={colors.error} />
        ) : !isPro ? (
          <Lock size={iconSize} color={colors.textTertiary} />
        ) : (
          <Mic size={iconSize} color={colors.accent} />
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  spinner: {
    // Add rotation animation if needed, but Loader usually implies it
  },
});
