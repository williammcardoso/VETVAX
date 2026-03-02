import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/vetvax";

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Mantido para compatibilidade com guards. Não exibimos UI de loading. */
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

  // Flags internas para evitar redirecionamentos prematuros (ex.: onboarding) antes de resolver o profile.
  const [initialized, setInitialized] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);

  const profileRef = useRef<Profile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const user = session?.user ?? null;

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      setProfileResolved(true);
      return;
    }

    const { profile: p, resolved } = await fetchProfileResolved(user.id, profileRef.current);
    if (resolved) setProfileResolved(true);
    if (resolved) setProfile(p);
  };

  useEffect(() => {
    let mounted = true;

    const sync = async (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setProfileResolved(true);
        return;
      }

      const { profile: p, resolved } = await fetchProfileResolved(nextSession.user.id, profileRef.current);
      if (!mounted) return;

      if (resolved) {
        setProfile(p);
        setProfileResolved(true);
      }
      // Se não resolveu, não força onboarding; mantém estado anterior (sem UI de loading).
    };

    const loadSession = async () => {
      const fallback = { data: { session: null as Session | null } };

      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 6000, fallback);
        if (!mounted) return;
        await sync(data.session);
      } catch {
        // Se falhar, não bloqueia UI; apenas marca init para não travar a navegação.
      } finally {
        if (mounted) setInitialized(true);
      }
    };

    loadSession();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      await sync(nextSession);
      if (mounted) setInitialized(true);
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

  // Não mostramos loader. "loading" serve apenas para os guards NÃO decidirem redirects antes da hora.
  const loading = !initialized || (!!user && !profileResolved);

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