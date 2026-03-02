import { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card } from "@/components/ui/card";

function FullPageLoader({ title }: { title: string }) {
  return (
    <div className="min-h-[100svh] bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-sm p-6 rounded-2xl">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-4 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/2 bg-primary/80 animate-pulse" />
        </div>
      </Card>
    </div>
  );
}

export function RequireAuth({ children }: PropsWithChildren) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader title="Carregando sua sessão…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequireOnboarding({ children }: PropsWithChildren) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader title="Carregando sua organização…" />;

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

  if (loading) return <FullPageLoader title="Carregando permissões…" />;
  if (!profile || !allow.includes(profile.role)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
