import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme, ScrollView } from 'react-native';
import { AIFace } from '@/components/AIFace';
import { RefreshCcw } from 'lucide-react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
  errorStack: string | null;
}

function ErrorFallback({ onReset, errorMessage, errorStack }: { onReset: () => void; errorMessage?: string | null; errorStack?: string | null }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bg = isDark ? '#141311' : '#FAF8F3';
  const textColor = isDark ? '#ECE7DC' : '#25221C';
  const subtitleColor = isDark ? '#A39B8B' : '#837C6D';
  const buttonBg = isDark ? '#8FB896' : '#6E8E76';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <AIFace expression="concerned" size={120} />
      <Text style={[styles.title, { color: textColor }]}>Something went wrong</Text>
      <Text style={[styles.subtitle, { color: subtitleColor }]}>Don't worry, let's try again</Text>
      
      {__DEV__ && (errorMessage || errorStack) ? (
        <ScrollView style={styles.errorBox}>
          <Text style={styles.errorText}>
            {errorStack || errorMessage}
          </Text>
        </ScrollView>
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

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null, errorStack: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'Unknown error', errorStack: error?.stack || null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('=== [ErrorBoundary] Caught error ===', error);
    console.error('Stack:', error?.stack);
    console.error('Component stack:', errorInfo?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: null, errorStack: null });
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          onReset={this.handleReset}
          errorMessage={this.state.errorMessage}
          errorStack={this.state.errorStack}
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
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
  },
  errorBox: {
    maxHeight: 180,
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  button: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
