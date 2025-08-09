
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
// Re-introduce Session and User types from Supabase v2 for type safety.
import type { Session, User } from '@supabase/supabase-js';
import type { Database } from '../services/database.types';

interface AppUser {
  id: string;
  email?: string;
  name: string;
  avatarUrl: string;
}

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<any>;
  logout: () => Promise<void>;
  updateUser: (data: { name?: string; avatar_url?: string; password?: string }) => Promise<any>;
  signup: (name: string, email: string, password?: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Centralized function to process user data and apply cache-busting
  const processUser = (authUser: User | undefined): AppUser | null => {
    if (!authUser) return null;

    let avatarUrl = authUser.user_metadata.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`;
    
    // Cache-busting logic:
    // If the avatar URL is from Supabase storage, append a timestamp to prevent browser caching.
    // This ensures the latest profile picture is always displayed.
    if (avatarUrl && avatarUrl.includes('supabase.co')) {
        avatarUrl = `${avatarUrl.split('?')[0]}?t=${new Date().getTime()}`;
    }

    return {
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata.name || 'Guru',
        avatarUrl: avatarUrl
    };
  };


  useEffect(() => {
    // v2: supabase.auth.getSession() is asynchronous.
    const getInitialSession = async () => {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(processUser(initialSession?.user));
        setLoading(false);
    };

    getInitialSession();

    // v2: onAuthStateChange returns { data: { subscription } }.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(processUser(session?.user));
      setLoading(false); // Also set loading to false on auth state changes
    });

    return () => {
      // v2: The returned object is the subscription, which has an unsubscribe method.
      subscription?.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    session,
    user,
    loading,
    // v2: use signInWithPassword
    login: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    // v2: signUp has a different signature with `options`
    signup: (name, email, password) => supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          avatar_url: `https://i.pravatar.cc/150?u=${email}`
        }
      }
    }),
    logout: async () => {
        localStorage.removeItem('scheduleNotificationsEnabled');
        await supabase.auth.signOut();
    },
    // v2: use updateUser
    updateUser: (data) => supabase.auth.updateUser({
        password: data.password,
        data: {
            name: data.name,
            avatar_url: data.avatar_url
        }
    }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context as AuthContextType;
};
