/**
 * AlarmCard — Visible alarm management card for the System/Journey tab.
 *
 * Looks like a real alarm app: large time display with toggle, day pills,
 * sound label, and delete button. Appears in the Journey tab so users
 * can see and manage their alarms without opening Settings.
 */

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Switch, Platform,
} from 'react-native';
import { Clock, Trash2, BellRing } from 'lucide-react-native';
import { Alarm } from '@/types';
import { ALARM_SOUNDS } from '@/constants/alarm-sounds';
import { useTranslation } from '@/hooks/useTranslation';

interface AlarmCardProps {
  alarms: Alarm[];
  colors: any;
  onToggle: (alarmId: string, enabled: boolean) => void;
  onDelete: (alarmId: string) => void;
}

function formatTime(hour?: number, minute?: number): { time: string; period: string } {
  const safeH = typeof hour === 'number' && !isNaN(hour) ? hour : 0;
  const safeM = typeof minute === 'number' && !isNaN(minute) ? minute : 0;
  const h = safeH % 12 || 12;
  const m = safeM.toString().padStart(2, '0');
  const period = safeH < 12 ? 'AM' : 'PM';
  return { time: `${h}:${m}`, period };
}

function getNextAlarmText(alarm: Alarm, t: any): string {
  if (!alarm || !alarm.enabled) return t('alarms.disabled');
  const safeH = typeof alarm.hour === 'number' && !isNaN(alarm.hour) ? alarm.hour : 0;
  const safeM = typeof alarm.minute === 'number' && !isNaN(alarm.minute) ? alarm.minute : 0;
  const days = Array.isArray(alarm.days) ? alarm.days : typeof alarm.days === 'number' ? [0, 1, 2, 3, 4, 5, 6] : [];
  
  const now = new Date();
  const target = new Date();
  target.setHours(safeH, safeM, 0, 0);

  if (days.length === 0) {
    // One-time
    if (target <= now) target.setDate(target.getDate() + 1);
    const diff = target.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return t('alarms.inDays', { count: Math.floor(hours / 24).toString() });
    if (hours > 0) return t('alarms.inHoursMins', { hours: hours.toString(), minutes: minutes.toString() });
    return t('alarms.inMins', { minutes: minutes.toString() });
  }

  // Recurring — find next day
  const today = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const alarmMinutes = safeH * 60 + safeM;
  const sorted = [...days].sort((a, b) => a - b);

  for (const d of sorted) {
    if (d > today || (d === today && alarmMinutes > currentMinutes)) {
      const daysUntil = (d - today + 7) % 7 || (d === today ? 0 : 7);
      if (daysUntil === 0) {
        const diff = alarmMinutes - currentMinutes;
        const hours = Math.floor(diff / 60);
        return hours > 0 ? t('alarms.inHoursMins', { hours: hours.toString(), minutes: (diff % 60).toString() }) : t('alarms.inMins', { minutes: diff.toString() });
      }
      return daysUntil === 1 ? t('alarms.tomorrow') : t('alarms.inDays', { count: daysUntil.toString() });
    }
  }
  // Wrap around to next week
  const nextDay = sorted[0] ?? 0;
  const daysUntil = (nextDay - today + 7) % 7 || 7;
  return daysUntil === 1 ? t('alarms.tomorrow') : t('alarms.inDays', { count: daysUntil.toString() });
}

export function AlarmCard({ alarms, colors, onToggle, onDelete }: AlarmCardProps) {
  const { t } = useTranslation();

  if (!alarms || alarms.length === 0) return null;

  return (
    <View style={[styles.card, { borderColor: colors.borderLight }]}>
      {/* Header */}
      <View style={styles.header}>
        <BellRing size={18} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>{t('alarms.title')}</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.countText, { color: colors.textTertiary }]}>
            {alarms.filter(a => a.enabled).length}/{alarms.length}
          </Text>
        </View>
      </View>

      {/* Alarm Items */}
      {alarms.map((alarm, idx) => {
        const { time, period } = formatTime(alarm.hour, alarm.minute);
        const soundEntry = ALARM_SOUNDS.find(s => s.id === alarm.soundId);
        const soundLabel = soundEntry ? t(soundEntry.labelKey) : t('alarm.sound');
        const nextText = getNextAlarmText(alarm, t);

        return (
          <View
            key={alarm.id}
            style={[
              styles.alarmRow,
              { backgroundColor: colors.backgroundSecondary },
              !alarm.enabled && { opacity: 0.45 },
            ]}
          >
            {/* Left: Time + Info */}
            <View style={styles.alarmLeft}>
              <View style={styles.timeRow}>
                <Text style={[styles.timeText, { color: colors.text }]}>{time}</Text>
                <Text style={[styles.periodText, { color: colors.textSecondary }]}>{period}</Text>
              </View>
              <Text style={[styles.labelText, { color: colors.text }]}>{alarm.label}</Text>

              {/* Day dots */}
              <View style={styles.dayRow}>
                {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                  const daysList = Array.isArray(alarm?.days) ? alarm.days : typeof alarm?.days === 'number' ? [0, 1, 2, 3, 4, 5, 6] : [];
                  const isActive = daysList.includes(dayIdx);
                  const lbl = t(`alarms.dayLabels.${dayIdx}`);
                  return (
                    <View
                      key={dayIdx}
                      style={[
                        styles.dayDot,
                        isActive && { backgroundColor: colors.accent },
                        !isActive && { backgroundColor: colors.border },
                      ]}
                    >
                      <Text style={[
                        styles.dayDotText,
                        isActive && { color: '#fff' },
                        !isActive && { color: colors.textTertiary },
                      ]}>{lbl}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>{soundLabel}</Text>
                <Text style={[styles.metaDot, { color: colors.textTertiary }]}>·</Text>
                <Text style={[styles.metaText, { color: alarm.enabled ? colors.accent : colors.textTertiary }]}>{nextText}</Text>
              </View>
            </View>

            {/* Right: Toggle + Delete */}
            <View style={styles.alarmRight}>
              <Switch
                value={alarm.enabled}
                onValueChange={(v) => onToggle(alarm.id, v)}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFF"
              />
              <Pressable
                style={styles.deleteBtn}
                onPress={() => onDelete(alarm.id)}
                hitSlop={8}
              >
                <Trash2 size={14} color={colors.textTertiary} />
              </Pressable>
            </View>
          </View>
        );
      })}

      {/* Footer hint */}
      <View style={styles.footer}>
        <Clock size={12} color={colors.textTertiary} />
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          {t('alarms.footerHint')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },

  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  alarmLeft: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  timeText: {
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 38,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
  },
  labelText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  dayDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayDotText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 10,
  },

  alarmRight: {
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
  },
  deleteBtn: {
    padding: 4,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 4,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

