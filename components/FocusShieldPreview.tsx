import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LockKeyhole, ShieldCheck, Timer, X } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';

interface FocusShieldPreviewProps {
  visible: boolean;
  apps: string[];
  durationMinutes: number;
  onStartFocus: () => void;
  onDismiss: () => void;
}

/**
 * The iPhone Focus Shield gives a focus session a clear, cinematic starting
 * moment inside Mazō. It does not use system-level app blocking.
 */
export function FocusShieldPreview({ visible, apps, durationMinutes, onStartFocus, onDismiss }: FocusShieldPreviewProps) {
  const { colors, isDark } = useTheme();
  const appNames = apps.length ? apps.join(' · ') : 'Distracting apps';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: isDark ? '#151B17' : '#F7F7F2' }]}>
          <View style={styles.topRow}>
            <View style={[styles.previewPill, { backgroundColor: isDark ? 'rgba(143,184,150,0.16)' : '#E5F0E6' }]}>
              <Text style={[styles.previewPillText, { color: colors.accent }]}>FOCUS SHIELD</Text>
            </View>
            <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Close Focus Shield preview">
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.shield, { backgroundColor: colors.accent }]}>
            <ShieldCheck size={44} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Your focus is protected</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>A calm interruption before distraction wins.</Text>

          <View style={[styles.pauseCard, { backgroundColor: isDark ? '#202722' : '#FFFFFF', borderColor: isDark ? '#314037' : '#DCE7DE' }]}>
            <View style={[styles.pauseIcon, { backgroundColor: isDark ? 'rgba(143,184,150,0.16)' : '#E5F0E6' }]}>
              <LockKeyhole size={19} color={colors.accent} />
            </View>
            <View style={styles.pauseCopy}>
              <Text style={[styles.pauseTitle, { color: colors.text }]}>{appNames} outside this focus block</Text>
              <Text style={[styles.pauseDetail, { color: colors.textSecondary }]}>Your {durationMinutes}-minute commitment is ready</Text>
            </View>
            <Text style={[styles.previewTag, { color: colors.textTertiary }]}>Active</Text>
          </View>

          <View style={[styles.timerCard, { backgroundColor: isDark ? 'rgba(143,184,150,0.10)' : '#EFF5EF' }]}>
            <Timer size={19} color={colors.accent} />
            <Text style={[styles.timerText, { color: colors.text }]}>{durationMinutes}:00 focus block ready</Text>
          </View>

          <Text style={[styles.disclosure, { color: colors.textTertiary }]}>Stay with the next small step. Mazō will keep the session visible.</Text>

          <Pressable style={[styles.primary, { backgroundColor: colors.accent }]} onPress={onStartFocus}>
            <Text style={styles.primaryText}>Start my focus session</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onDismiss}>
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Back to chat</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = {
  backdrop: { flex: 1, backgroundColor: 'rgba(8, 13, 10, 0.74)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 34 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  previewPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  shield: { alignSelf: 'center', width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 17 },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 7, marginBottom: 21 },
  pauseCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 14 },
  pauseIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  pauseCopy: { flex: 1 },
  pauseTitle: { fontSize: 15, fontWeight: '700' },
  pauseDetail: { fontSize: 12, marginTop: 3 },
  previewTag: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  timerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 13, marginTop: 12 },
  timerText: { fontSize: 14, fontWeight: '700' },
  disclosure: { textAlign: 'center', fontSize: 11, lineHeight: 15, marginTop: 16, marginHorizontal: 12 },
  primary: { marginTop: 20, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondary: { alignItems: 'center', paddingTop: 15, paddingBottom: 3 },
  secondaryText: { fontSize: 14, fontWeight: '600' },
} as const;
