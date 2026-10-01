/**
 * NorthStarCard — Compact long-term goal banner for Journey page.
 * 
 * Ultra-slim design: icon + goal title in one row, with a tiny prompt line.
 * Keeps the goal visible without dominating the page.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Target, ChevronRight } from 'lucide-react-native';
import { Goal } from '@/types';

interface NorthStarCardProps {
  goals: Goal[];
  colors: any;
  isDark: boolean;
  onGoalPress?: (goal: Goal) => void;
}

const DAILY_PROMPTS = [
  'What did you do today to move toward this?',
  'How does today\'s work connect to this goal?',
  'One small step today gets you closer.',
  'Keep this in mind with every decision.',
  'What\'s the next action that moves the needle?',
  'Progress is invisible until it\'s not.',
];

export function NorthStarCard({ goals, colors, isDark, onGoalPress }: NorthStarCardProps) {
  const longTermGoals = goals
    .filter(g => g.type === 'long-term' && g.status === 'active')
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  if (longTermGoals.length === 0) return null;

  const northStar = longTermGoals[0];
  const dayOfYear = Math.floor(Date.now() / 86400000);
  const prompt = DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length];

  return (
    <Pressable
      onPress={() => onGoalPress?.(northStar)}
      style={({ pressed }) => [st.container, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
    >
      <LinearGradient
        colors={isDark
          ? ['rgba(108,92,231,0.2)', 'rgba(108,92,231,0.06)']
          : ['rgba(108,92,231,0.12)', 'rgba(108,92,231,0.03)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.gradient}
      >
        {/* Single row: icon + label + title + chevron */}
        <View style={st.row}>
          <View style={[st.icon, { backgroundColor: colors.accent + '18' }]}>
            <Target size={14} color={colors.accent} />
          </View>
          <View style={st.textWrap}>
            <Text style={[st.label, { color: colors.accent }]}>NORTH STAR</Text>
            <Text style={[st.title, { color: colors.text }]} numberOfLines={1}>
              {northStar.title}
            </Text>
          </View>
          <ChevronRight size={16} color={colors.textTertiary} />
        </View>

        {/* Tiny prompt line */}
        <Text style={[st.prompt, { color: colors.accent }]} numberOfLines={1}>
          {prompt}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const st = StyleSheet.create({
  container: { marginBottom: 12 },
  gradient: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  prompt: {
    fontSize: 11,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 6,
    marginLeft: 38, // align with text (28 icon + 10 gap)
    opacity: 0.8,
  },
});
