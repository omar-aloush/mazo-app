import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, AppState, AppStateStatus, Dimensions, Vibration, Platform, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { sendFocusBreakNotification } from '@/services/notifications';
import { speakBreak, speakWorkResume, speakSessionDone, stopSpeaking } from '@/services/mazoVoice';
import Svg, { Circle } from 'react-native-svg';
import Colors from '@/constants/colors';
import { AMBIENT_SOUNDS, AmbientSoundId } from '@/constants/ambient-sounds';
import { FocusTechnique } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

const colors = Colors;
const { width } = Dimensions.get('window');

// Ring sizing
const RING_SIZE = Math.min(width * 0.65, 300);
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = RING_RADIUS * 2 * Math.PI;

interface FocusModeOverlayProps {
  visible: boolean;
  durationMinutes: number;
  taskName: string;
  technique: FocusTechnique;
  onComplete: (success: boolean, rating?: 'great' | 'okay' | 'hard') => void;
  onCancel?: () => void;
}

const QUOTES = [
  'Stay with it. You are building momentum.',
  'One focused minute is worth ten distracted ones.',
  'Deep work compounds over time. Keep going.',
  'Small consistent effort beats big sporadic bursts.',
  'You chose to focus. That decision is already a win.',
  'The hardest part was starting. You are past it.',
  'Clarity comes from sustained attention.',
  'Progress is invisible until it is not.',
];

type Phase = 'idle' | 'work' | 'break' | 'done';

export function FocusModeOverlay({ visible, durationMinutes, taskName, technique, onComplete, onCancel }: FocusModeOverlayProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [milestone, setMilestone] = useState('');
  const [selectedSound, setSelectedSound] = useState<AmbientSoundId>('none');
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const safeMinutes = typeof durationMinutes === 'number' && !isNaN(durationMinutes) && durationMinutes > 0 ? durationMinutes : 25;
  const totalWorkSeconds = safeMinutes * 60;
  const breakSeconds = technique === 'pomodoro' ? 5 * 60 : 0;

  const appState = useRef(AppState.currentState);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const milestoneOpacity = useRef(new Animated.Value(0)).current;
  const notificationId = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseEndsAtRef = useRef<number | null>(null);

  // Milestone flags — reset each session
  const m25 = useRef(false);
  const m50 = useRef(false);
  const m75 = useRef(false);

  // ── Start / Stop lifecycle ─────────────────────────
  useEffect(() => {
    if (visible && phase === 'idle') {
      // FRESH START: set timer and enter work phase
      const secs = safeMinutes * 60;
      if (secs <= 0) return; // guard: don't start with 0
      phaseEndsAtRef.current = Date.now() + secs * 1000;
      setTimeLeft(secs);
      setPhase('work');
      m25.current = false;
      m50.current = false;
      m75.current = false;
      setQuoteIdx(0);
      setMilestone('');

      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, { toValue: 1.03, duration: 3000, useNativeDriver: true }),
          Animated.timing(breatheAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        ])
      ).start();
      Vibration.vibrate();
    }

    if (!visible && phase !== 'idle') {
      // Reset when hidden
      setPhase('idle');
      setTimeLeft(0);
      phaseEndsAtRef.current = null;
      stopSound();
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [visible]);

  // ── Audio lifecycle ────────────────────────────────
  const stopSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch { /* ignore */ }
      soundRef.current = null;
    }
  }, []);

  const playSound = useCallback(async (soundId: AmbientSoundId) => {
    await stopSound();
    if (soundId === 'none') return;
    const entry = AMBIENT_SOUNDS.find(s => s.id === soundId);
    if (!entry?.asset) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        entry.asset,
        { shouldPlay: true, isLooping: true, volume: 0.6 }
      );
      soundRef.current = sound;
    } catch (err) {
      if (__DEV__) console.warn('Ambient sound load failed:', err);
    }
  }, [stopSound]);

  // Auto-play when user selects a sound during active session
  useEffect(() => {
    if ((phase === 'work' || phase === 'break') && selectedSound !== 'none') {
      playSound(selectedSound);
    } else {
      stopSound();
    }
  }, [selectedSound, phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopSound(); };
  }, []);

  // ── Countdown tick ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'work' && phase !== 'break') return;
    if (timeLeft <= 0) return;

    intervalRef.current = setInterval(() => {
      const remaining = phaseEndsAtRef.current == null
        ? 0
        : Math.max(0, Math.ceil((phaseEndsAtRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && intervalRef.current) clearInterval(intervalRef.current);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase]);

  // ── Phase transitions when timeLeft hits 0 ─────────
  useEffect(() => {
    if (timeLeft !== 0) return;
    if (phase === 'idle' || phase === 'done') return;

    if (phase === 'work' && technique === 'pomodoro' && breakSeconds > 0) {
      // Switch to break
      Vibration.vibrate([0, 400, 200, 400]);
      phaseEndsAtRef.current = Date.now() + breakSeconds * 1000;
      setPhase('break');
      setTimeLeft(breakSeconds);
      // Send break notification (shows even when app is backgrounded)
      sendFocusBreakNotification(taskName, Math.ceil(breakSeconds / 60)).catch(() => {});
      // 🎤 Mazō speaks: "Great work! Time for a break."
      speakBreak().catch(() => {});
    } else if (phase === 'work' || phase === 'break') {
      // Session complete
      phaseEndsAtRef.current = null;
      Vibration.vibrate([0, 300, 150, 300, 150, 300]);
      setPhase('done');
      // 🎤 Mazō speaks: "Session complete! Amazing work."
      speakSessionDone().catch(() => {});
    }
  }, [timeLeft, phase]);

  // ── Milestones (only during work phase) ────────────
  useEffect(() => {
    if (phase !== 'work' || totalWorkSeconds <= 0) return;
    const elapsed = totalWorkSeconds - timeLeft;
    const pct = elapsed / totalWorkSeconds;

    if (!m25.current && pct >= 0.25) {
      m25.current = true;
      showMilestone('Great start. Keep going.');
    } else if (!m50.current && pct >= 0.5) {
      m50.current = true;
      showMilestone('Halfway there. You are in the zone.');
    } else if (!m75.current && pct >= 0.75) {
      m75.current = true;
      showMilestone('Almost done. Finish strong.');
    }

    // Rotate quotes every 5 minutes
    if (timeLeft > 0 && timeLeft % 300 === 0 && elapsed > 0) {
      setQuoteIdx(i => (i + 1) % QUOTES.length);
    }
  }, [timeLeft, phase]);

  const showMilestone = (msg: string) => {
    setMilestone(msg);
    Vibration.vibrate(40);
    Animated.sequence([
      Animated.timing(milestoneOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(milestoneOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setMilestone(''));
  };

  // ── AppState accountability ────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => { sub.remove(); cancelNotif(); };
  }, [timeLeft, phase]);

  const handleAppStateChange = async (next: AppStateStatus) => {
    if (phase !== 'work' && phase !== 'break') return;
    if (appState.current.match(/active/) && next === 'background') {
      if (Platform.OS !== 'web') {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Stay Focused',
            body: `You have ${Math.ceil(timeLeft / 60)} minutes left on: ${taskName}`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: null,
        });
        notificationId.current = id;
      }
    } else if (appState.current.match(/inactive|background/) && next === 'active') {
      cancelNotif();
      if (phaseEndsAtRef.current != null) {
        setTimeLeft(Math.max(0, Math.ceil((phaseEndsAtRef.current - Date.now()) / 1000)));
      }
    }
    appState.current = next;
  };

  const cancelNotif = async () => {
    if (Platform.OS !== 'web' && notificationId.current) {
      await Notifications.cancelScheduledNotificationAsync(notificationId.current);
      notificationId.current = null;
    }
  };

  // ── Dismiss handler ────────────────────────────────
  const dismiss = useCallback((success: boolean, rating?: 'great' | 'okay' | 'hard') => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setPhase('idle');
      setTimeLeft(0);
      phaseEndsAtRef.current = null;
      onComplete(success, rating);
    });
  }, [onComplete]);

  // ── Helpers ────────────────────────────────────────
  const fmt = (s: number) => {
    const safeS = typeof s === 'number' && !isNaN(s) && s >= 0 ? s : 0;
    const m = Math.floor(safeS / 60);
    const sec = safeS % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = (() => {
    const total = phase === 'work' ? totalWorkSeconds : breakSeconds;
    if (total <= 0) return 0;
    return 1 - timeLeft / total;
  })();

  const ringOffset = RING_CIRCUMFERENCE * (1 - progress);
  const ringColor = phase === 'work' ? colors.accent : '#2ecc71';

  if (!visible || phase === 'idle') return null;

  // ── DONE / CELEBRATION SCREEN ──────────────────────
  if (phase === 'done') {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <BlurView intensity={100} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={styles.content}>
          <Text style={styles.doneIcon}>✓</Text>
          <Text style={styles.doneTitle}>Session Complete</Text>
          <Text style={styles.doneSub}>
            {durationMinutes} minutes focused on "{taskName}"
          </Text>

          <View style={styles.reflectionCard}>
            <Text style={styles.reflectionTitle}>How did this session feel?</Text>
            <View style={styles.ratingRow}>
              <Pressable style={styles.ratingBtn} onPress={() => dismiss(true, 'great')}>
                <View style={[styles.ratingDot, { backgroundColor: '#2ecc71' }]} />
                <Text style={styles.ratingLabel}>Great</Text>
              </Pressable>
              <Pressable style={styles.ratingBtn} onPress={() => dismiss(true, 'okay')}>
                <View style={[styles.ratingDot, { backgroundColor: '#f39c12' }]} />
                <Text style={styles.ratingLabel}>Okay</Text>
              </Pressable>
              <Pressable style={styles.ratingBtn} onPress={() => dismiss(true, 'hard')}>
                <View style={[styles.ratingDot, { backgroundColor: '#e74c3c' }]} />
                <Text style={styles.ratingLabel}>Hard</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ── ACTIVE TIMER SCREEN ────────────────────────────
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <BlurView intensity={100} style={StyleSheet.absoluteFill} tint="dark" />

      <View style={styles.content}>
        <Animated.View style={[styles.avatarCircle, { transform: [{ scale: breatheAnim }] }]}>
          <Text style={styles.avatarGlyph}>{phase === 'work' ? '◉' : '○'}</Text>
        </Animated.View>

        <View style={styles.phasePill}>
          <Text style={styles.phasePillText}>
            {phase === 'work' ? 'FOCUSING' : 'BREAK'}
          </Text>
        </View>

        <Text style={styles.taskLabel}>{taskName}</Text>

        {/* ── Circular Progress Ring ── */}
        <View style={styles.ringWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            {/* Background track */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {/* Foreground progress */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={ringColor}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${RING_CIRCUMFERENCE}`}
              strokeDashoffset={`${ringOffset}`}
              strokeLinecap="round"
              rotation="-90"
              originX={RING_SIZE / 2}
              originY={RING_SIZE / 2}
            />
          </Svg>
          <View style={styles.timeOverlay}>
            <Text style={styles.timeText}>{fmt(timeLeft)}</Text>
            <Text style={styles.timePhaseLabel}>
              {phase === 'work' ? 'remaining' : 'break'}
            </Text>
          </View>
        </View>

        <Text style={styles.quoteText}>{QUOTES[quoteIdx]}</Text>

        {/* ── Ambient Sound Picker ── */}
        <Pressable
          style={styles.soundToggle}
          onPress={() => setShowSoundPicker(prev => !prev)}
        >
          <Text style={styles.soundToggleIcon}>
            {selectedSound === 'none' ? '♪' : AMBIENT_SOUNDS.find(s => s.id === selectedSound)?.icon || '♪'}
          </Text>
          <Text style={styles.soundToggleLabel}>
            {selectedSound === 'none' ? t('focus.ambient.addSound') : (() => { const entry = AMBIENT_SOUNDS.find(s => s.id === selectedSound); return entry ? t(entry.labelKey) : t('focus.ambient.addSound'); })()}
          </Text>
        </Pressable>

        {showSoundPicker && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.soundRow}
            contentContainerStyle={styles.soundRowContent}
          >
            {AMBIENT_SOUNDS.map(s => (
              <Pressable
                key={s.id}
                style={[
                  styles.soundPill,
                  selectedSound === s.id && styles.soundPillActive,
                ]}
                onPress={() => {
                  setSelectedSound(s.id);
                  if (s.id === 'none') setShowSoundPicker(false);
                }}
              >
                <Text style={[
                  styles.soundPillIcon,
                  selectedSound === s.id && styles.soundPillTextActive,
                ]}>{s.icon}</Text>
                <Text style={[
                  styles.soundPillLabel,
                  selectedSound === s.id && styles.soundPillTextActive,
                ]}>{t(s.labelKey)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Pressable
          style={styles.endBtn}
          onPress={() => {
            if (onCancel) onCancel();
            dismiss(false);
          }}
        >
          <Text style={styles.endBtnText}>End Session</Text>
        </Pressable>
      </View>

      {/* ── Milestone Toast ── */}
      {milestone !== '' && (
        <Animated.View style={[styles.toastBar, { opacity: milestoneOpacity }]}>
          <Text style={styles.toastText}>{milestone}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    ...(Platform.OS === 'web'
      ? { position: 'fixed' as any }
      : StyleSheet.absoluteFillObject),
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99999, elevation: 99999,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(8,8,12,0.5)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    width: '100%',
  },

  // ── Avatar ──
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarGlyph: { fontSize: 28, color: colors.accent },

  // ── Phase pill ──
  phasePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 14, marginBottom: 8,
  },
  phasePillText: {
    color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 2.5,
  },

  taskLabel: {
    color: '#fff', fontSize: 22, fontWeight: '700',
    textAlign: 'center', marginBottom: 32, opacity: 0.92,
  },

  // ── Ring ──
  ringWrap: {
    width: RING_SIZE, height: RING_SIZE,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
  },
  timeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  timeText: {
    color: '#fff', fontSize: 54, fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timePhaseLabel: {
    color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600',
    marginTop: 2,
  },

  quoteText: {
    color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500',
    textAlign: 'center', marginBottom: 40, paddingHorizontal: 16,
    lineHeight: 22,
  },

  endBtn: {
    paddingVertical: 12, paddingHorizontal: 28,
    borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  endBtnText: {
    color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600',
  },

  // ── Done screen ──
  doneIcon: {
    fontSize: 64, color: '#2ecc71', marginBottom: 16, fontWeight: '700',
  },
  doneTitle: {
    fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8,
  },
  doneSub: {
    fontSize: 15, color: 'rgba(255,255,255,0.6)',
    textAlign: 'center', marginBottom: 36,
  },

  reflectionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20, padding: 24, width: '100%',
    alignItems: 'center',
  },
  reflectionTitle: {
    color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 20,
  },
  ratingRow: {
    flexDirection: 'row', justifyContent: 'space-around', width: '100%',
  },
  ratingBtn: {
    alignItems: 'center', padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, flex: 1, marginHorizontal: 4,
  },
  ratingDot: {
    width: 12, height: 12, borderRadius: 6, marginBottom: 8,
  },
  ratingLabel: {
    color: '#fff', fontSize: 14, fontWeight: '600',
  },

  // ── Toast ──
  toastBar: {
    position: 'absolute', bottom: 60,
    backgroundColor: colors.accent,
    paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  toastText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Sound Picker ──
  soundToggle: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginBottom: 12,
    gap: 6,
  },
  soundToggleIcon: { color: colors.accent, fontSize: 16 },
  soundToggleLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  soundRow: { maxHeight: 50, marginBottom: 20 },
  soundRowContent: { gap: 8, paddingHorizontal: 4 },
  soundPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, gap: 5,
    borderWidth: 1, borderColor: 'transparent',
  },
  soundPillActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(108,92,231,0.15)',
  },
  soundPillIcon: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  soundPillLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  soundPillTextActive: { color: colors.accent },
});
