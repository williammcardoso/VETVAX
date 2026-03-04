import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Branch } from "@/types/vetvax";

const schema = z.object({
  username: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .regex(/^[a-zA-Z0-9._-]+$/, "Use apenas letras, números, . _ -"),
  display_name: z.string().min(2, "Informe o nome"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["admin", "manager", "staff", "viewer"]).default("staff"),
  branch_id: z.string().optional().nullable(),
});

type Values = z.infer<typeof schema>;

export default function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
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

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      display_name: "",
      password: "",
      role: "staff",
      branch_id: "",
    },
  });

  const create = useMutation({
    mutationFn: async (values: Values) => {
      const { data: session } = await supabase.auth.getSession();
      const jwt = session.session?.access_token;
      if (!jwt) throw new Error("Sessão inválida");

      const res = await fetch("https://nocwkogecmwwpodoqaos.supabase.co/functions/v1/admin-create-user", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
          display_name: values.display_name,
          role: values.role,
          branch_id: values.branch_id ? values.branch_id : null,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Falha ao criar usuário");
      }

      return (await res.json()) as { ok: boolean; user_id: string; username: string };
    },
    onSuccess: async () => {
      toast({ title: "Usuário criado" });
      form.reset({ username: "", display_name: "", password: "", role: "staff", branch_id: "" });
      onCreated();
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Falha ao criar usuário", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[10px] max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-muted">
              <UserPlus className="h-4.5 w-4.5" />
            </span>
            Cadastrar usuário
          </DialogTitle>
        </DialogHeader>

        <form className="mt-2 grid gap-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <div className="grid gap-2">
            <Label>Usuário</Label>
            <Input className="h-10 rounded-[10px] border-[1.5px]" placeholder="ex: william" {...form.register("username")} />
            {form.formState.errors.username && <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input className="h-10 rounded-[10px] border-[1.5px]" placeholder="Ex: William Cardoso" {...form.register("display_name")} />
            {form.formState.errors.display_name && <p className="text-xs text-destructive">{form.formState.errors.display_name.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Senha</Label>
            <Input className="h-10 rounded-[10px] border-[1.5px]" type="password" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={form.watch("role")} onValueChange={(v) => form.setValue("role", v as any)}>
                <SelectTrigger className="h-10 rounded-[10px] border-[1.5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[10px]">
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="manager">manager</SelectItem>
                  <SelectItem value="staff">staff</SelectItem>
                  <SelectItem value="viewer">viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Filial</Label>
              <Select value={form.watch("branch_id") || "_none"} onValueChange={(v) => form.setValue("branch_id", v === "_none" ? "" : v)}>
                <SelectTrigger className="h-10 rounded-[10px] border-[1.5px]">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent className="rounded-[10px]">
                  <SelectItem value="_none">Sem filial</SelectItem>
                  {(branches.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" className="h-10 rounded-[10px]" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10 rounded-[10px]" disabled={create.isPending}>
              {create.isPending ? "Criando…" : "Criar usuário"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
