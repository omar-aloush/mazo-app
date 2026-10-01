import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, Keyboard, Animated, Text, Alert, Platform, Linking } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { AIFace, FaceExpression } from '@/components/AIFace';
import { useTheme } from '@/providers/ThemeProvider';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { hapticPress, hapticSelection } from '@/utils/haptics';
import { track } from '@/services/analytics';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  faceExpression?: FaceExpression;
  onVoiceStateChange?: (isListening: boolean) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Message...',
  faceExpression = 'idle',
  onVoiceStateChange,
}) => {
  const [text, setText] = useState('');
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const micPulseAnim = useRef(new Animated.Value(1)).current;
  const micGlowAnim = useRef(new Animated.Value(0)).current;

  const {
    isListening,
    isSupported: isSpeechSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error: micError,
    clearError: clearMicError,
  } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      setText(transcript.trim());
    }
  }, [transcript]);

  // Surface mic failures instead of swallowing them — the old code failed silently.
  useEffect(() => {
    if (!micError) return;
    if (micError === 'permission') {
      Alert.alert(
        'Microphone access needed',
        'Turn on the microphone for Mazō so you can talk to your coach.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ],
      );
    } else if (micError === 'empty') {
      Alert.alert("Didn't catch that", "I didn't hear anything — tap the mic and speak a little longer.");
    } else {
      Alert.alert('Mic trouble', 'Something went wrong with the microphone. Please try again.');
    }
    clearMicError();
  }, [micError, clearMicError]);

  useEffect(() => {
    onVoiceStateChange?.(isListening);
  }, [isListening, onVoiceStateChange]);

  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(micPulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      Animated.timing(micGlowAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      return () => {
        pulse.stop();
        micPulseAnim.setValue(1);
        Animated.timing(micGlowAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      };
    } else {
      micPulseAnim.setValue(1);
      micGlowAnim.setValue(0);
    }
  }, [isListening, micPulseAnim, micGlowAnim]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed && !disabled) {
      if (isListening) {
        stopListening();
      }
      hapticPress();
      track('message_sent');
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
      onSend(trimmed);
      setText('');
      resetTranscript();
      Keyboard.dismiss();
    }
  }, [text, disabled, onSend, scaleAnim, isListening, stopListening, resetTranscript]);

  const handleMicPress = useCallback(() => {
    hapticSelection();
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setText('');
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.88,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const canSend = text.trim().length > 0 && !disabled;
  const displayText = isListening && interimTranscript ? text + (text ? ' ' : '') + interimTranscript : text;

  const activeExpression: FaceExpression = isListening
    ? 'listening'
    : canSend
      ? 'listening'
      : faceExpression;

  const micGlowColor = micGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(124,154,130,0)', 'rgba(239,68,68,0.2)'],
  });

  return (
    <View style={styles.container}>
      {isListening && (
        <Animated.View style={[styles.listeningIndicator, { backgroundColor: colors.surface }]}>
          <View style={styles.listeningDot} />
          <Text style={[styles.listeningText, { color: colors.textSecondary }]}>Listening...</Text>
        </Animated.View>
      )}
      <View style={[styles.inputWrapper, { backgroundColor: colors.surface }]}>
        <Pressable
          onPress={handleMicPress}
          disabled={disabled}
          style={styles.micButtonWrap}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={isListening ? 'Stop voice input' : 'Start voice input'}
          accessibilityRole="button"
        >
          <Animated.View
            style={[
              styles.micButton,
              { transform: [{ scale: micPulseAnim }] },
              disabled && styles.micButtonDisabled,
            ]}
          >
            <Animated.View
              style={[
                styles.micGlow,
                { backgroundColor: micGlowColor },
              ]}
            />
            {isListening ? (
              <MicOff size={20} color="#EF4444" />
            ) : (
              <Mic size={20} color={colors.textSecondary} />
            )}
          </Animated.View>
        </Pressable>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={displayText}
          onChangeText={(newText) => {
            setText(newText);
            if (isListening) {
              stopListening();
            }
          }}
          placeholder={isListening ? 'Speak now...' : placeholder}
          placeholderTextColor={isListening ? colors.accent : colors.textTertiary}
          multiline
          maxLength={2000}
          editable={!isListening}
          testID="chat-input"
        />
        <Pressable
          onPress={handleSend}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!canSend}
          testID="send-button"
          style={styles.mazoButtonWrap}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          <Animated.View
            style={[
              styles.mazoButton,
              { transform: [{ scale: scaleAnim }] },
              !canSend && styles.mazoButtonInactive,
            ]}
          >
            <AIFace
              expression={activeExpression}
              size={44}
            />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 4,
    borderRadius: 16,
    alignSelf: 'center',
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  listeningText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 28,
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 10,
    paddingHorizontal: 8,
    lineHeight: 20,
  },
  micButtonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  micButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    position: 'relative',
  },
  micButtonDisabled: {
    opacity: 0.4,
  },
  micGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  mazoButtonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  mazoButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mazoButtonInactive: {
    opacity: 0.55,
  },
});
