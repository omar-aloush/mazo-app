/**
 * ScreenErrorBoundary — Per-screen error boundary for graceful recovery.
 * Wraps individual tab screens so one crash doesn't take down the whole app.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { RefreshCcw } from 'lucide-react-native';
import { track } from '@/services/analytics';

interface Props {
    children: ReactNode;
    screenName?: string;
}

interface State {
    hasError: boolean;
    errorMessage: string | null;
}

function ScreenFallback({
    onReset,
    screenName,
    errorMessage,
}: {
    onReset: () => void;
    screenName?: string;
    errorMessage?: string | null;
}) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const bg = isDark ? '#141311' : '#FAF8F3';
    const textColor = isDark ? '#ECE7DC' : '#25221C';
    const subtitleColor = isDark ? '#A39B8B' : '#837C6D';
    const buttonBg = isDark ? '#8FB896' : '#6E8E76';

    return (
        <View style={[styles.container, { backgroundColor: bg }]}>
            <Text style={styles.emoji}>😔</Text>
            <Text style={[styles.title, { color: textColor }]}>Something went wrong</Text>
            <Text style={[styles.subtitle, { color: subtitleColor }]}>
                {screenName ? `The ${screenName} screen had a problem.` : 'This screen had a problem.'}
                {'\n'}Tap below to try again.
            </Text>
            {__DEV__ && errorMessage ? (
                <Text
                    style={[styles.errorDetail, { color: '#EF4444' }]}
                    numberOfLines={4}
                >
                    {errorMessage}
                </Text>
            ) : null}
            <Pressable
                style={[styles.button, { backgroundColor: buttonBg }]}
                onPress={onReset}
                accessibilityLabel="Try again"
                accessibilityRole="button"
            >
                <RefreshCcw size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Try Again</Text>
            </Pressable>
        </View>
    );
}

export class ScreenErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, errorMessage: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, errorMessage: error?.message || 'Unknown error' };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`[ScreenErrorBoundary:${this.props.screenName || 'unknown'}]`, error?.message);
        track('error_boundary_triggered', {
            screen: this.props.screenName || 'unknown',
            error: error?.message?.slice(0, 200),
        });
    }

    handleReset = () => {
        this.setState({ hasError: false, errorMessage: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <ScreenFallback
                    onReset={this.handleReset}
                    screenName={this.props.screenName}
                    errorMessage={this.state.errorMessage}
                />
            );
        }
        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    errorDetail: {
        fontSize: 11,
        marginTop: 12,
        textAlign: 'center',
    },
    button: {
        marginTop: 28,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 28,
        borderRadius: 14,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
});

/**
 * HOC wrapper for convenience.
 * Usage: export default withScreenBoundary(MyScreen, 'Chat');
 */
export function withScreenBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    screenName: string,
) {
    const WithBoundary = (props: P) => (
        <ScreenErrorBoundary screenName={screenName}>
            <WrappedComponent {...props} />
        </ScreenErrorBoundary>
    );
    WithBoundary.displayName = `withScreenBoundary(${screenName})`;
    return WithBoundary;
}
