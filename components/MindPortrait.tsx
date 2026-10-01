import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Sprout, Sparkles, Compass, CloudFog } from 'lucide-react-native';
import { useMemory } from '@/providers/MemoryProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { computeBond, BOND_STAGE_LABELS } from '@/services/bond';
import { DayArchitectButton } from '@/components/DayArchitectButton';
import type { MindInsightFace, BondStage } from '@/types';

const STAGE_ORDER: BondStage[] = ['stranger', 'getting_to_know', 'knows_you_well', 'gets_you'];
const STAGE_SHORT: Record<BondStage, string> = {
    stranger: 'Stranger',
    getting_to_know: 'Knowing you',
    knows_you_well: 'Knows you',
    gets_you: 'Gets you',
};

const FACES: { face: MindInsightFace; title: string; Icon: typeof Sprout }[] = [
    { face: 'workstyle', title: 'How you work best', Icon: Sprout },
    { face: 'identity', title: 'Who you are', Icon: Sparkles },
    { face: 'ambition', title: "What you're chasing", Icon: Compass },
    { face: 'obstacle', title: 'What gets in your way', Icon: CloudFog },
];

const FRESH_MS = 5 * 60 * 1000;

/**
 * The Mind — a living portrait of what Mazo understands about the person.
 * Bond meter (from computeBond) + the four faces. Confirmed insights are the
 * portrait; active goals + open problems/constraints are folded in so the
 * faces aren't empty before insights accumulate. Living Garden look.
 */
export function MindPortrait() {
    const { colors, isDark } = useTheme();
    const { memory, mindInsights } = useMemory();

    const insights = mindInsights ?? [];
    const known = useMemo(
        () => insights.filter(i => i.status === 'confirmed' || i.status === 'corrected'),
        [insights],
    );
    const bond = useMemo(() => computeBond(insights), [insights]);

    const sage = colors.accent;
    const sageSoft = isDark ? 'rgba(143,184,150,0.12)' : 'rgba(124,154,130,0.10)';
    const sageBorder = isDark ? 'rgba(143,184,150,0.28)' : 'rgba(124,154,130,0.26)';

    const chipsFor = (face: MindInsightFace): { key: string; text: string; fresh: boolean }[] => {
        const list = known
            .filter(i => i.face === face)
            .map(i => ({ key: i.id, text: i.text, fresh: !!i.confirmedAt && Date.now() - i.confirmedAt < FRESH_MS }));
        if (face === 'ambition') {
            memory.goals.filter(g => g.status === 'active').forEach(g => list.push({ key: g.id, text: g.title, fresh: false }));
        }
        if (face === 'obstacle') {
            memory.problems.filter(p => p.status === 'open').forEach(p => list.push({ key: p.id, text: p.description, fresh: false }));
            memory.constraints.forEach(c => list.push({ key: c.id, text: c.description, fresh: false }));
        }
        return list;
    };

    return (
        <View style={styles.wrap}>
            <Text style={[styles.eyebrow, { color: sage }]}>YOUR MIND</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>What Mazo understands about you</Text>

            {/* Bond meter */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: sageBorder }]}>
                <View style={styles.bondTop}>
                    <Text style={[styles.stage, { color: colors.text }]}>{BOND_STAGE_LABELS[bond.stage]}</Text>
                    <Text style={[styles.pct, { color: sage }]}>{bond.score}%</Text>
                </View>
                <View style={[styles.track, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                    <View style={[styles.fill, { width: `${Math.max(4, bond.score)}%`, backgroundColor: sage }]} />
                </View>
                <View style={styles.stagesRow}>
                    {STAGE_ORDER.map(s => (
                        <Text
                            key={s}
                            style={[styles.stageTick, { color: s === bond.stage ? sage : colors.textTertiary, fontWeight: s === bond.stage ? '700' : '500' }]}
                        >
                            {STAGE_SHORT[s]}
                        </Text>
                    ))}
                </View>
                <View style={[styles.sigRow, { borderTopColor: sageBorder }]}>
                    <Svg width={34} height={34} viewBox="0 0 40 40">
                        <Path d="M20 38 V18" stroke={sage} strokeWidth={2.4} strokeLinecap="round" />
                        <Path d="M20 22 C12 20 9 13 10 8 C16 8 21 12 20 22Z" fill={sage} opacity={0.5} />
                        <Path d="M20 26 C28 23 31 16 30 11 C24 12 19 16 20 26Z" fill={sage} />
                    </Svg>
                    <Text style={[styles.sigTxt, { color: colors.textSecondary }]}>
                        <Text style={{ color: colors.text, fontWeight: '600' }}>{insights.length} learned · {bond.confirmedCount} confirmed by you.</Text>{' '}
                        Every time you confirm or correct, the bond grows.
                    </Text>
                </View>
            </View>

            {/* The four faces */}
            {FACES.map(({ face, title, Icon }) => {
                const chips = chipsFor(face);
                return (
                    <View key={face} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                        <View style={styles.faceHead}>
                            <View style={[styles.faceIcon, { backgroundColor: sageSoft }]}>
                                <Icon size={15} color={sage} />
                            </View>
                            <Text style={[styles.faceTitle, { color: colors.text }]}>{title}</Text>
                            <Text style={[styles.faceCount, { color: colors.textTertiary }]}>{chips.length}</Text>
                        </View>
                        {chips.length === 0 ? (
                            <Text style={[styles.empty, { color: colors.textTertiary }]}>
                                Mazo hasn&apos;t learned this yet — keep talking and it will.
                            </Text>
                        ) : (
                            <View style={styles.chips}>
                                {chips.map(c => (
                                    <View
                                        key={c.key}
                                        style={[
                                            styles.chip,
                                            c.fresh
                                                ? { backgroundColor: sageSoft, borderColor: sage, borderWidth: 1 }
                                                : { backgroundColor: isDark ? colors.backgroundSecondary : colors.background },
                                        ]}
                                    >
                                        <Text style={[styles.chipText, { color: colors.text }]}>{c.text}</Text>
                                        {c.fresh && <Text style={[styles.chipStamp, { color: sage }]}>JUST NOW · YOU CONFIRMED</Text>}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                );
            })}

            <DayArchitectButton />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginBottom: 8 },
    eyebrow: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4, marginBottom: 3 },
    subtitle: { fontSize: 13, marginBottom: 14 },
    card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
    bondTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    stage: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
    pct: { fontSize: 13, fontWeight: '700' as const },
    track: { height: 10, borderRadius: 999, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 999 },
    stagesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
    stageTick: { fontSize: 9.5, letterSpacing: 0.2 },
    sigRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth },
    sigTxt: { flex: 1, fontSize: 11.5, lineHeight: 16 },
    faceHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 11 },
    faceIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    faceTitle: { flex: 1, fontSize: 14, fontWeight: '700' as const, letterSpacing: -0.2 },
    faceCount: { fontSize: 12, fontWeight: '600' as const },
    empty: { fontSize: 12.5, lineHeight: 18, fontStyle: 'italic' as const },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    chip: { borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8 },
    chipText: { fontSize: 12.5, lineHeight: 17 },
    chipStamp: { fontSize: 8.5, fontWeight: '700' as const, letterSpacing: 0.5, marginTop: 3 },
});
