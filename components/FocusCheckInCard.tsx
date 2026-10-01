import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { focusCheckInOptions, type FocusCheckIn } from '@/services/focusCheckIn';

export function FocusCheckInCard({ checkIn, onReply, onSkip }: {
  checkIn: FocusCheckIn;
  onReply: (text: string) => void;
  onSkip: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Sparkles size={16} color={colors.accent} />
        <Text style={[styles.title, { color: colors.accent }]}>
          {checkIn.stage === 'reflection' ? 'A quick check-in' : 'Make it specific'}
        </Text>
      </View>
      <View style={styles.options}>
        {focusCheckInOptions(checkIn).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => onReply(option)}
            style={({ pressed }) => [styles.option, { backgroundColor: colors.accentLight, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>Or tell me in your own words.</Text>
        <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.skip, { color: colors.textTertiary }]}>Keep my original step</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 8, marginBottom: 12, padding: 14, borderWidth: 1, borderRadius: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  title: { fontSize: 13, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 10 },
  optionText: { fontSize: 13, fontWeight: '600' },
  footer: { gap: 10, marginTop: 12 },
  hint: { fontSize: 12 },
  skip: { fontSize: 12 },
});
