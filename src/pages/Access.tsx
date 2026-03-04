import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Shield, UserCog, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import type { Branch, Invite, Profile, Role } from "@/types/vetvax";
import { dayjs } from "@/lib/datetime";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import CreateUserDialog from "@/components/access/CreateUserDialog";

function randomToken(bytes = 24) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  const b64 = btoa(String.fromCharCode(...buf));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const inviteSchema = z.object({
  email: z.string().email("Informe um email válido"),
  role: z.enum(["admin", "manager", "staff", "viewer"]),
  branch_id: z.string().optional().nullable(),
  expires_days: z.coerce.number().int().min(1).max(60).default(7),
});

type InviteValues = z.infer<typeof inviteSchema>;

export default function Access() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const branches = useQuery({
    queryKey: ["branches", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, org_id, name, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });

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

  const invites = useQuery({
    queryKey: ["access", "invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select(
          "id, org_id, email, role, branch_id, token, expires_at, accepted_at, is_active, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "staff",
      branch_id: "",
      expires_days: 7,
    },
  });

  const createInvite = useMutation({
    mutationFn: async (values: InviteValues) => {
      if (!profile?.org_id) throw new Error("Sem organização no perfil");

      const token = randomToken(32);
      const expiresAt = dayjs().add(values.expires_days ?? 7, "day").toISOString();

      const { error } = await supabase.from("invites").insert({
        org_id: profile.org_id,
        email: values.email.toLowerCase().trim(),
        role: values.role,
        branch_id: values.branch_id ? values.branch_id : null,
        token,
        expires_at: expiresAt,
      });

      if (error) throw error;
      return token;
    },
    onSuccess: async (token) => {
      await qc.invalidateQueries({ queryKey: ["access", "invites"] });
      setInviteOpen(false);
      form.reset({ email: "", role: "staff", branch_id: "", expires_days: 7 });

      const url = `${window.location.origin}/invite?token=${encodeURIComponent(token)}`;
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Convite criado", description: "Link copiado para a área de transferência." });
      } catch {
        toast({ title: "Convite criado", description: "Copie o link na lista de convites." });
      }
    },
    onError: (e: any) => {
      toast({ title: "Falha ao criar convite", description: e?.message, variant: "destructive" });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["access", "members"] });
      toast({ title: "Permissão atualizada" });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao atualizar", description: e?.message, variant: "destructive" });
    },
  });

  const deactivateInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invites").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["access", "invites"] });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao desativar", description: e?.message, variant: "destructive" });
    },
  });

  const rows = useMemo(() => members.data ?? [], [members.data]);
  const inviteRows = useMemo(() => invites.data ?? [], [invites.data]);

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          Admin
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Usuários e acessos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          RBAC por organização: admin, manager, staff, viewer. Convites geram um link para o usuário aceitar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                <div className="text-sm font-semibold">Membros</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Somente admin pode listar/alterar papéis.</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                {rows.length}
              </Badge>
              <Button variant="secondary" className="h-9 rounded-2xl" onClick={() => setCreateUserOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Novo usuário
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Usuário</TableHead>
                  <TableHead className="w-[160px]">Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={2}>
                        <Skeleton className="h-9 w-full rounded-xl" />
                      </TableCell>
                    </TableRow>
                  ))}

                {rows.map((m) => (
                  <TableRow key={m.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="text-sm font-medium">
                        {m.display_name ?? "Usuário"}
                        {m.id === profile?.id && (
                          <Badge className="ml-2 rounded-full" variant="secondary">
                            você
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.id}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={m.role}
                        onValueChange={(v) => updateRole.mutate({ id: m.id, role: v as Role })}
                        disabled={updateRole.isPending || m.id === profile?.id}
                      >
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="manager">manager</SelectItem>
                          <SelectItem value="staff">staff</SelectItem>
                          <SelectItem value="viewer">viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      {m.id === profile?.id ? (
                        <div className="mt-1 text-[11px] text-muted-foreground">você não pode mudar seu próprio role aqui</div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}

                {!members.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="py-10 text-center">
                      <div className="text-sm font-medium">Nenhum membro listado</div>
                      <p className="mt-1 text-xs text-muted-foreground">Verifique a policy de profiles (admin-only).</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="rounded-3xl p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                <div className="text-sm font-semibold">Convites</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Crie um convite e compartilhe o link.</div>
            </div>
            <Button className="rounded-2xl" onClick={() => setInviteOpen(true)}>
              Novo convite
            </Button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={3}>
                        <Skeleton className="h-9 w-full rounded-xl" />
                      </TableCell>
                    </TableRow>
                  ))}

                {inviteRows.map((inv) => {
                  const expired = dayjs(inv.expires_at).isBefore(dayjs());
                  const acceptUrl = `${window.location.origin}/invite?token=${encodeURIComponent(inv.token)}`;

                  return (
                    <TableRow key={inv.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="text-sm font-medium">{inv.email}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="secondary" className="rounded-full text-[11px]">
                            {inv.role}
                          </Badge>
                          {!inv.is_active && (
                            <Badge variant="secondary" className="rounded-full text-[11px]">
                              inativo
                            </Badge>
                          )}
                          {inv.accepted_at && <Badge className="rounded-full text-[11px]">aceito</Badge>}
                          {expired && !inv.accepted_at && (
                            <Badge variant="destructive" className="rounded-full text-[11px]">
                              expirado
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">expira em {dayjs(inv.expires_at).format("DD/MM/YYYY")}</div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {inv.accepted_at ? `aceito em ${dayjs(inv.accepted_at).format("DD/MM/YYYY HH:mm")}` : "pendente"}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-2xl"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(acceptUrl);
                                toast({ title: "Link copiado" });
                              } catch {
                                toast({ title: "Não foi possível copiar", description: acceptUrl });
                              }
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            className="rounded-2xl"
                            onClick={() => deactivateInvite.mutate(inv.id)}
                            disabled={deactivateInvite.isPending || !inv.is_active || !!inv.accepted_at}
                          >
                            Desativar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!invites.isLoading && inviteRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center">
                      <div className="text-sm font-medium">Nenhum convite</div>
                      <p className="mt-1 text-xs text-muted-foreground">Crie um convite para adicionar equipe à sua organização.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="rounded-3xl max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo convite</DialogTitle>
          </DialogHeader>

          <form className="mt-2 grid gap-4" onSubmit={form.handleSubmit((v) => createInvite.mutate(v))}>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input className="rounded-2xl" placeholder="pessoa@empresa.com" {...form.register("email")} />
              {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={form.watch("role")} onValueChange={(v) => form.setValue("role", v as Role)}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="manager">manager</SelectItem>
                    <SelectItem value="staff">staff</SelectItem>
                    <SelectItem value="viewer">viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Filial</Label>
                <Select value={form.watch("branch_id") || "_none"} onValueChange={(v) => form.setValue("branch_id", v === "_none" ? "" : v)}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="_none">Sem filial</SelectItem>
                    {(branches.data ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Expira (dias)</Label>
                <Input type="number" min={1} max={60} className="rounded-2xl" {...form.register("expires_days")} />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" className="rounded-2xl" onClick={() => setInviteOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-2xl" disabled={createInvite.isPending}>
                {createInvite.isPending ? "Criando…" : "Criar convite"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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