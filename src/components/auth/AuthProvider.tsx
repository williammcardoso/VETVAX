import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let id: number | undefined;
  const t = new Promise<T>((resolve) => {
    id = window.setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, t]).finally(() => {
    if (id) window.clearTimeout(id);
  });
}

async function safeFetchProfile(userId: string, previous: Profile | null): Promise<Profile | null> {
  try {
    // undefined = timeout (distinguish from null = row not found)
    const result = await withTimeout(fetchMyProfile(userId), 6000, undefined as unknown as Profile | null);

    // If we timed out, keep the previous profile for the same user (prevents false onboarding redirects).
    if (result === (undefined as unknown as Profile | null)) {
      return previous?.id === userId ? previous : null;
    }

    return result;
  } catch {
    // On transient failures, keep the last known profile for the same user.
    return previous?.id === userId ? previous : null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const profileRef = useRef<Profile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const user = session?.user ?? null;

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const p = await safeFetchProfile(user.id, profileRef.current);
    setProfile(p);
  };

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      setLoading(true);
      const fallback = { data: { session: null as Session | null } };

      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 6000, fallback);
        if (!mounted) return;

        setSession(data.session);

        if (data.session?.user) {
          const p = await safeFetchProfile(data.session.user.id, profileRef.current);
          if (!mounted) return;
          setProfile(p);
        } else {
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSession();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // For refresh events, don't blank profile—keep last known if profile fetch is slow.
      setLoading(event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION");
      const p = await safeFetchProfile(nextSession.user.id, profileRef.current);
      if (!mounted) return;
      setProfile(p);
      setLoading(false);
    });

    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      loadSession();
    };

    document.addEventListener("visibilitychange", onVis);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVis);
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