import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AIQuestion } from '@/types';
import Colors from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';

interface QuestionsModeProps {
  questions: AIQuestion[];
  currentIndex: number;
  onAnswer: (questionId: string, optionId: string) => void;
  onBack: () => void;
  onComplete: () => void;
}

function AIFaceSmall() {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blinkLoop = () => {
      const delay = 2500 + Math.random() * 2500;
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

  return (
    <View style={styles.aiFaceContainer}>
      <View style={styles.aiFace}>
        <View style={styles.eyesRow}>
          <Animated.View style={[styles.eyeCurve, { transform: [{ scaleY: blinkAnim }] }]}>
            <View style={styles.eyeCurveInner} />
          </Animated.View>
          <Animated.View style={[styles.eyeCurve, { transform: [{ scaleY: blinkAnim }] }]}>
            <View style={styles.eyeCurveInner} />
          </Animated.View>
        </View>
        <View style={styles.smileCurve}>
          <View style={styles.smileCurveInner} />
        </View>
      </View>
    </View>
  );
}

export function QuestionsMode({
  questions,
  currentIndex,
  onAnswer,
  onBack,
  onComplete,
}: QuestionsModeProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex, fadeAnim, slideAnim]);

  const handleOptionPress = (optionId: string) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onAnswer(currentQuestion.id, optionId);
      if (isLastQuestion) {
        onComplete();
      }
    });
  };

  if (!currentQuestion) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart || '#F8F6F4', colors.gradientMid || '#F2EDE8', colors.background]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={12}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <View style={styles.progressContainer}>
          {questions.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.progressDot,
                idx === currentIndex && [styles.progressDotActive, { backgroundColor: colors.accent }],
                idx < currentIndex && [styles.progressDotCompleted, { backgroundColor: colors.accent }],
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.questionSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.questionBubbleRow}>
            <AIFaceSmall />
            <View style={styles.speechBubble}>
              <Text style={[styles.questionText, { color: colors.text }]}>{currentQuestion.question}</Text>
              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{currentQuestion.description}</Text>
              <View style={styles.bubbleTail} />
            </View>
          </View>

          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.optionCard,
                  pressed && styles.optionCardPressed,
                ]}
                onPress={() => handleOptionPress(option.id)}
              >
                <Animated.View
                  style={{
                    opacity: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                    transform: [
                      {
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 30],
                          outputRange: [0, 20 + index * 10],
                        }),
                      },
                    ],
                  }}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>{option.text}</Text>
                </Animated.View>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F4',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingRight: 44,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  progressDotActive: {
    backgroundColor: Colors.accent,
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: Colors.accent,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  questionSection: {
    flex: 1,
  },
  questionBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
    marginLeft: -10,
  },
  aiFaceContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginTop: 8,
  },
  aiFace: {
    alignItems: 'center',
  },
  eyesRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 6,
  },
  eyeCurve: {
    width: 12,
    height: 8,
    overflow: 'hidden',
  },
  eyeCurveInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: '#4A4A4A',
    marginTop: -6,
  },
  smileCurve: {
    width: 20,
    height: 10,
    overflow: 'hidden',
  },
  smileCurveInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#4A4A4A',
    borderTopColor: 'transparent',
    marginTop: -10,
  },
  speechBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    padding: 20,
    marginLeft: 12,
    position: 'relative',
  },
  bubbleTail: {
    position: 'absolute',
    left: -8,
    top: 24,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'rgba(255,255,255,0.7)',
  },
  questionText: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 32,
  },
  descriptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  optionCardPressed: {
    backgroundColor: '#F5F3F0',
    transform: [{ scale: 0.98 }],
  },
  optionText: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
  },
});
