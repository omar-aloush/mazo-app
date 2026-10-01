import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = 'https://021a08188554447a834962fbb174903b@o4510906684866560.ingest.us.sentry.io/4510906804928512';

/**
 * Initialize Sentry crash reporting.
 * Call once in app root layout.
 */
export function initCrashReporting() {
    if (__DEV__) {
        // Skip Sentry in development to avoid noise
        console.log('[Sentry] Skipped init in dev mode');
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.2,
        enableAutoSessionTracking: true,
        attachScreenshot: true,
    });
}

/**
 * Capture an exception in Sentry.
 */
export function captureException(error: unknown, context?: Record<string, any>) {
    if (__DEV__) {
        console.error('[Sentry] captureException:', error, context);
        return;
    }
    if (context) {
        Sentry.withScope((scope) => {
            scope.setExtras(context);
            Sentry.captureException(error);
        });
    } else {
        Sentry.captureException(error);
    }
}

/**
 * Capture an informational message.
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
    if (__DEV__) {
        console.log(`[Sentry] ${level}:`, message);
        return;
    }
    Sentry.captureMessage(message, level);
}

/**
 * Set the current user ID for error attribution.
 */
export function setUser(id: string) {
    Sentry.setUser({ id });
}

/**
 * Add a breadcrumb for debugging context.
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
    Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
    });
}

/**
 * Wrap the root component with Sentry error boundary.
 */
export const wrap = Sentry.wrap;
