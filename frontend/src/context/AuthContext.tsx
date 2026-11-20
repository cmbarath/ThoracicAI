import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserProfile } from '../types';
import {
  fetchCurrentUser,
  getAuthToken,
  requestDevToken,
  setAuthToken,
  updateProfile as apiUpdateProfile,
} from '../services/api';
import { isSupabaseConfigured, supabase } from '../services/supabase';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (displayName: string, email: string, password?: string) => Promise<void>;
  logout: () => void;
  updateDisplayName: (displayName: string) => Promise<void>;
  switchRole: (role: 'ADMIN' | 'RESEARCHER') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initial session recovery
  useEffect(() => {
    async function initAuth() {
      const existingToken = getAuthToken();
      if (!existingToken) {
        // Automatically provision a default researcher session for immediate review if no session exists
        try {
          const dev = await requestDevToken(
            'researcher@thoracicai.org',
            'Dr. Sarah Chen',
            'RESEARCHER'
          );
          setAuthToken(dev.access_token);
          setToken(dev.access_token);
          setUser(dev.user);
        } catch (e) {
          console.warn('[ThoracicAI] Auth initialization fallback:', e);
        }
        setIsLoading(false);
        return;
      }

      try {
        const profile = await fetchCurrentUser();
        setUser(profile);
      } catch (err) {
        console.warn('[ThoracicAI] Token expired or invalid, clearing session.');
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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) {
          const accessToken = data.session.access_token;
          setAuthToken(accessToken);
          setToken(accessToken);
          const profile = await fetchCurrentUser();
          setUser(profile);
          return;
        }
      }

      // Local / Offline fallback
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName, role: 'RESEARCHER' },
          },
        });
        if (error) throw error;
        if (data.session) {
          const accessToken = data.session.access_token;
          setAuthToken(accessToken);
          setToken(accessToken);
          const profile = await fetchCurrentUser();
          setUser(profile);
          return;
        }
      }

      // Local / Offline fallback
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

  const updateDisplayName = async (name: string) => {
    const updated = await apiUpdateProfile(name);
    setUser(updated);
  };

  const switchRole = async (targetRole: 'ADMIN' | 'RESEARCHER') => {
    if (!user) return;
    setIsLoading(true);
    try {
      const dev = await requestDevToken(user.email, user.display_name, targetRole);
      setAuthToken(dev.access_token);
      setToken(dev.access_token);
      setUser(dev.user);
    } finally {
      setIsLoading(false);
    }
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
        updateDisplayName,
        switchRole,
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
