import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Mic, X, ArrowUp, Sprout, RotateCcw } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useMemory } from '@/providers/MemoryProvider';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Fonts } from '@/constants/fonts';
import { hapticTap, hapticSuccess } from '@/utils/haptics';
import { generateActionPlan } from '@/services/actionPlanner';
import { executeAction, orderActions } from '@/services/actionDispatch';
import { getTopUsageApps } from '@/services/deviceApps';
import { isLocalDemoMode } from '@/services/demoMode';
import { ActionList } from '@/components/ActionList';
import type { ActionPlan, ActionReceipt, MazoAction } from '@/types';

type Phase = 'input' | 'planning' | 'review' | 'executing' | 'done';

/** One-tap flagship commands — the agent orchestrates a whole plan from each. */
const HEROES = [
  { emoji: '📚', label: 'Plan my exam week' },
  { emoji: '☀️', label: 'Get me through today' },
  { emoji: '🧘', label: 'Detox my phone' },
];

const EXAMPLES = [
  'Remind me to call the dentist at 4pm',
  'Open Spotify and set a 25-min focus alarm',
  'Block Instagram and TikTok for 2 hours',
];

/**
 * The Agent's command surface. A prominent home-screen pill opens a focused
 * sheet where you say what you want; Mazō plans real phone actions, you approve
 * once, it runs them and shows receipts. This is "it runs my phone for you."
 */
interface CommandBarProps {
  /** Show the built-in "Tell Mazo to do something…" pill. Default true (System tab). */
  showLauncher?: boolean;
  /** Controlled open state — e.g. opened from the chat's ⚡ button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandBar({ showLauncher = true, open: openProp, onOpenChange }: CommandBarProps = {}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { memory, mindInsights, addAlarm, addIdea } = useMemory();
  const speech = useSpeechRecognition();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (onOpenChange) onOpenChange(v);
      else setInternalOpen(v);
    },
    [onOpenChange],
  );
  const [phase, setPhase] = useState<Phase>('input');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [receipts, setReceipts] = useState<ActionReceipt[]>([]);
  const [runOrder, setRunOrder] = useState<MazoAction[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);

  const sage = colors.accent;
  const sageSoft = isDark ? 'rgba(143,184,150,0.12)' : 'rgba(124,154,130,0.10)';
  const sageBorder = isDark ? 'rgba(143,184,150,0.30)' : 'rgba(124,154,130,0.28)';

  // Voice → input field
  useEffect(() => {
    if (speech.transcript) setInput(speech.transcript.trim());
  }, [speech.transcript]);

  const reset = useCallback(() => {
    setPhase('input');
    setInput('');
    setError(null);
    setPlan(null);
    setReceipts([]);
    setRunOrder([]);
    setRunningId(null);
    if (speech.isListening) speech.stopListening();
  }, [speech]);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset, setOpen]);

  const onMic = useCallback(() => {
    hapticTap();
    if (speech.isListening) speech.stopListening();
    else {
      speech.resetTranscript();
      speech.startListening();
    }
  }, [speech]);

  const submit = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text) return;
    if (speech.isListening) speech.stopListening();
    hapticTap();
    setError(null);
    setInput(text);
    setPhase('planning');
    const distractions = getTopUsageApps(7, 3).map((a) => a.label);
    const p = await generateActionPlan(text, memory, mindInsights ?? [], distractions);
    if (p && p.actions.length) {
      setPlan(p);
      setPhase('review');
    } else {
      setPhase('input');
      setError("I couldn't turn that into actions yet. Try saying it more concretely — e.g. “remind me to stretch at 6pm.”");
    }
  }, [input, memory, mindInsights, speech]);

  // One approval, then run each action live so you watch the agent work.
  const approve = useCallback(async () => {
    if (!plan) return;
    hapticSuccess();
    const ordered = orderActions(plan.actions);
    setRunOrder(ordered);
    setReceipts([]);
    setPhase('executing');
    const helpers = {
      addAlarm,
      saveNote: (note: string, category?: string) => addIdea({ content: note, category }),
    };
    const acc: ActionReceipt[] = [];
    for (const a of ordered) {
      setRunningId(a.id);
      const r = await executeAction(a, helpers);
      acc.push(r);
      setReceipts([...acc]);
      await new Promise((res) => setTimeout(res, 380));
    }
    setRunningId(null);
    hapticSuccess();
    setPhase('done');
  }, [plan, addAlarm, addIdea]);

  const okCount = receipts.filter((r) => r.success).length;

  return (
    <>
      {/* Home-screen pill */}
      {showLauncher && (
        <Pressable
          onPress={() => {
            hapticTap();
            setOpen(true);
          }}
          style={[styles.pill, { backgroundColor: colors.surface, borderColor: sageBorder }]}
        >
          <View style={[styles.pillIcon, { backgroundColor: sageSoft }]}>
            <Sparkles size={16} color={sage} />
          </View>
          <Text style={[styles.pillText, { color: colors.textSecondary }]}>Tell Mazo to do something…</Text>
          <Mic size={16} color={colors.textTertiary} />
        </Pressable>
      )}

      <Modal visible={open} animationType="slide" onRequestClose={close} statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: sageSoft }]}>
              <Sprout size={18} color={sage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>What should I do?</Text>
              <Text style={[styles.headerSub, { color: colors.textSecondary }]}>I act on your phone — only what you approve.</Text>
              {isLocalDemoMode() && (
                <Text style={[styles.headerSub, { color: colors.accent2 }]}>Local Mode · Review actions, then approve what Mazō does.</Text>
              )}
            </View>
            <Pressable onPress={close} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={colors.textTertiary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {/* PLANNING */}
            {phase === 'planning' && (
              <View style={styles.center}>
                <ActivityIndicator color={sage} size="large" />
                <Text style={[styles.centerText, { color: colors.textSecondary }]}>Working out what you need…</Text>
              </View>
            )}

            {/* REVIEW / EXECUTING / DONE share the plan view */}
            {(phase === 'review' || phase === 'executing' || phase === 'done') && plan && (
              <View>
                <Text style={[styles.understood, { color: colors.text }]}>
                  {phase === 'done'
                    ? okCount
                      ? 'Done.'
                      : 'Hmm.'
                    : phase === 'executing'
                      ? 'Running it on your phone…'
                      : plan.understood}
                </Text>
                {!!plan.why && phase === 'review' && (
                  <Text style={[styles.why, { color: sage, backgroundColor: sageSoft }]}>{plan.why}</Text>
                )}
                {phase === 'done' && (
                  <>
                    <Text style={[styles.why, { color: sage, backgroundColor: sageSoft }]}>
                      {okCount === plan.actions.length
                        ? `Mazō completed all ${plan.actions.length} actions on your phone.`
                        : `Mazō completed ${okCount} of ${plan.actions.length} actions.`}
                    </Text>
                    {okCount === 0 && (
                      <Text
                        style={[
                          styles.error,
                          { color: colors.error, backgroundColor: isDark ? 'rgba(224,128,128,0.10)' : 'rgba(194,112,112,0.08)' },
                        ]}
                      >
                        Check Mazō’s permissions in Settings (notifications, calendar, Focus Guardian) and try again.
                      </Text>
                    )}
                  </>
                )}
                <ActionList
                  actions={runOrder.length ? runOrder : plan.actions}
                  receipts={phase === 'review' ? undefined : receipts}
                  runningId={phase === 'executing' ? runningId : null}
                />
              </View>
            )}

            {/* INPUT */}
            {phase === 'input' && (
              <View>
                {!!error && (
                  <Text style={[styles.error, { color: colors.error, backgroundColor: isDark ? 'rgba(224,128,128,0.10)' : 'rgba(194,112,112,0.08)' }]}>
                    {error}
                  </Text>
                )}

                {/* One-tap flagship commands — the agent plans the whole thing */}
                <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>LET MAZŌ RUN YOUR PHONE</Text>
                <View style={styles.heroes}>
                  {HEROES.map((h) => (
                    <Pressable
                      key={h.label}
                      onPress={() => {
                        hapticTap();
                        submit(h.label);
                      }}
                      style={[styles.hero, { backgroundColor: colors.surface, borderColor: sageBorder }]}
                    >
                      <Text style={styles.heroEmoji}>{h.emoji}</Text>
                      <Text style={[styles.heroText, { color: colors.text }]}>{h.label}</Text>
                      <View style={[styles.heroChip, { backgroundColor: sageSoft }]}>
                        <Sparkles size={12} color={sage} />
                      </View>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.eyebrow, { color: colors.textTertiary, marginTop: 22 }]}>OR ASK FOR ANYTHING</Text>
                <View style={styles.examples}>
                  {EXAMPLES.map((ex) => (
                    <Pressable
                      key={ex}
                      onPress={() => {
                        hapticTap();
                        setInput(ex);
                      }}
                      style={[styles.example, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                    >
                      <Text style={[styles.exampleText, { color: colors.text }]}>{ex}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer: input row (input phase) or actions (review/done) */}
          {phase === 'input' && (
            <View style={[styles.inputBar, { borderTopColor: colors.borderLight, paddingBottom: insets.bottom + 10 }]}>
              <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: sageBorder }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder={speech.isListening ? 'Listening…' : 'Tell Mazo what to do…'}
                  placeholderTextColor={colors.textTertiary}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  autoFocus
                  onSubmitEditing={() => submit()}
                />
                {speech.isSupported && (
                  <Pressable onPress={onMic} hitSlop={8} style={[styles.micBtn, speech.isListening && { backgroundColor: sageSoft }]}>
                    <Mic size={19} color={speech.isListening ? colors.error : colors.textSecondary} />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => submit()}
                  disabled={!input.trim()}
                  style={[styles.sendBtn, { backgroundColor: input.trim() ? sage : colors.borderLight }]}
                >
                  <ArrowUp size={19} color={input.trim() ? '#FFFFFF' : colors.textTertiary} />
                </Pressable>
              </View>
            </View>
          )}

          {phase === 'review' && plan && (
            <View style={[styles.footer, { borderTopColor: colors.borderLight, paddingBottom: insets.bottom + 10 }]}>
              <Pressable style={[styles.primary, { backgroundColor: sage }]} onPress={approve}>
                <Text style={styles.primaryText}>Approve all {plan.actions.length}</Text>
              </Pressable>
              <Pressable style={[styles.secondary, { borderColor: sageBorder }]} onPress={reset}>
                <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Not now</Text>
              </Pressable>
            </View>
          )}

          {phase === 'executing' && (
            <View style={[styles.footer, { borderTopColor: colors.borderLight, paddingBottom: insets.bottom + 10 }]}>
              <View style={[styles.primary, { backgroundColor: sage, opacity: 0.7 }]}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={[styles.primaryText, { marginLeft: 8 }]}>Doing it…</Text>
              </View>
            </View>
          )}

          {phase === 'done' && (
            <View style={[styles.footer, { borderTopColor: colors.borderLight, paddingBottom: insets.bottom + 10 }]}>
              <Pressable style={[styles.primary, { backgroundColor: sage }]} onPress={close}>
                <Text style={styles.primaryText}>Done</Text>
              </Pressable>
              <Pressable style={[styles.secondary, { borderColor: sageBorder }]} onPress={reset}>
                <RotateCcw size={15} color={colors.textSecondary} />
                <Text style={[styles.secondaryText, { color: colors.textSecondary, marginLeft: 6 }]}>Again</Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  pillIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pillText: { flex: 1, fontSize: 14.5, fontWeight: '500' as const },

  // modal
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingBottom: 14 },
  headerIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 20, letterSpacing: -0.2 },
  headerSub: { fontSize: 12.5, marginTop: 1 },
  closeBtn: { padding: 4 },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 16 },
  centerText: { fontSize: 14 },

  understood: { fontFamily: Fonts.serifMedium, fontSize: 21, lineHeight: 28, marginBottom: 12 },
  why: { fontSize: 13, lineHeight: 19, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginBottom: 14, overflow: 'hidden' },

  error: { fontSize: 13, lineHeight: 19, padding: 12, borderRadius: 12, marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2, marginBottom: 10 },

  heroes: { gap: 10 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  heroEmoji: { fontSize: 22 },
  heroText: { flex: 1, fontSize: 15.5, fontWeight: '600' as const },
  heroChip: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  examples: { gap: 9 },
  example: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 15 },
  exampleText: { fontSize: 14.5, fontWeight: '500' as const },

  // input bar
  inputBar: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderWidth: 1,
    borderRadius: 20,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 7,
  },
  textInput: { flex: 1, fontSize: 15.5, maxHeight: 120, paddingTop: 6, paddingBottom: 6 },
  micBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  // footer actions
  footer: { flexDirection: 'row', gap: 10, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12 },
  primary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 15, paddingVertical: 15 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' as const },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 15, paddingVertical: 15, paddingHorizontal: 20 },
  secondaryText: { fontSize: 14, fontWeight: '600' as const },
});
