import { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";

export function RequireAuth({ children }: PropsWithChildren) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Nunca mostrar tela de "carregando". Se ainda estiver sincronizando a sessão,
  // apenas não renderiza nada por um instante.
  if (loading && !user) return null;

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
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading && !profile) return null;

  if (!profile?.org_id) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export function RequireRole({
  allow,
  children,
}: PropsWithChildren<{ allow: Array<"admin" | "manager" | "staff" | "viewer"> }>) {
  const { profile, loading } = useAuth();

  if (loading && !profile) return null;
  if (!profile || !allow.includes(profile.role)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}