import React, { useState } from 'react';
import { Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useMemory } from '@/providers/MemoryProvider';
import { hapticTap } from '@/utils/haptics';
import { generateDayProposal } from '@/services/dayArchitect';
import { dispatchPlan } from '@/services/actionDispatch';
import { ApprovalCard } from '@/components/ApprovalCard';
import type { ActionPlan } from '@/types';

/**
 * Day Architect — a one-tap preset of the Agent. Reads the Mind, proposes a day
 * setup, and on approval runs it through the same dispatcher the command surface
 * uses. Lives on the Mind screen.
 */
export function DayArchitectButton() {
    const { colors } = useTheme();
    const { memory, mindInsights, addAlarm, addIdea } = useMemory();
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [proposal, setProposal] = useState<ActionPlan | null>(null);

    const plan = async () => {
        hapticTap();
        setLoading(true);
        const p = await generateDayProposal(memory, mindInsights ?? []);
        setLoading(false);
        if (p && p.actions.length) setProposal(p);
        else Alert.alert('Not yet', 'Mazo needs to learn a little more about you first. Keep chatting, then come back.');
    };

    const execute = async () => {
        if (!proposal) return;
        setBusy(true);
        const receipts = await dispatchPlan(proposal.actions, {
            addAlarm,
            saveNote: (note, category) => addIdea({ content: note, category }),
        });
        setBusy(false);
        setProposal(null);
        const ok = receipts.filter((r) => r.success);
        Alert.alert(
            ok.length ? 'Done' : 'Hmm',
            ok.length
                ? `Set up: ${ok.map((r) => r.title).join(', ')}.`
                : 'Nothing was added — check calendar/alarm permissions and try again.',
        );
    };

    return (
        <>
            <Pressable
                style={[styles.btn, { backgroundColor: colors.accent, opacity: loading ? 0.7 : 1 }]}
                onPress={plan}
                disabled={loading}
            >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Sparkles size={17} color="#FFFFFF" />}
                <Text style={styles.btnText}>{loading ? 'Reading your Mind…' : 'Let Mazo plan your day'}</Text>
            </Pressable>
            {proposal && (
                <ApprovalCard proposal={proposal} busy={busy} onApprove={execute} onDecline={() => setProposal(null)} />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 15,
        paddingVertical: 15,
        marginTop: 2,
        marginBottom: 10,
    },
    btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' as const },
});
