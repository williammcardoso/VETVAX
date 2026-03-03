import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

export function RequireAuth({ children }: PropsWithChildren) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Mantém o layout visível enquanto o auth inicializa (evita a sensação de "topbar sumiu").
  if (loading) return <>{children}</>;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

export function RequireOnboarding({ children }: PropsWithChildren) {
  const { user, profile, loading, refreshProfile } = useAuth();

  const attemptedRef = useRef(false);
  const [attempting, setAttempting] = useState(false);

  // Política do VetVAX: nunca bloquear o uso do sistema com onboarding.
  // Se o usuário ainda não tiver org_id, tentamos criar automaticamente em background.
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (profile?.org_id) return;
    if (attemptedRef.current) return;

    attemptedRef.current = true;
    setAttempting(true);

    (async () => {
      const { error } = await supabase.rpc("onboard_create_org", {
        payload: {
          store_name: "VetVAX",
          branch_name: "Matriz",
          display_name: profile?.display_name ?? "",
          store_phone: "",
          timezone: "America/Sao_Paulo",
          branding: { brand: "vetvax" },
        },
      });

      if (!error) {
        await refreshProfile();
      }

      setAttempting(false);
    })();
  }, [loading, user, profile?.org_id, profile?.display_name, refreshProfile]);

  void attempting;

  return <>{children}</>;
}

export function RequireRole({
  allow,
  children,
}: PropsWithChildren<{ allow: Array<"admin" | "manager" | "staff" | "viewer"> }>) {
  const { profile, loading } = useAuth();

  if (loading) return null;
  if (!profile || !allow.includes(profile.role)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}