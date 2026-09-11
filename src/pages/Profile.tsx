import { useEffect, useMemo, useState } from "react";
import { KeyRound, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente.";
}

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  const username = useMemo(() => {
    const email = user?.email ?? "";
    return email.endsWith("@vetvax.local") ? email.replace("@vetvax.local", "") : email;
  }, [user?.email]);

  const updateName = useMutation({
    mutationFn: async () => {
      const name = displayName.trim();
      if (!profile?.id) throw new Error("Perfil não encontrado");
      if (name.length < 2) throw new Error("Informe um nome com pelo menos 2 caracteres");

      const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast({ title: "Perfil atualizado" });
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao atualizar perfil", description: getErrorMessage(e), variant: "destructive" });
    },
  });

  const updatePassword = useMutation({
    mutationFn: async () => {
      if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");
      if (password !== confirmPassword) throw new Error("As senhas não conferem");

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      setPassword("");
      setConfirmPassword("");
      toast({ title: "Senha atualizada" });
    },
    onError: (e: unknown) => {
      toast({ title: "Falha ao alterar senha", description: getErrorMessage(e), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Conta"
        title="Meu perfil"
        description="Atualize seus dados de acesso, identidade e segurança no VetVAX."
        actions={<Badge variant="info">Acesso interno</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[16px] border border-vetvax-border-soft bg-gradient-to-br from-white to-vetvax-surface-panel/60 p-4 shadow-vetvax-card ring-1 ring-black/[0.02] sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-vetvax-info-soft text-vetvax-info">
              <User className="h-4 w-4" />
            </span>
            <div className="text-sm font-semibold">Dados do usuário</div>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <Label>Usuário</Label>
              <Input className="h-10" value={username} readOnly />
              <p className="text-xs text-muted-foreground">Para alterar o usuário, crie outro usuário na tela Usuários.</p>
            </div>

            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input
                className="h-10"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>

            <div className="flex justify-end">
              <Button className="h-10 min-w-[140px]" onClick={() => updateName.mutate()} disabled={updateName.isPending}>
                {updateName.isPending ? "Salvando..." : "Salvar nome"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="rounded-[16px] border border-vetvax-border-soft bg-gradient-to-br from-white to-vetvax-surface-panel/60 p-4 shadow-vetvax-card ring-1 ring-black/[0.02] sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-vetvax-warning-soft text-vetvax-warning">
              <KeyRound className="h-4 w-4" />
            </span>
            <div className="text-sm font-semibold">Alterar senha</div>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <Label>Nova senha</Label>
              <Input
                className="h-10"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Confirmar nova senha</Label>
              <Input
                className="h-10"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button className="h-10 min-w-[140px]" onClick={() => updatePassword.mutate()} disabled={updatePassword.isPending}>
                {updatePassword.isPending ? "Alterando..." : "Alterar senha"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
