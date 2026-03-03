import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/vetvax";

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Mantido para compatibilidade com guards. */
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

async function fetchProfileResolved(
  userId: string,
  previous: Profile | null,
): Promise<{ profile: Profile | null; resolved: boolean }> {
  try {
    // undefined = timeout (distinguish from null = row not found)
    const result = await withTimeout(fetchMyProfile(userId), 6000, undefined as unknown as Profile | null);

    // Timeout: não conclui decisão; preserva profile anterior se for do mesmo usuário.
    if (result === (undefined as unknown as Profile | null)) {
      return { profile: previous?.id === userId ? previous : null, resolved: previous?.id === userId };
    }

    return { profile: result, resolved: true };
  } catch {
    // Erro transitório: idem timeout.
    return { profile: previous?.id === userId ? previous : null, resolved: previous?.id === userId };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Evita múltiplas leituras concorrentes do auth storage (causa os locks do supabase/gotrue-js)
  const syncingRef = useRef<Promise<void> | null>(null);

  const [initialized, setInitialized] = useState(false);

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

    const { profile: p, resolved } = await fetchProfileResolved(user.id, profileRef.current);
    if (resolved) setProfile(p);
  };

  useEffect(() => {
    let mounted = true;

    const sync = async (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        return;
      }

      const { profile: p, resolved } = await fetchProfileResolved(nextSession.user.id, profileRef.current);
      if (!mounted) return;
      if (resolved) setProfile(p);
    };

    const enqueueSync = (nextSession: Session | null) => {
      const run = async () => {
        await sync(nextSession);
        if (mounted) setInitialized(true);
      };

      // Serializa para não disparar concorrência (lock "steal")
      const next = (syncingRef.current ?? Promise.resolve())
        .catch(() => {
          // ignore
        })
        .then(run);

      syncingRef.current = next.finally(() => {
        if (syncingRef.current === next) syncingRef.current = null;
      });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      enqueueSync(nextSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Não bloqueamos a UI por profile (evita layout/topbar "sumir").
  const loading = !initialized;

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