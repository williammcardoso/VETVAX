import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";

export function RequireAuth({ children }: PropsWithChildren) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Nunca mostrar tela de "carregando" e nunca redirecionar durante sincronização inicial.
  if (loading) return null;

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return <>{children}</>;
}

export function RequireOnboarding({ children }: PropsWithChildren) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const location = useLocation();

  // Só decide onboarding quando a auth/profile foram resolvidos.
  if (loading) return null;

  // Se já tem organização, segue normalmente.
  if (profile?.org_id) return <>{children}</>;

  // Sem org: cria automaticamente em background (remove necessidade de onboarding manual).
  // Evita loop de criação.
  const [creating, setCreating] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    (async () => {
      setCreating(true);
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

      setCreating(false);
    })();
  }, [user, profile?.display_name, refreshProfile]);

  // Durante criação automática, não renderiza nem redireciona.
  if (creating) return null;

  // Se falhou por algum motivo, ainda permite onboarding manual como fallback.
  return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
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