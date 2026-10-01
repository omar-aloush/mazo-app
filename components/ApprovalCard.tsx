import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Pressable,
    Modal,
    ScrollView,
} from 'react-native';
import { Check, Sprout } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { hapticSuccess, hapticTap } from '@/utils/haptics';
import { ActionList } from '@/components/ActionList';
import type { ActionPlan } from '@/types';

interface ApprovalCardProps {
    proposal: ActionPlan;
    onApprove: () => void;
    onDecline: () => void;
    busy?: boolean;
}

/**
 * The Agent's approval sheet — the sacred "with their acceptance" step.
 * Lists exactly what Mazō will do on the phone (drawn from a plan) and runs
 * nothing until the user approves. Living Garden look.
 */
export const ApprovalCard: React.FC<ApprovalCardProps> = ({ proposal, onApprove, onDecline, busy }) => {
    const { colors, isDark } = useTheme();
    const slide = useRef(new Animated.Value(60)).current;
    const fade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        hapticSuccess();
        Animated.parallel([
            Animated.spring(slide, { toValue: 0, friction: 11, tension: 50, useNativeDriver: true }),
            Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
    }, [slide, fade]);

    const sage = colors.accent;
    const sageSoft = isDark ? 'rgba(143,184,150,0.12)' : 'rgba(124,154,130,0.10)';
    const sageBorder = isDark ? 'rgba(143,184,150,0.30)' : 'rgba(124,154,130,0.28)';

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDecline}>
            <View style={styles.flex}>
                <Pressable
                    style={[styles.scrim, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(20,18,12,0.35)' }]}
                    onPress={busy ? undefined : onDecline}
                />
                <Animated.View
                    style={[
                        styles.sheet,
                        { backgroundColor: colors.surface, borderColor: sageBorder, opacity: fade, transform: [{ translateY: slide }] },
                    ]}
                >
                    <View style={styles.head}>
                        <View style={[styles.headIcon, { backgroundColor: sageSoft }]}>
                            <Sprout size={17} color={sage} />
                        </View>
                        <View style={styles.headText}>
                            <Text style={[styles.title, { color: colors.text }]}>Want me to set this up?</Text>
                            <Text style={[styles.sub, { color: colors.textSecondary }]}>Nothing happens until you approve.</Text>
                        </View>
                    </View>

                    {!!(proposal.why || proposal.understood) && (
                        <Text style={[styles.why, { color: sage, backgroundColor: sageSoft }]}>
                            {proposal.why ?? proposal.understood}
                        </Text>
                    )}

                    <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                        <ActionList actions={proposal.actions} />
                    </ScrollView>

                    <View style={styles.actions}>
                        <Pressable
                            disabled={busy}
                            style={[styles.approve, { backgroundColor: sage, opacity: busy ? 0.6 : 1 }]}
                            onPress={() => { hapticSuccess(); onApprove(); }}
                        >
                            <Check size={17} color="#FFFFFF" />
                            <Text style={styles.approveText}>{busy ? 'Setting it up…' : `Approve all ${proposal.actions.length}`}</Text>
                        </Pressable>
                        <Pressable
                            disabled={busy}
                            style={[styles.decline, { borderColor: sageBorder }]}
                            onPress={() => { hapticTap(); onDecline(); }}
                        >
                            <Text style={[styles.declineText, { color: colors.textSecondary }]}>Not now</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1, justifyContent: 'flex-end' },
    scrim: { ...StyleSheet.absoluteFillObject },
    sheet: {
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        borderWidth: 1,
        padding: 22,
        paddingBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
        elevation: 16,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 },
    headIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    headText: { flex: 1 },
    title: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
    sub: { fontSize: 12, marginTop: 1 },
    why: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginBottom: 13, overflow: 'hidden' },
    list: { maxHeight: 280 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    approve: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, paddingVertical: 15 },
    approveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' as const },
    decline: { borderWidth: 1, borderRadius: 15, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
    declineText: { fontSize: 14, fontWeight: '600' as const },
});
