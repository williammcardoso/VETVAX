import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, UserCog, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/vetvax";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CreateUserDialog from "@/components/access/CreateUserDialog";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/vetvax/EmptyState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Access() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const [createUserOpen, setCreateUserOpen] = useState(false);

  const members = useQuery({
    queryKey: ["access", "members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, org_id, branch_id, role, display_name, created_at, updated_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const rows = useMemo(() => members.data ?? [], [members.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Acesso interno"
        title="Usuários"
        description="Gerencie acessos internos ao VetVAX."
        actions={
          <Button onClick={() => setCreateUserOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Novo usuário
          </Button>
        }
      />

      <Card className="rounded-card border border-vetvax-border-soft bg-white p-5 shadow-vetvax-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-vetvax-primary" />
            <p className="text-sm font-bold text-vetvax-text-main">Acessos ativos</p>
          </div>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>

        <div className="space-y-2">
          {members.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[74px] rounded-card-md" />)}
          {!members.isLoading &&
            rows.map((m) => (
              <article key={m.id} className="flex items-center justify-between rounded-card-md border border-vetvax-border-soft bg-vetvax-surface-alt p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-vetvax-primary-soft text-sm font-bold text-vetvax-primary">
                      {(m.display_name?.[0] ?? "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-vetvax-text-main">{m.display_name ?? "Usuário"}</p>
                      {m.id === profile?.id ? <Badge variant="outline">Você</Badge> : null}
                    </div>
                    <p className="text-xs text-vetvax-text-tertiary">{m.role === "admin" ? "Administrador" : "Operador"}</p>
                  </div>
                </div>
                <div className="hidden items-center gap-6 md:flex">
                  <span className="font-mono text-xs text-vetvax-text-tertiary">{m.id.slice(0, 8)}</span>
                  <span className="text-xs text-vetvax-text-tertiary">{new Date(m.created_at).toLocaleDateString("pt-BR")}</span>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))}

          {!members.isLoading && rows.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum usuário listado" description="Crie o primeiro usuário para sua organização." />
          ) : null}
        </div>
      </Card>

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onCreated={async () => {
          await qc.invalidateQueries({ queryKey: ["access", "members"] });
        }}
      />
    </div>
  );
}