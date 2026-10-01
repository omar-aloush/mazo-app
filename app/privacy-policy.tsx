import React from 'react';
import { View, ScrollView, StyleSheet, Text, Pressable, Linking, I18nManager } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { Shield, Database, Eye, Users, Lock, Baby, RefreshCw, Mail, ChevronLeft, ExternalLink } from 'lucide-react-native';

export default function PrivacyPolicyScreen() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const router = useRouter();

    const sections = [
        {
            icon: Eye,
            title: '1. Introduction',
            body: 'Mazō ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.\n\nBy using Mazō, you agree to the collection and use of information in accordance with this policy.',
        },
        {
            icon: Database,
            title: '2. Information We Collect',
            body: null,
            subsections: [
                {
                    subtitle: 'Personal Information',
                    items: [
                        'Name and age (if provided during onboarding)',
                        'Values, focus areas, and personal goals',
                        'Chat messages with AI coaches',
                        'Goals, tasks, habits, and schedule items',
                    ],
                },
                {
                    subtitle: 'Usage Data',
                    items: [
                        'App usage analytics (session duration, features used)',
                        'Device type and operating system',
                        'Language preferences',
                        'Crash reports for app stability',
                    ],
                },
            ],
        },
        {
            icon: Shield,
            title: '3. How We Use Your Information',
            body: null,
            items: [
                'Provide personalized AI coaching experiences',
                'Remember your preferences and conversation context',
                'Improve app features and performance',
                'Send optional daily check-in notifications',
                'Process subscription purchases',
            ],
        },
        {
            icon: Lock,
            title: '4. Data Storage & Security',
            body: 'Your profile, coaching history, goals, and preferences are stored locally in the app on your device. Messages you send to an AI coach are transmitted to our AI provider to generate a response. Community, account, and subscription features may store the minimum data needed in our backend.\n\nWe do not sell your personal information or share it with third parties for marketing purposes.',
        },
        {
            icon: Users,
            title: '5. Third-Party Services',
            body: 'We use the following trusted services to operate Mazō:',
            items: [
                'Supabase — Community coach sharing and subscription management',
                'RevenueCat — Subscription and payment processing',
                'OpenAI — AI coaching conversation processing',
            ],
            footer: 'Each service operates under its own privacy policy. We only share the minimum data necessary for each service to function.',
        },
        {
            icon: Shield,
            title: '6. Your Rights',
            body: 'You have the right to:',
            items: [
                'Access all data stored about you',
                'Delete locally stored coaching data from Settings',
                'Opt out of analytics tracking',
                'Disable notifications',
                'Cancel your subscription at any time',
            ],
        },
        {
            icon: Baby,
            title: "7. Children's Privacy",
            body: "Mazō is not intended for children under 13. We do not knowingly collect personal information from children. If you are a parent and believe your child has provided us with personal data, please contact us and we will delete it.",
        },
        {
            icon: RefreshCw,
            title: '8. Changes to This Policy',
            body: 'We may update this Privacy Policy from time to time. We will notify you of changes by posting the new policy within the app and updating the "Last updated" date. Continued use of the app constitutes acceptance of any changes.',
        },
        {
            icon: Mail,
            title: '9. Contact Us',
            body: 'If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us:',
            contact: true,
        },
    ];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('settings.privacyPolicy'),
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                }}
            />
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header badge */}
                <View style={[styles.headerBadge, { backgroundColor: isDark ? 'rgba(108,92,231,0.1)' : 'rgba(108,92,231,0.06)' }]}>
                    <Shield size={20} color="#6C5CE7" />
                    <Text style={[styles.headerBadgeText, { color: '#6C5CE7' }]}>
                        Your privacy is our priority
                    </Text>
                </View>

                <Text style={[styles.lastUpdated, { color: colors.textTertiary }]}>
                    Last updated: March 20, 2026
                </Text>

                {sections.map((section, index) => {
                    const Icon = section.icon;
                    return (
                        <View key={index} style={[styles.section, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                            <View style={styles.sectionHeader}>
                                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(108,92,231,0.12)' : 'rgba(108,92,231,0.08)' }]}>
                                    <Icon size={16} color="#6C5CE7" />
                                </View>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                    {section.title}
                                </Text>
                            </View>

                            {section.body && (
                                <Text style={[styles.body, { color: colors.textSecondary }]}>
                                    {section.body}
                                </Text>
                            )}

                            {section.subsections && section.subsections.map((sub, si) => (
                                <View key={si} style={{ marginTop: si > 0 ? 12 : 4 }}>
                                    <Text style={[styles.subTitle, { color: colors.text }]}>
                                        {sub.subtitle}
                                    </Text>
                                    {sub.items.map((item, ii) => (
                                        <View key={ii} style={styles.bulletRow}>
                                            <View style={[styles.bullet, { backgroundColor: '#6C5CE7' }]} />
                                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                                                {item}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ))}

                            {section.items && (
                                <View style={{ marginTop: section.body ? 8 : 4 }}>
                                    {section.items.map((item, ii) => (
                                        <View key={ii} style={styles.bulletRow}>
                                            <View style={[styles.bullet, { backgroundColor: '#6C5CE7' }]} />
                                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                                                {item}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {section.footer && (
                                <Text style={[styles.body, { color: colors.textTertiary, marginTop: 8, fontSize: 12, fontStyle: 'italic' }]}>
                                    {section.footer}
                                </Text>
                            )}

                            {section.contact && (
                                <Pressable
                                    onPress={() => Linking.openURL('mailto:support@mazo.app')}
                                    style={[styles.contactButton, { backgroundColor: isDark ? 'rgba(108,92,231,0.12)' : 'rgba(108,92,231,0.08)' }]}
                                >
                                    <Mail size={14} color="#6C5CE7" />
                                    <Text style={[styles.contactText, { color: '#6C5CE7' }]}>
                                        support@mazo.app
                                    </Text>
                                    <ExternalLink size={12} color="#6C5CE7" style={{ opacity: 0.6 }} />
                                </Pressable>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 12,
    },
    headerBadgeText: {
        fontSize: 13,
        fontWeight: '600',
    },
    lastUpdated: {
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 20,
    },
    section: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    iconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        flex: 1,
    },
    subTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
    },
    body: {
        fontSize: 13,
        lineHeight: 20,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 6,
        paddingLeft: 4,
    },
    bullet: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginTop: 7,
        marginRight: 10,
    },
    bulletText: {
        fontSize: 13,
        lineHeight: 20,
        flex: 1,
    },
    contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 10,
        alignSelf: 'flex-start',
    },
    contactText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
