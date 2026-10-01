/**
 * AlarmOverlay — Full-screen alarm dismissal UI.
 *
 * Shown when the user taps an alarm notification.
 * Plays the alarm sound on loop via expo-av,
 * shows the time, label, and a contextual greeting.
 * Allows dismiss or snooze (5 min).
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  Dimensions, Platform, Vibration,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import Colors from '@/constants/colors';
import { ALARM_SOUNDS } from '@/constants/alarm-sounds';
import { AlarmSoundId } from '@/types';
import { scheduleSnooze } from '@/services/alarms';

const colors = Colors;
const { width } = Dimensions.get('window');

interface AlarmOverlayProps {
  visible: boolean;
  label: string;
  hour: number;
  minute: number;
  soundId: AlarmSoundId;
  alarmId: string;
  onDismiss: () => void;
  onSnooze: () => void;
}

export function AlarmOverlay({
  visible, label, hour, minute, soundId, alarmId,
  onDismiss, onSnooze,
}: AlarmOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const [currentTime, setCurrentTime] = useState('');

  // ── Update live clock ──────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const now = new Date();
      const h = now.getHours() % 12 || 12;
      const m = now.getMinutes().toString().padStart(2, '0');
      const period = now.getHours() < 12 ? 'AM' : 'PM';
      setCurrentTime(`${h}:${m} ${period}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  // ── Play sound + animate on show ───────────────────
  useEffect(() => {
    if (visible) {
      // Fade in
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
      // Vibration pattern
      Vibration.vibrate([0, 500, 300, 500, 300, 500], true);
      // Play sound
      playAlarmSound();
    } else {
      stopAll();
    }

    return () => { stopAll(); };
  }, [visible]);

  const playAlarmSound = async () => {
    if (soundId === 'vibrate') return; // vibrate-only
    const entry = ALARM_SOUNDS.find(s => s.id === soundId);
    if (!entry?.asset) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        entry.asset,
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
    } catch (err) {
      if (__DEV__) console.warn('[AlarmOverlay] Sound failed:', err);
    }
  };

  const stopAll = useCallback(async () => {
    Vibration.cancel();
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch { /* ignore */ }
      soundRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(async () => {
    await stopAll();
    Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      onDismiss();
    });
  }, [onDismiss, stopAll]);

  const handleSnooze = useCallback(async () => {
    await stopAll();
    Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      onSnooze();
    });
  }, [onSnooze, stopAll]);

  const greeting = (() => {
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Time to wake up';
  })();

  const formattedAlarmTime = (() => {
    const h = hour % 12 || 12;
    const m = minute.toString().padStart(2, '0');
    const period = hour < 12 ? 'AM' : 'PM';
    return `${h}:${m} ${period}`;
  })();

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <BlurView intensity={100} style={StyleSheet.absoluteFill} tint="dark" />

      <View style={styles.content}>
        {/* Greeting */}
        <Text style={styles.greeting}>{greeting}</Text>

        {/* Live Clock */}
        <Text style={styles.timeDisplay}>{currentTime}</Text>

        {/* Alarm Label */}
        <View style={styles.labelPill}>
          <Text style={styles.labelText}>{label}</Text>
        </View>

        {/* Pulsing ring */}
        <Animated.View style={[styles.alarmRing, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.alarmRingInner}>
            <Text style={styles.alarmIcon}>
              {ALARM_SOUNDS.find(s => s.id === soundId)?.icon || '◉'}
            </Text>
          </View>
        </Animated.View>

        <Text style={styles.scheduledFor}>Alarm: {formattedAlarmTime}</Text>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, styles.snoozeBtn]}
            onPress={handleSnooze}
          >
            <Text style={styles.snoozeBtnText}>Snooze</Text>
            <Text style={styles.snoozeSub}>5 min</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.dismissBtn]}
            onPress={handleDismiss}
          >
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...(Platform.OS === 'web'
      ? { position: 'fixed' as any }
      : StyleSheet.absoluteFillObject),
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999999, elevation: 999999,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(8,8,16,0.6)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },

  greeting: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 18, fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  timeDisplay: {
    color: '#fff',
    fontSize: 72, fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginBottom: 16,
  },
  labelPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, marginBottom: 40,
  },
  labelText: {
    color: '#fff', fontSize: 17, fontWeight: '700',
  },

  alarmRing: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  alarmRingInner: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(108,92,231,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  alarmIcon: {
    fontSize: 36, color: colors.accent,
  },

  scheduledFor: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14, fontWeight: '500',
    marginBottom: 48,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snoozeBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  snoozeBtnText: {
    color: '#fff', fontSize: 17, fontWeight: '700',
  },
  snoozeSub: {
    color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500', marginTop: 2,
  },
  dismissBtn: {
    backgroundColor: colors.accent,
  },
  dismissBtnText: {
    color: '#fff', fontSize: 17, fontWeight: '700',
  },
});
