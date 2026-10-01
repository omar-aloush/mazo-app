import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

// Required for web browser flow
WebBrowser.maybeCompleteAuthSession();

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  isAnonymous: boolean;
}

let sessionPromise: Promise<Session> | null = null;

function mapAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name,
    isAnonymous: user.is_anonymous === true,
  };
}

/**
 * Return a verified Supabase session, creating an anonymous account for
 * device-first users when needed. The shared promise prevents concurrent
 * first AI requests from creating multiple anonymous accounts.
 */
export async function ensureAuthSession(): Promise<Session> {
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const { data: existing, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (existing.session) return existing.session;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) {
      throw new Error(error?.message || 'Could not create a secure AI session.');
    }
    return data.session;
  })();

  try {
    return await sessionPromise;
  } finally {
    sessionPromise = null;
  }
}

export async function signInWithGoogle(): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    const redirectUrl = makeRedirectUri({
      scheme: 'mazo',
      path: 'auth/callback',
    });

    // Serialize OAuth with first-run anonymous session creation so identity
    // linking cannot race a parallel ensureAuthSession() call.
    const currentSession = await ensureAuthSession();
    const authRequest = currentSession.user.is_anonymous
      ? await supabase.auth.linkIdentity({
          provider: 'google',
          options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
        })
      : await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
        });

    if (authRequest.error || !authRequest.data.url) {
      return { user: null, error: authRequest.error?.message || 'Could not start Google sign-in' };
    }

    const result = await WebBrowser.openAuthSessionAsync(authRequest.data.url, redirectUrl, {
      showInRecents: true,
    });

    if (result.type === 'success' && result.url) {
      // Extract the access token and refresh token from the URL
      const urlObj = new URL(result.url.replace('#', '?'));
      const params = new URLSearchParams(urlObj.search);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          return { user: null, error: error.message };
        }

        if (data.user) {
          return { user: mapAuthUser(data.user), error: null };
        }
      }
    } else if (result.type === 'cancel' || result.type === 'dismiss') {
      return { user: null, error: 'User cancelled login' };
    }

    return { user: null, error: 'Login failed' };
  } catch (error: any) {
    console.error('[Auth] Google Sign-In error:', error);
    return { user: null, error: error.message || 'An unexpected error occurred' };
  }
}

export async function signOut(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('[Auth] Sign out error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Auth] Sign out exception:', error);
    return false;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return mapAuthUser(user);
  } catch (error) {
    console.warn('[Auth] Get user error:', error);
    return null;
  }
}
