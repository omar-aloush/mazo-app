import React from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';

export default function TermsOfServiceScreen() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { t } = useTranslation();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('settings.termsOfService'),
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                }}
            />
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.lastUpdated, { color: colors.textTertiary }]}>
                    Last updated: February 26, 2026
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Acceptance of Terms</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    By downloading, installing, or using Mazō ("the App"), you agree to be bound by these Terms of Service.  If you do not agree to these terms, please do not use the App.
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Description of Service</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    Mazō is an AI-powered personal coaching application. The App provides conversational coaching, goal tracking, habit building, and schedule management features. Mazō is not a substitute for professional mental health treatment, therapy, or medical advice.
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>3. User Accounts</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    Mazō does not require you to link a personal account. Your profile, coaching history, goals, and preferences are stored locally in the app. Messages sent to an AI coach are processed by our AI provider, and community, account, and subscription features may store the minimum data needed on our servers, as described in our Privacy Policy.
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Subscriptions & Payments</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    Mazō offers both free and premium (Pro) tiers.{'\n\n'}
                    • Free tier: Limited daily sessions, basic coaches, up to 2 custom coaches{'\n'}
                    • Pro tier: Unlimited sessions, all coaches, unlimited custom coaches, and cross-session memory{'\n\n'}
                    Subscriptions are billed through Apple App Store or Google Play Store. You may cancel at any time through your device's subscription settings. Refunds are handled by the respective app store.
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Acceptable Use</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    You agree not to:{'\n\n'}
                    • Use the App for any unlawful purpose{'\n'}
                    • Attempt to reverse-engineer or tamper with the App{'\n'}
                    • Share coaches that contain harmful, hateful, or inappropriate content{'\n'}
                    • Misrepresent AI coaching as professional therapy or medical advice{'\n'}
                    • Use the App in any way that could damage, disable, or impair the service
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>6. AI Coaching Disclaimer</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    The AI coaches in Mazō are powered by large language models. They are designed to help with productivity, clarity, and personal growth. However:{'\n\n'}
                    • AI responses are generated and may not always be accurate{'\n'}
                    • AI coaching is not a replacement for professional advice{'\n'}
                    • If you are experiencing a mental health crisis, please contact a professional or emergency services{'\n'}
                    • We do not guarantee specific outcomes from using the App
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>7. Intellectual Property</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    The App and its content, including but not limited to text, graphics, logos, and software, are the property of Mazō and are protected by intellectual property laws. Custom coaches you create remain your intellectual property.
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>8. Limitation of Liability</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    To the maximum extent permitted by law, Mazō shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App. The App is provided "as is" without warranties of any kind.
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>9. Termination</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    We reserve the right to suspend or terminate access to the App at any time for violations of these terms. You may stop using the App and delete it at any time.
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>10. Changes to Terms</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    We may update these Terms from time to time. Continued use of the App after changes constitutes acceptance of the new terms.
                </Text>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>11. Contact Us</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                    If you have questions about these Terms, please contact us at:{'\n\n'}
                    Email: support@mazo.app
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    lastUpdated: {
        fontSize: 13,
        marginBottom: 24,
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 24,
        marginBottom: 8,
    },
    body: {
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 8,
    },
});
