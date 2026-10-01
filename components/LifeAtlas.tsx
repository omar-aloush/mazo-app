import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
} from 'react-native';
import { Heart, Target, Sparkles, CheckSquare, ChevronRight, Zap } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useTheme } from '@/providers/ThemeProvider';

interface AtlasNode {
    id: string;
    label: string;
    type: 'value' | 'goal' | 'habit' | 'task';
    status?: 'active' | 'completed' | 'pending';
    connectedTo?: string[];
}

interface LifeAtlasProps {
    values: string;
    goals: Array<{ id: string; title: string; status: string }>;
    habits: Array<{ id: string; title: string; streak?: number }>;
    tasks: Array<{ id: string; title: string; status: string; priority: string }>;
    onNodePress?: (node: AtlasNode) => void;
}

const nodeColors = {
    value: '#8B5CF6',
    goal: '#22C55E',
    habit: '#F59E0B',
    task: '#3B82F6',
};

const nodeIcons = {
    value: Heart,
    goal: Target,
    habit: Sparkles,
    task: CheckSquare,
};

export const LifeAtlas: React.FC<LifeAtlasProps> = ({
    values,
    goals,
    habits,
    tasks,
    onNodePress,
}) => {
    const { colors } = useTheme();

    const valueNodes = useMemo(() => {
        if (!values) return [];
        return values.split(',').map((v, idx) => ({
            id: `value-${idx}`,
            label: v.trim(),
            type: 'value' as const,
        })).filter(n => n.label.length > 0).slice(0, 4);
    }, [values]);

    const goalNodes = useMemo(() => {
        return goals
            .filter(g => g.status === 'active')
            .slice(0, 4)
            .map(g => ({
                id: g.id,
                label: g.title,
                type: 'goal' as const,
                status: g.status as 'active',
            }));
    }, [goals]);

    const habitNodes = useMemo(() => {
        return habits.slice(0, 4).map(h => ({
            id: h.id,
            label: h.title,
            type: 'habit' as const,
            status: 'active' as const,
        }));
    }, [habits]);

    const taskNodes = useMemo(() => {
        return tasks
            .filter(t => t.status === 'pending' && t.priority === 'high')
            .slice(0, 4)
            .map(t => ({
                id: t.id,
                label: t.title,
                type: 'task' as const,
                status: 'pending' as const,
            }));
    }, [tasks]);

    const renderLayer = (
        title: string,
        nodes: AtlasNode[],
        type: 'value' | 'goal' | 'habit' | 'task'
    ) => {
        const Icon = nodeIcons[type];
        const color = nodeColors[type];

        if (nodes.length === 0) {
            return (
                <View key={type} style={styles.layer}>
                    <View style={styles.layerHeader}>
                        <View style={[styles.layerIcon, { backgroundColor: `${color}20` }]}>
                            <Icon size={16} color={color} />
                        </View>
                        <Text style={[styles.layerTitle, { color: colors.text }]}>{title}</Text>
                    </View>
                    <View style={[styles.emptyLayer, { backgroundColor: colors.background }]}>
                        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No {(title || '').toLowerCase()} yet</Text>
                    </View>
                </View>
            );
        }

        return (
            <View key={type} style={styles.layer}>
                <View style={styles.layerHeader}>
                    <View style={[styles.layerIcon, { backgroundColor: `${color}20` }]}>
                        <Icon size={16} color={color} />
                    </View>
                    <Text style={[styles.layerTitle, { color: colors.text }]}>{title}</Text>
                    <View style={[styles.layerCount, { backgroundColor: colors.background }]}>
                        <Text style={[styles.layerCountText, { color }]}>{nodes.length}</Text>
                    </View>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.nodesRow}
                >
                    {nodes.map((node) => (
                        <Pressable
                            key={node.id}
                            style={[styles.node, { borderColor: color, backgroundColor: colors.background }]}
                            onPress={() => {
                                onNodePress?.(node);
                            }}
                        >
                            <Text style={[styles.nodeLabel, { color: colors.text }]} numberOfLines={2}>
                                {node.label}
                            </Text>
                            <ChevronRight size={14} color={colors.textSecondary} />
                        </Pressable>
                    ))}
                </ScrollView>
                <View style={[styles.connector, { backgroundColor: color }]} />
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <View style={styles.header}>
                <Zap size={20} color={colors.accent} />
                <Text style={[styles.title, { color: colors.text }]}>Life Atlas</Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Your values drive your goals, goals shape habits, habits complete tasks
            </Text>

            <View style={styles.atlasContent}>
                {renderLayer('Values', valueNodes, 'value')}
                {renderLayer('Goals', goalNodes, 'goal')}
                {renderLayer('Habits', habitNodes, 'habit')}
                {renderLayer('Tasks', taskNodes, 'task')}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 20,
        marginHorizontal: 16,
        marginVertical: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '700' as const,
        color: Colors.text,
    },
    subtitle: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginBottom: 20,
        lineHeight: 18,
    },
    atlasContent: {
        gap: 0,
    },
    layer: {
        marginBottom: 8,
    },
    layerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    layerIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    layerTitle: {
        fontSize: 14,
        fontWeight: '600' as const,
        color: Colors.text,
        flex: 1,
    },
    layerCount: {
        backgroundColor: Colors.background,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    layerCountText: {
        fontSize: 12,
        fontWeight: '600' as const,
    },
    emptyLayer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: Colors.background,
        borderRadius: 12,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 13,
        color: Colors.textTertiary,
        fontStyle: 'italic',
    },
    nodesRow: {
        gap: 8,
        paddingBottom: 8,
    },
    node: {
        backgroundColor: Colors.background,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        maxWidth: 180,
    },
    nodeLabel: {
        fontSize: 13,
        fontWeight: '500' as const,
        color: Colors.text,
        flex: 1,
    },
    connector: {
        width: 2,
        height: 16,
        marginLeft: 13,
        opacity: 0.3,
        borderRadius: 1,
    },
});

