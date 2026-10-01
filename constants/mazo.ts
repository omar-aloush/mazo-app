import { MazoConfig, MazoEyeStyle, MazoMouthStyle, MazoAccessory } from '@/types';

export interface CoachMazoConfig extends MazoConfig {
  coachId: string;
  toneBased: boolean;
}

export const COACH_MAZO_CONFIGS: Record<string, MazoConfig> = {
  clarifier: {
    eyeStyle: 'neutral',
    mouthStyle: 'calm',
    accessory: 'none',
    accentColor: '#6366F1',
  },
  strategist: {
    eyeStyle: 'focused',
    mouthStyle: 'neutral',
    accessory: 'visor',
    accentColor: '#3B82F6',
  },
  reflector: {
    eyeStyle: 'soft',
    mouthStyle: 'calm',
    accessory: 'none',
    accentColor: '#8B5CF6',
  },
  energizer: {
    eyeStyle: 'soft',
    mouthStyle: 'slight_smile',
    accessory: 'cap',
    accentColor: '#F59E0B',
  },
  sage: {
    eyeStyle: 'closed',
    mouthStyle: 'calm',
    accessory: 'glasses',
    accentColor: '#10B981',
  },
};

export const TONE_MAZO_CONFIGS: Record<string, MazoConfig> = {
  calm: {
    eyeStyle: 'neutral',
    mouthStyle: 'calm',
    accessory: 'none',
  },
  direct: {
    eyeStyle: 'focused',
    mouthStyle: 'neutral',
    accessory: 'visor',
  },
  warm: {
    eyeStyle: 'soft',
    mouthStyle: 'slight_smile',
    accessory: 'none',
  },
  wise: {
    eyeStyle: 'closed',
    mouthStyle: 'calm',
    accessory: 'glasses',
  },
  reflective: {
    eyeStyle: 'soft',
    mouthStyle: 'calm',
    accessory: 'none',
  },
};

export const EYE_STYLE_OPTIONS: { id: MazoEyeStyle; label: string }[] = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'focused', label: 'Focused' },
  { id: 'soft', label: 'Soft' },
];

export const MOUTH_STYLE_OPTIONS: { id: MazoMouthStyle; label: string }[] = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'slight_smile', label: 'Gentle' },
  { id: 'calm', label: 'Calm' },
  { id: 'strong', label: 'Strong' },
];

export const ACCESSORY_OPTIONS: { id: MazoAccessory; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'cap', label: 'Cap' },
  { id: 'visor', label: 'Visor' },
  { id: 'glasses', label: 'Glasses' },
];

export const getMazoConfigForCoach = (coachId: string, tone?: string): MazoConfig => {
  if (COACH_MAZO_CONFIGS[coachId]) {
    return COACH_MAZO_CONFIGS[coachId];
  }

  if (tone && TONE_MAZO_CONFIGS[tone]) {
    return TONE_MAZO_CONFIGS[tone];
  }

  return {
    eyeStyle: 'neutral',
    mouthStyle: 'slight_smile',
    accessory: 'none',
  };
};

export const STATE_COLORS: Record<string, string> = {
  idle: '#3D3D3D',
  listening: '#E85A5A',
  thinking: '#5A8AE8',
  responding: '#5AE88A',
  memory_save: '#E8B85A',
  plan_ready: '#8A5AE8',
  happy: '#5AE8D4',
  empathetic: '#E85A8A',    // Warm pink for supportive moments
  encouraging: '#E8A85A',   // Energetic orange for motivation
  celebrating: '#FFD700',   // Gold for wins and achievements
};

export const STATE_GRADIENT_COLORS: Record<string, { light: string; mid: string; dark: string }> = {
  idle: { light: '#FFFFFF', mid: '#F8F6F4', dark: '#E8E4E0' },
  listening: { light: '#FFFFFF', mid: '#FFF5F5', dark: '#FFE8E8' },
  thinking: { light: '#FFFFFF', mid: '#F5F8FF', dark: '#E8F0FF' },
  responding: { light: '#FFFFFF', mid: '#F5FFF8', dark: '#E8FFE8' },
  memory_save: { light: '#FFFFFF', mid: '#FFFAF5', dark: '#FFF5E8' },
  plan_ready: { light: '#FFFFFF', mid: '#F8F5FF', dark: '#F0E8FF' },
  happy: { light: '#FFFFFF', mid: '#F5FFFD', dark: '#E8FFF8' },
  empathetic: { light: '#FFFFFF', mid: '#FFF5F8', dark: '#FFE8F0' },
  encouraging: { light: '#FFFFFF', mid: '#FFFAF5', dark: '#FFE8D0' },
  celebrating: { light: '#FFFFFF', mid: '#FFFDF5', dark: '#FFF5D0' },
};

