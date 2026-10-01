import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Check, X, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { ACTION_META } from '@/constants/actionCatalog';
import type { MazoAction, ActionReceipt } from '@/types';

/**
 * Presentational list of agent actions — one row per action (icon · title ·
 * detail · → destination). Shared by the Approval sheet and the Command surface
 * so the two never drift. When `receipts` is passed, each row shows its outcome;
 * `runningId` marks the action currently executing (live "agent at work" view).
 */
export const ActionList: React.FC<{ actions: MazoAction[]; receipts?: ActionReceipt[]; runningId?: string | null }> = ({ actions, receipts, runningId }) => {
  const { colors, isDark } = useTheme();
  const sage = colors.accent;
  const sageBorder = isDark ? 'rgba(143,184,150,0.30)' : 'rgba(124,154,130,0.28)';

  const safeActions = (actions || []).filter(Boolean);

  return (
    <View>
      {safeActions.map((a, idx) => {
        const meta = (a && a.kind && ACTION_META[a.kind]) || { Icon: Sparkles, dest: 'Action' };
        const Icon = meta.Icon || Sparkles;
        const dest = meta.dest || 'Action';
        const receipt = receipts?.find((r) => r.id === a.id);
        const done = !!receipt;
        const ok = receipt?.success;
        const running = !done && runningId === a.id;
        const itemKey = a.id || `action-${idx}`;

        return (
          <View
            key={itemKey}
            style={[
              styles.item,
              { backgroundColor: isDark ? colors.backgroundSecondary : colors.background },
              done && { opacity: ok ? 1 : 0.7 },
              running && { backgroundColor: isDark ? 'rgba(143,184,150,0.12)' : 'rgba(124,154,130,0.10)' },
            ]}
          >
            <View
              style={[
                styles.itemIcon,
                { backgroundColor: colors.surface, borderColor: sageBorder },
                done && ok && { backgroundColor: sage, borderColor: sage },
                done && !ok && { borderColor: colors.error },
                running && { borderColor: sage },
              ]}
            >
              {done ? (
                ok ? <Check size={15} color="#FFFFFF" /> : <X size={15} color={colors.error} />
              ) : running ? (
                <ActivityIndicator size="small" color={sage} />
              ) : (
                <Icon size={16} color={sage} />
              )}
            </View>
            <View style={styles.itemText}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{a.title || 'Action'}</Text>
              {!!(receipt?.message || a.detail) && (
                <Text style={[styles.itemDetail, { color: done && !ok ? colors.error : colors.textTertiary }]}>
                  {receipt?.message ?? a.detail}
                </Text>
              )}
            </View>
            {!done && !running && <Text style={[styles.dest, { color: sage }]}>→ {dest}</Text>}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, borderRadius: 14, marginBottom: 8 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 13.5, fontWeight: '600' as const },
  itemDetail: { fontSize: 11, marginTop: 1 },
  dest: { fontSize: 10, fontWeight: '700' as const },
});
