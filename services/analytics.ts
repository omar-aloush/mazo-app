import { Platform } from 'react-native';

// Typed analytics events for consistency
export type AnalyticsEvent =
    | 'app_opened'
    | 'onboarding_completed'
    | 'onboarding_step_completed'
    | 'session_start'
    | 'session_end'
    | 'first_session_completed'
    | 'second_session_completed'
    | 'message_sent'
    | 'voice_message_sent'
    | 'coach_selected'
    | 'custom_coach_created'
    | 'coach_shared'
    | 'coach_imported'
    | 'breakthrough_moment'
    | 'paywall_shown'
    | 'purchase_started'
    | 'purchase_completed'
    | 'purchase_restored'
    | 'referral_sent'
    | 'streak_milestone'
    | 'schedule_generated'
    | 'memory_extracted'
    | 'exit_card_shown'
    | 'exit_card_action_taken'
    | 'share_streak'
    | 'share_breakthrough'
    | 'share_goal'
    | 'daily_focus_tapped'
    | 'memory_insights_shown'
    | 'memory_insights_cta'
    | 'error_boundary_triggered';

/**
 * Initialize analytics (Clean local/no-op mode).
 */
export async function initAnalytics() {
    if (__DEV__) console.log('[Analytics] Initialized (Privacy-first local mode)');
}

/**
 * Identify the current user.
 */
export function identify(userId: string) {
    if (__DEV__) console.log('[Analytics] User identified:', userId);
}

/**
 * Track an analytics event with optional properties.
 */
export function track(event: AnalyticsEvent, properties?: Record<string, any>) {
    if (__DEV__) console.log(`[Analytics] ${event}`, properties || '');
}

/**
 * Set user profile properties.
 */
export function setProfile(properties: Record<string, any>) {
    if (__DEV__) console.log('[Analytics] Profile updated:', properties);
}

/**
 * Increment a numeric profile property.
 */
export function incrementProfile(property: string, value: number = 1) {
    if (__DEV__) console.log(`[Analytics] Increment ${property} by ${value}`);
}

/**
 * Reset analytics state.
 */
export function resetAnalytics() {
    if (__DEV__) console.log('[Analytics] State reset');
}

// ── Funnel & Cohort Helpers ──

export function setUserCohort(props: {
    installDate: string;
    coachType: string;
    language: string;
    appVersion?: string;
}) {
    setProfile({
        install_date: props.installDate,
        coach_type: props.coachType,
        language: props.language,
        platform: Platform.OS,
        app_version: props.appVersion || '1.0.0',
    });
}

export function trackSessionEnd(props: {
    durationSeconds: number;
    messageCount: number;
    memoryItemsExtracted: number;
    breakthroughDetected: boolean;
    coachId: string;
    mode: string;
}) {
    track('session_end', {
        duration_seconds: props.durationSeconds,
        message_count: props.messageCount,
        memory_items: props.memoryItemsExtracted,
        breakthrough: props.breakthroughDetected,
        coach_id: props.coachId,
        mode: props.mode,
    });
}
