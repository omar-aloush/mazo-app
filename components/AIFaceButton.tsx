import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Text,
  Easing,
} from 'react-native';
import Svg, { Path, Defs, RadialGradient, Stop, Circle as SvgCircle } from 'react-native-svg';
import { Mic } from 'lucide-react-native';
import { speechService } from '@/services/speech';
import Colors from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';

type FaceExpression = 'idle' | 'listening' | 'thinking' | 'happy';

interface AIFaceButtonProps {
  onTranscription: (text: string) => void;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
  disabled?: boolean;
  size?: number;
  showHint?: boolean;
}

export function AIFaceButton({
  onTranscription,
  onRecordingStart,
  onRecordingEnd,
  disabled = false,
  size = 120,
  showHint = true,
}: AIFaceButtonProps) {
  const { colors } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const ring3Anim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const eyeLeftAnim = useRef(new Animated.Value(0)).current;
  const eyeRightAnim = useRef(new Animated.Value(0)).current;
  const browLeftAnim = useRef(new Animated.Value(0)).current;
  const browRightAnim = useRef(new Animated.Value(0)).current;
  const mouthAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const micIconAnim = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const expression: FaceExpression = isProcessing ? 'thinking' : isRecording ? 'listening' : 'idle';

  useEffect(() => {
    const blinkLoop = () => {
      const delay = 2000 + Math.random() * 3000;
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
        ]).start(() => blinkLoop());
      }, delay);
    };
    blinkLoop();
  }, [blinkAnim]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(micIconAnim, {
          toValue: 0.6,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(micIconAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [micIconAnim]);

  const handlePress = async () => {
    if (disabled || isProcessing) return;

    if (isRecording) {
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
        onRecordingStart?.();
      } catch (error) {
        console.error('Error starting recording:', error);
      }
    }
  };

  const eyeY = 40;
  const eyeSpacing = 20;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handlePress}
        disabled={disabled || isProcessing}
        style={({ pressed }) => [
          styles.button,
          { width: size, height: size, borderRadius: size / 2 },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Animated Glow Wrapper */}
          <SvgCircle cx="50" cy="50" r="45" fill="url(#glow)" />

          {/* Main Face Circle */}
          <SvgCircle
            cx="50"
            cy="50"
            r="40"
            fill={colors.surface}
            stroke={isRecording ? colors.error : colors.accent}
            strokeWidth="2"
          />

          {/* Eyes */}
          <Animated.View style={{ transform: [{ scaleY: blinkAnim }] }}>
            <SvgCircle cx={50 - eyeSpacing} cy={eyeY} r="4" fill={colors.text} />
            <SvgCircle cx={50 + eyeSpacing} cy={eyeY} r="4" fill={colors.text} />
          </Animated.View>

          {/* Mouth */}
          <Path
            d={isRecording ? "M 35 65 Q 50 75 65 65" : "M 40 65 Q 50 65 60 65"}
            stroke={colors.text}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </Svg>

        {showHint && !isRecording && !isProcessing && (
          <View style={[styles.hintContainer, { backgroundColor: colors.surface }]}>
            <Mic size={16} color={colors.accent} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  hintContainer: {
    position: 'absolute',
    bottom: -5,
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EEE',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});
