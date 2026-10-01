import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AuthUser, getCurrentUser, signInWithGoogle, signOut as authSignOut } from '@/services/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  signOut: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (mounted) {
          setUser(currentUser);
        }
      } catch (err) {
        console.warn('[AuthProvider] Init error:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    try {
      const { user: newUser, error } = await signInWithGoogle();
      if (newUser) {
        setUser(newUser);
        return { success: true, user: newUser };
      }
      return { success: false, error: error || 'Failed to sign in' };
    } catch (err: any) {
      console.warn('[AuthProvider] Sign in error:', err);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      const signedOut = await authSignOut();
      if (!signedOut) return false;
      setUser(null);
      return true;
    } catch (err) {
      console.warn('[AuthProvider] Sign out error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: !!user && !user.isAnonymous,
    isLoading,
    signIn,
    signOut,
  }), [user, isLoading, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
