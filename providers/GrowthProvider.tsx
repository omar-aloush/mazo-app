/**
 * GrowthProvider — owns trial, streak, referral, and smart paywall triggers.
 * Extracted from AppProvider lines 1248-1351.
 */

import React, { createContext, useContext, useCallback, useEffect, useMemo } from 'react';
import { useStorage } from './StorageProvider';
import { calculateStreak } from '@/services/engagement';
import { sendStreakMilestoneNotification } from '@/services/notifications';
import { maybeRequestReview } from '@/services/storeReview';
import { getAppConfig } from '@/services/remoteConfig';
import { redeemVoucherCode } from '@/services/iap';

// ── Context Shape ───────────────────────────────────────────

export type ShareMomentType = 'streak' | 'breakthrough' | 'goal';

export interface PendingShareMoment {
    type: ShareMomentType;
    title: string;
    subtitle: string;
    data?: Record<string, any>;
}

interface GrowthContextValue {
    streak: {
        currentStreak: number;
        longestStreak: number;
        lastActiveDate: string;
        totalSessions: number;
    };
    sessionDates: string[];
    pendingShareMoment: PendingShareMoment | null;
    referralCode: string | null;
    smartPaywallTriggers: Record<string, boolean>;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    trialExpired: boolean;
    hasSeenSystemReady: boolean;
    showSystemReadyScreen: boolean;
    trialDaysRemaining: number;
    isTrialActive: boolean;
    updateStreak: () => void;
    markSmartPaywallTrigger: (trigger: string) => void;
    setReferralCode: (code: string) => void;
    redeemVoucher: (code: string) => Promise<{ success: boolean; message: string; expiresAt?: string }>;
    queueShareMoment: (moment: PendingShareMoment) => void;
    dismissShareMoment: () => void;
    triggerSystemReadyScreen: () => void;
    dismissSystemReadyScreen: () => void;
}

const GrowthContext = createContext<GrowthContextValue | null>(null);

export function useGrowth(): GrowthContextValue {
    const ctx = useContext(GrowthContext);
    if (!ctx) throw new Error('useGrowth must be used within GrowthProvider');
    return ctx;
}

// ── Provider ────────────────────────────────────────────────

export function GrowthProvider({ children }: { children: React.ReactNode }) {
    const { state, setState, persistState, isLoaded, getUserId } = useStorage();

    // ── Auto-initialize Trial ─────────────────────────────
    useEffect(() => {
        if (!isLoaded || state.trialStartedAt) return;
        (async () => {
            try {
                const config = await getAppConfig();
                if (!config.trial_enabled) return;

                // IMPORTANT: Check Supabase first — prevents trial reset on reinstall
                const userId = getUserId();
                if (userId) {
                    const { checkSubscriptionStatus } = await import('@/services/subscription');
                    const status = await checkSubscriptionStatus();
                    // If Supabase already has this user with an expired trial, don't grant again
                    if (status.source === 'trial' && !status.isPro) {
                        // Trial was already used and expired — mark locally as expired
                        setState((prev) => {
                            if (prev.trialStartedAt) return prev;
                            const newState = {
                                ...prev,
                                trialStartedAt: new Date().toISOString(),
                                trialEndsAt: new Date().toISOString(), // expired immediately
                                trialExpired: true,
                            };
                            persistState(newState);
                            return newState;
                        });
                        return;
                    }
                    // If Supabase says user is already pro with active trial, sync locally
                    if (status.isPro && status.source === 'trial' && status.expiresAt) {
                        setState((prev) => {
                            if (prev.trialStartedAt) return prev;
                            const newState = {
                                ...prev,
                                trialStartedAt: new Date().toISOString(),
                                trialEndsAt: status.expiresAt!,
                            };
                            persistState(newState);
                            return newState;
                        });
                        return;
                    }
                }

                // Fresh user — grant new trial
                const now = new Date();
                const endsAt = new Date(now.getTime() + (config.trial_days ?? 7) * 24 * 60 * 60 * 1000);
                setState((prev) => {
                    if (prev.trialStartedAt) return prev;
                    const newState = {
                        ...prev,
                        trialStartedAt: now.toISOString(),
                        trialEndsAt: endsAt.toISOString(),
                    };
                    persistState(newState);
                    return newState;
                });
            } catch { /* silently skip */ }
        })();
    }, [isLoaded, state.trialStartedAt, setState, persistState, getUserId]);

    // ── Cohort Properties (Analytics) ─────────────────────
    useEffect(() => {
        if (!isLoaded) return;
        Promise.all([
            import('@/services/analytics'),
            import('expo-localization'),
        ]).then(([analytics, loc]) => {
            const lang = loc.getLocales?.()?.[0]?.languageCode || 'en';
            analytics.setUserCohort({
                installDate: state.trialStartedAt || new Date().toISOString().split('T')[0],
                coachType: state.selectedCoachId || 'none',
                language: lang,
            });
        }).catch(() => { });
    }, [isLoaded]);

    // ── Trial Computed Values ─────────────────────────────

    const trialDaysRemaining = useMemo(() => {
        if (!state.trialEndsAt || state.trialExpired) return 0;
        const remaining = Math.ceil((new Date(state.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return Math.max(0, remaining);
    }, [state.trialEndsAt, state.trialExpired]);

    const isTrialActive = useMemo(() => {
        return !!state.trialStartedAt && !state.trialExpired && trialDaysRemaining > 0;
    }, [state.trialStartedAt, state.trialExpired, trialDaysRemaining]);

    // ── Check Trial Expiry ────────────────────────────────
    useEffect(() => {
        if (!state.trialEndsAt || state.trialExpired) return;
        if (trialDaysRemaining <= 0) {
            setState((prev) => {
                const newState = { ...prev, trialExpired: true };
                persistState(newState);
                return newState;
            });
        }
    }, [trialDaysRemaining, state.trialEndsAt, state.trialExpired, setState, persistState]);

    // ── Streak ────────────────────────────────────────────

    const updateStreak = useCallback(() => {
        setState((prev) => {
            const result = calculateStreak(prev.streak);
            const today = new Date().toISOString().split('T')[0];
            const prevDates = prev.sessionDates || [];
            const updatedDates = prevDates.includes(today)
                ? prevDates
                : [...prevDates, today].slice(-7);
            let newState: typeof prev = {
                ...prev,
                streak: {
                    currentStreak: result.currentStreak,
                    longestStreak: result.longestStreak,
                    lastActiveDate: result.lastActiveDate,
                    totalSessions: result.totalSessions,
                },
                sessionDates: updatedDates,
            };
            persistState(newState);

            if (result.milestoneReached) {
                sendStreakMilestoneNotification(result.milestoneReached).catch(() => { });
                if (result.milestoneReached >= 7) {
                    maybeRequestReview(`streak_${result.milestoneReached}` as any).catch(() => { });
                }
                // Queue a share moment for viral growth
                newState = {
                    ...newState,
                    pendingShareMoment: {
                        type: 'streak' as const,
                        title: `${result.milestoneReached}-Day Streak! 🔥`,
                        subtitle: 'Share your coaching streak with friends',
                        data: { streak: result.milestoneReached },
                    },
                };
            }

            return newState;
        });
    }, [setState, persistState]);

    // ── Smart Paywall Triggers ────────────────────────────

    const markSmartPaywallTrigger = useCallback((trigger: string) => {
        setState((prev) => {
            if (prev.smartPaywallTriggers[trigger]) return prev;
            const newState = {
                ...prev,
                smartPaywallTriggers: {
                    ...prev.smartPaywallTriggers,
                    [trigger]: true,
                },
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const setReferralCode = useCallback((code: string) => {
        setState((prev) => {
            const newState = { ...prev, referralCode: code };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    const queueShareMoment = useCallback((moment: PendingShareMoment) => {
        setState((prev) => ({ ...prev, pendingShareMoment: moment }));
    }, [setState]);

    const dismissShareMoment = useCallback(() => {
        setState((prev) => ({ ...prev, pendingShareMoment: null }));
    }, [setState]);

    const redeemVoucher = useCallback(async (code: string): Promise<{ success: boolean; message: string; expiresAt?: string }> => {
        return await redeemVoucherCode(code);
    }, []);

    // ── System Ready ──────────────────────────────────────

    const triggerSystemReadyScreen = useCallback(() => {
        setState((prev) => {
            if (prev.hasSeenSystemReady) return prev;
            return { ...prev, showSystemReadyScreen: true };
        });
    }, [setState]);

    const dismissSystemReadyScreen = useCallback(() => {
        setState((prev) => {
            const newState = {
                ...prev,
                showSystemReadyScreen: false,
                hasSeenSystemReady: true,
            };
            persistState(newState);
            return newState;
        });
    }, [setState, persistState]);

    // ── Memoized Value ────────────────────────────────────

    const value = useMemo<GrowthContextValue>(() => ({
        streak: state.streak,
        sessionDates: state.sessionDates || [],
        pendingShareMoment: state.pendingShareMoment || null,
        referralCode: state.referralCode,
        smartPaywallTriggers: state.smartPaywallTriggers,
        trialStartedAt: state.trialStartedAt,
        trialEndsAt: state.trialEndsAt,
        trialExpired: state.trialExpired,
        hasSeenSystemReady: state.hasSeenSystemReady,
        showSystemReadyScreen: state.showSystemReadyScreen,
        trialDaysRemaining,
        isTrialActive,
        updateStreak,
        markSmartPaywallTrigger,
        setReferralCode,
        redeemVoucher,
        queueShareMoment,
        dismissShareMoment,
        triggerSystemReadyScreen,
        dismissSystemReadyScreen,
    }), [
        state.streak,
        state.sessionDates,
        state.pendingShareMoment,
        state.referralCode,
        state.smartPaywallTriggers,
        state.trialStartedAt,
        state.trialEndsAt,
        state.trialExpired,
        state.hasSeenSystemReady,
        state.showSystemReadyScreen,
        trialDaysRemaining,
        isTrialActive,
        updateStreak,
        markSmartPaywallTrigger,
        setReferralCode,
        redeemVoucher,
        queueShareMoment,
        dismissShareMoment,
        triggerSystemReadyScreen,
        dismissSystemReadyScreen,
    ]);

    return (
        <GrowthContext.Provider value={value}>
            {children}
        </GrowthContext.Provider>
    );
}
