
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

type ScheduleWithClassName = Database['public']['Tables']['schedules']['Row'] & {
    className?: string;
};

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<any>;
  logout: () => Promise<void>;
  updateUser: (data: { name?: string; avatar_url?: string; password?: string }) => Promise<any>;
  signup: (name: string, email: string, password?: string) => Promise<any>;
  enableScheduleNotifications: (schedule: ScheduleWithClassName[]) => Promise<boolean>;
  disableScheduleNotifications: () => Promise<void>;
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

  const setupServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) return null;

    // In development, ensure no SW interferes with Vite HMR or cached HTML
    if (import.meta && (import.meta as any).env && (import.meta as any).env.DEV) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames
            .filter((name) => name.startsWith('guru-pwa-cache-'))
            .map((name) => caches.delete(name)));
        }
      } catch (e) {
        console.warn('SW cleanup (dev) failed:', e);
      }
      return null;
    }

    try {
      // Unregister old service workers that might have been registered from blob URLs
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        if (registration.active && registration.active.scriptURL.startsWith('blob:')) {
          await registration.unregister();
        }
      }
      // Register the static service worker file
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  const enableScheduleNotifications = async (schedule: ScheduleWithClassName[]): Promise<boolean> => {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
          alert('Browser Anda tidak mendukung notifikasi.');
          return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
          alert('Izin notifikasi tidak diberikan.');
          return false;
      }
      
      const registration = await setupServiceWorker();
      if (registration && registration.active) {
          registration.active.postMessage({
              type: 'SCHEDULE_UPDATED',
              payload: schedule,
          });
          localStorage.setItem('scheduleNotificationsEnabled', 'true');
          return true;
      }
      return false;
  };

  const disableScheduleNotifications = async () => {
      if ('serviceWorker' in navigator) {
          try {
              const registration = await navigator.serviceWorker.getRegistration();
              if (registration && registration.active) {
                  registration.active.postMessage({ type: 'CLEAR_SCHEDULE' });
              }
          } catch (error) {
              console.error('Failed to clear notifications:', error);
          }
      }
      localStorage.removeItem('scheduleNotificationsEnabled');
  };

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
        await disableScheduleNotifications();
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
    enableScheduleNotifications,
    disableScheduleNotifications,
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
