import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>; // Added
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Define refreshUserProfile as a stable callback
  const refreshUserProfile = useCallback(async () => {
    if (!user) {
      console.warn("No user available to refresh profile.");
      return;
    }

    if (!supabase || !isSupabaseConfigured) {
        console.error("Supabase not configured, cannot refresh user profile.");
        return;
    }

    try {
        console.log("Attempting to fetch user profile for ID:", user.id); // Added log
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error("Error fetching user profile:", error, error.message); // Modified log
            // If profile not found, create a default one
            if (error.code === 'PGRST116' || error.message.includes('rows returned')) { // No rows found
                console.info("User profile not found, attempting to create a default.");
                const defaultDisplayName = user.email || 'New User';
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({ id: user.id, display_name: defaultDisplayName });

                if (insertError) {
                    console.error("Error creating default user profile:", insertError);
                    return;
                }
                // Update local user state with the newly created profile data
                setUser((currentUser) => {
                    if (!currentUser) return null;
                    return {
                        ...currentUser,
                        user_metadata: {
                            ...currentUser.user_metadata,
                            display_name: defaultDisplayName,
                        },
                    };
                });
            }
            return;
        }

        if (profile) {
            setUser((currentUser) => {
                if (!currentUser) return null;
                return {
                    ...currentUser,
                    user_metadata: {
                        ...currentUser.user_metadata,
                        display_name: profile.display_name,
                    },
                };
            });
        }
    } catch (e) {
        console.error("Unexpected error during profile refresh:", e);
    }
  }, [user, supabase, isSupabaseConfigured]); // Dependencies for useCallback

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
            await refreshUserProfile(); // Refresh profile after user is set
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
          await refreshUserProfile(); // Refresh profile after user is set
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [refreshUserProfile]); // refreshUserProfile is now a stable dependency

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase || !isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured') };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUpWithEmail = async (email: string, password: string, fullName?: string) => {
    if (!supabase || !isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured') };
    }
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName || email },
      },
    });
    return { error: error as Error | null };
  };

  const signInWithMagicLink = async (email: string) => {
    if (!supabase || !isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured') };
    }
    const redirectUrl = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl },
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    if (!supabase || !isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured') };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (!supabase || !isSupabaseConfigured) {
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithMagicLink,
        signInWithGoogle,
        signOut,
        refreshUserProfile, // Expose refreshUserProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
