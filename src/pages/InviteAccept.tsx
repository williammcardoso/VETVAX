import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Step = "idle" | "accepting" | "done" | "error";

export default function InviteAccept() {
  const [sp] = useSearchParams();
  const token = useMemo(() => sp.get("token") ?? "", [sp]);
  const nav = useNavigate();
  const { refreshProfile } = useAuth();

  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStep("error");
      setErrorMsg("Convite sem token.");
      return;
    }

    let cancelled = false;
    (async () => {
      setStep("accepting");
      setErrorMsg(null);

      const { data, error } = await supabase.rpc("accept_invite", { token });
      if (cancelled) return;

      if (error) {
        setStep("error");
        setErrorMsg(error.message);
        return;
      }

      setStep("done");
      await refreshProfile();
      toast({ title: "Convite aceito", description: "Acesso liberado." });
      nav("/dashboard", { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [token, nav, refreshProfile]);

  return (
    <div className="min-h-[100svh] bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-xl rounded-3xl p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" />
          Convite
        </div>

        {step === "accepting" && (
          <>
            <h1 className="mt-3 text-2xl font-semibold">Aceitando convite…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Estamos vinculando seu usuário à organização e aplicando o role do convite.
            </p>
            <div className="mt-6 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full w-2/3 bg-primary/80 animate-pulse" />
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold">
              <CheckCircle2 className="h-6 w-6" />
              Convite aceito
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Redirecionando…</p>
          </>
        )}

        {step === "error" && (
          <>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold">
              <XCircle className="h-6 w-6 text-destructive" />
              Não foi possível aceitar
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMsg ?? "Tente novamente."}</p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" className="rounded-2xl" onClick={() => nav("/dashboard")}
              >
                Ir ao dashboard
              </Button>
            </div>
          </>
        )}

        {step === "idle" && (
          <>
            <h1 className="mt-3 text-2xl font-semibold">Carregando…</h1>
          </>
        )}
      </Card>
    </div>
  );
}
