import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { X } from 'lucide-react-native';

interface InlineQuickAnswersProps {
  question: string;
  options: string[];
  onSelect: (answer: string) => void;
  onDismiss: () => void;
}

export const InlineQuickAnswers: React.FC<InlineQuickAnswersProps> = ({
  question,
  options,
  onSelect,
  onDismiss,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [selectedChip, setSelectedChip] = useState<string | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSelect = useCallback((answer: string) => {
    setSelectedChip(answer);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onSelect(answer);
    });
  }, [onSelect, fadeAnim]);

  const handleDismiss = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  }, [onDismiss, fadeAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Pressable style={styles.dismissButton} onPress={handleDismiss}>
        <X size={16} color="#9B9B9B" />
      </Pressable>
      <Text style={styles.question}>{question}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        {options.map((option) => {
          const isSelected = selectedChip === option;
          return (
            <Pressable key={option} onPress={() => handleSelect(option)}>
              <View
                style={[
                  styles.chip,
                  isSelected && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 1,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  question: {
    fontSize: 15,
    color: '#6B6B6B',
    marginBottom: 8,
    paddingRight: 24,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F4F2',
    borderWidth: 1,
    borderColor: '#E8E8E6',
  },
  chipSelected: {
    backgroundColor: '#7C9A82',
    borderColor: '#7C9A82',
  },
  chipText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
});
