import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Pressable,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Sprout, Check, Pencil, X } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { hapticSuccess, hapticTap } from '@/utils/haptics';
import type { MindInsight } from '@/types';

interface CatchCardProps {
    insight: MindInsight;
    onConfirm: () => void;
    onCorrect: (text: string) => void;
    onDismiss: () => void;
}

/**
 * The Catch Card — the headline moment. When Mazo learns something about the
 * person, this slides up: ✓ confirms, ✎ lets them correct it in their own
 * words, ✕ forgets it. Living Garden look (sage accent from the theme).
 */
export const CatchCard: React.FC<CatchCardProps> = ({ insight, onConfirm, onCorrect, onDismiss }) => {
    const { colors, isDark } = useTheme();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(insight.text);
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
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.flex}
            >
                <Pressable
                    style={[styles.scrim, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(20,18,12,0.35)' }]}
                    onPress={onDismiss}
                />
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.surface,
                            borderColor: sageBorder,
                            opacity: fade,
                            transform: [{ translateY: slide }],
                        },
                    ]}
                >
                    <View style={styles.tagRow}>
                        <View style={[styles.tagIcon, { backgroundColor: sageSoft }]}>
                            <Sprout size={15} color={sage} />
                        </View>
                        <Text style={[styles.tag, { color: sage }]}>MAZO LEARNED SOMETHING</Text>
                    </View>

                    {editing ? (
                        <TextInput
                            value={draft}
                            onChangeText={setDraft}
                            multiline
                            autoFocus
                            style={[styles.input, { color: colors.text, borderColor: sageBorder, backgroundColor: sageSoft }]}
                            placeholder="Say it the way it's true for you…"
                            placeholderTextColor={colors.textTertiary}
                        />
                    ) : (
                        <Text style={[styles.insight, { color: colors.text }]}>{insight.text}</Text>
                    )}

                    {editing ? (
                        <View style={styles.actions}>
                            <Pressable
                                style={[styles.btn, styles.primary, { backgroundColor: sage }]}
                                onPress={() => { hapticSuccess(); onCorrect(draft.trim() || insight.text); }}
                            >
                                <Check size={17} color="#FFFFFF" />
                                <Text style={styles.primaryText}>Save it</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.btn, styles.ghost, { borderColor: sageBorder }]}
                                onPress={() => { hapticTap(); setEditing(false); }}
                            >
                                <Text style={[styles.ghostText, { color: colors.textSecondary }]}>Back</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.actions}>
                            <Pressable
                                style={[styles.btn, styles.primary, { backgroundColor: sage }]}
                                onPress={() => { hapticSuccess(); onConfirm(); }}
                            >
                                <Check size={17} color="#FFFFFF" />
                                <Text style={styles.primaryText}>Yes, that&apos;s me</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.btnIcon, { borderColor: sageBorder }]}
                                onPress={() => { hapticTap(); setEditing(true); }}
                            >
                                <Pencil size={16} color={colors.textSecondary} />
                            </Pressable>
                            <Pressable
                                style={[styles.btnIcon, { borderColor: sageBorder }]}
                                onPress={() => { hapticTap(); onDismiss(); }}
                            >
                                <X size={16} color={colors.textTertiary} />
                            </Pressable>
                        </View>
                    )}

                    <Text style={[styles.hint, { color: colors.textTertiary }]}>
                        You&apos;re teaching me. I&apos;ll only remember what you confirm.
                    </Text>
                </Animated.View>
            </KeyboardAvoidingView>
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
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 13 },
    tagIcon: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    tag: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2 },
    insight: { fontSize: 20, lineHeight: 28, fontWeight: '500' as const, marginBottom: 20 },
    input: {
        fontSize: 17,
        lineHeight: 24,
        borderWidth: 1,
        borderRadius: 14,
        padding: 13,
        minHeight: 80,
        marginBottom: 18,
        textAlignVertical: 'top',
    },
    actions: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, paddingVertical: 15, paddingHorizontal: 18 },
    primary: { flex: 1 },
    primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' as const },
    ghost: { borderWidth: 1, paddingHorizontal: 22 },
    ghostText: { fontSize: 15, fontWeight: '600' as const },
    btnIcon: { width: 52, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    hint: { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
