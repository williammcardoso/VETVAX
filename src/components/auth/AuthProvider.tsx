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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let id: number | undefined;
  const t = new Promise<T>((resolve) => {
    id = window.setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, t]).finally(() => {
    if (id) window.clearTimeout(id);
  });
}

async function safeFetchProfile(userId: string) {
  try {
    return await withTimeout(fetchMyProfile(userId), 6000, null);
  } catch {
    return null;
  }
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

    const p = await safeFetchProfile(user.id);
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
          const p = await safeFetchProfile(data.session.user.id);
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

      // Evita travar a UI em refresh/token events: sempre finalizamos loading via timeouts.
      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Para SIGNED_IN e refresh de token, buscamos profile mas com timeout.
      setLoading(event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION");
      const p = await safeFetchProfile(nextSession.user.id);
      if (!mounted) return;
      setProfile(p);
      setLoading(false);
    });

    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      // Ao voltar para a aba, re-sincroniza sem bloquear indefinidamente.
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