import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserProfile } from '../types';
import {
  fetchAuthConfig,
  fetchCurrentUser,
  getAuthToken,
  requestDevToken,
  setAuthToken,
  updateProfile as apiUpdateProfile,
} from '../services/api';
import {
  configureSupabase,
  isSupabaseConfigured,
  supabase,
} from '../services/supabase';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (displayName: string, email: string, password?: string) => Promise<void>;
  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const withTimeout = <T,>(promise: Promise<T>, ms = 3500): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Auth request timed out')), ms)),
  ]);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initial session recovery
  useEffect(() => {
    async function initAuth() {
      // 1. Configure Supabase client dynamically if needed
      if (!isSupabaseConfigured) {
        try {
          const config = await fetchAuthConfig();
          if (config.supabase_url && config.supabase_anon_key) {
            configureSupabase(config.supabase_url, config.supabase_anon_key);
          }
        } catch (e) {
          console.warn('[ThoracicAI] Auth configuration check:', e);
        }
      }

      // 2. Check existing active Supabase session
      let existingToken = getAuthToken();

      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            existingToken = data.session.access_token;
            setAuthToken(existingToken);
            setToken(existingToken);
          }
        } catch (e) {
          console.warn('[ThoracicAI] Supabase session retrieval error:', e);
        }
      }

      if (!existingToken) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await fetchCurrentUser();
        setUser(profile);
      } catch (err: any) {
        console.warn('[ThoracicAI] Token expired or invalid, resetting session.');
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase && password) {
        try {
          const { data, error } = await withTimeout(
            supabase.auth.signInWithPassword({ email, password }),
            3500
          );
          if (!error && data?.session) {
            const accessToken = data.session.access_token;
            setAuthToken(accessToken);
            setToken(accessToken);
            const profile = await fetchCurrentUser();
            setUser(profile);
            return;
          }
          if (error && import.meta.env.PROD) {
            throw error;
          }
        } catch (sbErr) {
          if (import.meta.env.PROD) throw sbErr;
          console.warn('[ThoracicAI] Supabase auth fallback to dev token:', sbErr);
        }
      }

      // Local / Dev token fallback for development and automated testing
      const dev = await requestDevToken(
        email,
        email.split('@')[0] || 'Researcher',
        'RESEARCHER'
      );
      setAuthToken(dev.access_token);
      setToken(dev.access_token);
      setUser(dev.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (displayName: string, email: string, password?: string) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase && password) {
        try {
          const { data, error } = await withTimeout(
            supabase.auth.signUp({
              email,
              password,
              options: {
                data: { display_name: displayName, role: 'RESEARCHER' },
              },
            }),
            3500
          );
          if (!error && data?.session) {
            const accessToken = data.session.access_token;
            setAuthToken(accessToken);
            setToken(accessToken);
            const profile = await fetchCurrentUser();
            setUser(profile);
            return;
          }
          if (error && import.meta.env.PROD) {
            throw error;
          }
        } catch (sbErr) {
          if (import.meta.env.PROD) throw sbErr;
          console.warn('[ThoracicAI] Supabase auth fallback to dev token:', sbErr);
        }
      }

      // Local / Dev token fallback for development and automated testing
      const dev = await requestDevToken(email, displayName, 'RESEARCHER');
      setAuthToken(dev.access_token);
      setToken(dev.access_token);
      setUser(dev.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch(console.error);
    }
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
    }
  };

  const updateDisplayName = async (name: string) => {
    const updated = await apiUpdateProfile(name);
    setUser(updated);
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAdmin,
        login,
        register,
        logout,
        resetPassword,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
