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

import { Mic } from 'lucide-react-native';
import { speechService } from '@/services/speech';
import { MazoCharacter } from './MazoCharacter';
import { MazoConfig, MazoState } from '@/types';
import { getMazoConfigForCoach, STATE_COLORS } from '@/constants/mazo';
import Colors from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';

interface MazoButtonProps {
  onTranscription: (text: string) => void;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
  disabled?: boolean;
  size?: number;
  showHint?: boolean;
  coachId?: string;
  coachTone?: string;
  customConfig?: MazoConfig;
  externalState?: MazoState;
  showAccessory?: boolean;
}

export function MazoButton({
  onTranscription,
  onRecordingStart,
  onRecordingEnd,
  disabled = false,
  size = 120,
  showHint = true,
  coachId,
  coachTone,
  customConfig,
  externalState,
  showAccessory = true,
}: MazoButtonProps) {
  const { colors } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const ring3Anim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const micIconAnim = useRef(new Animated.Value(1)).current;

  const mazoConfig = customConfig || getMazoConfigForCoach(coachId || '', coachTone);

  const getState = (): MazoState => {
    if (externalState) return externalState;
    if (isProcessing) return 'thinking';
    if (isRecording) return 'listening';
    return 'idle';
  };

  const currentState = getState();
  const accentColor = STATE_COLORS[currentState] || mazoConfig.accentColor || colors.accent;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(micIconAnim, {
          toValue: 0.5,
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

  useEffect(() => {
    if (isRecording) {
      const createRingAnimation = (anim: Animated.Value, delay: number) => {
        const animate = () => {
          anim.setValue(0);
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start(() => {
            if (isRecording) {
              setTimeout(animate, 0);
            }
          });
        };
        setTimeout(animate, delay);
      };

      createRingAnimation(ring1Anim, 0);
      createRingAnimation(ring2Anim, 600);
      createRingAnimation(ring3Anim, 1200);
    } else {
      ring1Anim.setValue(0);
      ring2Anim.setValue(0);
      ring3Anim.setValue(0);
    }

    return () => {
      ring1Anim.stopAnimation();
      ring2Anim.stopAnimation();
      ring3Anim.stopAnimation();
    };
  }, [isRecording, ring1Anim, ring2Anim, ring3Anim]);

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

  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, {
      toValue: 0.94,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  }, [pressAnim]);

  const ringScale1 = ring1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });
  const ringOpacity1 = ring1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  const ringScale2 = ring2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.7],
  });
  const ringOpacity2 = ring2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  const ringScale3 = ring3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6],
  });
  const ringOpacity3 = ring3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });

  return (
    <View style={styles.container}>
      <View style={[styles.ringsContainer, { width: size, height: size }]}>
        <Animated.View style={[styles.ring, { borderColor: accentColor, transform: [{ scale: ringScale1 }], opacity: ringOpacity1 }]} />
        <Animated.View style={[styles.ring, { borderColor: accentColor, transform: [{ scale: ringScale2 }], opacity: ringOpacity2 }]} />
        <Animated.View style={[styles.ring, { borderColor: accentColor, transform: [{ scale: ringScale3 }], opacity: ringOpacity3 }]} />
      </View>

      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isProcessing}
        style={({ pressed }) => [
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: currentState === 'thinking' ? colors.backgroundSecondary : colors.surface,
            borderColor: accentColor,
            transform: [{ scale: pressAnim }],
          }
        ]}
      >
        <MazoCharacter
          config={mazoConfig}
          state={currentState}
          size={size * 0.75}
          showAccessory={showAccessory}
        />

        {showHint && !isRecording && !isProcessing && (
          <Animated.View style={[styles.micHint, { opacity: micIconAnim }]}>
            <Mic size={size * 0.18} color={accentColor} />
          </Animated.View>
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
    borderWidth: 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  ringsContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 1000,
    borderWidth: 1.5,
  },
  micHint: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#FFF',
    padding: 6,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  }
});
