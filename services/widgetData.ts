/**
 * Widget Data Service — Unified
 *
 * Shares app state with native home screen widgets.
 * Single data model covering: coach face, streak, top task, North Star goal, next alarm.
 *
 * iOS:  App Groups shared UserDefaults
 * Android: SharedPreferences
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import { setWidgetData as nativeSetWidgetData } from '@/modules/mazo-focus-guard';

const WIDGET_DATA_KEY = 'mazo_widget_data';
const WIDGET_PREFS_KEY = 'mazo_widget_prefs';

// ── Data Model ──

export interface WidgetData {
    /** Face expression for the coach */
    expression: 'idle' | 'happy' | 'curious' | 'thinking' | 'proud' | 'focused';
    /** Mood label (no emojis) */
    moodLabel: string;
    /** Contextual message */
    message: string;
    /** User name */
    userName: string;
    /** Streak count */
    streakCount: number;
    /** Coach name */
    coachName: string;
    /** Coach accent color hex */
    coachColor: string;
    /** Top pending task title */
    topTask: string;
    /** North Star (long-term) goal title */
    northStarGoal: string;
    /** Next alarm time string e.g. "7:00 AM" */
    nextAlarmTime: string;
    /** Energy 0-100 */
    energy: number;
    /** Last sync */
    updatedAt: string;
}

export interface WidgetPreferences {
    showStreak: boolean;
    showTask: boolean;
    showGoal: boolean;
    theme: 'auto' | 'dark' | 'light';
}

const DEFAULT_WIDGET_PREFS: WidgetPreferences = {
    showStreak: true,
    showTask: true,
    showGoal: true,
    theme: 'auto',
};

// ── Expression from energy ──

function getExpression(energy: number): WidgetData['expression'] {
    if (energy >= 80) return 'proud';
    if (energy >= 60) return 'happy';
    if (energy >= 40) return 'curious';
    if (energy >= 20) return 'thinking';
    return 'idle';
}

function getMoodLabel(expression: string): string {
    switch (expression) {
        case 'proud': return 'Thriving';
        case 'happy': return 'Active';
        case 'curious': return 'Building';
        case 'thinking': return 'Reflecting';
        case 'focused': return 'Focused';
        default: return 'Ready';
    }
}

function getMessage(expression: string, userName?: string, topTask?: string): string {
    const name = userName?.trim();
    if (topTask) {
        return `Next: ${topTask}`;
    }
    switch (expression) {
        case 'proud': return name ? `Amazing progress, ${name}!` : 'Amazing progress!';
        case 'happy': return name ? `Keep going, ${name}!` : 'Keep going!';
        case 'curious': return name ? `What's next, ${name}?` : "What's on your mind?";
        case 'focused': return 'Deep in focus mode';
        case 'thinking': return name ? `Let's reflect, ${name}` : "Let's reflect together";
        default: return name ? `Hey ${name}, ready to chat?` : 'Ready when you are';
    }
}

// ── Public API ──

/**
 * Update widget with current app state.
 * Call from Journey page useEffect whenever state changes.
 */
export async function updateWidgetData(params: {
    energy: number;
    userName?: string;
    streakCount?: number;
    coachName?: string;
    coachColor?: string;
    topTask?: string;
    northStarGoal?: string;
    nextAlarmTime?: string;
    expressionOverride?: WidgetData['expression'];
}): Promise<void> {
    try {
        const expression = params.expressionOverride || getExpression(params.energy);
        const data: WidgetData = {
            expression,
            moodLabel: getMoodLabel(expression),
            message: getMessage(expression, params.userName, params.topTask),
            userName: params.userName || '',
            streakCount: params.streakCount || 0,
            coachName: params.coachName || '',
            coachColor: params.coachColor || '',
            topTask: params.topTask || '',
            northStarGoal: params.northStarGoal || '',
            nextAlarmTime: params.nextAlarmTime || '',
            energy: params.energy,
            updatedAt: new Date().toISOString(),
        };

        await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(data));

        // Write to native shared storage
        if (Platform.OS === 'ios') {
            try {
                const SharedGroupPreferences = NativeModules.SharedGroupPreferences;
                if (SharedGroupPreferences) {
                    await SharedGroupPreferences.setItem(
                        WIDGET_DATA_KEY,
                        JSON.stringify(data),
                        'group.app.rork.mazo'
                    );
                }
            } catch {
                if (__DEV__) console.log('[Widget] iOS shared prefs not available');
            }
        } else if (Platform.OS === 'android') {
            try {
                nativeSetWidgetData(JSON.stringify(data));
            } catch {
                if (__DEV__) console.log('[Widget] native setWidgetData unavailable');
            }
        }

        if (__DEV__) console.log('[Widget] Synced:', expression, params.topTask || '(no task)');
    } catch (error) {
        console.warn('[Widget] Failed to update:', error);
    }
}

/** Get cached widget data */
export async function getWidgetData(): Promise<WidgetData | null> {
    try {
        const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/** Get widget preferences */
export async function getWidgetPreferences(): Promise<WidgetPreferences> {
    try {
        const raw = await AsyncStorage.getItem(WIDGET_PREFS_KEY);
        return raw ? { ...DEFAULT_WIDGET_PREFS, ...JSON.parse(raw) } : DEFAULT_WIDGET_PREFS;
    } catch {
        return DEFAULT_WIDGET_PREFS;
    }
}

/** Save widget preferences */
export async function saveWidgetPreferences(prefs: Partial<WidgetPreferences>): Promise<void> {
    try {
        const current = await getWidgetPreferences();
        const updated = { ...current, ...prefs };
        await AsyncStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(updated));
    } catch {
        console.warn('[Widget] Failed to save preferences');
    }
}
