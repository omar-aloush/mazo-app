/**
 * AlarmSettingsSection — Professional alarm management for Settings.
 *
 * Features:
 * - Large time display with ▲/▼ controls
 * - Day repeat selector with filled circles
 * - Vertical sound list with radio selection + tap to preview
 * - "Browse Device" to pick custom audio from phone storage
 * - Clean card-based UI matching app design language
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Switch, TextInput, Alert,
  ScrollView, Modal, Vibration,
} from 'react-native';
import { Plus, Trash2, Volume2, Bell, X, Music, Check, ChevronRight, Upload } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALARM_SOUNDS } from '@/constants/alarm-sounds';
import { Alarm, AlarmSoundId } from '@/types';
import { formatAlarmTime, scheduleAlarm, cancelAlarm } from '@/services/alarms';
import { useTranslation } from '@/hooks/useTranslation';

interface Props {
  alarms: Alarm[];
  colors: any;
  isDark: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Alarm>) => void;
  addAlarm: (alarm: any) => void;
}

// Custom sounds stored in AsyncStorage
const CUSTOM_SOUNDS_KEY = 'mazo_custom_alarm_sounds';

interface CustomSound {
  id: string;
  label: string;
  uri: string;
}

async function getCustomSounds(): Promise<CustomSound[]> {
  try {
    const stored = await AsyncStorage.getItem(CUSTOM_SOUNDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

async function saveCustomSound(sound: CustomSound): Promise<void> {
  const existing = await getCustomSounds();
  existing.push(sound);
  await AsyncStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(existing));
}

/** Translated version of formatAlarmDays */
function formatAlarmDaysI18n(rawDays: any, t: (key: string) => string): string {
  const days = Array.isArray(rawDays) ? rawDays : typeof rawDays === 'number' ? [0, 1, 2, 3, 4, 5, 6] : [];
  if (days.length === 0) return t('alarm.ringsOnce');
  if (days.length === 7) return t('alarm.everyDay');
  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];
  if (days.length === 5 && weekdays.every(d => days.includes(d))) return t('alarm.weekdays');
  if (days.length === 2 && weekend.every(d => days.includes(d))) return t('alarm.weekends');
  const dayKeys = ['alarm.sun', 'alarm.mon', 'alarm.tue', 'alarm.wed', 'alarm.thu', 'alarm.fri', 'alarm.sat'];
  return days.map(d => t(dayKeys[d])).join(', ');
}

export function AlarmSettingsSection({ alarms, colors, isDark, onDelete, onUpdate, addAlarm }: Props) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [soundPickerFor, setSoundPickerFor] = useState<'new' | string | null>(null); // 'new' or alarm.id
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Form state
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [selectedSound, setSelectedSound] = useState<string>('gentle');

  // Load custom sounds on mount
  React.useEffect(() => { getCustomSounds().then(setCustomSounds); }, []);

  // ── Sound Control ──
  const stopSound = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const playPreview = useCallback(async (sid: string, source: any | null) => {
    await stopSound();
    if (sid === 'vibrate') { Vibration.vibrate([0, 200, 150, 200]); return; }
    if (!source) return;
    try {
      setPlayingId(sid);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync(
        typeof source === 'string' ? { uri: source } : source,
        { shouldPlay: true, isLooping: false, volume: 1.0 }
      );
      soundRef.current = sound;
      // Auto-stop after 3s
      const timer = setTimeout(async () => {
        if (soundRef.current === sound) { await stopSound(); }
      }, 3000);
      sound.setOnPlaybackStatusUpdate((st: any) => {
        if (st.didJustFinish) { clearTimeout(timer); stopSound(); }
      });
    } catch { setPlayingId(null); }
  }, [stopSound]);

  // ── Device Sound Picker ──
  const pickFromDevice = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        const customId = `custom_${Date.now()}`;
        const name = file.name?.replace(/\.[^.]+$/, '') || 'Custom Sound';
        const newSound: CustomSound = { id: customId, label: name, uri: file.uri };
        await saveCustomSound(newSound);
        setCustomSounds(prev => [...prev, newSound]);
        // Select this sound
        if (soundPickerFor === 'new') {
          setSelectedSound(customId);
        } else if (soundPickerFor) {
          onUpdate(soundPickerFor, { soundId: customId as AlarmSoundId });
        }
        // Preview it
        await playPreview(customId, file.uri);
      }
    } catch (e) {
      if (__DEV__) console.warn('[AlarmSettings] Document picker error:', e);
    }
  }, [soundPickerFor, onUpdate, playPreview]);

  // ── Handlers ──
  const handleAdd = useCallback(() => {
    addAlarm({
      hour, minute, days,
      label: label.trim() || t('alarm.newAlarm'),
      soundId: selectedSound,
      enabled: true,
    });
    setShowForm(false);
    setLabel(''); setHour(7); setMinute(0); setDays([]); setSelectedSound('gentle');
  }, [hour, minute, label, days, selectedSound, addAlarm]);

  const handleToggle = useCallback(async (alarm: Alarm, enabled: boolean) => {
    onUpdate(alarm.id, { enabled });
    if (enabled) {
      const nid = await scheduleAlarm({ ...alarm, enabled: true });
      if (nid) onUpdate(alarm.id, { enabled: true, notificationId: nid });
    } else if (alarm.notificationId) {
      await cancelAlarm(alarm.notificationId);
    }
  }, [onUpdate]);

  const DAY_NAMES_FULL = [
    t('alarm.sun'), t('alarm.mon'), t('alarm.tue'), t('alarm.wed'),
    t('alarm.thu'), t('alarm.fri'), t('alarm.sat'),
  ];
  const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Build full sound list
  const allSounds = [
    ...ALARM_SOUNDS.map(s => ({ id: s.id, label: t(s.labelKey), icon: s.icon, source: s.asset })),
    ...customSounds.map(s => ({ id: s.id, label: s.label, icon: '♪', source: s.uri })),
  ];

  const getSoundLabel = (sid: string) => allSounds.find(s => s.id === sid)?.label || t('alarm.sounds.gentle');

  // ── Sound Picker Modal ──
  const renderSoundPicker = () => {
    if (!soundPickerFor) return null;
    const currentId = soundPickerFor === 'new'
      ? selectedSound
      : alarms.find(a => a.id === soundPickerFor)?.soundId || 'gentle';

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => { stopSound(); setSoundPickerFor(null); }}>
        <View style={[st.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[st.modalSheet, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={[st.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[st.modalTitle, { color: colors.text }]}>{t('alarm.alarmSound')}</Text>
              <Pressable onPress={() => { stopSound(); setSoundPickerFor(null); }} hitSlop={12}>
                <X size={22} color={colors.textTertiary} />
              </Pressable>
            </View>

            <ScrollView style={st.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Browse from device */}
              <Pressable
                onPress={pickFromDevice}
                style={({ pressed }) => [st.soundRow, pressed && { backgroundColor: colors.backgroundSecondary }]}
              >
                <View style={[st.soundIconCircle, { backgroundColor: colors.accent + '15' }]}>
                  <Upload size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.soundName, { color: colors.accent, fontWeight: '700' }]}>
                    {t('alarm.browseDevice')}
                  </Text>
                  <Text style={[st.soundDesc, { color: colors.textTertiary }]}>
                    {t('alarm.browseHint')}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.textTertiary} />
              </Pressable>

              <View style={[st.soundDivider, { backgroundColor: colors.border }]} />

              {/* Built-in sounds */}
              <Text style={[st.soundSectionLabel, { color: colors.textTertiary }]}>{t('alarm.builtInSounds')}</Text>
              {ALARM_SOUNDS.map(s => {
                const isActive = currentId === s.id;
                const isPlaying = playingId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      if (soundPickerFor === 'new') {
                        setSelectedSound(s.id);
                      } else {
                        onUpdate(soundPickerFor!, { soundId: s.id });
                      }
                      playPreview(s.id, s.asset);
                    }}
                    style={({ pressed }) => [
                      st.soundRow,
                      isActive && { backgroundColor: colors.accent + '08' },
                      pressed && { backgroundColor: colors.backgroundSecondary },
                    ]}
                  >
                    <View style={[
                      st.radioOuter,
                      { borderColor: isActive ? colors.accent : colors.border },
                    ]}>
                      {isActive && <View style={[st.radioInner, { backgroundColor: colors.accent }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.soundName, { color: isActive ? colors.accent : colors.text }]}>
                        {t(s.labelKey)}
                      </Text>
                    </View>
                    {isPlaying && <Volume2 size={16} color={colors.accent} />}
                  </Pressable>
                );
              })}

              {/* Custom sounds from device */}
              {customSounds.length > 0 && (
                <>
                  <View style={[st.soundDivider, { backgroundColor: colors.border }]} />
                  <Text style={[st.soundSectionLabel, { color: colors.textTertiary }]}>{t('alarm.yourSounds')}</Text>
                  {customSounds.map(s => {
                    const isActive = currentId === s.id;
                    const isPlaying = playingId === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => {
                          if (soundPickerFor === 'new') {
                            setSelectedSound(s.id);
                          } else {
                            onUpdate(soundPickerFor!, { soundId: s.id as AlarmSoundId });
                          }
                          playPreview(s.id, s.uri);
                        }}
                        style={({ pressed }) => [
                          st.soundRow,
                          isActive && { backgroundColor: colors.accent + '08' },
                          pressed && { backgroundColor: colors.backgroundSecondary },
                        ]}
                      >
                        <View style={[
                          st.radioOuter,
                          { borderColor: isActive ? colors.accent : colors.border },
                        ]}>
                          {isActive && <View style={[st.radioInner, { backgroundColor: colors.accent }]} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[st.soundName, { color: isActive ? colors.accent : colors.text }]}>
                            {s.label}
                          </Text>
                        </View>
                        {isPlaying && <Volume2 size={16} color={colors.accent} />}
                      </Pressable>
                    );
                  })}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>

            {/* Done button */}
            <Pressable
              onPress={() => { stopSound(); setSoundPickerFor(null); }}
              style={[st.doneBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={st.doneBtnText}>{t('common.done')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Bell size={15} color={colors.accent} />
          <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>{t('alarm.alarms')}</Text>
        </View>
        <Pressable
          onPress={() => setShowForm(!showForm)}
          style={({ pressed }) => [
            st.headerBtn,
            { backgroundColor: showForm ? 'transparent' : colors.accent, borderColor: showForm ? colors.error : 'transparent', borderWidth: showForm ? 1.5 : 0 },
            pressed && { opacity: 0.8 },
          ]}
        >
          {showForm
            ? <X size={14} color={colors.error} strokeWidth={2.5} />
            : <Plus size={14} color="#fff" strokeWidth={2.5} />
          }
          <Text style={{ fontSize: 13, fontWeight: '700', color: showForm ? colors.error : '#fff' }}>
            {showForm ? t('common.cancel') : t('alarm.newAlarm')}
          </Text>
        </Pressable>
      </View>

      <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

        {/* ── CREATE FORM ── */}
        {showForm && (
          <View style={[st.form, { borderBottomColor: colors.border }]}>
            {/* Time */}
            <View style={st.timeRow}>
              <View style={st.timeCol}>
                <Pressable onPress={() => setHour(h => (h+1)%24)} style={st.timeArrow} hitSlop={10}>
                  <Text style={[st.arrowChar, { color: colors.textTertiary }]}>▲</Text>
                </Pressable>
                <Text style={[st.timeNum, { color: colors.text }]}>
                  {String(hour % 12 || 12).padStart(2, '0')}
                </Text>
                <Pressable onPress={() => setHour(h => (h-1+24)%24)} style={st.timeArrow} hitSlop={10}>
                  <Text style={[st.arrowChar, { color: colors.textTertiary }]}>▼</Text>
                </Pressable>
              </View>

              <Text style={[st.timeSep, { color: colors.textTertiary }]}>:</Text>

              <View style={st.timeCol}>
                <Pressable onPress={() => setMinute(m => (m+5)%60)} style={st.timeArrow} hitSlop={10}>
                  <Text style={[st.arrowChar, { color: colors.textTertiary }]}>▲</Text>
                </Pressable>
                <Text style={[st.timeNum, { color: colors.text }]}>
                  {String(minute).padStart(2, '0')}
                </Text>
                <Pressable onPress={() => setMinute(m => (m-5+60)%60)} style={st.timeArrow} hitSlop={10}>
                  <Text style={[st.arrowChar, { color: colors.textTertiary }]}>▼</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setHour(h => h < 12 ? h+12 : h-12)}
                style={[st.ampmBtn, { backgroundColor: colors.accent + '12', borderColor: colors.accent + '30' }]}
              >
                <Text style={[st.ampmText, { color: colors.accent }]}>{hour < 12 ? 'AM' : 'PM'}</Text>
              </Pressable>
            </View>

            {/* Label */}
            <TextInput
              style={[st.labelField, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
              placeholder={t('alarm.whatFor')}
              placeholderTextColor={colors.textTertiary}
              value={label}
              onChangeText={setLabel}
              returnKeyType="done"
            />

            {/* Repeat */}
            <Text style={[st.label, { color: colors.textSecondary }]}>{t('alarm.repeat')}</Text>
            <View style={st.dayRow}>
              {DAY_LETTERS.map((l, i) => {
                const on = days.includes(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => setDays(p => on ? p.filter(x=>x!==i) : [...p, i])}
                    style={[st.dayBtn, { backgroundColor: on ? colors.accent : 'transparent', borderColor: on ? colors.accent : colors.border }]}
                  >
                    <Text style={[st.dayChar, { color: on ? '#fff' : colors.textSecondary }]}>{l}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[st.dayHint, { color: colors.textTertiary }]}>
              {days.length === 0 ? t('alarm.ringsOnce') : days.length === 7 ? t('alarm.everyDay') : days.map(d => DAY_NAMES_FULL[d]).join(', ')}
            </Text>

            {/* Sound Selector — tap to open modal */}
            <Text style={[st.label, { color: colors.textSecondary }]}>{t('alarm.sound')}</Text>
            <Pressable
              onPress={() => setSoundPickerFor('new')}
              style={({ pressed }) => [
                st.soundSelector,
                { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Music size={18} color={colors.accent} />
              <Text style={[st.soundSelectorText, { color: colors.text }]} numberOfLines={1}>
                {getSoundLabel(selectedSound)}
              </Text>
              <ChevronRight size={16} color={colors.textTertiary} />
            </Pressable>

            {/* Set Alarm */}
            <Pressable
              onPress={handleAdd}
              style={({ pressed }) => [st.setBtn, { backgroundColor: colors.accent }, pressed && { opacity: 0.85 }]}
            >
              <Bell size={17} color="#fff" />
              <Text style={st.setBtnText}>{t('alarm.setAlarm')}</Text>
            </Pressable>
          </View>
        )}

        {/* ── ALARM LIST ── */}
        {alarms.length === 0 && !showForm ? (
          <View style={st.empty}>
            <View style={{ marginBottom: 8 }}><Bell size={36} color={colors.textTertiary} /></View>
            <Text style={[st.emptyTitle, { color: colors.text }]}>{t('alarm.noAlarms')}</Text>
            <Text style={[st.emptyHint, { color: colors.textTertiary }]}>
              {t('alarm.noAlarmsHint')}
            </Text>
          </View>
        ) : (
          alarms.map((alarm, i) => (
            <React.Fragment key={alarm.id}>
              {(i > 0 || showForm) && <View style={[st.divider, { backgroundColor: colors.border }]} />}
              <View style={st.alarmItem}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                    <Text style={[st.alarmTime, { color: alarm.enabled ? colors.text : colors.textTertiary }]}>
                      {formatAlarmTime(alarm.hour, alarm.minute)}
                    </Text>
                    <Text style={[st.alarmLabel, { color: alarm.enabled ? colors.textSecondary : colors.textTertiary }]}>
                      {alarm.label}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Text style={[st.alarmSub, { color: colors.textTertiary }]}>
                      {formatAlarmDaysI18n(alarm.days, t)}
                    </Text>
                    <Text style={[st.alarmSub, { color: colors.textTertiary }]}>  ·  </Text>
                    <Pressable
                      onPress={() => setSoundPickerFor(alarm.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                    >
                      <Music size={11} color={colors.accent} />
                      <Text style={[st.alarmSub, { color: colors.accent }]}>
                        {getSoundLabel(alarm.soundId)}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable
                    onPress={() => Alert.alert(t('alarm.deleteAlarm'), t('alarm.deleteConfirm', { label: alarm.label }), [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(alarm.id) },
                    ])}
                    hitSlop={10} style={{ padding: 5 }}
                  >
                    <Trash2 size={15} color={colors.textTertiary} />
                  </Pressable>
                  <Switch
                    value={alarm.enabled}
                    onValueChange={v => handleToggle(alarm, v)}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            </React.Fragment>
          ))
        )}
      </View>

      {/* Sound picker modal */}
      {renderSoundPicker()}
    </View>
  );
}

// ── Styles ──
const st = StyleSheet.create({
  root: { marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },

  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },

  // Form
  form: { padding: 24, borderBottomWidth: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginBottom: 24 },
  timeCol: { alignItems: 'center' },
  timeArrow: { paddingVertical: 8, paddingHorizontal: 16 },
  arrowChar: { fontSize: 12, fontWeight: '800' },
  timeNum: { fontSize: 56, fontWeight: '200', fontVariant: ['tabular-nums'] as any, lineHeight: 62 },
  timeSep: { fontSize: 44, fontWeight: '200', marginHorizontal: 4, marginBottom: 12 },
  ampmBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, marginLeft: 12, marginBottom: 12 },
  ampmText: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },

  labelField: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },

  dayRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayChar: { fontSize: 14, fontWeight: '700' },
  dayHint: { fontSize: 12, textAlign: 'center', marginTop: 8, marginBottom: 20 },

  soundSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginBottom: 24,
  },
  soundSelectorText: { flex: 1, fontSize: 15, fontWeight: '500' },

  setBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16 },
  setBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // List
  empty: { alignItems: 'center', paddingVertical: 36, gap: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  divider: { height: 1, marginHorizontal: 20 },
  alarmItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  alarmTime: { fontSize: 32, fontWeight: '200', fontVariant: ['tabular-nums'] as any },
  alarmLabel: { fontSize: 14, fontWeight: '500' },
  alarmSub: { fontSize: 12 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', paddingBottom: 20 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalScroll: { paddingHorizontal: 8 },

  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, marginHorizontal: 4 },
  soundIconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  soundName: { fontSize: 15, fontWeight: '500' },
  soundDesc: { fontSize: 12, marginTop: 1 },
  soundDivider: { height: 1, marginHorizontal: 20, marginVertical: 8 },
  soundSectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 20, paddingVertical: 8 },

  doneBtn: { marginHorizontal: 20, paddingVertical: 15, borderRadius: 16, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
