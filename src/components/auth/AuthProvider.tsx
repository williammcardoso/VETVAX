import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/vetvax";

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, org_id, branch_id, role, display_name, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

function timeout(ms: number) {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Auth init timeout")), ms);
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const p = await fetchMyProfile(user.id);
    setProfile(p);
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const { data } = await Promise.race([supabase.auth.getSession(), timeout(6000)]);
        if (!mounted) return;
        setSession(data.session);

        if (data.session?.user) {
          try {
            const p = await fetchMyProfile(data.session.user.id);
            if (!mounted) return;
            setProfile(p);
          } catch {
            // Profile pode falhar por RLS/migração; ainda assim não travamos a UI.
            if (mounted) setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } catch {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setLoading(true);
      try {
        if (nextSession?.user) {
          try {
            const p = await fetchMyProfile(nextSession.user.id);
            setProfile(p);
          } catch {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo<AuthState>(
    () => ({
      session,
      user,
      profile,
      loading,
      refreshProfile,
      signOut,
    }),
    [session, user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}